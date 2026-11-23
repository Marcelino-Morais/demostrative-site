import { Ban, Cake } from 'lucide-react';
import type { FeriadoGoogle } from '../../../application/ports/porta-google-calendar.js';
import { AvisosFeriados } from './feriados-agenda.js';
import type { ConsultaNaAgenda } from '../../../application/use-cases/consulta.js';
import { TIPO_BLOQUEIO_AGENDA_LABEL, type BloqueioAgenda } from '../../../domain/entities/bloqueio-agenda.js';
import { TOM_POR_STATUS_CONSULTA, type TomStatusConsulta } from '../../../domain/entities/consulta.js';
import { cn } from '../../lib/cn.js';
import type { AniversarioNaAgenda } from '../../pages/agenda-page.js';

const CABECALHO_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MAXIMO_POR_DIA = 3;

/**
 * Só a bolinha de status — mesma regra de ouro de `grade-horaria-agenda.tsx`
 * (Etapa 49): nenhuma classe `neutral-N` leva `dark:` neste arquivo, exceto
 * hover que precisa contrastar com o fundo em repouso — ver o comentário
 * completo lá.
 */
export const COR_PONTO_CLASSES: Record<TomStatusConsulta, string> = {
  brand: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  neutral: 'bg-neutral-400',
};

export interface GradeMensalAgendaProps {
  /** 42 datas `YYYY-MM-DD` (6 semanas, domingo a sábado) cobrindo o mês + sobra das pontas. */
  dias: string[];
  /** Mês "oficial" sendo mostrado (`0`–`11`) — dias de outros meses na grade ficam esmaecidos. */
  mes: number;
  porDia: Map<string, ConsultaNaAgenda[]>;
  hoje: string;
  /** Dias bloqueados (feriado/final de semana/avulso — Etapa 51) por data — só uma marca visual; o detalhe/desbloquear fica na visão Dia. */
  bloqueios: Map<string, BloqueioAgenda>;
  /** Aniversariantes por data — só informativo, nunca ocupa espaço de consulta nem conta no limite de 3 por dia. */
  aniversarios: Map<string, AniversarioNaAgenda[]>;
  feriados?: Map<string, FeriadoGoogle[]>;
  onAbrirAniversario: (pacienteId: string) => void;
  onSelecionarConsulta: (item: ConsultaNaAgenda) => void;
  onSelecionarDia: (dia: string) => void;
}

/**
 * Visão de mês da Agenda (Etapa 49 — pedido do usuário, mesmo espírito
 * da grade horária: restaurar a experiência do Praxis/teste2). Cada
 * dia mostra até 3 consultas + contador do restante; clicar num dia
 * leva pra visão "Dia" dele; clicar numa consulta abre o cartão de
 * detalhes (mesmo de sempre — nada de regra nova aqui).
 *
 * Só desktop/tablet (`sm:` pra cima), mesma resposabilidade dividida
 * da grade horária: a Agenda mostra um aviso simples em telas
 * estreitas em vez de espremer 42 dias numa lista rolável enorme.
 */
export function GradeMensalAgenda({
  dias,
  mes,
  porDia,
  hoje,
  bloqueios,
  aniversarios,
  feriados,
  onAbrirAniversario,
  onSelecionarConsulta,
  onSelecionarDia,
}: GradeMensalAgendaProps) {
  return (
    <div className="hidden overflow-hidden rounded-md border border-neutral-200 sm:block">
      <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50">
        {CABECALHO_DIAS.map((rotulo) => (
          <div key={rotulo} className="px-2 py-2 text-center text-xs font-medium text-neutral-500">
            {rotulo}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const consultasDoDia = (porDia.get(dia) ?? []).slice().sort((a, b) => a.consulta.toSnapshot().horario.localeCompare(b.consulta.toSnapshot().horario));
          const visiveis = consultasDoDia.slice(0, MAXIMO_POR_DIA);
          const restantes = consultasDoDia.length - visiveis.length;
          const noMes = Number(dia.slice(5, 7)) - 1 === mes;
          const ehHoje = dia === hoje;
          const bloqueio = bloqueios.get(dia);
          const aniversariosDoDia = aniversarios.get(dia) ?? [];
          return (
            <button
              key={dia}
              type="button"
              onClick={() => onSelecionarDia(dia)}
              title={bloqueio ? `${TIPO_BLOQUEIO_AGENDA_LABEL[bloqueio.tipo]}${bloqueio.motivo ? ` — ${bloqueio.motivo}` : ''}` : undefined}
              className={cn(
                'flex min-h-24 flex-col gap-1 border-b border-r border-neutral-100 p-1.5 text-left last:border-r-0 hover:bg-neutral-50 dark:hover:bg-neutral-900/60',
                !noMes && 'bg-neutral-100/60',
                bloqueio && 'bg-neutral-50',
              )}
            >
              <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                <span
                  className={cn(
                    'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                    ehHoje ? 'bg-brand-700 text-white' : noMes ? 'text-neutral-700' : 'text-neutral-400',
                  )}
                >
                  {Number(dia.slice(8, 10))}
                </span>
                {bloqueio && (
                  // Sem `truncate` de propósito (achado ao vivo, Etapa 51):
                  // numa célula estreita (tela intermediária, ~768px) o
                  // rótulo "Final de semana" cortava no meio da palavra.
                  // `flex-wrap` no pai deixa a etiqueta cair pra própria
                  // linha, e o texto quebra normalmente em vez de truncar.
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium leading-tight text-neutral-500">
                    <Ban className="h-3 w-3 shrink-0" aria-hidden="true" /> {TIPO_BLOQUEIO_AGENDA_LABEL[bloqueio.tipo]}
                  </span>
                )}
              </span>
              {aniversariosDoDia.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  {aniversariosDoDia.map((a) => (
                    <span
                      key={a.pacienteId}
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAbrirAniversario(a.pacienteId);
                      }}
                      className="flex items-center gap-1 truncate text-[11px] font-medium text-brand-700 hover:underline dark:text-brand-400"
                    >
                      <Cake className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">Aniversário de {a.nomeCompleto}</span>
                    </span>
                  ))}
                </div>
              )}
              <AvisosFeriados eventos={feriados?.get(dia)} />
              <div className="flex flex-col gap-0.5">
                {visiveis.map((item) => {
                  const snap = item.consulta.toSnapshot();
                  return (
                    <span
                      key={snap.id}
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelecionarConsulta(item);
                      }}
                      className={cn(
                        'flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] hover:bg-neutral-100 dark:hover:bg-neutral-800',
                        (snap.status === 'CANCELADA' || snap.status === 'FALTOU') && 'opacity-60',
                      )}
                    >
                      <span
                        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', COR_PONTO_CLASSES[TOM_POR_STATUS_CONSULTA[snap.status]])}
                        aria-hidden="true"
                      />
                      <span className="truncate text-neutral-700">
                        {snap.horario} {item.nomePaciente}
                      </span>
                    </span>
                  );
                })}
                {restantes > 0 && <span className="px-1 text-[11px] font-medium text-neutral-500">+{restantes} mais</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
