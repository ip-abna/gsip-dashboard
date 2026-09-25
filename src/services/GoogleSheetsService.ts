/**
 * GoogleSheetsService - Gerencia a busca de dados da API do Google Sheets v4
 * 
 * Este serviço fornece acesso somente leitura a uma planilha pública do Google Sheets
 * contendo dados de campanhas da ABNA. Inclui validação de configuração, tratamento
 * de erros e mensagens de erro descritivas.
 */

import type { GoogleSheetsConfig, RawSheetRow, SheetData } from '../types';

/**
 * Só os campos da planilha que o painel pede à API (fields=...)
 */
interface SpreadsheetMeta {
    properties?: { locale?: string };
    sheets?: { properties: { title: string } }[];
}

/**
 * Aba que o Google cria ao vincular um formulário: "Respostas ao formulário 4",
 * ou "Form Responses 4" se quem vinculou usa o Google em inglês
 */
const FORM_RESPONSES_TAB = /^(respostas ao formulário|form responses)\s+(\d+)$/i;

/**
 * Escolhe a aba de respostas mais nova. Ao vincular um formulário, o Google copia
 * todas as respostas que o formulário guarda para uma aba nova, e as abas antigas
 * param de receber respostas. A de número maior é sempre a completa.
 */
export function newestResponsesTab(titles: string[]): string | null {
    let newest: string | null = null;
    let highest = -1;
    for (const title of titles) {
        const match = title.trim().match(FORM_RESPONSES_TAB);
        if (match && Number(match[2]) > highest) {
            highest = Number(match[2]);
            newest = title;
        }
    }
    return newest;
}

/**
 * Classe de erro customizada para erros da API do Google Sheets
 */
export class GoogleSheetsError extends Error {
    public readonly statusCode?: number;
    public readonly originalError?: unknown;

    constructor(
        message: string,
        statusCode?: number,
        originalError?: unknown
    ) {
        super(message);
        this.name = 'GoogleSheetsError';
        this.statusCode = statusCode;
        this.originalError = originalError;
    }
}

/**
 * Classe de serviço para buscar dados da API do Google Sheets
 */
export class GoogleSheetsService {
    private config: GoogleSheetsConfig;
    private baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';

    constructor(config: GoogleSheetsConfig) {
        this.config = config;
        this.validateConfig();
    }

    /**
     * Valida a configuração do Google Sheets
     * @throws {GoogleSheetsError} Se a configuração for inválida
     */
    validateConfig(): void {
        const { apiKey, spreadsheetId } = this.config;

        if (!apiKey || apiKey.trim() === '') {
            throw new GoogleSheetsError(
                'A chave da API está vazia. Preencha DEFAULT_API_KEY em src/services/GoogleSheetsService.ts.'
            );
        }

        if (!spreadsheetId || spreadsheetId.trim() === '') {
            throw new GoogleSheetsError(
                'O ID da planilha está vazio. Preencha DEFAULT_SPREADSHEET_ID em src/services/GoogleSheetsService.ts.'
            );
        }

        // Validação básica do formato da chave da API
        if (apiKey.length < 20) {
            throw new GoogleSheetsError(
                'A chave da API está incompleta. Confira DEFAULT_API_KEY em src/services/GoogleSheetsService.ts.'
            );
        }
    }

    /**
     * Busca as respostas do formulário na aba de respostas mais nova da planilha
     * @throws {GoogleSheetsError} Se a busca falhar, a API retornar um erro ou a
     * planilha não tiver aba de respostas
     */
    async fetchData(): Promise<SheetData> {
        const { spreadsheetId, apiKey } = this.config;
        const sheetUrl = `${this.baseUrl}/${spreadsheetId}`;

        const meta = await this.getJson<SpreadsheetMeta>(
            `${sheetUrl}?fields=properties.locale,sheets.properties.title&key=${apiKey}`
        );
        const tab = newestResponsesTab((meta.sheets ?? []).map(sheet => sheet.properties.title));
        if (!tab) {
            throw new GoogleSheetsError(
                'A planilha não tem uma aba de respostas do formulário (como "Respostas ao formulário 1"). ' +
                'Para criar, abra o formulário, vá em Respostas → Vincular ao Planilhas e escolha esta planilha.'
            );
        }

        // Aba entre aspas simples (notação A1) e codificada: espaços e acentos
        // quebrariam o intervalo e a URL
        const range = encodeURIComponent(`'${tab.replace(/'/g, "''")}'`);
        const data = await this.getJson<{ values?: unknown[][] }>(
            `${sheetUrl}/values/${range}?key=${apiKey}`
        );

        return {
            // Aba vazia (sem respostas ainda) chega sem "values"
            rows: this.transformToRows(data.values ?? []),
            locale: meta.properties?.locale ?? 'pt_BR'
        };
    }

    /**
     * GET na API do Google Sheets, com os erros traduzidos em GoogleSheetsError
     */
    private async getJson<T>(url: string): Promise<T> {
        let response: Response;
        try {
            response = await fetch(url);
        } catch (error) {
            // fetch só rejeita quando a requisição nem chega ao Google
            throw new GoogleSheetsError(
                'Erro de rede: não foi possível conectar à API do Google Sheets. Verifique sua conexão com a internet.',
                undefined,
                error
            );
        }

        if (!response.ok) {
            const errorData = await this.parseErrorResponse(response);
            throw new GoogleSheetsError(
                this.getErrorMessage(response.status, errorData),
                response.status,
                errorData
            );
        }

        return response.json();
    }

    /**
     * Processa a resposta de erro da API do Google Sheets
     */
    private async parseErrorResponse(response: Response): Promise<unknown> {
        try {
            return await response.json();
        } catch {
            return { message: response.statusText };
        }
    }

    /**
     * Retorna mensagem de erro amigável baseada no código de status
     */
    private getErrorMessage(statusCode: number, errorData: unknown): string {
        switch (statusCode) {
            case 400:
                return `O Google recusou a requisição (${this.extractErrorMessage(errorData)}). ` +
                    'Confira a chave em DEFAULT_API_KEY, em src/services/GoogleSheetsService.ts.';
            case 403:
                return 'O Google negou o acesso à planilha. A chave da API não aceita este endereço, ' +
                    'ou a planilha não está pública (Compartilhar → Qualquer pessoa com o link → Leitor).';
            case 404:
                return 'Planilha não encontrada. Confira o ID em DEFAULT_SPREADSHEET_ID, em src/services/GoogleSheetsService.ts.';
            case 429:
                return 'Limite de requisições excedido: aguarde alguns minutos antes de tentar novamente.';
            case 500:
            case 502:
            case 503:
                return 'Erro no servidor do Google: tente novamente em alguns instantes.';
            default: {
                const message = this.extractErrorMessage(errorData);
                return `Erro ao buscar dados (${statusCode}): ${message}`;
            }
        }
    }

    /**
     * Extrai a mensagem de erro da resposta de erro da API
     */
    private extractErrorMessage(errorData: unknown): string {
        if (typeof errorData === 'object' && errorData !== null) {
            const data = errorData as Record<string, unknown>;
            if (data.error && typeof data.error === 'object') {
                const error = data.error as Record<string, unknown>;
                if (typeof error.message === 'string') {
                    return error.message;
                }
            }
            if (typeof data.message === 'string') {
                return data.message;
            }
        }
        return 'Erro desconhecido';
    }

    /**
     * Transforma o array de valores do Google Sheets em objetos RawSheetRow
     * A primeira linha é tratada como cabeçalhos, as linhas seguintes como dados
     */
    private transformToRows(values: unknown[][]): RawSheetRow[] {
        if (values.length === 0) {
            return [];
        }

        // A primeira linha contém os cabeçalhos
        const headers = values[0] as string[];
        const rows: RawSheetRow[] = [];

        // Processa as linhas de dados (pula a linha de cabeçalho)
        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            const rowObject: RawSheetRow = {};

            // Mapeia cada célula para seu cabeçalho correspondente
            for (let j = 0; j < headers.length; j++) {
                const header = headers[j];
                const value = row[j];

                // Converte strings vazias para null
                if (value === '' || value === undefined) {
                    rowObject[header] = null;
                } else if (typeof value === 'string' || typeof value === 'number') {
                    rowObject[header] = value;
                } else {
                    // Converte outros tipos para string
                    rowObject[header] = String(value);
                }
            }

            rows.push(rowObject);
        }

        return rows;
    }

    /**
     * Retorna a configuração atual (útil para debug)
     */
    getConfig(): Readonly<GoogleSheetsConfig> {
        return {
            ...this.config,
            // Mascara a chave da API por segurança
            apiKey: this.config.apiKey.substring(0, 8) + '...'
        };
    }
}

/**
 * Valores de produção — o deploy não usa GitHub Secrets. A chave é uma API key
 * PÚBLICA do Google (vai no bundle de qualquer jeito); quem a protege é a restrição
 * por referenciador HTTP no Google Cloud (veja DEPLOYMENT.md). Para trocar a chave
 * ou a planilha, edite aqui. A aba não se configura: o painel acha sozinho a aba de
 * respostas mais nova (newestResponsesTab). Um .env local só sobrepõe estes valores.
 */
const DEFAULT_API_KEY = 'AIzaSyDdBdySPffBf1bndFpnEZaje0C1kN8wm4o';
const DEFAULT_SPREADSHEET_ID = '1X_NnjQTEWJ8Se9Anm5CvD5BIGdjKo5BadYEqnxPnLKY';

/**
 * Função factory para criar GoogleSheetsService a partir de variáveis de ambiente
 */
export function createGoogleSheetsService(): GoogleSheetsService {
    const config: GoogleSheetsConfig = {
        apiKey: import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || DEFAULT_API_KEY,
        spreadsheetId: import.meta.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID
    };

    return new GoogleSheetsService(config);
}
