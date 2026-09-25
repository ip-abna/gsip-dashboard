/**
 * DataIssuesNotice - Avisa quando parte da planilha não chega ao painel
 *
 * Sem este aviso, uma pergunta renomeada no formulário zera um número sem
 * ninguém perceber. Fica fechado: quem só lê os números vê uma linha, e quem
 * cuida da planilha abre para saber o que corrigir.
 */

import { useData } from '../contexts';

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

export function DataIssuesNotice() {
    const { missingColumns, skippedResponses } = useData().issues;
    const skippedCount = skippedResponses.reduce((sum, { count }) => sum + count, 0);

    if (missingColumns.length === 0 && skippedCount === 0) {
        return null;
    }

    return (
        <details className="surface group px-5 py-3 text-sm text-ink-700">
            <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </span>
                <span className="flex-1 font-semibold text-ink-900">
                    Parte dos dados da planilha não aparece no painel
                </span>
                <span className="text-xs font-medium text-ink-500 max-sm:hidden group-open:hidden">Ver detalhes</span>
                <svg className="h-4 w-4 text-ink-400 transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </summary>

            <div className="mt-3 space-y-3 sm:pl-10">
                {skippedCount > 0 && (
                    <div>
                        <p>
                            {skippedCount} {plural(skippedCount, 'resposta ficou', 'respostas ficaram')} de fora dos números:
                        </p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5">
                            {skippedResponses.map(({ reason, count }) => (
                                <li key={reason}>
                                    {count} {plural(count, 'resposta', 'respostas')} {reason}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {missingColumns.length > 0 && (
                    <div>
                        <p>
                            O painel não achou {plural(missingColumns.length, 'esta pergunta', 'estas perguntas')} na
                            planilha, então {plural(missingColumns.length, 'ela aparece zerada', 'elas aparecem zeradas')} ou
                            em branco:
                        </p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5">
                            {missingColumns.map((column) => (
                                <li key={column}>“{column}”</li>
                            ))}
                        </ul>
                    </div>
                )}

                <p className="text-ink-500">
                    Isso costuma acontecer quando alguém muda o texto de uma pergunta ou de uma opção no
                    formulário. Para corrigir, volte o texto antigo no formulário ou peça a quem cuida do
                    painel para ajustá-lo.
                </p>
            </div>
        </details>
    );
}
