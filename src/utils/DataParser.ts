/**
 * DataParser - Transforma dados brutos do Google Sheets em objetos CampaignRecord tipados
 * 
 * Este parser gerencia:
 * - Conversão de linhas brutas da planilha para objetos de domínio tipados
 * - Parsing de datas, números e enums com validação
 * - Tratamento de dados esparsos (colunas condicionais de estado/cidade)
 * - Extração de mapeamentos CSR/CSA de 12 colunas específicas de CSR
 * - Tratamento gracioso de erros para dados malformados
 */

import type {
    RawSheetRow,
    CampaignRecord,
    FilterOptions,
    ServiceStructure,
    ActivityFormat,
    CSRCSAMap,
    MaterialsDistributed,
    DataIssues
} from '../types';

/**
 * Erro de parsing. Quando descarta uma resposta, a mensagem completa a frase
 * "N respostas …" do aviso do painel (ex.: "sem “Data” válida").
 */
export class DataParseError extends Error {
    public readonly rowId?: string;
    public readonly field?: string;

    constructor(message: string, rowId?: string, field?: string) {
        super(message);
        this.name = 'DataParseError';
        this.rowId = rowId;
        this.field = field;
    }
}

/**
 * Estados brasileiros (todos os 27 estados)
 */
const BRAZILIAN_STATES = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
] as const;

/**
 * Data com barras, como a planilha formata: "04/11/2025" ou "04/11/2025 21:32:38".
 * Se o dia ou o mês vem primeiro depende da localidade da planilha (isMonthFirst).
 */
const SLASH_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * A API entrega as datas como texto, formatadas na localidade da planilha. Em
 * Português (Brasil) é 23/09/2026; em inglês (EUA) é 9/23/2026. Pergunta ao Intl
 * em que ordem a localidade escreve dia e mês.
 */
function isMonthFirst(sheetLocale: string): boolean {
    try {
        const order = new Intl.DateTimeFormat(sheetLocale.replace('_', '-'))
            .formatToParts(new Date(2000, 11, 31))
            .map(part => part.type);
        return order.indexOf('month') < order.indexOf('day');
    } catch {
        // Localidade que o Intl não conhece: fica com o padrão brasileiro
        return false;
    }
}

/**
 * Nomes dos CSRs para mapeamento
 */
const CSR_NAMES = [
    'CSR 10 Brasil',
    'CSR Brasil',
    'CSR Brasil Central',
    'CSR Brasil Sul',
    'CSR Grande São Paulo',
    'CSR HOW Brasil',
    'CSR Minas',
    'CSR Nordeste',
    'CSR Rio de Janeiro',
    'CSR Rio Grande do Sul',
    'CSR Terra do Sol',
    'CSR UAI'
] as const;

/**
 * O cabeçalho da planilha é o título da pergunta no formulário, e quem edita o
 * formulário muda maiúsculas e espaços sem perceber ("Pasta RP  - apenas número",
 * "Selecione a Cidade - AP"). As colunas são procuradas por esta chave, que ignora
 * essas diferenças.
 */
function columnKey(header: string): string {
    return header.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Reindexa a linha pela chave de coluna. Se dois cabeçalhos caem na mesma chave,
 * fica o que tem valor: cada resposta preenche só uma das duas perguntas.
 */
function byColumnKey(row: RawSheetRow): RawSheetRow {
    const keyed: RawSheetRow = {};
    for (const [header, value] of Object.entries(row)) {
        const key = columnKey(header);
        const current = keyed[key];
        if (current === undefined || current === null || current === '') {
            keyed[key] = value;
        }
    }
    return keyed;
}

/**
 * Classe DataParser para transformar dados brutos da planilha
 */
export class DataParser {
    private readonly monthFirst: boolean;
    /** Colunas que o parser procurou (chave → título), para achar as que sumiram */
    private requestedColumns = new Map<string, string>();
    private issues: DataIssues = { missingColumns: [], skippedResponses: [] };

    /**
     * @param sheetLocale Localidade da planilha (ex.: "pt_BR"), que a API informa
     */
    constructor(sheetLocale = 'pt_BR') {
        this.monthFirst = isMonthFirst(sheetLocale);
    }

    /**
     * Processa linhas brutas da planilha em objetos CampaignRecord tipados.
     * Respostas inválidas ficam de fora, e o motivo vai para getIssues().
     */
    parse(rows: RawSheetRow[]): CampaignRecord[] {
        this.requestedColumns.clear();
        this.issues = { missingColumns: [], skippedResponses: [] };
        const records: CampaignRecord[] = [];

        if (rows.length === 0) {
            return records;
        }

        this.validateSchema(rows);

        const skipped = new Map<string, number>();
        for (const row of rows) {
            try {
                records.push(this.parseRow(row));
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
            }
        }

        // Toda linha tem os mesmos cabeçalhos (os da aba), então a primeira basta
        const present = byColumnKey(rows[0]);
        this.issues = {
            // ID_Resposta vem do script da planilha, não do formulário: faltar não é pergunta sumida
            missingColumns: [...this.requestedColumns]
                .filter(([key]) => !(key in present) && key !== columnKey('ID_Resposta'))
                .map(([, title]) => title),
            skippedResponses: [...skipped].map(([reason, count]) => ({ reason, count }))
        };

        return records;
    }

    /**
     * Processa uma única linha em um CampaignRecord
     * @throws {DataParseError} Se campos obrigatórios estiverem ausentes ou inválidos
     */
    parseRow(sheetRow: RawSheetRow): CampaignRecord {
        const row = byColumnKey(sheetRow);

        // O ID_Resposta não vem do formulário: é preenchido por um script na
        // planilha, que chega vazio nas respostas mais recentes. Como ele não
        // identifica nada na interface, uma resposta válida nunca deve ser
        // descartada por falta dele.
        const responseId = this.getString(row, 'ID_Resposta');

        // Processa todos os campos com tratamento de erro apropriado
        const timestamp = this.parseDate(this.cell(row, 'Carimbo de data/hora'));
        if (!timestamp) {
            throw new DataParseError('sem “Carimbo de data/hora” válido', responseId ?? undefined, 'Carimbo de data/hora');
        }

        // ponytail: dois envios no mesmo segundo colidiriam. O id não é usado
        // como chave em lugar nenhum, então basta ser estável entre recargas.
        const id = responseId ?? `sem-id-${timestamp.getTime()}`;

        const selectedCSR = this.getRequiredString(row, 'Selecione o CSR');
        const stateRaw = this.getRequiredString(row, 'Selecione o Estado');

        // Extrai a sigla do estado do formato "Nome do Estado (XX)" ou apenas "XX"
        const state = this.extractStateCode(stateRaw);

        // Valida o estado
        if (!state || !BRAZILIAN_STATES.includes(state as typeof BRAZILIAN_STATES[number])) {
            throw new DataParseError(`com o estado “${stateRaw}”, que o painel não reconhece`, id, 'Selecione o Estado');
        }

        // Processa o mapeamento CSR/CSA
        const csrCSAMap = this.parseCSRCSAMap(row);

        // Processa a cidade condicional baseada no estado
        const city = this.parseConditionalCity(row, state);

        // Processa a data da atividade
        const activityDate = this.parseDate(this.cell(row, 'Data'));
        if (!activityDate) {
            throw new DataParseError('sem “Data” válida', id, 'Data');
        }

        // Processa a estrutura de serviço
        const structureRaw = this.cell(row, 'Qual Estrutura Prestou Atividade');
        const serviceStructure = this.parseServiceStructure(structureRaw);
        if (!serviceStructure) {
            throw this.unknownOption('Qual Estrutura Prestou Atividade', structureRaw, id);
        }

        // Processa o formato da atividade
        const formatRaw = this.cell(row, 'Formato do Atendimento');
        const activityFormat = this.parseActivityFormat(formatRaw);
        if (!activityFormat) {
            throw this.unknownOption('Formato do Atendimento', formatRaw, id);
        }

        // Processa os materiais
        const materials = this.parseMaterials(row);

        // Constrói o registro completo
        const record: CampaignRecord = {
            id,
            timestamp,
            email: this.getString(row, 'Email') || '',
            name: this.getString(row, 'Nome') || '',
            phone: this.getString(row, 'Telefone') || '',
            position: this.getString(row, 'Encargo na Irmandade') || '',
            selectedCSR,
            csrCSAMap,
            state,
            city,
            activityDate,
            activityTime: this.getString(row, 'Horário') || '',
            serviceStructure,
            activityFormat,
            institution: this.getString(row, 'Nome da Instituição / Grupo') || '',
            activityType: this.getString(row, 'Tipo de Atividade') || '',
            activityDescription: this.getString(row, 'Qual atividade realizada?') || '',
            speakersCount: this.parseNumber(this.cell(row, 'Quantidade de Oradores/Servidores')) || 0,
            participantsCount: this.parseNumber(this.cell(row, 'Quantidade de Participantes')) || 0,
            audienceReached: this.parseNumber(this.cell(row, 'Quantidade de Público Atingido')) || 0,
            serviceCost: this.parseNumber(this.cell(row, 'Custo do Serviço')) || 0,
            materials,
            observations: this.getString(row, 'Alguma observação?') || ''
        };

        return record;
    }

    /**
     * Extrai opções de filtro únicas dos registros processados
     */
    extractFilterOptions(records: CampaignRecord[]): FilterOptions {
        const csasSet = new Set<string>();
        const csrsSet = new Set<string>();
        const statesSet = new Set<string>();
        const citiesSet = new Set<string>();
        const activityTypesSet = new Set<string>();

        for (const record of records) {
            // Adiciona CSR
            if (record.selectedCSR) {
                csrsSet.add(record.selectedCSR);
            }

            // Adiciona CSAs do mapa
            Object.values(record.csrCSAMap).forEach(csa => {
                if (csa) {
                    csasSet.add(csa);
                }
            });

            // Adiciona estado
            if (record.state) {
                statesSet.add(record.state);
            }

            // Adiciona cidade
            if (record.city) {
                citiesSet.add(record.city);
            }

            // Adiciona tipo de atividade
            if (record.activityType) {
                activityTypesSet.add(record.activityType);
            }
        }

        return {
            csas: Array.from(csasSet).sort(),
            csrs: Array.from(csrsSet).sort(),
            states: Array.from(statesSet).sort(),
            cities: Array.from(citiesSet).sort(),
            activityTypes: Array.from(activityTypesSet).sort()
        };
    }

    /**
     * O que a última chamada de parse() não conseguiu levar ao painel
     */
    getIssues(): DataIssues {
        return this.issues;
    }

    // ========================================================================
    // Métodos Auxiliares Privados
    // ========================================================================

    /**
     * Valida que as colunas obrigatórias existem no dataset
     */
    private validateSchema(rows: RawSheetRow[]): void {
        // Só perguntas do formulário. ID_Resposta fica de fora: é do script da
        // planilha, e uma aba nova (formulário religado) nasce sem essa coluna.
        const requiredColumns = [
            'Carimbo de data/hora',
            'Selecione o CSR',
            'Selecione o Estado',
            'Data',
            'Qual Estrutura Prestou Atividade',
            'Tipo de Atividade'
        ];

        if (rows.length === 0) {
            throw new DataParseError('Planilha vazia ou sem dados');
        }

        const firstRow = byColumnKey(rows[0]);
        const missingColumns = requiredColumns.filter(col => !(columnKey(col) in firstRow));

        if (missingColumns.length > 0) {
            throw new DataParseError(
                `A planilha não tem ${missingColumns.length === 1 ? 'a pergunta' : 'as perguntas'} ` +
                `${missingColumns.map(col => `“${col}”`).join(', ')}, e o painel não funciona sem ` +
                `${missingColumns.length === 1 ? 'ela' : 'elas'}. Se alguém mudou o texto no formulário, ` +
                'volte o texto antigo ou peça a quem cuida do painel para ajustá-lo.'
            );
        }
    }

    /**
     * Erro de uma resposta com uma opção que o painel não conhece (ex.: alguém
     * criou a opção "Remoto" no formulário) ou sem resposta nessa pergunta
     */
    private unknownOption(column: string, raw: unknown, id: string): DataParseError {
        const value = raw === null || raw === undefined ? '' : String(raw).trim();
        const reason = value
            ? `com a opção “${value}” em “${column}”, que o painel não conhece`
            : `sem “${column}”`;
        return new DataParseError(reason, id, column);
    }

    /**
     * Extrai o código do estado de formatos como "Paraná (PR)" ou apenas "PR"
     */
    private extractStateCode(value: string): string | null {
        if (!value) return null;

        const trimmed = value.trim();

        // Verifica se já é apenas o código (2 letras maiúsculas)
        if (/^[A-Z]{2}$/.test(trimmed)) {
            return trimmed;
        }

        // Extrai do formato "Nome do Estado (XX)"
        const match = trimmed.match(/\(([A-Z]{2})\)$/);
        if (match) {
            return match[1];
        }

        return null;
    }

    /**
     * Obtém um campo string obrigatório, lança erro se ausente
     */
    private getRequiredString(row: RawSheetRow, field: string): string {
        const value = this.cell(row, field);
        if (value === null || value === undefined || value === '') {
            throw new DataParseError(`sem “${field}”`);
        }
        return String(value).trim();
    }

    /**
     * Obtém um campo string opcional
     */
    private getString(row: RawSheetRow, field: string): string | null {
        const value = this.cell(row, field);
        if (value === null || value === undefined || value === '') {
            return null;
        }
        return String(value).trim();
    }

    /**
     * Lê uma coluna pelo título da pergunta, numa linha já passada por byColumnKey
     */
    private cell(row: RawSheetRow, column: string): string | number | null | undefined {
        const key = columnKey(column);
        this.requestedColumns.set(key, column);
        return row[key];
    }

    /**
     * Processa uma data de vários formatos
     *
     * Datas com barras precisam de parsing explícito: `new Date()` sempre lê
     * mm/dd/aaaa, e numa planilha brasileira erraria sem avisar todo dia até 12
     * ("04/11/2025" viraria 11 de abril) e rejeitaria o resto ("23/02/2026").
     * A ordem de dia e mês vem da localidade da planilha (construtor).
     */
    parseDate(value: unknown): Date | null {
        if (!value || value === '') {
            return null;
        }

        // Tenta processar como objeto Date
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? null : value;
        }

        // Tenta processar como string
        const str = String(value).trim();

        const slash = str.match(SLASH_DATE_PATTERN);
        if (slash) {
            const [, first, second, year, hours = '0', minutes = '0', seconds = '0'] = slash;
            const [day, month] = this.monthFirst ? [second, first] : [first, second];
            const date = new Date(+year, +month - 1, +day, +hours, +minutes, +seconds);

            // Descarta datas inexistentes (31/02), que o Date rolaria para março
            return date.getMonth() === +month - 1 && date.getDate() === +day ? date : null;
        }

        // Demais formatos (ISO, por exemplo) seguem pelo parser nativo
        const date = new Date(str);

        if (isNaN(date.getTime())) {
            return null;
        }

        return date;
    }

    /**
     * Processa um número de vários formatos
     */
    parseNumber(value: unknown): number | null {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        // Se já for um número
        if (typeof value === 'number') {
            return isNaN(value) ? null : value;
        }

        // Tenta processar como string
        const str = String(value).trim();

        // Remove formatação comum (separadores de milhar, símbolos de moeda)
        const cleaned = str.replace(/[R$\s.]/g, '').replace(',', '.');
        const num = Number(cleaned);

        if (isNaN(num)) {
            return null;
        }

        return num;
    }

    /**
     * Processa o enum de estrutura de serviço com correspondência flexível
     */
    private parseServiceStructure(value: unknown): ServiceStructure | null {
        if (!value) return null;

        const str = String(value).trim().toLowerCase();

        // Mapeia variações para valores padrão
        if (str === 'subcomite' || str === 'sub-comite' || str === 'sub-comitê' || str === 'subcomitê') {
            return 'Sub-comitê';
        }
        if (str === 'oficina') {
            return 'Oficina';
        }
        if (str === 'area' || str === 'área') {
            return 'Área';
        }
        if (str === 'outros' || str === 'outro') {
            return 'Outros';
        }

        return null;
    }

    /**
     * Processa o enum de formato de atividade com correspondência flexível
     */
    private parseActivityFormat(value: unknown): ActivityFormat | null {
        if (!value) return null;

        const str = String(value).trim().toLowerCase();

        // Mapeia variações para valores padrão
        if (str === 'presencial') {
            return 'Presencial';
        }
        if (str === 'hibrido' || str === 'híbrido' || str === 'hybr ido') {
            return 'Híbrido';
        }
        if (str === 'virtual') {
            return 'Virtual';
        }
        if (str === 'online') {
            return 'Online';
        }

        return null;
    }

    /**
     * Processa o mapeamento CSR/CSA de 12 colunas específicas de CSR
     */
    private parseCSRCSAMap(row: RawSheetRow): CSRCSAMap {
        const map: CSRCSAMap = {};

        for (const csrName of CSR_NAMES) {
            const columnName = `${csrName} - Selecione o CSA`;
            const value = this.getString(row, columnName);

            if (value) {
                map[csrName] = value;
            }
        }

        return map;
    }

    /**
     * Processa a coluna condicional de cidade baseada no estado selecionado
     */
    private parseConditionalCity(row: RawSheetRow, state: string): string | null {
        // Uma pergunta de cidade por estado; columnKey já cobre "Cidade" com C maiúsculo
        return this.getString(row, `Selecione a cidade - ${state}`);
    }

    /**
     * Processa os materiais distribuídos de múltiplas colunas
     */
    private parseMaterials(row: RawSheetRow): MaterialsDistributed {
        return {
            cartazes: this.parseNumber(this.cell(row, 'Cartazes - apenas número')) || 0,
            panfletos: this.parseNumber(this.cell(row, 'Panfletos - apenas número')) || 0,
            listaGrupos: this.parseNumber(this.cell(row, 'Lista de Grupos - apenas número')) || 0,
            cartao: this.parseNumber(this.cell(row, 'Cartão - apenas número')) || 0,
            folder: this.parseNumber(this.cell(row, 'Folder - apenas número')) || 0,
            ips: this.parseNumber(this.cell(row, 'IPs - Folhetos - apenas número')) || 0,
            textoBasico: this.parseNumber(this.cell(row, 'Texto Básico - apenas número')) || 0,
            pastaRP: this.parseNumber(this.cell(row, 'Pasta RP - apenas número')) || 0,
            lixoCar: this.parseNumber(this.cell(row, 'Lixo Car - apenas número')) || 0,
            calendario: this.parseNumber(this.cell(row, 'Calendário - apenas número')) || 0,
            outros: this.parseNumber(this.cell(row, 'Outros Materiais')) || 0
        };
    }
}

/**
 * Função factory para criar uma instância de DataParser
 */
export function createDataParser(): DataParser {
    return new DataParser();
}
