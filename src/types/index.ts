/**
 * Tipos e interfaces TypeScript principais para o Dashboard de Campanha ABNA
 */

// ============================================================================
// Tipos de Dados de Campanha
// ============================================================================

/**
 * Materiais distribuídos durante uma atividade de campanha
 */
export interface MaterialsDistributed {
    cartazes: number;
    panfletos: number;
    listaGrupos: number;
    cartao: number;
    folder: number;
    ips: number;
    textoBasico: number;
    pastaRP: number;
    lixoCar: number;
    calendario: number;
    outros: number;
}

/**
 * Tipos de estrutura de serviço
 */
export type ServiceStructure = 'Sub-comitê' | 'Oficina' | 'Área' | 'Outros';

/**
 * Tipos de formato de atividade
 */
export type ActivityFormat = 'Presencial' | 'Híbrido' | 'Virtual' | 'Online';

/**
 * Mapeamento CSR para CSA para seleções regionais
 */
export interface CSRCSAMap {
    'CSR 10 Brasil'?: string;
    'CSR Brasil'?: string;
    'CSR Brasil Central'?: string;
    'CSR Brasil Sul'?: string;
    'CSR Grande São Paulo'?: string;
    'CSR HOW Brasil'?: string;
    'CSR Minas'?: string;
    'CSR Nordeste'?: string;
    'CSR Rio de Janeiro'?: string;
    'CSR Rio Grande do Sul'?: string;
    'CSR Terra do Sol'?: string;
    'CSR UAI'?: string;
    /** Permite lookup por um nome de CSR arbitrário resolvido em tempo de execução */
    [csr: string]: string | undefined;
}

/**
 * Registro completo de campanha representando uma única submissão de formulário
 */
export interface CampaignRecord {
    id: string;
    timestamp: Date;
    email: string;
    name: string;
    phone: string;
    position: string;
    selectedCSR: string;
    csrCSAMap: CSRCSAMap;
    state: string;
    city: string | null;
    neighborhood: string | null;
    activityDate: Date;
    activityTime: string;
    serviceStructure: ServiceStructure;
    activityFormat: ActivityFormat;
    institution: string;
    activityType: string;
    activityDescription: string;
    speakersCount: number;
    participantsCount: number;
    audienceReached: number;
    serviceCost: number;
    materials: MaterialsDistributed;
    observations: string;
}

// ============================================================================
// Tipos de Filtro
// ============================================================================

/**
 * Escopo geográfico para filtragem
 */
export type GeographicScope = 'brasil' | 'csa' | 'region' | 'state' | 'city';

/**
 * Estado de filtro gerenciando todos os filtros ativos
 */
export interface FilterState {
    geographicScope: GeographicScope;
    selectedCSA: string | null;
    selectedRegion: string | null;
    selectedState: string | null;
    selectedCity: string | null;
    dateRange: {
        start: Date | null;
        end: Date | null;
    };
}

/**
 * Opções de filtro disponíveis extraídas dos dados
 */
export interface FilterOptions {
    csas: string[];
    csrs: string[];
    states: string[];
    cities: string[];
    activityTypes: string[];
}

// ============================================================================
// Tipos de Estatísticas Resumidas
// ============================================================================

/**
 * Estatísticas agregadas para cards de resumo
 */
export interface SummaryStatistics {
    activityCount: number;
    serversCount: number;
    participantsCount: number;
    audienceReached: number;
    statesCount: number;
    citiesCount: number;
    totalMaterials: number;
    totalCost: number;
}

// ============================================================================
// Tipos de Dados de Gráfico
// ============================================================================

/**
 * Ponto de dados genérico de gráfico para gráficos de pizza e barras
 */
export interface ChartData {
    name: string;
    value: number;
    [key: string]: string | number; // Assinatura de índice para compatibilidade com Recharts
}

/**
 * Ponto de dados de série temporal para gráficos de linha
 */
export interface TimeSeriesData {
    date: string;
    count: number;
}

/**
 * Item de ranking para rankings geográficos
 */
export interface RankingItem {
    name: string;
    count: number;
    rank: number;
}

/**
 * Linha de material para tabela de materiais
 */
export interface MaterialRow {
    material: string;
    quantity: number;
}

/**
 * Linha de detalhamento por CSA combinando contagem de atividades e público atingido
 */
export interface CSABreakdownRow {
    csa: string;
    activityCount: number;
    audienceReached: number;
}

// ============================================================================
// Tipos de Dados Brutos
// ============================================================================

/**
 * Linha bruta da API do Google Sheets
 */
export interface RawSheetRow {
    [key: string]: string | number | null;
}

/**
 * O que a planilha entrega ao painel: as respostas e a localidade (ex.: "pt_BR"),
 * que decide a ordem de dia e mês nas datas
 */
export interface SheetData {
    rows: RawSheetRow[];
    locale: string;
}

// ============================================================================
// Tipos de Contexto
// ============================================================================

/**
 * Valor do contexto de dados fornecendo registros de campanha
 */
export interface DataContextValue {
    records: CampaignRecord[];
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

/**
 * Valor do contexto de filtro fornecendo dados filtrados e controles de filtro
 */
export interface FilterContextValue {
    filters: FilterState;
    setGeographicFilter: (scope: GeographicScope, value: string | null) => void;
    setDateRange: (start: Date | null, end: Date | null) => void;
    clearFilters: () => void;
    filteredRecords: CampaignRecord[];
    filterOptions: FilterOptions;
}

// ============================================================================
// Tipos de Configuração de Serviço
// ============================================================================

/**
 * Configuração da API do Google Sheets
 */
export interface GoogleSheetsConfig {
    apiKey: string;
    spreadsheetId: string;
}

// ============================================================================
// Extensões de Tipo Global
// ============================================================================

/**
 * Interface de rastreador de erros para serviço opcional de log de erros
 */
export interface ErrorTracker {
    logError: (error: Error, errorInfo: Record<string, unknown>) => void;
}

/**
 * Estende a interface Window para incluir rastreador de erros opcional
 */
declare global {
    interface Window {
        errorTracker?: ErrorTracker;
    }
}

// Este export é necessário para tornar este arquivo um módulo
export { };
