/**
 * Testes do DataParser focados nas duas causas de respostas sumindo do painel:
 * datas no padrão brasileiro e ID_Resposta vazio.
 */

import { describe, it, expect } from 'vitest';
import { DataParser } from './DataParser';

/**
 * Linha mínima que passa por todos os campos obrigatórios do parseRow
 */
function makeRow(overrides: Record<string, unknown> = {}) {
    return {
        'ID_Resposta': 'abc-123',
        'Carimbo de data/hora': '04/11/2025 21:32:38',
        'Selecione o CSR': 'CSR Brasil Sul',
        'Selecione o Estado': 'Paraná (PR)',
        'Data': '04/11/2025',
        'Qual Estrutura Prestou Atividade': 'Subcomite',
        'Formato do Atendimento': 'Presencial',
        'Tipo de Atividade': 'Religiosos',
        ...overrides
    };
}

describe('parseDate', () => {
    const parser = new DataParser();

    it('lê dd/mm/aaaa como data brasileira, não americana', () => {
        const date = parser.parseDate('04/11/2025')!;
        expect(date.getDate()).toBe(4);
        expect(date.getMonth()).toBe(10); // novembro
        expect(date.getFullYear()).toBe(2025);
    });

    it('aceita dia acima de 12, que o Date nativo rejeitaria', () => {
        const date = parser.parseDate('23/02/2026 21:33:31')!;
        expect(date.getDate()).toBe(23);
        expect(date.getMonth()).toBe(1); // fevereiro
        expect(date.getHours()).toBe(21);
        expect(date.getMinutes()).toBe(33);
        expect(date.getSeconds()).toBe(31);
    });

    it('descarta datas inexistentes em vez de rolar para o mês seguinte', () => {
        expect(parser.parseDate('31/02/2026')).toBeNull();
    });

    it('continua aceitando ISO e valores vazios', () => {
        expect(parser.parseDate('2025-11-04T12:00:00Z')?.getUTCDate()).toBe(4);
        expect(parser.parseDate('')).toBeNull();
        expect(parser.parseDate(null)).toBeNull();
        expect(parser.parseDate('não é data')).toBeNull();
    });
});

describe('parseRow', () => {
    const parser = new DataParser();

    it('mantém a resposta quando o ID_Resposta vem vazio da planilha', () => {
        const record = parser.parseRow(makeRow({ 'ID_Resposta': '' }));
        expect(record.id).toBeTruthy();
        expect(record.state).toBe('PR');
    });

    it('preserva o ID_Resposta quando ele existe', () => {
        expect(parser.parseRow(makeRow()).id).toBe('abc-123');
    });

    // Cabeçalhos reais da planilha, que diferem do título "limpo" da pergunta
    it('acha a coluna mesmo com espaço duplo no cabeçalho', () => {
        const record = parser.parseRow(makeRow({ 'Pasta RP  - apenas número': '1' }));
        expect(record.materials.pastaRP).toBe(1);
    });

    it('acha a coluna mesmo com maiúsculas diferentes no cabeçalho', () => {
        const record = parser.parseRow(makeRow({
            'Selecione o Estado': 'Amapá (AP)',
            'Selecione a Cidade - AP': 'Macapá'
        }));
        expect(record.city).toBe('Macapá');
    });

    it('fica com o valor preenchido quando dois cabeçalhos só diferem na caixa', () => {
        const record = parser.parseRow(makeRow({
            'Selecione a cidade - PR': 'Curitiba',
            'Selecione a Cidade - PR': ''
        }));
        expect(record.city).toBe('Curitiba');
    });
});

describe('parse', () => {
    it('não descarta respostas recentes por data brasileira ou ID vazio', () => {
        const parser = new DataParser();
        const records = parser.parse([
            makeRow(),
            makeRow({ 'ID_Resposta': '', 'Carimbo de data/hora': '15/07/2026 21:42:38', 'Data': '15/07/2026' }),
            makeRow({ 'Carimbo de data/hora': '23/02/2026 21:33:31', 'Data': '23/02/2026' })
        ]);

        expect(records).toHaveLength(3);
        expect(parser.getWarnings()).toHaveLength(0);
    });

    it('funciona sem a coluna ID_Resposta, que é do script e não do formulário', () => {
        // Religar o formulário cria uma aba nova só com as perguntas, sem essa coluna
        const semId: Record<string, unknown> = makeRow();
        delete semId['ID_Resposta'];
        const records = new DataParser().parse([semId]);
        expect(records).toHaveLength(1);
    });
});
