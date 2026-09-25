/**
 * Testes do Componente Dashboard
 * 
 * Testes para o componente de layout do Dashboard incluindo:
 * - Exibição do estado de carregamento
 * - Exibição do estado de erro com botão de tentar novamente
 * - Exibição bem-sucedida de dados com todos os componentes
 * 
 * Requisitos: 7.6, 8.1, 9.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { DataProvider } from '../contexts/DataContext';
import { FilterProvider } from '../contexts/FilterContext';
import type { CampaignRecord, DataIssues } from '../types';

// Cria funções mock no nível do módulo
const mockFetchData = vi.fn();
const mockParse = vi.fn((data) => data);
const mockGetIssues = vi.fn((): DataIssues => ({ missingColumns: [], skippedResponses: [] }));

// Mock do módulo de serviços
vi.mock('../services', () => ({
    createGoogleSheetsService: vi.fn(() => ({
        fetchData: mockFetchData
    }))
}));

// Mock do DataParser como construtor de classe
vi.mock('../utils/DataParser', () => {
    return {
        DataParser: vi.fn(function (this: { parse: typeof mockParse; getIssues: typeof mockGetIssues }) {
            this.parse = mockParse;
            this.getIssues = mockGetIssues;
        })
    };
});

// Função auxiliar para renderizar Dashboard com providers
function renderDashboard() {
    return render(
        <MemoryRouter>
            <DataProvider>
                <FilterProvider>
                    <Dashboard />
                </FilterProvider>
            </DataProvider>
        </MemoryRouter>
    );
}

describe('Componente Dashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetchData.mockReset();
        mockParse.mockReset();
        mockParse.mockImplementation((data) => data);
    });

    it('deve exibir estado de carregamento inicialmente', () => {
        // Mock de fetch lento para manter o estado de carregamento
        mockFetchData.mockReturnValue(new Promise(() => { })); // Nunca resolve

        renderDashboard();

        // Verifica o indicador de carregamento
        expect(screen.getByText(/Carregando dados/i)).toBeInTheDocument();
    });

    it('deve exibir estado de erro com botão de tentar novamente quando fetch falha', async () => {
        // Mock de falha no fetch
        mockFetchData.mockRejectedValue(new Error('Network error'));

        renderDashboard();

        // Aguarda o estado de erro
        await waitFor(() => {
            expect(screen.getByText(/Erro ao Carregar Dados/i)).toBeInTheDocument();
        });

        // Verifica a mensagem de erro
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();

        // Verifica o botão de tentar novamente
        expect(screen.getByText(/Tentar Novamente/i)).toBeInTheDocument();
    });

    it('deve chamar refetch quando botão de tentar novamente é clicado', async () => {
        mockFetchData.mockRejectedValue(new Error('Network error'));

        renderDashboard();

        // Aguarda o estado de erro
        await waitFor(() => {
            expect(screen.getByText(/Tentar Novamente/i)).toBeInTheDocument();
        });

        // Clica no botão de tentar novamente
        const retryButton = screen.getByText(/Tentar Novamente/i);
        await userEvent.click(retryButton);

        // Verifica se fetchData foi chamado novamente
        await waitFor(() => {
            expect(mockFetchData).toHaveBeenCalledTimes(2); // Inicial + retry
        });
    });

    it('deve renderizar todos os componentes do dashboard quando dados carregam com sucesso', async () => {
        // Mock de fetch de dados bem-sucedido
        const mockData: CampaignRecord[] = [
            {
                id: '1',
                timestamp: new Date('2024-01-15'),
                email: 'test@example.com',
                name: 'Test User',
                phone: '123456789',
                position: 'Coordenador',
                selectedCSR: 'CSR Brasil',
                csrCSAMap: {},
                state: 'SP',
                city: 'São Paulo',
                activityDate: new Date('2024-01-15'),
                activityTime: '14:00',
                serviceStructure: 'Sub-comitê',
                activityFormat: 'Presencial',
                institution: 'Hospital Central',
                activityType: 'Apresentação',
                activityDescription: 'Apresentação sobre NA',
                speakersCount: 2,
                participantsCount: 30,
                audienceReached: 50,
                serviceCost: 100,
                materials: {
                    cartazes: 10,
                    panfletos: 50,
                    listaGrupos: 5,
                    cartao: 20,
                    folder: 15,
                    ips: 10,
                    textoBasico: 5,
                    pastaRP: 3,
                    lixoCar: 2,
                    calendario: 10,
                    outros: 5
                },
                observations: 'Atividade bem-sucedida'
            }
        ];

        mockFetchData.mockResolvedValue({ rows: mockData, locale: 'pt_BR' });
        mockParse.mockReturnValue(mockData);

        renderDashboard();

        // Aguarda o carregamento dos dados
        await waitFor(() => {
            expect(screen.queryByText(/Carregando dados/i)).not.toBeInTheDocument();
        });

        // Verifica se o header foi renderizado
        expect(screen.getByText(/Relatório Nacional de RP\/IP/i)).toBeInTheDocument();

        // Verifica se a seção de cards de resumo está presente (pelo menos um card)
        expect(screen.getByText(/Quantidade de Atividades/i)).toBeInTheDocument();

        // Verifica se os gráficos foram renderizados (pelos títulos)
        expect(screen.getByText(/Estrutura de Serviço/i)).toBeInTheDocument();
        expect(screen.getByText(/Tipo de Atividade/i)).toBeInTheDocument();
        expect(screen.getByText(/Atividades ao Longo do Tempo/i)).toBeInTheDocument();

        // Verifica se o ranking geográfico foi renderizado
        expect(screen.getByText(/Ranking de Estados/i)).toBeInTheDocument();

        // Verifica se a tabela de materiais foi renderizada
        expect(screen.getByText(/Materiais Distribuídos/i)).toBeInTheDocument();

        // Planilha sem problemas não mostra aviso
        expect(screen.queryByText(/Parte dos dados da planilha/i)).not.toBeInTheDocument();
    });

    it('avisa o que da planilha ficou de fora do painel', async () => {
        mockFetchData.mockResolvedValue({ rows: [], locale: 'pt_BR' });
        mockGetIssues.mockReturnValueOnce({
            missingColumns: ['Pasta RP - apenas número'],
            skippedResponses: [{ reason: 'sem “Data” válida', count: 2 }]
        });

        renderDashboard();

        expect(await screen.findByText(/Parte dos dados da planilha não aparece no painel/i)).toBeInTheDocument();
        expect(screen.getByText('2 respostas ficaram de fora dos números:')).toBeInTheDocument();
        expect(screen.getByText('2 respostas sem “Data” válida')).toBeInTheDocument();
        expect(screen.getByText('“Pasta RP - apenas número”')).toBeInTheDocument();
    });

    it('deve ter classes de layout responsivo', async () => {
        mockFetchData.mockResolvedValue({ rows: [], locale: 'pt_BR' });

        const { container } = renderDashboard();

        // Aguarda o carregamento completar
        await waitFor(() => {
            expect(screen.queryByText(/Carregando dados/i)).not.toBeInTheDocument();
        });

        // Verifica as classes de container responsivo
        const mainElement = container.querySelector('main');
        expect(mainElement).toHaveClass('container', 'mx-auto', 'px-4');
    });
});
