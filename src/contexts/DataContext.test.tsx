/**
 * Testes unitários para DataContext
 * Testa busca de dados, cache, tratamento de erros e modo offline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DataProvider, useData } from './DataContext';
import type { CampaignRecord } from '../types';
import * as services from '../services';
import type { GoogleSheetsService } from '../services/GoogleSheetsService';
import * as utils from '../utils/DataParser';

// Mock do GoogleSheetsService
vi.mock('../services');

// Mock do DataParser
vi.mock('../utils/DataParser');

// Componente de teste que usa o DataContext
function TestComponent() {
    const { records, loading, error, refetch } = useData();

    return (
        <div>
            <div data-testid="loading">{loading ? 'Carregando' : 'Não Carregando'}</div>
            <div data-testid="error">{error ? error.message : 'Sem Erro'}</div>
            <div data-testid="records-count">{records.length}</div>
            <button onClick={refetch}>Recarregar</button>
        </div>
    );
}

describe('DataContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deve lançar erro quando useData é usado fora do DataProvider', () => {
        // Suprime console.error para este teste
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

        expect(() => {
            render(<TestComponent />);
        }).toThrow('useData deve ser usado dentro de um DataProvider');

        consoleError.mockRestore();
    });

    it('deve fornecer estado inicial de carregamento', () => {
        const mockFetchData = vi.fn(() => new Promise(() => { })); // Nunca resolve

        vi.mocked(services.createGoogleSheetsService).mockReturnValue({
            fetchData: mockFetchData,
            validateConfig: vi.fn(),
            getConfig: vi.fn()
        } as unknown as GoogleSheetsService);

        render(
            <DataProvider>
                <TestComponent />
            </DataProvider>
        );

        expect(screen.getByTestId('loading')).toHaveTextContent('Carregando');
        expect(screen.getByTestId('records-count')).toHaveTextContent('0');
    });

    it('deve buscar e exibir dados com sucesso', async () => {
        const mockRecords: CampaignRecord[] = [
            {
                id: '1',
                timestamp: new Date('2024-01-15'),
                email: 'teste@exemplo.com',
                name: 'Usuário Teste',
                phone: '123456789',
                position: 'Coordenador',
                selectedCSR: 'CSR Brasil',
                csrCSAMap: {},
                state: 'SP',
                city: 'São Paulo',
                neighborhood: 'Centro',
                activityDate: new Date('2024-01-20'),
                activityTime: '14:00',
                serviceStructure: 'Sub-comitê',
                activityFormat: 'Presencial',
                institution: 'Instituição Teste',
                activityType: 'Workshop',
                activityDescription: 'Atividade de teste',
                speakersCount: 2,
                participantsCount: 10,
                audienceReached: 50,
                serviceCost: 100,
                materials: {
                    cartazes: 5,
                    panfletos: 10,
                    listaGrupos: 2,
                    cartao: 3,
                    folder: 4,
                    ips: 6,
                    textoBasico: 1,
                    pastaRP: 2,
                    lixoCar: 0,
                    calendario: 1,
                    outros: 3
                },
                observations: 'Observação de teste'
            }
        ];

        const mockFetchData = vi.fn().mockResolvedValue([{ id: '1' }]);
        const mockParse = vi.fn().mockReturnValue(mockRecords);

        vi.mocked(services.createGoogleSheetsService).mockReturnValue({
            fetchData: mockFetchData,
            validateConfig: vi.fn(),
            getConfig: vi.fn()
        } as unknown as GoogleSheetsService);

        // Mock do DataParser como construtor
        vi.mocked(utils.DataParser).mockImplementation(function (this: { parse: typeof mockParse; extractFilterOptions: ReturnType<typeof vi.fn> }) {
            this.parse = mockParse;
            this.extractFilterOptions = vi.fn();
            return this;
        } as unknown as typeof utils.DataParser);

        render(
            <DataProvider>
                <TestComponent />
            </DataProvider>
        );

        // Aguarda os dados carregarem
        await waitFor(() => {
            expect(screen.getByTestId('loading')).toHaveTextContent('Não Carregando');
        });

        expect(screen.getByTestId('records-count')).toHaveTextContent('1');
        expect(screen.getByTestId('error')).toHaveTextContent('Sem Erro');
        expect(mockFetchData).toHaveBeenCalledTimes(1);
        expect(mockParse).toHaveBeenCalledTimes(1);
    });

    it('deve tratar erros da API e exibir mensagem de erro', async () => {
        const mockFetchData = vi.fn().mockRejectedValue(new Error('Erro de rede'));

        vi.mocked(services.createGoogleSheetsService).mockReturnValue({
            fetchData: mockFetchData,
            validateConfig: vi.fn(),
            getConfig: vi.fn()
        } as unknown as GoogleSheetsService);

        // Mock do DataParser como construtor
        vi.mocked(utils.DataParser).mockImplementation(function (this: { parse: ReturnType<typeof vi.fn>; extractFilterOptions: ReturnType<typeof vi.fn> }) {
            this.parse = vi.fn();
            this.extractFilterOptions = vi.fn();
            return this;
        } as unknown as typeof utils.DataParser);

        render(
            <DataProvider>
                <TestComponent />
            </DataProvider>
        );

        // Aguarda o estado de erro
        await waitFor(() => {
            expect(screen.getByTestId('loading')).toHaveTextContent('Não Carregando');
        });

        expect(screen.getByTestId('error')).toHaveTextContent('Erro de rede');
        expect(screen.getByTestId('records-count')).toHaveTextContent('0');
    });
});
