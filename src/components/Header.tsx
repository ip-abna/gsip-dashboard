import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import headerImage from '../assets/header-image.jpeg';

interface HeaderProps {
    selectedCSR?: string | null;
}

// Cor de fundo exata da arte do banner. O masthead inteiro (topbar + banner) vive
// nela para que o topbar transparente se funda com o banner atrás dele.
const BANNER_BG = '#373374';

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
    [
        'px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200',
        isActive
            ? 'bg-white text-abna-primary shadow-soft'
            : 'text-white/85 hover:bg-white/15 hover:text-white',
    ].join(' ');

export function Header({ selectedCSR }: HeaderProps) {
    const headerRef = useRef<HTMLElement>(null);
    const [navHeight, setNavHeight] = useState(0);
    const [scrolled, setScrolled] = useState(false);

    // Mede a altura do topbar para puxar o banner exatamente atrás dele (robusto a
    // mudanças de layout: empilha no mobile, lado a lado no desktop).
    useLayoutEffect(() => {
        const el = headerRef.current;
        if (!el) return;
        const measure = () => setNavHeight(el.offsetHeight);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Topbar transparente no topo (fundido ao banner); sólido + sombra ao rolar.
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <>
            <header
                ref={headerRef}
                className={[
                    'sticky top-0 z-30 transition-[background-color,box-shadow] duration-300',
                    scrolled ? 'shadow-soft-lg' : '',
                ].join(' ')}
                style={{ backgroundColor: scrolled ? BANNER_BG : 'transparent' }}
            >
                <div className="container mx-auto px-4 py-2.5 md:py-3">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                        {/* Logo + Título. No mobile o logo do NA é redundante (já aparece na
                            arte do banner logo abaixo), então some — deixando só as abas. */}
                        <Link
                            to="/"
                            aria-label="Ir para o início"
                            className={[
                                'items-center gap-3 rounded-2xl transition-opacity duration-200 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                                selectedCSR ? 'flex' : 'hidden md:flex',
                            ].join(' ')}
                        >
                            <img
                                src="https://www.na.org.br/wp-content/uploads/2020/04/logo-narcoticos-anonimos.png"
                                alt="Narcóticos Anônimos"
                                className="hidden md:block h-11 w-auto bg-white px-3 py-1.5 rounded-xl shadow-soft ring-1 ring-white/40"
                                onError={(e) => {
                                    console.error('Falha ao carregar logo do NA');
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                            {/* Título para leitores de tela/SEO; a marca visual vive no banner. */}
                            <h1 className="sr-only">Relatório Nacional de RP/IP</h1>
                            {selectedCSR && (
                                <p className="text-sm font-medium text-white/90">{selectedCSR}</p>
                            )}
                        </Link>

                        {/* Navegação */}
                        <nav className="flex items-center gap-1.5 rounded-full bg-white/10 p-1 ring-1 ring-white/15 backdrop-blur-sm">
                            <NavLink to="/" end className={navLinkClass}>
                                Painel Nacional
                            </NavLink>
                            <NavLink to="/csr" className={navLinkClass}>
                                Relatórios por CSR
                            </NavLink>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Banner puxado para trás do topbar: no topo, o header transparente revela esta
                arte; ao rolar, a arte passa por trás do topbar sólido. Mesmo #373374 em tudo
                => topbar e banner se fundem num único masthead.
                ponytail: `scale` recorta a franja clara de ~1px das bordas do JPEG; ao receber
                um SVG/PNG transparente em alta resolução, remova o scale e a cor de fundo fixa. */}
            <div
                style={{ backgroundColor: BANNER_BG, marginTop: -navHeight, paddingTop: navHeight }}
            >
                <div className="container mx-auto px-4 pt-2 pb-4 md:pb-6">
                    <div className="mx-auto w-full max-w-3xl overflow-hidden">
                        <img
                            src={headerImage}
                            alt="Relatório Nacional de Informação ao Público da ABNA · Narcóticos Anônimos"
                            fetchPriority="high"
                            width={576}
                            height={146}
                            className="block h-auto w-full scale-[1.03]"
                        />
                    </div>
                </div>
                {/* Assinatura da marca — o único acento verde intencional (azul → verde) */}
                <div className="h-[3px] w-full bg-accent-gradient" aria-hidden="true" />
            </div>
        </>
    );
}
