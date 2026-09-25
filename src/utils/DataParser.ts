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
    MaterialsDistributed
} from '../types';

/**
 * Classe de erro customizada para erros de parsing de dados
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
 * Data no padrão brasileiro gravado pela planilha: dd/mm/aaaa, com hora opcional
 * ("04/11/2025" ou "04/11/2025 21:32:38")
 */
const BR_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

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
    private warnings: string[] = [];

    /**
     * Processa linhas brutas da planilha em objetos CampaignRecord tipados
     * Ignora registros inválidos e registra avisos
     */
    parse(rows: RawSheetRow[]): CampaignRecord[] {
        this.warnings = [];
        const records: CampaignRecord[] = [];

        if (rows.length === 0) {
            console.warn('DataParser: Nenhuma linha para processar');
            return records;
        }

        // Valida o schema
        try {
            this.validateSchema(rows);
        } catch (error) {
            console.error('DataParser: Falha na validação do schema', error);
            throw error;
        }

        // Processa cada linha
        for (const row of rows) {
            try {
                const record = this.parseRow(row);
                records.push(record);
            } catch (error) {
                const rowId = this.getString(byColumnKey(row), 'ID_Resposta') || 'desconhecido';
                const message = error instanceof Error ? error.message : String(error);
                this.warnings.push(`Registro ${rowId}: ${message}`);
                console.warn(`DataParser: Ignorando linha inválida ${rowId}`, error);
            }
        }

        // Registra resumo se houver avisos
        if (this.warnings.length > 0) {
            console.warn(
                `DataParser: ${this.warnings.length} registro(s) foram ignorados devido a dados inválidos.`
            );
        }

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
            throw new DataParseError('Timestamp inválido', responseId ?? undefined, 'Carimbo de data/hora');
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
            throw new DataParseError(`Estado inválido: ${stateRaw}`, id, 'Selecione o Estado');
        }

        // Processa o mapeamento CSR/CSA
        const csrCSAMap = this.parseCSRCSAMap(row);

        // Processa cidade/bairro condicionais baseados no estado
        const city = this.parseConditionalCity(row, state);
        const neighborhood = this.parseConditionalNeighborhood(row, state);

        // Processa a data da atividade
        const activityDate = this.parseDate(this.cell(row, 'Data'));
        if (!activityDate) {
            throw new DataParseError('Data da atividade inválida', id, 'Data');
        }

        // Processa a estrutura de serviço
        const serviceStructure = this.parseServiceStructure(this.cell(row, 'Qual Estrutura Prestou Atividade'));
        if (!serviceStructure) {
            throw new DataParseError('Estrutura de serviço inválida', id, 'Qual Estrutura Prestou Atividade');
        }

        // Processa o formato da atividade
        const activityFormat = this.parseActivityFormat(this.cell(row, 'Formato do Atendimento'));
        if (!activityFormat) {
            throw new DataParseError('Formato de atividade inválido', id, 'Formato do Atendimento');
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
            neighborhood,
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
     * Retorna os avisos da última operação de parsing
     */
    getWarnings(): string[] {
        return [...this.warnings];
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
                `Colunas obrigatórias ausentes: ${missingColumns.join(', ')}`
            );
        }
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
            throw new DataParseError(`Campo obrigatório ausente: ${field}`);
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
        return row[columnKey(column)];
    }

    /**
     * Processa uma data de vários formatos
     *
     * A planilha grava no padrão brasileiro (dd/mm/aaaa, hora opcional), que
     * precisa de parsing explícito: `new Date()` lê barras como mm/dd/aaaa e
     * erra silenciosamente todo dia menor ou igual a 12 ("04/11/2025" viraria
     * 11 de abril) ou devolve Invalid Date acima disso ("23/02/2026").
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

        const br = str.match(BR_DATE_PATTERN);
        if (br) {
            const [, day, month, year, hours = '0', minutes = '0', seconds = '0'] = br;
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
        // Tenta correspondência exata primeiro
        const exactColumn = `Selecione a cidade - ${state}`;
        let value = this.getString(row, exactColumn);

        if (value) {
            return value;
        }

        // Tenta variações com colchetes
        const bracketColumn = `Selecione a cidade - [${state}]`;
        value = this.getString(row, bracketColumn);

        if (value) {
            return value;
        }

        // Tenta sem hífen
        const noDashColumn = `Selecione a cidade ${state}`;
        value = this.getString(row, noDashColumn);

        return value;
    }

    /**
     * Processa a coluna condicional de bairro baseada no estado selecionado
     */
    private parseConditionalNeighborhood(row: RawSheetRow, state: string): string | null {
        // Tenta correspondência exata primeiro
        const exactColumn = `Qual o bairro? (${state})`;
        let value = this.getString(row, exactColumn);

        if (value) {
            return value;
        }

        // Tenta variações com colchetes
        const bracketColumn = `Qual o bairro? [${state}]`;
        value = this.getString(row, bracketColumn);

        if (value) {
            return value;
        }

        // Tenta sem parênteses
        const noParenColumn = `Qual o bairro? ${state}`;
        value = this.getString(row, noParenColumn);

        return value;
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
            folhetos: this.parseNumber(this.cell(row, 'Folhetos - apenas número')) || 0,
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
