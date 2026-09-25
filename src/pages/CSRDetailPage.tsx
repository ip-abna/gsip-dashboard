/**
 * CSRDetailPage - Relatório detalhado independente para uma única CSR (região)
 *
 * Um relatório regional focado em CSA. Ele bloqueia um FilterProvider para a região
 * do slug para que os gráficos existentes do dashboard se escopem automaticamente
 * para esta CSR, então lidera com conteúdo específico de CSA (atividades por CSA,
 * público por CSA, tabela de detalhamento) antes das distribuições escopadas por região.
 *
 * Lê registros brutos do DataContext e resolve a CSR a partir de um slug de URL,
 * totalmente independente do estado de filtro do dashboard principal.
 */

import { useMemo } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useData } from '../contexts';
import { FilterProvider } from '../contexts/FilterContext';
import {
    Header,
    CSRSwitcher,
    CategoryBarChart,
    CSABreakdownTable,
    SummaryCards,
    ServiceStructurePieChart,
    ServiceFormatPieChart,
    TimeSeriesLineChart,
    ActivityByHourChart,
    ActivityTypeColumnChart,
    ActivityColumnChart,
    GeographicRanking,
    MaterialsTable,
    DataIssuesNotice,
} from '../components';
import {
    filterRecordsByCSR,
    rankCSAsByActivityCount,
    aggregateCSABreakdown,
    slugToCSR,
    csrToSlug,
} from '../utils';
import type { ChartData } from '../types';
import { PageStateWrapper } from './PageStateWrapper';

/**
 * Conteúdo interno renderizado quando os dados estão carregados. Assume que os registros estão disponíveis.
 */
function CSRDetailContent({ slug }: { slug: string }) {
    const { records } = useData();

    // Todas as CSRs presentes nos dados (para o switcher e resolução de slug)
    const allCSRs = useMemo(() => {
        const set = new Set<string>();
        for (const record of records) {
            if (record.selectedCSR) set.add(record.selectedCSR);
        }
        return Array.from(set).sort();
    }, [records]);

    const csr = useMemo(() => slugToCSR(slug, allCSRs), [slug, allCSRs]);

    const csrRecords = useMemo(
        () => (csr ? filterRecordsByCSR(records, csr) : []),
        [records, csr]
    );

    // Atividades por CSA (gráfico) e público atingido (gráfico)
    const csaActivityData = useMemo(
        () => (csr ? rankCSAsByActivityCount(csrRecords, csr) : []),
        [csrRecords, csr]
    );

    const breakdownRows = useMemo(
        () => (csr ? aggregateCSABreakdown(csrRecords, csr) : []),
        [csrRecords, csr]
    );

    const csaAudienceData = useMemo<ChartData[]>(
        () =>
            breakdownRows
                .map((row) => ({ name: row.csa, value: row.audienceReached }))
                .sort((a, b) => b.value - a.value),
        [breakdownRows]
    );

    // Slug desconhecido → redireciona para a visão geral
    if (!csr) {
        return <Navigate to="/csr" replace />;
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <Header selectedCSR={csr} />

            <main className="container mx-auto px-4 py-6 space-y-6 animate-fade-in-up">
                <DataIssuesNotice />

                {/* Breadcrumb + seletor de CSR */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <nav className="flex items-center gap-2 text-sm text-gray-600">
                        <Link to="/" className="text-abna-primary hover:underline font-medium">
                            Painel Nacional
                        </Link>
                        <span aria-hidden="true">/</span>
                        <Link to="/csr" className="text-abna-primary hover:underline font-medium">
                            Relatórios por CSR
                        </Link>
                        <span aria-hidden="true">/</span>
                        <span className="text-gray-900 font-medium">{csr}</span>
                    </nav>
                    <CSRSwitcher current={csr} csrs={allCSRs} />
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{csr}</h2>
                    <p className="text-gray-600 mt-1">Relatório regional detalhado por CSA.</p>
                </div>

                {/*
                 * Tudo abaixo é escopado para esta CSR via um FilterProvider
                 * bloqueado para a região, então os gráficos compartilhados do dashboard
                 * se filtram automaticamente.
                 */}
                <FilterProvider initialFilter={{ geographicScope: 'region', selectedRegion: csr }}>
                    {/* KPIs escopados */}
                    <section>
                        <SummaryCards />
                    </section>

                    {/* História da CSA - o destaque desta página */}
                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <CategoryBarChart
                            title="Atividades por CSA"
                            data={csaActivityData}
                            color="teal"
                        />
                        <CategoryBarChart
                            title="Público Atingido por CSA"
                            data={csaAudienceData}
                            color="purple"
                            seriesName="Público"
                        />
                    </section>

                    <section>
                        <CSABreakdownTable rows={breakdownRows} />
                    </section>

                    {/* Distribuições escopadas por região */}
                    <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        <ServiceStructurePieChart />
                        <ServiceFormatPieChart />
                        <TimeSeriesLineChart />
                    </section>

                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ActivityByHourChart />
                        <GeographicRanking />
                    </section>

                    {/* Detalhamentos de atividades - largura total, um por linha */}
                    <section className="space-y-6">
                        <ActivityTypeColumnChart />
                        <ActivityColumnChart />
                    </section>

                    <section>
                        <MaterialsTable />
                    </section>
                </FilterProvider>
            </main>
        </div>
    );
}

export function CSRDetailPage() {
    const { csrName } = useParams<{ csrName: string }>();
    // O parâmetro da rota é um slug; normaliza nomes legados/codificados para slug também.
    const slug = csrName ? csrToSlug(decodeURIComponent(csrName)) : '';

    return (
        <PageStateWrapper>
            <CSRDetailContent slug={slug} />
        </PageStateWrapper>
    );
}
