/**
 * ResponsesProxy - Lê as respostas através do proxy (Apps Script)
 *
 * A planilha é privada e o painel não tem chave de API: o script roda dentro
 * da planilha (na conta da ABNA) e publica só as colunas que o painel mostra,
 * sem Email, Nome e Telefone. O código do script fica em apps-script/Code.gs.
 */

import type { RawSheetRow, SheetData } from '../types';

/** Endereço que o Apps Script entrega ao implantar (Implantar → Novo deploy) */
const DEFAULT_PROXY_URL = 'https://script.google.com/macros/s/AKfycbwGBZ1OPrqsiwAuGhsd2cmEVEse5_FjVPMBpkska_txjRuN9NaOkSJurciFlShJMYX3/exec';

/**
 * Erro do proxy com mensagem pronta para a tela
 */
export class ResponsesProxyError extends Error {
    public readonly originalError?: unknown;

    constructor(message: string, originalError?: unknown) {
        super(message);
        this.name = 'ResponsesProxyError';
        this.originalError = originalError;
    }
}

export interface ResponsesProxy {
    fetchData(): Promise<SheetData>;
}

/**
 * Cria o proxy. Sem .env, usa o endereço de produção acima. Para apontar
 * para outro deploy na sua máquina, descomente VITE_RESPONSES_PROXY_URL
 * no .env (veja .env.example).
 */
export function createResponsesProxy(
    url: string = import.meta.env.VITE_RESPONSES_PROXY_URL || DEFAULT_PROXY_URL
): ResponsesProxy {
    if (!url || url.trim() === '') {
        throw new ResponsesProxyError(
            'O endereço do proxy está vazio. Preencha DEFAULT_PROXY_URL em src/services/ResponsesProxy.ts.'
        );
    }
    return { fetchData: () => fetchData(url) };
}

async function fetchData(url: string): Promise<SheetData> {
    let response: Response;
    try {
        response = await fetch(url);
    } catch (error) {
        // fetch só rejeita quando a requisição nem chega ao Google
        throw new ResponsesProxyError(
            'Erro de rede: não foi possível alcançar o proxy das respostas. Verifique sua conexão com a internet.',
            error
        );
    }

    if (!response.ok) {
        throw new ResponsesProxyError(
            `O proxy respondeu com erro (${response.status}). Tente recarregar em instantes.`
        );
    }

    const data: unknown = await response.json();

    // O script avisa quando a planilha está sem aba de respostas
    if (typeof data === 'object' && data !== null && 'error' in data) {
        throw new ResponsesProxyError(
            `O proxy não tem respostas para entregar: ${String((data as { error: unknown }).error)}`
        );
    }

    if (typeof data !== 'object' || data === null || !Array.isArray((data as { rows?: unknown }).rows)) {
        throw new ResponsesProxyError('O proxy devolveu um formato que o painel não entende.');
    }

    const { rows, locale } = data as { rows: RawSheetRow[]; locale?: string };
    return { rows, locale: locale ?? 'pt_BR' };
}
