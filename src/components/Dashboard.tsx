/**
 * Componente de Layout do Dashboard
 * 
 * Layout principal do dashboard que compõe todos os componentes:
 * - Header
 * - FilterBar
 * - SummaryCards
 * - Gráficos (Pizza, Coluna, Linha)
 * - GeographicRanking
 * - MaterialsTable
 * 
 * Gerencia estados de carregamento e erro com funcionalidade de retry.
 * Implementa layout de grid responsivo com Tailwind CSS.
 * 
 * Requisitos: 7.4, 7.6, 8.1
 */

import { useData, useFilters } from '../contexts';
import {
    Header,
    FilterBar,
    SummaryCards,
    ServiceStructurePieChart,
    ServiceFormatPieChart,
    ActivityTypeColumnChart,
    ActivityColumnChart,
    ActivityByHourChart,
    RegionalActivityChart,
    TimeSeriesLineChart,
    GeographicRanking,
    MaterialsTable,
    DataIssuesNotice
} from './';

/**
 * Componente Dashboard - layout principal
 */
export function Dashboard() {
    const { loading, error, refetch } = useData();
    const { filters } = useFilters();

    // Estado de carregamento
    if (loading) {
        return (
            <div className="min-h-screen">
                <Header />
                <div className="container mx-auto px-4 py-8">
                    <div className="flex flex-col items-center justify-center min-h-[60vh]">
                        <div className="relative h-16 w-16 mb-5">
                            <div className="absolute inset-0 rounded-full border-4 border-ink-200" />
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-abna-primary border-r-abna-secondary animate-spin" />
                        </div>
                        <p className="text-lg font-medium text-ink-600">Carregando dados...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Estado de erro com botão de retry
    if (error) {
        return (
            <div className="min-h-screen">
                <Header />
                <div className="container mx-auto px-4 py-8">
                    <div className="flex flex-col items-center justify-center min-h-[60vh]">
                        <div className="surface p-8 max-w-md text-center">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-abna-accent">
                                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-ink-900 mb-2">
                                Erro ao Carregar Dados
                            </h2>
                            <p className="text-ink-600 mb-5">
                                {error.message || 'Ocorreu um erro inesperado ao carregar os dados.'}
                            </p>
                            <button
                                onClick={refetch}
                                className="inline-flex items-center gap-2 rounded-xl bg-abna-primary px-6 py-2.5 font-semibold text-white shadow-glow transition-all duration-200 hover:bg-abna-primary-dark hover:-translate-y-0.5"
                            >
                                Tentar Novamente
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Layout principal do dashboard
    return (
        <div className="min-h-screen">
            {/* Cabeçalho (banner de marca global + barra fixa de navegação) */}
            <Header selectedCSR={filters.selectedRegion} />

            {/* Conteúdo Principal */}
            <main className="container mx-auto px-4 py-6 space-y-6 animate-fade-in-up">
                <DataIssuesNotice />

                {/* Barra de Filtros */}
                <section>
                    <FilterBar />
                </section>

                {/* Cards de Resumo (números) */}
                <section>
                    <SummaryCards />
                </section>

                {/* Primeiros gráficos — ordem solicitada: região, tipo de atividade, atividade realizada */}
                <section className="space-y-6">
                    <RegionalActivityChart />
                    <ActivityTypeColumnChart />
                    <ActivityColumnChart />
                </section>

                {/* Demais distribuições e tendências */}
                <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <ServiceStructurePieChart />
                    </div>
                    <div className="lg:col-span-1">
                        <ServiceFormatPieChart />
                    </div>
                    <div className="lg:col-span-2 xl:col-span-1">
                        <TimeSeriesLineChart />
                    </div>
                </section>

                {/* Distribuição por horário do dia */}
                <section>
                    <ActivityByHourChart />
                </section>

                {/* Ranking Geográfico e Tabela de Materiais */}
                <section className="grid grid-cols-1 items-stretch lg:grid-cols-2 gap-6">
                    <div className="h-full">
                        <GeographicRanking />
                    </div>
                    <div className="h-full">
                        <MaterialsTable />
                    </div>
                </section>
            </main>

            {/* Rodapé */}
            <footer className="mt-16 border-t border-ink-200/70">
                <div className="container mx-auto px-4 py-8">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <div className="h-1 w-12 rounded-full bg-brand-gradient" />
                        <p className="text-sm text-ink-500">
                            © {new Date().getFullYear()} ABNA · Associação Brasileira de Narcóticos Anônimos
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
