/**
 * Testes do ResponsesProxy: o painel lê a planilha privada através do
 * endereço do Apps Script, sem chave de API e sem ID de planilha.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createResponsesProxy, ResponsesProxyError } from './ResponsesProxy';

const PROXY_URL = 'https://script.google.com/macros/s/teste/exec';

function stubFetch(body: unknown, status = 200) {
    const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(body), { status })
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

describe('createResponsesProxy', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('devolve as linhas e a localidade que o script entrega', async () => {
        const fetchMock = stubFetch({
            rows: [{ 'Selecione o CSR': 'CSR Brasil Sul' }],
            locale: 'pt_BR'
        });

        const data = await createResponsesProxy(PROXY_URL).fetchData();

        expect(fetchMock).toHaveBeenCalledWith(PROXY_URL);
        expect(data).toEqual({
            rows: [{ 'Selecione o CSR': 'CSR Brasil Sul' }],
            locale: 'pt_BR'
        });
    });

    it('funciona sem localidade, que o script nem sempre manda', async () => {
        stubFetch({ rows: [] });

        const data = await createResponsesProxy(PROXY_URL).fetchData();

        expect(data).toEqual({ rows: [], locale: 'pt_BR' });
    });

    it('repete o aviso do script quando a planilha está sem aba de respostas', async () => {
        stubFetch({ error: 'Nenhuma aba de respostas.' });

        const error = await createResponsesProxy(PROXY_URL).fetchData().catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ResponsesProxyError);
        expect((error as ResponsesProxyError).message).toContain('Nenhuma aba de respostas.');
    });

    it('explica erro de rede e erro do Google em português', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
        const offline = await createResponsesProxy(PROXY_URL).fetchData().catch((e: unknown) => e);
        expect((offline as ResponsesProxyError).message).toContain('Erro de rede');
        vi.unstubAllGlobals();

        stubFetch({}, 500);
        const http = await createResponsesProxy(PROXY_URL).fetchData().catch((e: unknown) => e);
        expect((http as ResponsesProxyError).message).toContain('500');
    });

    it('rejeita resposta fora do formato { rows, locale }', async () => {
        stubFetch({ linhas: [] });

        const error = await createResponsesProxy(PROXY_URL).fetchData().catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ResponsesProxyError);
    });

    it('rejeita endereço vazio em vez de buscar no lugar errado', () => {
        expect(() => createResponsesProxy('')).toThrow(ResponsesProxyError);
    });
});
