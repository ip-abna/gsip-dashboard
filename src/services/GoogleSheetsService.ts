/**
 * GoogleSheetsService - Gerencia a busca de dados da API do Google Sheets v4
 * 
 * Este serviço fornece acesso somente leitura a uma planilha pública do Google Sheets
 * contendo dados de campanhas da ABNA. Inclui validação de configuração, tratamento
 * de erros e mensagens de erro descritivas.
 */

import type { GoogleSheetsConfig, RawSheetRow } from '../types';

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
        const { apiKey, spreadsheetId, range } = this.config;

        if (!apiKey || apiKey.trim() === '') {
            throw new GoogleSheetsError(
                'A chave da API é obrigatória. Defina VITE_GOOGLE_SHEETS_API_KEY no seu arquivo .env.'
            );
        }

        if (!spreadsheetId || spreadsheetId.trim() === '') {
            throw new GoogleSheetsError(
                'O ID da planilha é obrigatório. Defina VITE_GOOGLE_SHEETS_SPREADSHEET_ID no seu arquivo .env.'
            );
        }

        if (!range || range.trim() === '') {
            throw new GoogleSheetsError(
                'O intervalo é obrigatório. Defina VITE_GOOGLE_SHEETS_RANGE no seu arquivo .env.'
            );
        }

        // Validação básica do formato da chave da API
        if (apiKey.length < 20) {
            throw new GoogleSheetsError(
                'A chave da API parece ser inválida. Verifique VITE_GOOGLE_SHEETS_API_KEY.'
            );
        }
    }

    /**
     * Busca dados da API do Google Sheets
     * @returns Promise que resolve para um array de linhas brutas da planilha
     * @throws {GoogleSheetsError} Se a busca falhar ou a API retornar um erro
     */
    async fetchData(): Promise<RawSheetRow[]> {
        const { spreadsheetId, range, apiKey } = this.config;
        // O range precisa ser codificado: nomes de aba com espaços/acentos
        // (ex.: "Respostas ao formulário 4") quebram a URL sem encode.
        const url = `${this.baseUrl}/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;

        try {
            const response = await fetch(url);

            // Trata erros HTTP
            if (!response.ok) {
                const errorData = await this.parseErrorResponse(response);
                throw new GoogleSheetsError(
                    this.getErrorMessage(response.status, errorData),
                    response.status,
                    errorData
                );
            }

            const data = await response.json();

            // Valida a estrutura da resposta
            if (!data.values || !Array.isArray(data.values)) {
                throw new GoogleSheetsError(
                    'Resposta da API inválida: dados não encontrados.'
                );
            }

            // Converte para o formato RawSheetRow
            return this.transformToRows(data.values);
        } catch (error) {
            // Re-lança GoogleSheetsError como está
            if (error instanceof GoogleSheetsError) {
                throw error;
            }

            // Trata erros de rede
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new GoogleSheetsError(
                    'Erro de rede: não foi possível conectar à API do Google Sheets. Verifique sua conexão com a internet.',
                    undefined,
                    error
                );
            }

            // Trata outros erros inesperados
            throw new GoogleSheetsError(
                'Erro inesperado ao buscar dados: ' + (error instanceof Error ? error.message : String(error)),
                undefined,
                error
            );
        }
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
                return 'Requisição inválida: verifique a configuração do intervalo da planilha (VITE_GOOGLE_SHEETS_RANGE).';
            case 403:
                return 'Acesso negado: verifique se a chave da API está correta e tem permissões adequadas. A planilha deve estar configurada como "Qualquer pessoa com o link pode visualizar".';
            case 404:
                return 'Planilha não encontrada: verifique se o ID da planilha (VITE_GOOGLE_SHEETS_SPREADSHEET_ID) está correto.';
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
 * por referenciador HTTP no Google Cloud (veja DEPLOYMENT.md). Para trocar a chave,
 * a planilha ou a aba, edite aqui. Um .env local só sobrepõe estes valores.
 */
const DEFAULT_API_KEY = 'AIzaSyDdBdySPffBf1bndFpnEZaje0C1kN8wm4o';
const DEFAULT_SPREADSHEET_ID = '1X_NnjQTEWJ8Se9Anm5CvD5BIGdjKo5BadYEqnxPnLKY';
// Só o nome da aba, sem limite de colunas: pergunta nova no formulário vira coluna
// nova no fim da aba, e um limite como A:CS cortaria essa coluna sem dar erro.
const DEFAULT_RANGE = 'Respostas ao formulário 4';

/**
 * Função factory para criar GoogleSheetsService a partir de variáveis de ambiente
 */
export function createGoogleSheetsService(): GoogleSheetsService {
    const config: GoogleSheetsConfig = {
        apiKey: import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || DEFAULT_API_KEY,
        spreadsheetId: import.meta.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID,
        range: import.meta.env.VITE_GOOGLE_SHEETS_RANGE || DEFAULT_RANGE
    };

    return new GoogleSheetsService(config);
}
