/**
 * FilterContext - Gerencia o estado dos filtros e fornece dados filtrados
 * 
 * Este contexto gerencia toda a lógica de filtragem incluindo:
 * - Filtros geográficos (Brasil/CSA/Região/Estado/Cidade) com exclusividade mútua
 * - Filtragem por intervalo de datas
 * - Extração de opções de filtro dos dados
 * - Cálculo de registros filtrados
 */

import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import type {
    CampaignRecord,
    FilterContextValue,
    FilterState,
    FilterOptions,
    GeographicScope
} from '../types';
import { useData } from './DataContext';

/**
 * Cria o FilterContext com valor padrão undefined
 * Isso força os consumidores a usar o contexto dentro de um provider
 */
const FilterContext = createContext<FilterContextValue | undefined>(undefined);

/**
 * Props para o componente FilterProvider
 */
interface FilterProviderProps {
    children: ReactNode;
    /**
     * Filtro parcial opcional para inicializar o estado. Útil para visualizações
     * com escopo definido (ex.: relatório de CSR fixado em uma região). Mesclado
     * sobre o estado padrão limpo.
     */
    initialFilter?: Partial<FilterState>;
}

/**
 * Estado inicial dos filtros - todos os filtros limpos
 */
const createInitialFilterState = (): FilterState => ({
    geographicScope: 'brasil',
    selectedCSA: null,
    selectedRegion: null,
    selectedState: null,
    selectedCity: null,
    dateRange: {
        start: null,
        end: null
    }
});

/**
 * Componente FilterProvider que gerencia o estado dos filtros e dados filtrados
 */
export function FilterProvider({ children, initialFilter }: FilterProviderProps) {
    const { records } = useData();
    const [filters, setFilters] = useState<FilterState>(() => ({
        ...createInitialFilterState(),
        ...initialFilter
    }));

    /**
     * Extrai opções de filtro dos registros disponíveis
     */
    const filterOptions = useMemo((): FilterOptions => {
        const csasSet = new Set<string>();
        const csrsSet = new Set<string>();
        const statesSet = new Set<string>();
        const citiesSet = new Set<string>();
        const activityTypesSet = new Set<string>();

        records.forEach(record => {
            // Extrai CSRs
            if (record.selectedCSR) {
                csrsSet.add(record.selectedCSR);
            }

            // Extrai CSAs do mapa CSR-CSA
            Object.values(record.csrCSAMap).forEach(csa => {
                if (csa) {
                    csasSet.add(csa);
                }
            });

            // Extrai estados
            if (record.state) {
                statesSet.add(record.state);
            }

            // Extrai cidades
            if (record.city) {
                citiesSet.add(record.city);
            }

            // Extrai tipos de atividade
            if (record.activityType) {
                activityTypesSet.add(record.activityType);
            }
        });

        return {
            csas: Array.from(csasSet).sort(),
            csrs: Array.from(csrsSet).sort(),
            states: Array.from(statesSet).sort(),
            cities: Array.from(citiesSet).sort(),
            activityTypes: Array.from(activityTypesSet).sort()
        };
    }, [records]);

    /**
     * Define filtro geográfico com lógica de exclusividade mútua
     * Quando um escopo geográfico é selecionado, todos os outros filtros geográficos são limpos
     */
    const setGeographicFilter = useCallback((scope: GeographicScope, value: string | null): void => {
        setFilters(prev => {
            // Cria novo estado de filtro com todos os filtros geográficos limpos
            const newFilters: FilterState = {
                ...prev,
                geographicScope: scope,
                selectedCSA: null,
                selectedRegion: null,
                selectedState: null,
                selectedCity: null
            };

            // Define o filtro específico baseado no escopo
            switch (scope) {
                case 'brasil':
                    // Todos os filtros geográficos permanecem nulos
                    break;
                case 'csa':
                    newFilters.selectedCSA = value;
                    break;
                case 'region':
                    newFilters.selectedRegion = value;
                    break;
                case 'state':
                    newFilters.selectedState = value;
                    break;
                case 'city':
                    newFilters.selectedCity = value;
                    break;
            }

            return newFilters;
        });
    }, []);

    /**
     * Define filtro de intervalo de datas
     */
    const setDateRange = useCallback((start: Date | null, end: Date | null): void => {
        setFilters(prev => ({
            ...prev,
            dateRange: { start, end }
        }));
    }, []);

    /**
     * Limpa todos os filtros
     */
    const clearFilters = useCallback((): void => {
        setFilters(createInitialFilterState());
    }, []);

    /**
     * Aplica filtros aos registros e retorna resultados filtrados
     */
    const filteredRecords = useMemo((): CampaignRecord[] => {
        return records.filter(record => {
            // Filtragem geográfica
            switch (filters.geographicScope) {
                case 'brasil':
                    // Sem filtro geográfico - inclui todos
                    break;

                case 'csa':
                    if (filters.selectedCSA) {
                        // Verifica se o mapa CSR-CSA do registro contém o CSA selecionado
                        const recordCSAs = Object.values(record.csrCSAMap).filter(Boolean);
                        if (!recordCSAs.includes(filters.selectedCSA)) {
                            return false;
                        }
                    }
                    break;

                case 'region':
                    if (filters.selectedRegion) {
                        // Filtra por CSR (região)
                        if (record.selectedCSR !== filters.selectedRegion) {
                            return false;
                        }
                    }
                    break;

                case 'state':
                    if (filters.selectedState) {
                        if (record.state !== filters.selectedState) {
                            return false;
                        }
                    }
                    break;

                case 'city':
                    if (filters.selectedCity) {
                        if (record.city !== filters.selectedCity) {
                            return false;
                        }
                    }
                    break;
            }

            // Filtragem por intervalo de datas
            if (filters.dateRange.start || filters.dateRange.end) {
                const activityDate = record.activityDate;

                if (filters.dateRange.start && activityDate < filters.dateRange.start) {
                    return false;
                }

                if (filters.dateRange.end && activityDate > filters.dateRange.end) {
                    return false;
                }
            }

            // Registro passou por todos os filtros
            return true;
        });
    }, [records, filters]);

    // Valor do contexto
    const value: FilterContextValue = {
        filters,
        setGeographicFilter,
        setDateRange,
        clearFilters,
        filteredRecords,
        filterOptions
    };

    return (
        <FilterContext.Provider value={value}>
            {children}
        </FilterContext.Provider>
    );
}

/**
 * Hook customizado para usar o FilterContext
 * @throws {Error} Se usado fora de um FilterProvider
 */
// oxlint-disable-next-line react/only-export-components
export function useFilters(): FilterContextValue {
    const context = useContext(FilterContext);

    if (context === undefined) {
        throw new Error('useFilters deve ser usado dentro de um FilterProvider');
    }

    return context;
}

/**
 * Exporta o contexto para fins de teste
 */
export { FilterContext };
