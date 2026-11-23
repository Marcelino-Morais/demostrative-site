import { Ban, Cake } from 'lucide-react';
import type { ConsultaNaAgenda } from '../../../application/use-cases/consulta.js';
import { TIPO_BLOQUEIO_AGENDA_LABEL, type BloqueioAgenda } from '../../../domain/entities/bloqueio-agenda.js';
import { TOM_POR_STATUS_CONSULTA, type TomStatusConsulta } from '../../../domain/entities/consulta.js';
import { cn } from '../../lib/cn.js';
import { minutosDesdeMeiaNoite, rotuloDiaCurto, rotuloDiaMes } from '../../lib/datas-agenda.js';
import type { AniversarioNaAgenda } from '../../pages/agenda-page.js';

const HORA_INICIO = 7;
const HORA_FIM = 20;
const ALTURA_LINHA_PX = 56;

/**
 * Regra de ouro deste arquivo, achada ao vivo (Etapa 49): NENHUMA
 * classe `neutral-N` (fundo, texto ou borda) leva prefixo `dark:`. A
 * paleta `neutral` deste app já se auto-inverte no tema escuro
 * trocando as variáveis CSS (`--color-neutral-*`, ver `src/index.css`)
 * — `neutral-800` sozinho já vira um tom claro e legível no escuro
 * (mesmo texto/fundo escuro em `neutral-800` no claro); um
 * `dark:bg-neutral-800`/`dark:text-neutral-300`/`dark:border-neutral-800`
 * bateria numa variável que a essa altura JÁ inverteu de sentido,
 * deixando o elemento com a cor errada (às vezes ilegível) no tema
 * escuro. Mesma regra que `Badge`/`TONE_CLASSES.neutral` já seguem.
 * A ÚNICA exceção legítima é um estado de HOVER que precisa ser
 * visivelmente diferente do fundo em repouso (`hover:bg-neutral-50`
 * sozinho ficaria invisível no escuro, porque `neutral-50` já É o
 * fundo da página lá) — nesses casos, e só nesses, um
 * `dark:hover:bg-neutral-800/60` deliberado está correto.
 */
export const TOM_BLOCO_CLASSES: Record<TomStatusConsulta, string> = {
  brand: 'bg-brand-100 text-brand-900 border-brand-400 dark:bg-brand-900/40 dark:text-brand-200 dark:border-brand-700',
  success:
    'bg-success-100 text-success-800 border-success-400 dark:bg-success-900/40 dark:text-success-200 dark:border-success-700',
  warning:
    'bg-warning-100 text-warning-800 border-warning-400 dark:bg-warning-900/40 dark:text-warning-200 dark:border-warning-700',
  danger:
    'bg-danger-100 text-danger-800 border-danger-400 dark:bg-danger-900/40 dark:text-danger-200 dark:border-danger-700',
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-300',
};

function rotuloHora(hora: number): string {
  return `${String(hora).padStart(2, '0')}:00`;
}

/** `0`–`100` — posição vertical na grade para um horário em minutos desde a meia-noite, sujeita à janela 7h–20h. */
function offsetPercentual(minutosAbsolutos: number, horaInicio: number, horaFim: number): number {
  const minutos = minutosAbsolutos - horaInicio * 60;
  return Math.min(100, Math.max(0, (minutos / ((horaFim-horaInicio) * 60)) * 100));
}

export interface GradeHorariaAgendaProps {
  funcionamento?: { inicio: string; fim: string };
  /** 1 data (visão "dia") ou 7 datas (visão "semana"), `YYYY-MM-DD`. */
  dias: string[];
  porDia: Map<string, ConsultaNaAgenda[]>;
  hoje: string;
  /** Id de uma consulta pra destacar (deep-link "ir para esta consulta" do Painel/Relatórios) — mesmo realce da lista estreita. */
  consultaDestacada?: string | null;
  /** Dias bloqueados (feriado/final de semana/avulso — Etapa 51) por data — a coluna inteira fica fechada pra "Nova consulta". */
  bloqueios: Map<string, BloqueioAgenda>;
  /** Aniversariantes por data — só informativo, nunca ocupa a grade nem bloqueia o slot embaixo. */
  aniversarios: Map<string, AniversarioNaAgenda[]>;
  feriados?: Map<string, FeriadoGoogle[]>;
  onAbrirAniversario: (pacienteId: string) => void;
  onSelecionarConsulta: (item: ConsultaNaAgenda) => void;
  onSelecionarSlot: (dia: string, horario: string) => void;
  onDesbloquearDia: (bloqueio: BloqueioAgenda) => void;
}

/**
 * Grade horária da Agenda (Etapa 49 — pedido do usuário: "restaurar a
 * experiência da agenda do Praxis/teste2, que era melhor"). Janela fixa
 * 7h–20h, cada consulta é um bloco posicionado pelo horário/duração,
 * colorido pelo mesmo tom de status usado no resto do app. Clicar num
 * espaço vazio abre "Nova consulta" já com aquele dia/horário; clicar
 * num bloco abre o cartão de detalhes (mesmo `CartaoConsulta` da aba
 * Consultas, com as mesmas ações — nada de regra nova aqui).
 *
 * Só desktop/tablet (`sm:` pra cima) — a visão em lista por dia,
 * embaixo/junto na página, cobre telas estreitas, do jeito que já
 * funcionava. Na visão semana, os 7 dias têm uma largura mínima; abaixo
 * dela a grade rola na horizontal em vez de espremer o nome do
 * paciente até ficar ilegível.
 */
export function GradeHorariaAgenda({
  dias,
  funcionamento,
  porDia,
  hoje,
  consultaDestacada,
  bloqueios,
  aniversarios,
  feriados,
  onAbrirAniversario,
  onSelecionarConsulta,
  onSelecionarSlot,
  onDesbloquearDia,
}: GradeHorariaAgendaProps) {
  const registros = [...porDia.values()].flat().map(i => i.consulta.toSnapshot());
  const horaInicio = Math.max(0, Math.min(HORA_INICIO, Math.floor(minutosDesdeMeiaNoite(funcionamento?.inicio ?? '09:00')/60), ...registros.map(c => Math.floor(minutosDesdeMeiaNoite(c.horario)/60))));
  const horaFim = Math.min(24, Math.max(HORA_FIM, Math.ceil(minutosDesdeMeiaNoite(funcionamento?.fim ?? '17:00')/60), ...registros.map(c => Math.ceil((minutosDesdeMeiaNoite(c.horario)+c.duracaoMinutos)/60))));
  const linhas = horaFim-horaInicio;
  const alturaGrade = linhas * ALTURA_LINHA_PX;
  const ehSemana = dias.length > 1;
  const quantidadeAvisos = Math.max(0, ...dias.map(dia => (aniversarios.get(dia)?.length ?? 0) + (feriados?.get(dia)?.length ?? 0)));
  const alturaAvisos = quantidadeAvisos ? Math.min(160, quantidadeAvisos * 36 + 8) : 0;

  return (
    <div className="hidden overflow-x-auto rounded-md border border-neutral-200 sm:block">
      <div className={cn('flex', ehSemana && 'min-w-[50rem]')}>
        <div className="w-14 shrink-0">
          <div className="h-12 border-b border-neutral-200" />
          <div style={{ height: alturaAvisos }} />
          {Array.from({ length: linhas }, (_, i) => horaInicio + i).map((hora) => (
            <div
              key={hora}
              style={{ height: ALTURA_LINHA_PX }}
              className="border-t border-neutral-100 pr-2 text-right text-xs text-neutral-400"
            >
              {rotuloHora(hora)}
            </div>
          ))}
        </div>

        {dias.map((dia) => {
          const consultasDoDia = porDia.get(dia) ?? [];
          const ehHoje = dia === hoje;
          const bloqueio = bloqueios.get(dia);
          const aniversariosDoDia = aniversarios.get(dia) ?? [];
          return (
            <div key={dia} className="min-w-[7rem] flex-1 border-l border-neutral-200">
              <div
                className={cn(
                  'flex h-12 flex-col items-center justify-center border-b border-neutral-200 text-xs font-medium',
                  bloqueio
                    ? 'bg-neutral-100'
                    : ehHoje
                      ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300'
                      : 'text-neutral-600',
                )}
              >
                <span className="uppercase">{rotuloDiaCurto(dia)}</span>
                <span>{rotuloDiaMes(dia)}</span>
              </div>
              <div style={{ height: alturaAvisos }} className="overflow-y-auto">
              {aniversariosDoDia.length > 0 && (
                <ul className="flex flex-col gap-0.5 border-b border-neutral-100 bg-surface px-1.5 py-1">
                  {aniversariosDoDia.map((a) => (
                    <li key={a.pacienteId}>
                      <button
                        type="button"
                        onClick={() => onAbrirAniversario(a.pacienteId)}
                        className="flex w-full items-center gap-1 truncate text-left text-[11px] font-medium text-brand-700 hover:underline dark:text-brand-400"
                      >
                        <Cake className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">Aniversário de {a.nomeCompleto}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <AvisosFeriados eventos={feriados?.get(dia)} />
              </div>
              {bloqueio ? (
                <button
                  type="button"
                  onClick={() => onDesbloquearDia(bloqueio)}
                  title={`${TIPO_BLOQUEIO_AGENDA_LABEL[bloqueio.tipo]}${bloqueio.motivo ? ` — ${bloqueio.motivo}` : ''}. Clique para desbloquear.`}
                  className="flex w-full flex-col items-center gap-1 bg-neutral-50 px-2 py-6 text-center text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                  style={{ minHeight: alturaGrade }}
                >
                  <Ban className="h-4 w-4" aria-hidden="true" />
                  <span className="font-medium">{TIPO_BLOQUEIO_AGENDA_LABEL[bloqueio.tipo]}</span>
                  {bloqueio.motivo && <span className="line-clamp-2">{bloqueio.motivo}</span>}
                  <span className="underline">Desbloquear</span>
                </button>
              ) : (
                <div className="relative" style={{ height: alturaGrade }}>
                  {Array.from({ length: linhas }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Nova consulta às ${rotuloHora(horaInicio + i)}`}
                      style={{ height: ALTURA_LINHA_PX }}
                      className="block w-full border-t border-neutral-100 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 dark:hover:bg-neutral-800/60"
                      onClick={() => onSelecionarSlot(dia, rotuloHora(horaInicio + i))}
                    />
                  ))}
                  {consultasDoDia.map((item) => {
                    const snap = item.consulta.toSnapshot();
                    const inicioMin = minutosDesdeMeiaNoite(snap.horario);
                    const top = offsetPercentual(inicioMin, horaInicio, horaFim);
                    const altura = Math.max(4, offsetPercentual(inicioMin + snap.duracaoMinutos, horaInicio, horaFim) - top);
                    const discreto = snap.status === 'CANCELADA' || snap.status === 'FALTOU';
                    return (
                      <button
                        key={snap.id}
                        type="button"
                        onClick={() => onSelecionarConsulta(item)}
                        style={{ top: `${top}%`, height: `${altura}%` }}
                        className={cn(
                          'absolute inset-x-1 overflow-hidden rounded border-l-4 px-1.5 py-1 text-left text-xs shadow-sm',
                          TOM_BLOCO_CLASSES[TOM_POR_STATUS_CONSULTA[snap.status]],
                          discreto && 'opacity-60',
                          snap.id === consultaDestacada && 'ring-2 ring-brand-500 ring-offset-1',
                        )}
                      >
                        <p className="truncate font-medium">{item.nomePaciente}</p>
                        <p className="truncate">
                          {snap.horario}
                          {snap.ehEmergencia ? ' · Emergência' : ''}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
import type { FeriadoGoogle } from '../../../application/ports/porta-google-calendar.js';
import { AvisosFeriados } from './feriados-agenda.js';
