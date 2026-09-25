/**
 * CSROverviewPage - Hub independente listando todas as CSRs (regiões)
 *
 * Atua como o hub de comparação para relatórios regionais. Fornece:
 * - Uma faixa de KPIs resumindo o panorama nacional de CSRs
 * - Dois gráficos de comparação (atividades e público atingido por CSR)
 * - Uma grade de cards de CSR clicáveis (atividades, CSAs, público) usados como
 *   seletor visual para detalhar um único relatório de CSR
 *
 * Lê registros brutos do DataContext e escopa os dados por conta própria, então é
 * totalmente independente do estado de filtro do dashboard principal.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../contexts';
import { Header, CategoryBarChart, SummaryCard, CSRPillNav, DataIssuesNotice } from '../components';
import {
    rankCSRsByActivityCount,
    rankCSRsByAudienceReached,
    countCSAsForCSR,
    filterRecordsByCSR,
    csrToSlug,
    formatNumber,
} from '../utils';
import { PageStateWrapper } from './PageStateWrapper';

interface CSRSummary {
    name: string;
    activityCount: number;
    csaCount: number;
    audienceReached: number;
}

export function CSROverviewPage() {
    const { records } = useData();

    const csrRanking = useMemo(() => rankCSRsByActivityCount(records), [records]);
    const audienceRanking = useMemo(() => rankCSRsByAudienceReached(records), [records]);

    // Lookup rápido de público por CSR para os cards
    const audienceByCSR = useMemo(() => {
        const map = new Map<string, number>();
        for (const { name, value } of audienceRanking) {
            map.set(name, value);
        }
        return map;
    }, [audienceRanking]);

    const csrSummaries = useMemo((): CSRSummary[] => {
        return csrRanking.map(({ name, value }) => ({
            name,
            activityCount: value,
            csaCount: countCSAsForCSR(filterRecordsByCSR(records, name), name),
            audienceReached: audienceByCSR.get(name) ?? 0,
        }));
    }, [csrRanking, records, audienceByCSR]);

    // Totais nacionais de nível CSR para a faixa de KPIs
    const totals = useMemo(() => {
        const totalCSAs = csrSummaries.reduce((sum, csr) => sum + csr.csaCount, 0);
        const totalActivities = csrSummaries.reduce((sum, csr) => sum + csr.activityCount, 0);
        const totalAudience = csrSummaries.reduce((sum, csr) => sum + csr.audienceReached, 0);
        return {
            regionCount: csrSummaries.length,
            totalCSAs,
            totalActivities,
            totalAudience,
        };
    }, [csrSummaries]);

    return (
        <PageStateWrapper>
            <div className="min-h-screen">
                <Header />

                <main className="container mx-auto px-4 py-6 space-y-6 animate-fade-in-up">
                    <DataIssuesNotice />

                    {/* Breadcrumb / voltar ao dashboard */}
                    <nav className="flex items-center gap-2 text-sm text-ink-500">
                        <Link to="/" className="font-medium text-abna-primary hover:underline">
                            Painel Nacional
                        </Link>
                        <span aria-hidden="true" className="text-ink-300">/</span>
                        <span className="font-medium text-ink-800">Relatórios por CSR</span>
                    </nav>

                    <div>
                        <h2 className="text-2xl font-bold text-ink-900">Relatórios por CSR</h2>
                        <p className="text-ink-500 mt-1">
                            Compare as regiões e selecione uma CSR para ver o relatório detalhado por CSA.
                        </p>
                    </div>

                    {csrSummaries.length === 0 ? (
                        <div className="surface p-12 text-center">
                            <p className="text-ink-500">Nenhuma CSR encontrada nos dados.</p>
                        </div>
                    ) : (
                        <>
                            {/* Pills de navegação rápida */}
                            <CSRPillNav
                                items={csrSummaries.map((csr) => ({
                                    name: csr.name,
                                    count: csr.activityCount,
                                }))}
                            />

                            {/* Faixa de KPIs */}
                            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                                <SummaryCard title="Regiões (CSR)" value={totals.regionCount} format="number" accent="blue" />
                                <SummaryCard title="CSAs" value={totals.totalCSAs} format="number" accent="teal" />
                                <SummaryCard title="Atividades" value={totals.totalActivities} format="number" accent="green" />
                                <SummaryCard title="Público Atingido" value={totals.totalAudience} format="number" accent="purple" />
                            </section>

                            {/* Gráficos de comparação */}
                            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <CategoryBarChart
                                    title="Atividades por Região (CSR)"
                                    data={csrRanking}
                                    color="teal"
                                />
                                <CategoryBarChart
                                    title="Público Atingido por Região (CSR)"
                                    data={audienceRanking}
                                    color="purple"
                                    seriesName="Público"
                                />
                            </section>

                            {/* Título da seção para o seletor */}
                            <div className="pt-2">
                                <h3 className="text-lg font-semibold text-ink-900">Selecione uma CSR</h3>
                                <p className="text-sm text-ink-500">
                                    Clique em uma região para abrir o relatório detalhado.
                                </p>
                            </div>

                            {/* Cards de CSR clicáveis */}
                            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                {csrSummaries.map((csr) => (
                                    <Link
                                        key={csr.name}
                                        to={`/csr/${csrToSlug(csr.name)}`}
                                        className="group surface surface-hover relative overflow-hidden p-6 focus:outline-none focus:ring-2 focus:ring-abna-primary"
                                    >
                                        <div className="absolute inset-x-0 top-0 h-1 bg-brand-gradient opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                        <div className="flex items-start justify-between gap-3">
                                            <h3 className="text-lg font-semibold text-ink-900 transition-colors group-hover:text-abna-primary">
                                                {csr.name}
                                            </h3>
                                            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-400 transition-all duration-300 group-hover:bg-abna-primary group-hover:text-white">
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </span>
                                        </div>
                                        <div className="mt-5 grid grid-cols-3 gap-3">
                                            <div>
                                                <p className="text-2xl font-bold text-ink-900 tabular-nums">{csr.activityCount}</p>
                                                <p className="text-xs text-ink-500">
                                                    {csr.activityCount === 1 ? 'atividade' : 'atividades'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold text-ink-900 tabular-nums">{csr.csaCount}</p>
                                                <p className="text-xs text-ink-500">
                                                    {csr.csaCount === 1 ? 'CSA' : 'CSAs'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold text-ink-900 tabular-nums">{formatNumber(csr.audienceReached)}</p>
                                                <p className="text-xs text-ink-500">público</p>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </section>
                        </>
                    )}
                </main>
            </div>
        </PageStateWrapper>
    );
}
