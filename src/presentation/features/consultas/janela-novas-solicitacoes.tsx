import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { SolicitacaoAgendamento } from '../../../application/ports/porta-solicitacoes-agendamento.js';
import { Button, buttonClassName } from '../../components/ui/button.js';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog.js';
import { rotuloDataExtensa } from '../../lib/datas-agenda.js';
import { formatarDataHoraIso } from '../../lib/formatadores.js';
import { useContainer } from '../../providers/container-provider.js';
import { useExisteEdicaoPendente } from '../../providers/edicao-pendente-provider.js';
import { useSolicitacoesPendentes } from '../../providers/solicitacoes-pendentes-provider.js';
import { DialogAnaliseSolicitacao } from './painel-solicitacoes-agendamento.js';

const NOME_LOCK = 'pf-janela-solicitacoes';

/**
 * Janela automática de solicitações de agendamento — abre sozinha
 * quando chega pendência nova e ainda não reconhecida POR ESTE
 * DISPOSITIVO (nunca reabre pelas já reconhecidas; nunca silencia
 * outro dispositivo — ver `porta-solicitacoes-agendamento.ts`,
 * `vistaPorEsteDispositivo`). Mostra TODAS as pendentes, não só as
 * novas, ordenadas por data recebida.
 *
 * Três coisas distintas, de propósito (achado explícito do pedido):
 * - APRESENTAÇÃO: esta janela renderizada na tela agora.
 * - RECONHECIMENTO: só quando a PESSOA clica "Fechar" — nunca
 *   só por ter aparecido (fechar a aba/o navegador cair no meio não
 *   marca nada; a pendência continua aparecendo depois, aqui e em
 *   qualquer outro dispositivo).
 * - DECISÃO (aprovar/recusar): já era global por natureza — o
 *   `status` da própria solicitação, sem relação com isto.
 *
 * Duas camadas de segurança contra interromper o trabalho:
 * 1. Formulário com alteração não salva EM QUALQUER LUGAR do app
 *    (`useExisteEdicaoPendente` — registro compartilhado de verdade,
 *    não só foco de campo) adia a abertura.
 * 2. Qualquer outro diálogo já aberto (`[role="dialog"]`) também adia.
 * Adiar nunca perde o aviso — o contador/painel continuam visíveis, e
 * o próximo ciclo tenta de novo.
 *
 * Deduplicação DENTRO do mesmo navegador (várias abas) via Web Locks
 * API: só a aba que consegue o lock decide mostrar, e segura o lock
 * até a pessoa fechar — as outras abas, tentando o mesmo lock, ficam
 * na fila e, quando a vez delas chegar, já encontram tudo reconhecido
 * (então não mostram nada). Sem Web Locks (navegador antigo): cada aba
 * decide sozinha — pode mostrar em mais de uma aba do MESMO navegador
 * ao mesmo tempo (redundante, nunca inseguro: aprovar duas vezes a
 * mesma solicitação já é bloqueado no SERVIDOR, não aqui).
 */
export function JanelaNovasSolicitacoes() {
  const container = useContainer();
  const { pendentes, recarregar } = useSolicitacoesPendentes();
  const existeEdicaoPendente = useExisteEdicaoPendente();
  const [aberta, setAberta] = useState(false);
  const [emAnalise, setEmAnalise] = useState<SolicitacaoAgendamento | null>(null);
  const liberarLockRef = useRef<(() => void) | null>(null);
  const tentandoRef = useRef(false);
  const pendentesRef = useRef(pendentes);
  pendentesRef.current = pendentes;

  const naoVistas = pendentes.filter((s) => !s.vistaPorEsteDispositivo);

  useEffect(() => {
    if (aberta || tentandoRef.current || naoVistas.length === 0) return;
    if (existeEdicaoPendente || document.querySelector('[role="dialog"]')) return; // adia — próximo ciclo tenta de novo

    tentandoRef.current = true;
    let cancelado = false;

    async function tentarAbrir(): Promise<void> {
      const abrirAgora = (): void => {
        if (!cancelado) setAberta(true);
      };
      if (!('locks' in navigator)) {
        abrirAgora();
        tentandoRef.current = false;
        return;
      }
      await navigator.locks.request(
        NOME_LOCK,
        (lock) =>
          new Promise<void>((liberar) => {
            if (!lock || cancelado) {
              liberar();
              return;
            }
            // Re-checagem com o estado mais recente — pode ter mudado
            // (outra aba já reconheceu) enquanto esperava a vez do lock.
            if (pendentesRef.current.every((s) => s.vistaPorEsteDispositivo)) {
              liberar();
              return;
            }
            liberarLockRef.current = liberar;
            abrirAgora();
          }),
      );
      tentandoRef.current = false;
    }

    void tentarAbrir();
    return () => {
      cancelado = true;
    };
  }, [naoVistas.length, aberta, existeEdicaoPendente]);

  function fechar(): void {
    const idsParaReconhecer = pendentesRef.current.map((s) => s.id);
    setAberta(false);
    liberarLockRef.current?.();
    liberarLockRef.current = null;
    if (idsParaReconhecer.length > 0) {
      void container.solicitacaoAgendamento.marcarVistas.executar(idsParaReconhecer).then(recarregar);
    }
  }

  if (!aberta) return null;

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && fechar()}>
        <DialogContent>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <AlertTriangle className="h-5 w-5 text-warning-600" aria-hidden="true" />
            {pendentes.length} solicitação(ões) de agendamento aguardando análise
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-2 flex max-h-[50vh] flex-col gap-2 overflow-y-auto text-sm text-neutral-700">
              <p>
                O Google Forms recebeu pedido(s) de horário — nenhum deles ocupa a agenda até você aprovar ou
                recusar.
              </p>
              <ul className="flex flex-col gap-2">
                {pendentes.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning-200 bg-surface px-3 py-2"
                  >
                    <span>
                      <strong>{s.pacienteNome ?? 'Paciente não encontrado'}</strong>
                      <br />
                      <span className="text-xs text-neutral-500">Recebida em {formatarDataHoraIso(s.criadoEm)}</span>
                      <br />
                      Solicitou {rotuloDataExtensa(s.data)} às {s.horario}
                      {s.ehEmergencia && <span className="ml-2 text-xs font-semibold text-danger-700">Emergência</span>}
                    </span>
                    <Button variant="secondary" onClick={() => setEmAnalise(s)}>
                      Analisar solicitação
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </DialogDescription>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={fechar} className={buttonClassName('secondary')}>
              Fechar
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {emAnalise && (
        <DialogAnaliseSolicitacao
          solicitacao={emAnalise}
          onFechar={() => setEmAnalise(null)}
          onDecidida={() => {
            setEmAnalise(null);
            recarregar();
          }}
        />
      )}
    </>
  );
}
