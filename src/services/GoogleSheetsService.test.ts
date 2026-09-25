/**
 * Testes da escolha da aba de respostas: o painel não tem nome de aba fixo,
 * então religar o formulário (que cria "Respostas ao formulário 5") não o quebra.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { GoogleSheetsService, GoogleSheetsError, newestResponsesTab } from './GoogleSheetsService';

describe('newestResponsesTab', () => {
    it('fica com a aba de respostas de número maior', () => {
        expect(newestResponsesTab([
            'Respostas ao formulário 4',
            'Materiais',
            'Respostas ao formulário 5',
            'Respostas ao formulário 12'
        ])).toBe('Respostas ao formulário 12');
    });

    it('aceita o nome em inglês, de quem vinculou com o Google em inglês', () => {
        expect(newestResponsesTab(['Form Responses 1', 'Página1'])).toBe('Form Responses 1');
    });

    it('não confunde outras abas com a de respostas', () => {
        expect(newestResponsesTab(['Materiais', 'Respostas antigas', 'Página1'])).toBeNull();
    });
});

describe('GoogleSheetsService.fetchData', () => {
    const service = new GoogleSheetsService({
        apiKey: 'chave-de-teste-com-mais-de-20-caracteres',
        spreadsheetId: 'planilha-teste'
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function stubFetch(...bodies: unknown[]) {
        const fetchMock = vi.fn();
        for (const body of bodies) {
            fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body)));
        }
        vi.stubGlobal('fetch', fetchMock);
        return fetchMock;
    }

    it('lê a aba de respostas mais nova e devolve a localidade da planilha', async () => {
        const fetchMock = stubFetch(
            {
                properties: { locale: 'en_US' },
                sheets: [
                    { properties: { title: 'Respostas ao formulário 4' } },
                    { properties: { title: 'Respostas ao formulário 5' } }
                ]
            },
            { values: [['Carimbo de data/hora', 'Nome'], ['9/9/2026 21:04:16', 'Ana']] }
        );

        const data = await service.fetchData();

        expect(decodeURIComponent(fetchMock.mock.calls[1][0])).toContain("/values/'Respostas ao formulário 5'?");
        expect(data).toEqual({
            rows: [{ 'Carimbo de data/hora': '9/9/2026 21:04:16', 'Nome': 'Ana' }],
            locale: 'en_US'
        });
    });

    it('explica como vincular o formulário quando não há aba de respostas', async () => {
        stubFetch({ properties: { locale: 'pt_BR' }, sheets: [{ properties: { title: 'Página1' } }] });

        const error = await service.fetchData().catch((e: unknown) => e);

        expect(error).toBeInstanceOf(GoogleSheetsError);
        expect((error as GoogleSheetsError).message).toContain('Vincular ao Planilhas');
    });
});
