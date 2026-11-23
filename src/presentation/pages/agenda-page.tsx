import { ProcedimentoAgendamento, AVALIAR_NO_CONSULTORIO } from '../features/consultas/procedimento-agendamento.js';
import type { FeriadoGoogle, StatusFeriadosGoogle } from '../../application/ports/porta-google-calendar.js';
import { AvisosFeriados, DialogFeriados } from '../features/consultas/feriados-agenda.js';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useEncerramentosConsultas } from '../providers/encerramentos-consultas-provider.js';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Ban, Cake, CalendarDays, ChevronLeft, ChevronRight, Plus, Printer } from 'lucide-react';
import type { ConsultaNaAgenda } from '../../application/use-cases/consulta.js';
import { mensagemDeErro } from '../lib/erros.js';
import {
  TIPO_BLOQUEIO_AGENDA_LABEL,
  fimDeSemanaMaisProximo,
  type BloqueioAgenda,
  type TipoBloqueioAgenda,
} from '../../domain/entities/bloqueio-agenda.js';
import type { Paciente } from '../../domain/entities/paciente.js';
import { AVISO_TAXA_EMERGENCIA } from '../../domain/value-objects/atendimento-emergencia.js';
import { proximoAniversario } from '../../domain/value-objects/aniversario.js';
import { Alert } from '../components/ui/alert.js';
import { Button, buttonClassName } from '../components/ui/button.js';
import { CabecalhoImpressao } from '../components/ui/cabecalho-impressao.js';
import { Checkbox } from '../components/ui/checkbox.js';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '../components/ui/dialog.js';
import { EmptyState } from '../components/ui/empty-state.js';
import { Field } from '../components/ui/field.js';
import { Input, Select } from '../components/ui/input.js';
import { Spinner } from '../components/ui/spinner.js';
import { cn } from '../lib/cn.js';
import {
  adicionarDias,
  adicionarMeses,
  diasDaSemana,
  hojeIso,
  inicioDaGradeDoMes,
  inicioDaSemana,
  rotuloDataExtensa,
  rotuloDiaCurto,
  rotuloDiaMes,
  rotuloMesAno,
} from '../lib/datas-agenda.js';
import { useRegistrarEdicaoPendente } from '../providers/edicao-pendente-provider.js';
import { useContainer } from '../providers/container-provider.js';
import { CartaoConsulta } from '../features/consultas/cartao-consulta.js';
import { GradeHorariaAgenda } from '../features/consultas/grade-horaria-agenda.js';
import { GradeMensalAgenda } from '../features/consultas/grade-mensal-agenda.js';
import { PainelSolicitacoesAgendamento } from '../features/consultas/painel-solicitacoes-agendamento.js';
import { AtivarNotificacoesAgendamento } from '../features/consultas/ativar-notificacoes-agendamento.js';
import { SeletorPaciente } from '../features/pacientes/seletor-paciente.js';

type ModoAgenda = 'dia' | 'semana' | 'mes';

function ehDataValida(valor: string | null): valor is string {
  return valor !== null && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

/** Agrupa as consultas do intervalo por data (`YYYY-MM-DD`). */
function agruparPorDia(consultas: ConsultaNaAgenda[]): Map<string, ConsultaNaAgenda[]> {
  const mapa = new Map<string, ConsultaNaAgenda[]>();
  for (const item of consultas) {
    const dia = item.consulta.toSnapshot().data;
    const lista = mapa.get(dia) ?? [];
    lista.push(item);
    mapa.set(dia, lista);
  }
  return mapa;
}

export interface AniversarioNaAgenda {
  pacienteId: string;
  nomeCompleto: string;
}

/**
 * Aniversários a mostrar na Agenda — puramente informativo, derivado da
 * MESMA lista de pacientes já carregada pro seletor de "Nova consulta"
 * (nunca uma chamada nova ao servidor, nunca um caso de uso novo).
 * Reaproveita `proximoAniversario` (já trata data ausente/inválida e
 * 29/fev — ver `domain/value-objects/aniversario.ts`). Paciente
 * arquivado nunca aparece (`estaArquivado`); excluído de verdade já não
 * está na lista. Nunca ocupa horário, cria consulta nem dispara
 * qualquer notificação — é só dado derivado pra desenhar.
 */
export function agruparAniversariosPorDia(
  pacientes: readonly Paciente[],
  diaInicioIso: string,
  diaFimIso: string,
): Map<string, AniversarioNaAgenda[]> {
  const mapa = new Map<string, AniversarioNaAgenda[]>();
  for (const paciente of pacientes) {
    if (paciente.estaArquivado) continue;
    const snap = paciente.toSnapshot();
    const aniversario = proximoAniversario(snap.dataNascimento, diaInicioIso);
    if (!aniversario || aniversario.dataComemorada > diaFimIso) continue;
    const lista = mapa.get(aniversario.dataComemorada) ?? [];
    lista.push({ pacienteId: paciente.id, nomeCompleto: paciente.nomeCompleto });
    mapa.set(aniversario.dataComemorada, lista);
  }
  for (const lista of mapa.values()) lista.sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR'));
  return mapa;
}

/** Lista compacta "🎂 Aniversário de Nome" — nunca mostra ano/idade/CPF/RG, só o nome e o link pra ficha. */
function ListaAniversariosDoDia({
  aniversarios,
  onAbrir,
  className,
}: {
  aniversarios: AniversarioNaAgenda[];
  onAbrir: (pacienteId: string) => void;
  className?: string;
}) {
  if (aniversarios.length === 0) return null;
  return (
    <ul className={cn('flex flex-col gap-0.5', className)}>
      {aniversarios.map((a) => (
        <li key={a.pacienteId}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAbrir(a.pacienteId);
            }}
            className="flex items-center gap-1 truncate text-left text-[11px] font-medium text-brand-700 hover:underline dark:text-brand-400"
          >
            <Cake className="h-3 w-3 shrink-0" aria-hidden="true" /> <span className="truncate">Aniversário de {a.nomeCompleto}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SecaoDoDia({
  dia,
  consultas,
  compacta,
  hoje,
  consultaDestacada,
  bloqueio,
  aniversarios,
  feriados,
  onAbrirAniversario,
  onDesbloquearDia,
  onAtualizado,
}: {
  dia: string;
  consultas: ConsultaNaAgenda[];
  compacta: boolean;
  hoje: string;
  consultaDestacada: string | null;
  bloqueio?: BloqueioAgenda;
  aniversarios: AniversarioNaAgenda[];
  feriados: FeriadoGoogle[];
  onAbrirAniversario: (pacienteId: string) => void;
  onDesbloquearDia: (bloqueio: BloqueioAgenda) => void;
  onAtualizado: () => void;
}) {
  const ehHoje = dia === hoje;
  return (
    <section className="flex flex-col gap-2">
      <AvisosFeriados eventos={feriados} />
      <h2
        className={cn(
          'flex items-center gap-2 border-b border-neutral-200 pb-1',
          compacta ? 'text-xs font-semibold uppercase tracking-wide text-neutral-500' : 'text-sm font-semibold text-neutral-700',
        )}
      >
        {compacta ? `${rotuloDiaCurto(dia)} · ${rotuloDiaMes(dia)}` : rotuloDataExtensa(dia)}
        {ehHoje && (
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[0.65rem] font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-300">
            hoje
          </span>
        )}
        <span className="ml-auto text-xs font-normal text-neutral-400">
          {consultas.length === 0 ? 'sem consultas' : `${consultas.length} consulta${consultas.length > 1 ? 's' : ''}`}
        </span>
      </h2>
      {bloqueio && (
        <button
          type="button"
          onClick={() => onDesbloquearDia(bloqueio)}
          className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-xs text-neutral-600"
        >
          <Ban className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-medium">{TIPO_BLOQUEIO_AGENDA_LABEL[bloqueio.tipo]}</strong>
            {bloqueio.motivo ? ` — ${bloqueio.motivo}` : ''} — não é possível agendar consulta neste dia.{' '}
            <span className="underline">Desbloquear</span>
          </span>
        </button>
      )}
      <ListaAniversariosDoDia aniversarios={aniversarios} onAbrir={onAbrirAniversario} />
      {consultas.length > 0 && (
        <div className="flex flex-col gap-3">
          {consultas.map(({ consulta, nomePaciente, podeWhatsapp }) => (
            <CartaoConsulta
              key={consulta.id}
              consulta={consulta}
              nomePaciente={nomePaciente}
              linkPaciente={`/pacientes/${consulta.pacienteId}/consultas`}
              destacado={consulta.id === consultaDestacada}
              podeWhatsapp={podeWhatsapp}
              onAtualizado={onAtualizado}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Agenda do consultório inteiro (day view / week view). A tela só lê e
 * chama casos de uso: `container.consulta.listarIntervalo` pra montar a
 * grade e `container.consulta.agendar` pra "Nova consulta" (a mesma
 * regra de conflito e de paciente arquivado do resto do sistema, sem
 * nada reimplementado aqui).
 */
export function AgendaPage() {
  const container = useContainer();
  const versaoAtendimentos = useEncerramentosConsultas()?.versao ?? 0;
  const navegar = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const diaParam = searchParams.get('dia');
  const modoParam = searchParams.get('modo');
  const consultaDestacada = searchParams.get('consulta');

  const dataReferencia = ehDataValida(diaParam) ? diaParam : hojeIso();
  const modo: ModoAgenda = modoParam === 'semana' ? 'semana' : modoParam === 'mes' ? 'mes' : 'dia';
  const hoje = hojeIso();
  const mesReferencia = Number(dataReferencia.slice(5, 7)) - 1;

  const [dataInicio, dataFim] =
    modo === 'dia'
      ? [dataReferencia, dataReferencia]
      : modo === 'mes'
        ? [inicioDaGradeDoMes(dataReferencia), adicionarDias(inicioDaGradeDoMes(dataReferencia), 41)]
        : [inicioDaSemana(dataReferencia), adicionarDias(inicioDaSemana(dataReferencia), 6)];

  const [consultas, setConsultas] = useState<ConsultaNaAgenda[] | null>(null);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [bloqueios, setBloqueios] = useState<BloqueioAgenda[]>([]);
  const [statusFeriados, setStatusFeriados] = useState<StatusFeriadosGoogle | null>(null);
  const [erroFeriados, setErroFeriados] = useState(false);
  const [dialogFeriados, setDialogFeriados] = useState(false);
  const [avisoEncaixe, setAvisoEncaixe] = useState('');
  const [funcionamento,setFuncionamento] = useState({ inicio:'09:00',fim:'17:00' });
  useEffect(() => { let ativo = true; void container.configuracaoClinica.obter.executar().then(c => { if (ativo) setFuncionamento(c.funcionamento ?? { inicio:'09:00',fim:'17:00' }); }).catch(() => {}); return () => { ativo = false; }; }, [container]);
  const [dialogNovaConsulta, setDialogNovaConsulta] = useState<{ aberto: boolean; data: string; horario: string }>({
    aberto: false,
    data: hojeIso(),
    horario: '09:00',
  });
  const [consultaSelecionada, setConsultaSelecionada] = useState<ConsultaNaAgenda | null>(null);
  const [dialogBloquear, setDialogBloquear] = useState(false);
  const [bloqueioParaDesbloquear, setBloqueioParaDesbloquear] = useState<BloqueioAgenda | null>(null);
  const [erroCarregar, setErroCarregar] = useState(false);

  const recarregar = useCallback(() => {
    setConsultas(null);
    setErroCarregar(false);
    container.consulta.listarIntervalo
      .executar(dataInicio, dataFim)
      .then(setConsultas)
      .catch(() => {
        setErroCarregar(true);
        setConsultas([]);
      });
  }, [container, dataInicio, dataFim]);

  const recarregarBloqueios = useCallback(() => {
    container.bloqueioAgenda.listar.executar().then(setBloqueios).catch(() => setBloqueios([]));
  }, [container]);
  const recarregarFeriados = useCallback(async () => {
    try {
      setStatusFeriados(await container.googleCalendar.obterFeriados());
      setErroFeriados(false);
      recarregarBloqueios();
    } catch { setErroFeriados(true); }
  }, [container, recarregarBloqueios]);
  useEffect(() => {
    void recarregarFeriados();
    const timer = setInterval(() => void recarregarFeriados(), 30000);
    const foco = () => void recarregarFeriados();
    window.addEventListener('focus', foco);
    return () => { clearInterval(timer); window.removeEventListener('focus', foco); };
  }, [recarregarFeriados]);
  const feriadosPorDia = useMemo(() => {
    const mapa = new Map<string, FeriadoGoogle[]>();
    for (const e of statusFeriados?.eventos ?? []) mapa.set(e.data, [...(mapa.get(e.data) ?? []), e]);
    return mapa;
  }, [statusFeriados]);
  const solicitarDesbloqueio = (bloqueio: BloqueioAgenda) => {
    if (bloqueio.id.startsWith('feriado-google-')) setDialogFeriados(true);
    else setBloqueioParaDesbloquear(bloqueio);
  };

  useEffect(() => {
    recarregar();
  }, [recarregar, versaoAtendimentos]);

  useEffect(() => {
    recarregarBloqueios();
  }, [recarregarBloqueios]);

  useEffect(() => {
    container.pacientes.listar.executar().then(setPacientes).catch(() => setPacientes([]));
  }, [container]);

  const bloqueiosPorDia = useMemo(() => new Map(bloqueios.map((b) => [b.data, b])), [bloqueios]);
  const aniversariosPorDia = useMemo(
    () => agruparAniversariosPorDia(pacientes, dataInicio, dataFim),
    [pacientes, dataInicio, dataFim],
  );
  const onAbrirAniversario = useCallback((pacienteId: string) => navegar(`/pacientes/${pacienteId}/dados`), [navegar]);

  async function handleDesbloquear(bloqueio: BloqueioAgenda): Promise<void> {
    await container.bloqueioAgenda.desbloquear.executar(bloqueio.id);
    setBloqueioParaDesbloquear(null);
    recarregarBloqueios();
  }

  function atualizarParams(mudanca: { dia?: string; modo?: ModoAgenda }): void {
    const proximo = new URLSearchParams(searchParams);
    if (mudanca.dia !== undefined) proximo.set('dia', mudanca.dia);
    if (mudanca.modo !== undefined) proximo.set('modo', mudanca.modo);
    proximo.delete('consulta');
    setSearchParams(proximo, { replace: true });
  }

  function irPara(delta: number): void {
    if (modo === 'mes') {
      atualizarParams({ dia: adicionarMeses(dataReferencia, delta) });
      return;
    }
    atualizarParams({ dia: adicionarDias(dataReferencia, delta * (modo === 'semana' ? 7 : 1)) });
  }

  const diasVisiveis =
    modo === 'dia'
      ? [dataReferencia]
      : modo === 'mes'
        ? Array.from({ length: 42 }, (_, i) => adicionarDias(dataInicio, i))
        : diasDaSemana(dataReferencia);
  const porDia = useMemo(() => agruparPorDia(consultas ?? []), [consultas]);
  const rotuloIntervalo =
    modo === 'dia'
      ? rotuloDataExtensa(dataReferencia)
      : modo === 'mes'
        ? rotuloMesAno(dataReferencia)
        : `Semana de ${rotuloDiaMes(dataInicio)} a ${rotuloDiaMes(dataFim)} de ${dataFim.slice(0, 4)}`;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <CabecalhoImpressao subtitulo={`Agenda — ${rotuloIntervalo}`} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-neutral-900">
            <CalendarDays className="h-6 w-6 text-brand-700 dark:text-brand-300" aria-hidden="true" /> Agenda
          </h1>
          <p className="no-print mt-2 text-sm text-neutral-500">Use “Nova consulta” para agendar. Selecione uma consulta para ver os detalhes.</p>
        </div>
        <div className="no-print flex items-center gap-2">
          <details className="relative"><summary className="cursor-pointer rounded-xl border border-neutral-300 px-4 py-3 text-sm font-medium">Mais opções</summary><div onClick={e => { if ((e.target as HTMLElement).closest('button, a')) e.currentTarget.closest('details')?.removeAttribute('open'); }} className="absolute right-0 z-20 mt-2 flex w-64 flex-col gap-2 rounded-xl border border-neutral-200 bg-surface p-3 shadow-lg">
          <button
            type="button"
            onClick={() => window.print()}
            className={buttonClassName('secondary')}
            title="Imprime a agenda mostrada agora (dia, semana ou mês)"
          >
            <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir
          </button>
          <button type="button" onClick={() => setDialogBloquear(true)} className={buttonClassName('secondary')}>
            <Ban className="h-4 w-4" aria-hidden="true" /> Bloquear dia(s)
          </button>
          <Button variant="secondary" onClick={() => setDialogFeriados(true)}>Atendimento em feriados</Button>
            <a href="/configuracoes#descanso-diario" className="px-2 py-2 text-sm underline">Funcionamento e descanso</a>
          </div></details>
          <Button onClick={() => setDialogNovaConsulta({ aberto: true, data: dataReferencia, horario: funcionamento.inicio })}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Nova consulta
          </Button>
        </div>
      </div>
      {avisoEncaixe && <Alert tone="success">{avisoEncaixe}</Alert>}
      <div data-tour="solicitacoes-agenda"><PainelSolicitacoesAgendamento onDecidida={recarregar} /></div>

      
      <DialogFeriados aberto={dialogFeriados} fechar={() => setDialogFeriados(false)} status={statusFeriados} atualizado={recarregarFeriados} erroCarregar={erroFeriados} />
      {(erroFeriados || statusFeriados?.erro || (statusFeriados?.habilitado && !statusFeriados.atualizadoEm)) && <Alert tone="warning">A lista de feriados não pôde ser atualizada ou ainda está carregando. Confira “Atendimento em feriados” antes de agendar.</Alert>}
      <div className="print:hidden"><AtivarNotificacoesAgendamento /></div>

      <div className="no-print flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-neutral-300">
          {(['dia', 'semana', 'mes'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => atualizarParams({ modo: m })}
              className={cn(
                'min-h-9 px-3 text-sm font-medium',
                modo === m
                  ? 'bg-brand-700 text-white'
                  : 'bg-surface text-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-200/10',
              )}
            >
              {m === 'dia' ? 'Dia' : m === 'semana' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => irPara(-1)}
            aria-label={modo === 'dia' ? 'Dia anterior' : modo === 'semana' ? 'Semana anterior' : 'Mês anterior'}
            className={buttonClassName('secondary', 'min-w-11 px-2')}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => atualizarParams({ dia: hoje })} className={buttonClassName('secondary')}>
            Hoje
          </button>
          <button
            type="button"
            onClick={() => irPara(1)}
            aria-label={modo === 'dia' ? 'Próximo dia' : modo === 'semana' ? 'Próxima semana' : 'Próximo mês'}
            className={buttonClassName('secondary', 'min-w-11 px-2')}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          {/*
            Sem `capitalize` de propósito: os rótulos de `datas-agenda.ts` já
            vêm com só a primeira letra maiúscula (ex.: "Quinta-feira, 10
            de..."); a classe CSS capitalizaria TODA palavra ("10 De
            Setembro"), errado.
            Sem `dark:text-*` de propósito também (achado ao vivo, Etapa 49):
            a paleta `neutral` deste app já se auto-inverte no tema escuro
            (ver src/index.css) — `text-neutral-800` sozinho já vira um tom
            claro e legível no escuro; um par escuro explícito bateria
            numa variável que virou ESCURA, deixando o texto quase invisível
            no fundo preto (mesma armadilha do bloco "neutral" da grade
            horária).
          */}
          <p className="ml-1 text-sm font-medium text-neutral-800">{rotuloIntervalo}</p>
        </div>

        <Input
          type="date"
          value={dataReferencia}
          onChange={(e) => e.target.value && atualizarParams({ dia: e.target.value })}
          aria-label="Ir para a data"
          className="max-w-44"
        />
      </div>

      {erroCarregar && (
        <Alert tone="warning" title="Não foi possível carregar a agenda do servidor da clínica">
          <div className="flex flex-col items-start gap-2">
            <span>O servidor pode estar fora do ar. Verifique a conexão e tente de novo.</span>
            <Button variant="secondary" onClick={recarregar} className="text-xs">
              Tentar de novo
            </Button>
          </div>
        </Alert>
      )}

      {consultas === null ? (
        <div className="flex justify-center py-10">
          <Spinner label="Carregando agenda…" />
        </div>
      ) : (
        <>
          {/* Largura estreita: lista por dia (sem grade — não cabe de forma legível). */}
          <div className="sm:hidden">
            {modo === 'mes' ? (
              <EmptyState
                title="Visão de mês precisa de uma tela maior"
                description="No celular, use Dia ou Semana — a visão de mês fica disponível no computador/tablet."
              />
            ) : consultas.length === 0 && modo === 'dia' && !bloqueiosPorDia.has(dataReferencia) && !feriadosPorDia.has(dataReferencia) && !aniversariosPorDia.has(dataReferencia) ? (
              <EmptyState
                title="Nenhuma consulta neste dia"
                description="Use “Nova consulta” para agendar, ou navegue para outro dia."
              />
            ) : (
              <div className="flex flex-col gap-6">
                {diasVisiveis.map((dia) => (
                  <SecaoDoDia
                    key={dia}
                    dia={dia}
                    consultas={porDia.get(dia) ?? []}
                    compacta={modo === 'semana'}
                    hoje={hoje}
                    consultaDestacada={consultaDestacada}
                    bloqueio={bloqueiosPorDia.get(dia)}
                    aniversarios={aniversariosPorDia.get(dia) ?? []}
                    feriados={feriadosPorDia.get(dia) ?? []}
                    onAbrirAniversario={onAbrirAniversario}
                    onDesbloquearDia={solicitarDesbloqueio}
                    onAtualizado={recarregar}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Tablet/desktop: grade horária ou mensal (Etapa 49 — estilo do Praxis/teste2). */}
          {modo === 'mes' ? (
            <GradeMensalAgenda
              dias={diasVisiveis}
              mes={mesReferencia}
              porDia={porDia}
              hoje={hoje}
              bloqueios={bloqueiosPorDia}
              aniversarios={aniversariosPorDia}
              feriados={feriadosPorDia}
              onAbrirAniversario={onAbrirAniversario}
              onSelecionarConsulta={setConsultaSelecionada}
              onSelecionarDia={(dia) => atualizarParams({ dia, modo: 'dia' })}
            />
          ) : (
            <GradeHorariaAgenda
              funcionamento={funcionamento}
              dias={diasVisiveis}
              porDia={porDia}
              hoje={hoje}
              consultaDestacada={consultaDestacada}
              bloqueios={bloqueiosPorDia}
              aniversarios={aniversariosPorDia}
              feriados={feriadosPorDia}
              onAbrirAniversario={onAbrirAniversario}
              onSelecionarConsulta={setConsultaSelecionada}
              onSelecionarSlot={(dia, horario) => setDialogNovaConsulta({ aberto: true, data: dia, horario })}
              onDesbloquearDia={solicitarDesbloqueio}
            />
          )}
        </>
      )}

      <DialogNovaConsulta
        aberto={dialogNovaConsulta.aberto}
        onFechar={() => setDialogNovaConsulta((atual) => ({ ...atual, aberto: false }))}
        pacientes={pacientes}
        dataPadrao={dialogNovaConsulta.data}
        horarioPadrao={dialogNovaConsulta.horario}
        onAgendado={(aviso) => {
          setAvisoEncaixe(aviso ?? "Consulta agendada.");
          setDialogNovaConsulta((atual) => ({ ...atual, aberto: false }));
          recarregar();
        }}
      />

      <Dialog open={consultaSelecionada !== null} onOpenChange={(v) => !v && setConsultaSelecionada(null)}>
        <DialogContent>
          <DialogTitle className="sr-only">Detalhes da consulta</DialogTitle>
          {consultaSelecionada && (
            <CartaoConsulta
              consulta={consultaSelecionada.consulta}
              nomePaciente={consultaSelecionada.nomePaciente}
              linkPaciente={`/pacientes/${consultaSelecionada.consulta.pacienteId}/consultas`}
              podeWhatsapp={consultaSelecionada.podeWhatsapp}
              onAtualizado={() => {
                setConsultaSelecionada(null);
                recarregar();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <DialogBloquearDias
        aberto={dialogBloquear}
        dataPadrao={dataReferencia}
        onFechar={() => setDialogBloquear(false)}
        onBloqueado={() => {
          setDialogBloquear(false);
          recarregarBloqueios();
        }}
      />

      <Dialog open={bloqueioParaDesbloquear !== null} onOpenChange={(v) => !v && setBloqueioParaDesbloquear(null)}>
        <DialogContent>
          <DialogTitle className="text-base font-semibold text-neutral-900">Desbloquear este dia?</DialogTitle>
          {bloqueioParaDesbloquear && (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-sm text-neutral-600">
                <strong className="font-medium">{rotuloDataExtensa(bloqueioParaDesbloquear.data)}</strong> volta a aceitar
                consultas — {TIPO_BLOQUEIO_AGENDA_LABEL[bloqueioParaDesbloquear.tipo].toLowerCase()}
                {bloqueioParaDesbloquear.motivo ? ` (${bloqueioParaDesbloquear.motivo})` : ''}.
              </p>
              <div className="flex justify-end gap-2">
                <DialogClose className={buttonClassName('secondary')}>Cancelar</DialogClose>
                <Button variant="danger" onClick={() => void handleDesbloquear(bloqueioParaDesbloquear)}>
                  Desbloquear
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Sem aviso de "sair sem salvar" de propósito (revisão de segurança
 * operacional, Etapa 47): mesmo formulário curto de data/horário/
 * duração/motivo da aba Consultas — rápido de refazer se o diálogo for
 * fechado sem querer. Isso é só sobre o aviso ao sair — registrar no
 * `EdicaoPendenteProvider` (pra adiar o popup automático) é separado.
 */
function DialogNovaConsulta({
  aberto,
  onFechar,
  pacientes,
  dataPadrao,
  horarioPadrao = '09:00',
  onAgendado,
}: {
  aberto: boolean;
  onFechar: () => void;
  pacientes: Paciente[];
  dataPadrao: string;
  /** Pré-preenchido ao abrir clicando num espaço vazio da grade horária (Etapa 49) — `09:00` no botão "Nova consulta" do topo. */
  horarioPadrao?: string;
  onAgendado: (aviso?: string) => void;
}) {
  const container = useContainer();
  const [pacienteId, setPacienteId] = useState('');
  const [data, setData] = useState(dataPadrao);
  const [horario, setHorario] = useState(horarioPadrao);
  const [duracaoMinutos, setDuracaoMinutos] = useState('30');
  const [motivo, setMotivo] = useState('');
  const [procedimentoId, setProcedimentoId] = useState(AVALIAR_NO_CONSULTORIO);
  const [emergencia, setEmergencia] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Adia o popup automático de novas solicitações enquanto há escolha
  // real em andamento neste diálogo (nunca reabre aviso de "sair sem
  // salvar" — Etapa 47 preservada).
  useRegistrarEdicaoPendente(useId(), aberto && (pacienteId !== '' || motivo.trim() !== '' || emergencia));

  // Sempre que o diálogo abre, reinicia com a data/horário que a agenda mandou (do topo, ou de um espaço vazio clicado na grade).
  useEffect(() => {
    if (aberto) {
      setPacienteId('');
      setData(dataPadrao);
      setHorario(horarioPadrao);
      setDuracaoMinutos('30');
      setMotivo('');
      setProcedimentoId(AVALIAR_NO_CONSULTORIO);
      setEmergencia(false);
      setErro(null);
    }
  }, [aberto, dataPadrao, horarioPadrao]);

  async function handleAgendar(): Promise<void> {
    if (!pacienteId) {
      setErro('Escolha um paciente.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const criada = await container.consulta.agendar.executar({
        pacienteId,
        data,
        horario,
        duracaoMinutos: Number(duracaoMinutos),
        motivo: motivo.trim() || 'Avaliar no consultório',
        procedimentoId: procedimentoId === AVALIAR_NO_CONSULTORIO ? undefined : procedimentoId,
        definirValorNoConsultorio: procedimentoId === AVALIAR_NO_CONSULTORIO,
        ehEmergencia: emergencia,
      });
      const salva = criada.toSnapshot();
      onAgendado(salva.horario !== horario ? "Horário ajustado de " + horario + " para " + salva.horario + ", próximo horário disponível." : undefined);
    } catch (erroCapturado) {
      setErro(mensagemDeErro(erroCapturado, 'Não foi possível agendar a consulta.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogTitle className="text-base font-semibold text-neutral-900">Nova consulta</DialogTitle>
        {erro && (
          <Alert tone="danger" className="mt-3">
            {erro}
          </Alert>
        )}
        {pacientes.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="Nenhum paciente ativo"
              description="Cadastre um paciente antes de agendar uma consulta."
              action={
                <Link to="/pacientes/novo" className={buttonClassName('primary')}>
                  Cadastrar paciente
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-800">
                Paciente
                <span aria-hidden="true" className="text-danger-600">
                  {' '}
                  *
                </span>
              </span>
              <SeletorPaciente pacientes={pacientes} pacienteId={pacienteId} onSelecionar={setPacienteId} autoFocus />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Data">
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </Field>
              <Field label="Horário">
                <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
              </Field>
              <Field label="Duração (min)">
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={duracaoMinutos}
                  onChange={(e) => setDuracaoMinutos(e.target.value)}
                />
              </Field>
            </div>
            <ProcedimentoAgendamento valor={procedimentoId} emergencia={emergencia} onChange={(id, nome) => { setProcedimentoId(id); setMotivo(nome); }} />
            <Field label="Observações / motivo detalhado (opcional)">
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: Retorno, avaliação, urgência" />
            </Field>
            <Checkbox
              id="nova-consulta-emergencia"
              label="Atendimento de emergência (taxa adicional de R$ 350,00)"
              checked={emergencia}
              onChange={(e) => setEmergencia(e.target.checked)}
            />
            {emergencia && <Alert tone="warning">{AVISO_TAXA_EMERGENCIA}</Alert>}
            <div className="flex justify-end gap-2">
              <DialogClose className={buttonClassName('secondary')}>Cancelar</DialogClose>
              <Button onClick={() => void handleAgendar()} loading={salvando}>
                Agendar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const OPCOES_TIPO_BLOQUEIO: TipoBloqueioAgenda[] = ['FERIADO', 'FIM_DE_SEMANA', 'AVULSO'];

/**
 * Bloqueia um dia ou um intervalo de dias na Agenda (pedido do
 * usuário: "coloque a opção de bloquear dia/dias como feriado, finais
 * de semana ou dias avulso... e que esses dias não possam ser
 * registrados pra consulta"). "Final de semana" só bloqueia os
 * sábados/domingos dentro do intervalo escolhido — pode marcar o ano
 * inteiro sem fechar os dias úteis do meio (ver `diasDoBloqueio` no
 * domínio).
 */
function DialogBloquearDias({
  aberto,
  dataPadrao,
  onFechar,
  onBloqueado,
}: {
  aberto: boolean;
  dataPadrao: string;
  onFechar: () => void;
  onBloqueado: () => void;
}) {
  const container = useContainer();
  const [dataInicio, setDataInicio] = useState(dataPadrao);
  const [dataFim, setDataFim] = useState(dataPadrao);
  const [tipo, setTipo] = useState<TipoBloqueioAgenda>('AVULSO');
  const [motivo, setMotivo] = useState('');
  const [motivoPublico, setMotivoPublico] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ehPeriodo = tipo !== 'AVULSO';
  // Mesma lógica do diálogo de nova consulta acima — nunca reabre aviso
  // de "sair sem salvar" (Etapa 47 preservada).
  useRegistrarEdicaoPendente(useId(), aberto && (motivo.trim() !== '' || motivoPublico.trim() !== ''));

  useEffect(() => {
    if (aberto) {
      setDataInicio(dataPadrao);
      setDataFim(dataPadrao);
      setTipo('AVULSO');
      setMotivo('');
      setMotivoPublico('');
      setErro(null);
    }
  }, [aberto, dataPadrao]);

  async function handleBloquear(): Promise<void> {
    setSalvando(true);
    setErro(null);
    try {
      // `motivoPublico` nunca é enviado para AVULSO — mesma regra que o
      // aviso do WhatsApp já aplica (`whatsapp-funcionamento.mjs`), aqui
      // só por reforço: o campo nem aparece na tela pra esse tipo.
      const criados = await container.bloqueioAgenda.bloquear.executar({
        dataInicio,
        dataFim,
        tipo,
        motivo,
        motivoPublico: ehPeriodo ? motivoPublico : undefined,
      });
      if (criados.length === 0) {
        setErro('Nenhum dia novo foi bloqueado — os dias desse intervalo já estavam bloqueados ou não há nenhum sábado/domingo nele.');
        return;
      }
      onBloqueado();
    } catch (erroCapturado) {
      setErro(mensagemDeErro(erroCapturado, 'Não foi possível bloquear estes dias.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogTitle className="text-base font-semibold text-neutral-900">Bloquear dia(s) na agenda</DialogTitle>
        <p className="mt-2 text-sm text-neutral-600">O bot avisará essas datas no menu e no agendamento, sem enviar mensagens em massa. Consultas existentes precisam ser revistas e reagendadas pela equipe; seus avisos automáticos ficarão bloqueados.</p>
        {erro && (
          <Alert tone="danger" className="mt-3">
            {erro}
          </Alert>
        )}
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="De">
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </Field>
            <Field label="Até">
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </Field>
          </div>
          <Field label="Tipo">
            <Select
              value={tipo}
              onChange={(e) => {
                const novoTipo = e.target.value as TipoBloqueioAgenda;
                setTipo(novoTipo);
                // Achado do usuário: o diálogo abre com "De"/"Até" iguais
                // ao dia que a Agenda está mostrando — deixar esse
                // intervalo de UM dia só e escolher "Final de semana"
                // bloqueava só aquele único dia (sábado OU domingo,
                // dependendo do que estava na tela), parecendo que só
                // domingo era bloqueado. Ao escolher esse tipo com um
                // intervalo de um dia só, expande pro fim de semana
                // inteiro (sábado + domingo) mais próximo.
                if (novoTipo === 'FIM_DE_SEMANA' && dataInicio === dataFim) {
                  const { dataInicio: sabado, dataFim: domingo } = fimDeSemanaMaisProximo(dataInicio);
                  setDataInicio(sabado);
                  setDataFim(domingo);
                }
              }}
            >
              {OPCOES_TIPO_BLOQUEIO.map((t) => (
                <option key={t} value={t}>
                  {TIPO_BLOQUEIO_AGENDA_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          {tipo === 'FIM_DE_SEMANA' && (
            <p className="text-xs text-neutral-500">
              Só os sábados e domingos dentro do intervalo escolhido ficam bloqueados — os dias úteis do meio continuam livres.
            </p>
          )}
          {ehPeriodo && (
            <Field
              label="Motivo público (aparece no aviso do WhatsApp)"
              hint="Só pra Feriado/Final de semana. Se ficar em branco, o aviso mostra só a indisponibilidade, sem motivo."
            >
              <Input value={motivoPublico} onChange={(e) => setMotivoPublico(e.target.value)} placeholder="Ex.: Natal, recesso de fim de ano" />
            </Field>
          )}
          <Field
            label="Observação interna (opcional)"
            hint={ehPeriodo ? 'Só a equipe vê — nunca aparece no WhatsApp.' : 'Só a equipe vê. Um dia avulso nunca divulga motivo no WhatsApp, mesmo preenchendo aqui.'}
          >
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: consulta médica da Dra., manutenção" />
          </Field>
          <div className="flex justify-end gap-2">
            <DialogClose className={buttonClassName('secondary')}>Cancelar</DialogClose>
            <Button onClick={() => void handleBloquear()} loading={salvando}>
              Bloquear
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
