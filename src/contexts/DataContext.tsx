/**
 * DataContext - Fornece os dados de campanhas para toda a aplicação
 * 
 * Este contexto gerencia a busca de dados do Google Sheets, cache,
 * estados de carregamento e tratamento de erros. Ele fornece:
 * - Array de registros de campanhas
 * - Estado de carregamento
 * - Estado de erro
 * - Método de recarregamento
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { CampaignRecord, DataContextValue } from '../types';
import { createGoogleSheetsService } from '../services';
import { DataParser } from '../utils/DataParser';

// Chave de cache para sessionStorage
const CACHE_KEY = 'abna_campaign_data_cache';
const CACHE_TIMESTAMP_KEY = 'abna_campaign_data_cache_timestamp';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos em milissegundos

/**
 * Cria o DataContext com valor padrão undefined
 * Isso força os consumidores a usar o contexto dentro de um provider
 */
const DataContext = createContext<DataContextValue | undefined>(undefined);

/**
 * Props para o componente DataProvider
 */
interface DataProviderProps {
    children: ReactNode;
}

/**
 * Componente DataProvider que gerencia o estado dos dados de campanhas
 */
export function DataProvider({ children }: DataProviderProps) {
    const [records, setRecords] = useState<CampaignRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    /**
     * Verifica se os dados em cache ainda são válidos
     */
    const isCacheValid = useCallback((): boolean => {
        try {
            const timestamp = sessionStorage.getItem(CACHE_TIMESTAMP_KEY);
            if (!timestamp) {
                return false;
            }

            const cacheAge = Date.now() - parseInt(timestamp, 10);
            return cacheAge < CACHE_DURATION;
        } catch {
            // Se sessionStorage não estiver disponível ou lançar um erro
            return false;
        }
    }, []);

    /**
     * Recupera os dados em cache do sessionStorage
     */
    const getCachedData = useCallback((): CampaignRecord[] | null => {
        try {
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (!cached || !isCacheValid()) {
                return null;
            }

            const parsed = JSON.parse(cached) as CampaignRecord[];

            // Converte strings de data de volta para objetos Date
            return parsed.map((record) => ({
                ...record,
                timestamp: new Date(record.timestamp),
                activityDate: new Date(record.activityDate)
            }));
        } catch (err) {
            console.warn('Falha ao recuperar dados em cache:', err);
            return null;
        }
    }, [isCacheValid]);

    /**
     * Salva os dados no cache do sessionStorage
     */
    const setCachedData = useCallback((data: CampaignRecord[]): void => {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
            sessionStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
        } catch (err) {
            console.warn('Falha ao salvar dados em cache:', err);
            // Continua sem cache - não é um erro crítico
        }
    }, []);

    /**
     * Busca dados da API do Google Sheets
     */
    const fetchData = useCallback(async (): Promise<void> => {
        setLoading(true);
        setError(null);

        try {
            // Busca as respostas brutas do Google Sheets
            const service = createGoogleSheetsService();
            const { rows, locale } = await service.fetchData();

            // A localidade da planilha decide a ordem de dia e mês nas datas
            const parser = new DataParser(locale);

            // Converte dados brutos em objetos CampaignRecord
            const parsedRecords = parser.parse(rows);

            // Atualiza o estado
            setRecords(parsedRecords);
            setError(null);

            // Salva os dados em cache
            setCachedData(parsedRecords);
        } catch (err) {
            const errorObj = err instanceof Error ? err : new Error(String(err));
            setError(errorObj);

            // Tenta usar dados em cache se disponíveis
            const cachedData = getCachedData();
            if (cachedData && cachedData.length > 0) {
                setRecords(cachedData);
                // Atualiza o erro para indicar que estamos usando dados em cache
                setError(new Error('Usando dados em cache. ' + errorObj.message));
            } else {
                setRecords([]);
            }
        } finally {
            setLoading(false);
        }
    }, [getCachedData, setCachedData]);

    /**
     * Recarrega os dados (exposto aos consumidores)
     */
    const refetch = useCallback(async (): Promise<void> => {
        await fetchData();
    }, [fetchData]);

    /**
     * Carrega os dados na montagem
     * Primeiro tenta usar dados em cache para exibição instantânea,
     * depois busca dados atualizados em segundo plano
     */
    useEffect(() => {
        const loadData = async () => {
            // Tenta carregar do cache primeiro para exibição instantânea
            const cachedData = getCachedData();
            if (cachedData && cachedData.length > 0) {
                setRecords(cachedData);
                setLoading(false);
                // Ainda busca dados atualizados em segundo plano
                fetchData();
            } else {
                // Sem cache, busca os dados
                await fetchData();
            }
        };

        loadData();
    }, [fetchData, getCachedData]);

    // Valor do contexto
    const value: DataContextValue = {
        records,
        loading,
        error,
        refetch
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
}

/**
 * Hook customizado para usar o DataContext
 * @throws {Error} Se usado fora de um DataProvider
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
    const context = useContext(DataContext);

    if (context === undefined) {
        throw new Error('useData deve ser usado dentro de um DataProvider');
    }

    return context;
}

/**
 * Exporta o contexto para fins de teste
 */
export { DataContext };
