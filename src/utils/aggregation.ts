/**
 * Utilitários de agregação de dados para o Dashboard de Campanhas ABNA
 * 
 * Este módulo fornece funções para:
 * - Calcular estatísticas resumidas
 * - Classificar localizações geográficas por contagem de atividades
 * - Agregar dados de distribuição de materiais
 * - Formatar números e moeda para o locale brasileiro
 */

import type {
    CampaignRecord,
    SummaryStatistics,
    RankingItem,
    MaterialRow,
    ChartData,
    CSABreakdownRow,
} from '../types';

// ============================================================================
// Estatísticas Resumidas
// ============================================================================

/**
 * Calcula estatísticas resumidas agregadas dos registros de campanha
 * 
 * @param records - Array de registros de campanha para agregar
 * @returns Objeto de estatísticas resumidas com todas as métricas calculadas
 */
export function calculateSummaryStatistics(records: CampaignRecord[]): SummaryStatistics {
    if (records.length === 0) {
        return {
            activityCount: 0,
            serversCount: 0,
            participantsCount: 0,
            audienceReached: 0,
            statesCount: 0,
            citiesCount: 0,
            totalMaterials: 0,
            totalCost: 0,
        };
    }

    // Conta estados e cidades únicos
    const uniqueStates = new Set<string>();
    const uniqueCities = new Set<string>();

    // Calcula totais
    let totalServers = 0;
    let totalParticipants = 0;
    let totalAudienceReached = 0;
    let totalMaterialsCount = 0;
    let totalCostSum = 0;


    for (const record of records) {
        // Adiciona estado ao conjunto único
        if (record.state) {
            uniqueStates.add(record.state);
        }

        // Adiciona cidade ao conjunto único
        if (record.city) {
            uniqueCities.add(record.city);
        }

        // Soma servidores (oradores)
        totalServers += record.speakersCount;

        // Soma participantes
        totalParticipants += record.participantsCount;

        // Soma público atingido
        totalAudienceReached += record.audienceReached;

        // Soma todos os materiais
        const materials = record.materials;
        totalMaterialsCount +=
            materials.cartazes +
            materials.panfletos +
            materials.listaGrupos +
            materials.cartao +
            materials.folder +
            materials.ips +
            materials.textoBasico +
            materials.pastaRP +
            materials.lixoCar +
            materials.calendario +
            materials.outros;

        // Soma custo
        totalCostSum += record.serviceCost;
    }

    return {
        activityCount: records.length,
        serversCount: totalServers,
        participantsCount: totalParticipants,
        audienceReached: totalAudienceReached,
        statesCount: uniqueStates.size,
        citiesCount: uniqueCities.size,
        totalMaterials: totalMaterialsCount,
        totalCost: totalCostSum,
    };
}

// ============================================================================
// Rankings Geográficos
// ============================================================================


/**
 * Classifica cidades por contagem de atividades em ordem decrescente
 * 
 * @param records - Array de registros de campanha para analisar
 * @returns Array de itens de ranking ordenados por contagem de atividades (decrescente)
 * 
 * Requisitos: 5.1, 5.2
 */
export function rankCitiesByActivityCount(records: CampaignRecord[]): RankingItem[] {
    // Conta atividades por cidade
    const cityCountMap = new Map<string, number>();

    for (const record of records) {
        if (record.city) {
            const count = cityCountMap.get(record.city) || 0;
            cityCountMap.set(record.city, count + 1);
        }
    }

    // Converte para array e ordena por contagem (decrescente)
    const sortedCities = Array.from(cityCountMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    // Atribui posições no ranking
    return sortedCities.map((item, index) => ({
        ...item,
        rank: index + 1,
    }));
}

/**
 * Classifica estados por contagem de atividades em ordem decrescente
 * 
 * @param records - Array de registros de campanha para analisar
 * @returns Array de itens de ranking ordenados por contagem de atividades (decrescente)
 * 
 * Requisitos: 5.1, 5.2
 */
export function rankStatesByActivityCount(records: CampaignRecord[]): RankingItem[] {
    // Conta atividades por estado
    const stateCountMap = new Map<string, number>();

    for (const record of records) {
        if (record.state) {
            const count = stateCountMap.get(record.state) || 0;
            stateCountMap.set(record.state, count + 1);
        }
    }

    // Converte para array e ordena por contagem (decrescente)
    const sortedStates = Array.from(stateCountMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    // Atribui posições no ranking
    return sortedStates.map((item, index) => ({
        ...item,
        rank: index + 1,
    }));
}


// ============================================================================
// Agregação de Materiais
// ============================================================================

/**
 * Rótulos dos tipos de materiais em português
 */
const MATERIAL_LABELS: Record<keyof CampaignRecord['materials'], string> = {
    cartazes: 'Cartazes',
    panfletos: 'Panfletos',
    listaGrupos: 'Lista de Grupos',
    cartao: 'Cartão',
    folder: 'Folder',
    // A pergunta do formulário é "IPs - Folhetos": é aqui que os folhetos entram
    ips: 'IPs (folhetos)',
    textoBasico: 'Texto Básico',
    pastaRP: 'Pasta RP',
    lixoCar: 'Lixo Car',
    calendario: 'Calendário',
    outros: 'Outros Materiais',
};

/**
 * Agrega dados de distribuição de materiais de todos os registros
 * 
 * @param records - Array de registros de campanha para agregar
 * @returns Array de linhas de materiais ordenadas por quantidade (decrescente)
 * 
 * Requisitos: 6.1, 6.3
 */
export function aggregateMaterials(records: CampaignRecord[]): MaterialRow[] {
    // Inicializa totais para cada tipo de material
    const materialTotals: Record<keyof CampaignRecord['materials'], number> = {
        cartazes: 0,
        panfletos: 0,
        listaGrupos: 0,
        cartao: 0,
        folder: 0,
        ips: 0,
        textoBasico: 0,
        pastaRP: 0,
        lixoCar: 0,
        calendario: 0,
        outros: 0,
    };

    // Soma materiais de todos os registros
    for (const record of records) {
        for (const materialKey in materialTotals) {
            const key = materialKey as keyof CampaignRecord['materials'];
            materialTotals[key] += record.materials[key] || 0;
        }
    }

    // Converte para array com rótulos em português
    const materialRows: MaterialRow[] = Object.entries(materialTotals).map(
        ([key, quantity]) => ({
            material: MATERIAL_LABELS[key as keyof typeof MATERIAL_LABELS],
            quantity,
        })
    );

    // Ordena por quantidade (decrescente)
    return materialRows.sort((a, b) => b.quantity - a.quantity);
}


// ============================================================================
// Agregação de Atividades
// ============================================================================

/**
 * Conta atividades por um campo string, retornando dados prontos para gráficos
 * ordenados por contagem (decrescente). Valores vazios/em branco são ignorados.
 *
 * @param records - Array de registros de campanha para agregar
 * @param selector - Função que retorna a chave de agrupamento para um registro
 * @param limit - Limite opcional no número de entradas retornadas (top N)
 * @returns Array de { name, value } ordenado por value (decrescente)
 */
export function countByField(
    records: CampaignRecord[],
    selector: (record: CampaignRecord) => string,
    limit?: number
): ChartData[] {
    const countMap = new Map<string, number>();

    for (const record of records) {
        const key = selector(record)?.trim();
        if (!key) continue;
        countMap.set(key, (countMap.get(key) || 0) + 1);
    }

    const sorted = Array.from(countMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Normaliza uma string bruta de "Horário" em um rótulo de faixa horária.
 * Aceita formatos como "14:00", "14h", "9", "09:30" e retorna "14h".
 * Retorna null quando nenhuma hora válida (0-23) pode ser extraída.
 */
export function extractHourBucket(activityTime: string): string | null {
    if (!activityTime) return null;

    const match = activityTime.trim().match(/(\d{1,2})/);
    if (!match) return null;

    const hour = Number(match[1]);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;

    return `${hour.toString().padStart(2, '0')}h`;
}

/**
 * Agrega atividades em faixas horárias, ordenadas cronologicamente.
 *
 * @param records - Array de registros de campanha para agregar
 * @returns Array de { name, value } onde name é um rótulo de faixa "HHh"
 */
export function aggregateByHour(records: CampaignRecord[]): ChartData[] {
    const hourCountMap = new Map<string, number>();

    for (const record of records) {
        const bucket = extractHourBucket(record.activityTime);
        if (!bucket) continue;
        hourCountMap.set(bucket, (hourCountMap.get(bucket) || 0) + 1);
    }

    return Array.from(hourCountMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => a.name.localeCompare(b.name));
}


/**
 * Classifica CSRs (regiões) por contagem de atividades em ordem decrescente.
 *
 * @param records - Array de registros de campanha para analisar
 * @returns Array de { name, value } ordenado por value (decrescente)
 */
export function rankCSRsByActivityCount(records: CampaignRecord[]): ChartData[] {
    return countByField(records, (record) => record.selectedCSR);
}

/**
 * Classifica CSRs (regiões) por total de público atingido, decrescente.
 *
 * @param records - Array de registros de campanha para analisar
 * @returns Array de { name, value } ordenado por value (decrescente)
 */
export function rankCSRsByAudienceReached(records: CampaignRecord[]): ChartData[] {
    const map = new Map<string, number>();

    for (const record of records) {
        const csr = record.selectedCSR?.trim();
        if (!csr) continue;
        map.set(csr, (map.get(csr) || 0) + record.audienceReached);
    }

    return Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
}

/**
 * Retorna o subconjunto de registros pertencentes a um CSR (região) específico.
 *
 * @param records - Array de registros de campanha para filtrar
 * @param csr - O nome do CSR (região) para comparar com record.selectedCSR
 * @returns Registros cujo selectedCSR corresponde ao CSR fornecido
 */
export function filterRecordsByCSR(
    records: CampaignRecord[],
    csr: string
): CampaignRecord[] {
    return records.filter((record) => record.selectedCSR === csr);
}

/**
 * Conta os CSAs distintos associados a um CSR nos registros fornecidos.
 *
 * @param records - Array de registros de campanha para analisar
 * @param csr - A chave do CSR (região) usada para resolver o CSA de cada registro
 * @returns O número de CSAs únicos não vazios para esse CSR
 */
export function countCSAsForCSR(records: CampaignRecord[], csr: string): number {
    const csas = new Set<string>();

    for (const record of records) {
        const csa = record.csrCSAMap[csr]?.trim();
        if (csa) {
            csas.add(csa);
        }
    }

    return csas.size;
}


/**
 * Classifica CSAs por contagem de atividades para um CSR (região) específico, decrescente.
 * O CSA de um registro é lido do seu csrCSAMap usando a chave do CSR fornecida.
 *
 * @param records - Array de registros de campanha para analisar
 * @param csr - A chave do CSR (região) usada para resolver o CSA de cada registro
 * @returns Array de { name, value } ordenado por value (decrescente)
 */
export function rankCSAsByActivityCount(
    records: CampaignRecord[],
    csr: string
): ChartData[] {
    const csaCountMap = new Map<string, number>();

    for (const record of records) {
        const csa = record.csrCSAMap[csr]?.trim();
        if (!csa) continue;
        csaCountMap.set(csa, (csaCountMap.get(csa) || 0) + 1);
    }

    return Array.from(csaCountMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
}

/**
 * Constrói um detalhamento por CSA para um CSR, combinando contagem de atividades
 * e total de público atingido, ordenado por contagem de atividades (decrescente).
 *
 * @param records - Array de registros de campanha para analisar
 * @param csr - A chave do CSR (região) usada para resolver o CSA de cada registro
 * @returns Array de CSABreakdownRow ordenado por activityCount (decrescente)
 */
export function aggregateCSABreakdown(
    records: CampaignRecord[],
    csr: string
): CSABreakdownRow[] {
    const map = new Map<string, { activityCount: number; audienceReached: number }>();

    for (const record of records) {
        const csa = record.csrCSAMap[csr]?.trim();
        if (!csa) continue;
        const entry = map.get(csa) || { activityCount: 0, audienceReached: 0 };
        entry.activityCount += 1;
        entry.audienceReached += record.audienceReached;
        map.set(csa, entry);
    }

    return Array.from(map.entries())
        .map(([csa, { activityCount, audienceReached }]) => ({
            csa,
            activityCount,
            audienceReached,
        }))
        .sort((a, b) => b.activityCount - a.activityCount);
}


// ============================================================================
// Formatação de Números
// ============================================================================

/**
 * Formata um número com convenções do locale brasileiro
 * Usa ponto (.) como separador de milhar e vírgula (,) como separador decimal
 * 
 * @param value - Número a ser formatado
 * @param decimals - Número de casas decimais (padrão: 0)
 * @returns String do número formatado
 * 
 * Requisitos: 4.9
 * 
 * @example
 * formatNumber(1234567) // "1.234.567"
 * formatNumber(1234.56, 2) // "1.234,56"
 */
export function formatNumber(value: number, decimals: number = 0): string {
    return value.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

/**
 * Formata um número como moeda brasileira (Real - R$)
 * 
 * @param value - Número a ser formatado como moeda
 * @returns String de moeda formatada com símbolo R$
 * 
 * Requisitos: 4.9
 * 
 * @example
 * formatCurrency(1234.56) // "R$ 1.234,56"
 */
export function formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
}
