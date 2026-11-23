import { FaixaDemonstracao, EntradaDemonstracao } from '../../demo/demonstracao.js';
import { AjudaDaPagina } from '../features/tutorial/ajuda-da-pagina.js';
import { VisitaGuiada } from '../features/tutorial/visita-guiada.js';
import { BoasVindasTutorial } from '../features/tutorial/boas-vindas-tutorial.js';
import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, CalendarDays, LayoutDashboard, LockKeyhole, Settings2, Users } from 'lucide-react';
import { CONFIGURACAO_CLINICA } from '../../infrastructure/bootstrap/configuracao-clinica.js';
import { BadgeSincronizacao } from '../features/sincronizacao/badge-sincronizacao.js';
import { FaixaOffline } from '../features/sincronizacao/faixa-offline.js';
import { ThemeToggle } from '../components/ui/theme-toggle.js';
import { cn } from '../lib/cn.js';
import { useStatusAcessoClinica } from '../lib/usar-acesso-clinica.js';
import { useSolicitacoesPendentes } from '../providers/solicitacoes-pendentes-provider.js';
import { AvisoEncerramentosConsultas } from '../providers/encerramentos-consultas-provider.js';

const NAV_PRINCIPAL = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, fimDoCaminho: true },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays, fimDoCaminho: false },
  { to: '/pacientes', label: 'Pacientes', icon: Users, fimDoCaminho: false },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, fimDoCaminho: false },
  { to: '/configuracoes', label: 'Configurações', icon: Settings2, fimDoCaminho: false },
];

/** Contador persistente de solicitações de agendamento pendentes — só aparece no item "Agenda", só quando > 0. */
function ContadorPendencias({ quantidade }: { quantidade: number }) {
  if (quantidade === 0) return null;
  return (
    <span
      className="ml-auto rounded-full bg-warning-600 px-1.5 text-[0.65rem] font-semibold tabular-nums text-white"
      aria-label={`${quantidade} solicitação(ões) de agendamento pendente(s) de revisão`}
    >
      {quantidade}
    </span>
  );
}

function navLinkClass(isActive: boolean): string {
  return cn(
    'flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
    isActive
      ? 'bg-brand-50 text-brand-800 shadow-sm ring-1 ring-brand-200 dark:bg-brand-900/40 dark:text-brand-200 dark:ring-brand-800'
      : 'text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-200/10',
  );
}

function MarcaClinica({ compacta = false }: { compacta?: boolean }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-brand-200 bg-white shadow-sm dark:border-brand-900/70',
        compacta ? 'h-9 w-9' : 'h-10 w-10',
      )}
    >
      <img
        src={`${import.meta.env.BASE_URL}logo-dente.png`}
        alt=""
        aria-hidden="true"
        className="h-full w-full object-contain p-1"
        draggable={false}
      />
    </span>
  );
}

/**
 * Marca d'água impressa (Etapa 38) — o dente colorido, a mesma logo já
 * usada na barra lateral, bem apagada (8% de opacidade) por cima do
 * texto, perto do topo da primeira página (mesma região do cabeçalho
 * com o nome da clínica). `hidden print:block` esconde tudo da tela —
 * não é decoração de tela, só de papel. Fica dentro do `<main>` do
 * AppShell, cobrindo sozinha toda impressão feita a partir daqui
 * (ficha, agenda, orçamento, documento completo).
 *
 * Três decisões só descobertas testando de verdade nesta etapa (com
 * `page.pdf()`, não só a tela — ver notas de verificação da Etapa 38):
 *  1. Só UMA cópia, não várias espalhadas pela altura do documento —
 *     um `position: fixed` isolado só aparece numa página aleatória
 *     do PDF gerado pelo Chromium (não repete por página como em CSS
 *     Paged Media de verdade), e várias cópias `position: absolute`
 *     tentando "cobrir" várias páginas empurram o total de páginas
 *     impressas pra além do conteúdo real (o Chromium conta até a
 *     marca d'água mais baixa na hora de decidir quantas páginas
 *     imprimir, mesmo sendo só decoração).
 *  2. `top` pequeno o bastante pra caber dentro da PRIMEIRA página em
 *     qualquer documento — orçamento de 1 página ou prontuário
 *     completo de várias.
 *  3. Sem `z-index` negativo: em vez de a marca ficar atrás do texto
 *     (a intenção original), no Chromium impresso ela simplesmente
 *     não aparece — testado e confirmado com captura de tela da
 *     região exata (nada pintado ali). Sem `z-index` (o padrão),
 *     ela pinta por cima do texto — mas a 8% de opacidade isso não
 *     atrapalha a leitura nem um pouco, e visualmente é
 *     indistinguível de estar "atrás".
 */
function MarcaDaguaImpressao() {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo-dente.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="hidden print:absolute print:left-1/2 print:top-[7cm] print:block print:h-[9cm] print:w-[9cm] print:-translate-x-1/2 print:opacity-[0.08]"
    />
  );
}

function BotaoBloquearClinica() {
  const { configurado, autenticado } = useStatusAcessoClinica();
  if (!configurado || !autenticado) return null;

  return (
    <a
      href="/acesso/sair"
      className={cn(
        'inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-neutral-300 bg-surface px-3 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
      )}
      title="Bloquear o sistema neste navegador"
    >
      <LockKeyhole className="h-4 w-4" aria-hidden="true" />
      <span className="hidden lg:inline">Bloquear</span>
    </a>
  );
}

/**
 * Sidebar fixa + topbar — mesma referência visual do `teste2`
 * (SaaS clínico/administrativo): ícones + rótulo na navegação lateral,
 * identidade da profissional sempre visível, alternância de tema no
 * topo. Adaptado pra um consultório de profissional único: sem busca
 * global de cliente/notificações/múltiplos papéis — só o essencial
 * pra este sistema (Painel + Pacientes).
 */
export function AppShell() {
  const { pendentes } = useSolicitacoesPendentes();
  return (
    <>
      <FaixaDemonstracao />
      <div className="flex min-h-dvh flex-col sm:flex-row">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-surface focus:p-2"
      >
        Pular para o conteúdo
      </a>



      <aside className="no-print hidden w-64 shrink-0 border-r border-neutral-200 bg-surface sm:sticky sm:top-0 sm:flex sm:h-dvh sm:flex-col">
        <div className="flex items-center gap-2 px-4 py-5">
          <MarcaClinica />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug text-brand-800 dark:text-brand-300">
              {CONFIGURACAO_CLINICA.nomeProfissional}
            </p>
            <p className="truncate text-xs text-neutral-500">{CONFIGURACAO_CLINICA.registroProfissional}</p>
          </div>
        </div>
        <p className="px-5 pb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Consultório</p>
        <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-2 px-3">
          {NAV_PRINCIPAL.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                data-tour={`menu-${item.to === '/' ? 'painel' : item.to.slice(1)}`}
              to={item.to}
                end={item.fimDoCaminho}
                className={({ isActive }) => navLinkClass(isActive)}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                {item.label}
                {item.to === '/agenda' && <ContadorPendencias quantidade={pendentes.length} />}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-neutral-200 px-4 py-3">
          <p className="text-xs text-neutral-500">{CONFIGURACAO_CLINICA.nomeClinica}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-16 sm:pb-0">
        <header className="no-print hidden items-center gap-4 border-b border-neutral-200 bg-surface px-6 py-3 sm:flex">
          <p className="text-sm font-medium text-neutral-700">
            {CONFIGURACAO_CLINICA.nomeClinica}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <BadgeSincronizacao />
            <AjudaDaPagina />
            <BotaoBloquearClinica />
            <ThemeToggle />
          </div>
        </header>

        <header className="no-print flex items-center justify-between border-b border-neutral-200 bg-surface px-4 py-3 sm:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <MarcaClinica compacta />
            <p className="text-sm font-semibold leading-snug text-brand-800 dark:text-brand-300">
              {CONFIGURACAO_CLINICA.nomeProfissional}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <BadgeSincronizacao />
            <AjudaDaPagina />
            <BotaoBloquearClinica />
            <ThemeToggle />
          </div>
        </header>

        <main id="conteudo-principal" className="clinic-main flex-1 print:relative">
          <MarcaDaguaImpressao />
          <FaixaOffline />
          <AvisoEncerramentosConsultas />
          <EntradaDemonstracao /><Outlet />
          <BoasVindasTutorial />
          <VisitaGuiada />
        </main>
      </div>

      <nav
        aria-label="Navegação principal"
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-neutral-200 bg-surface sm:hidden"
      >
        {NAV_PRINCIPAL.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              data-tour={`menu-${item.to === '/' ? 'painel' : item.to.slice(1)}`}
              to={item.to}
              end={item.fimDoCaminho}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-center text-xs font-medium',
                  isActive
                    ? 'text-brand-800 dark:text-brand-300'
                    : 'text-neutral-700 hover:bg-neutral-100',
                )
              }
            >
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.to === '/agenda' && pendentes.length > 0 && (
                  <span
                    className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning-600 px-1 text-[0.6rem] font-semibold text-white"
                    aria-label={`${pendentes.length} solicitação(ões) de agendamento pendente(s) de revisão`}
                  >
                    {pendentes.length}
                  </span>
                )}
              </span>
              <span className="truncate">{item.to === '/configuracoes' ? 'Ajustes' : item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div></>
  );
}
