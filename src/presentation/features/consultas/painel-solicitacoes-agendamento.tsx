import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  MOTIVO_PENDENCIA_PROCEDIMENTO_TEXTO,
  type SolicitacaoAgendamento,
} from '../../../application/ports/porta-solicitacoes-agendamento.js';
import { Alert } from '../../components/ui/alert.js';
import { Button, buttonClassName } from '../../components/ui/button.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog.js';
import { Field } from '../../components/ui/field.js';
import { Input } from '../../components/ui/input.js';
import { rotuloDataExtensa } from '../../lib/datas-agenda.js';
import { mensagemDeErro } from '../../lib/erros.js';
import { useContainer } from '../../providers/container-provider.js';
import { useSolicitacoesPendentes } from '../../providers/solicitacoes-pendentes-provider.js';
import { AVALIAR_NO_CONSULTORIO, ProcedimentoAgendamento } from './procedimento-agendamento.js';

function horarioDeTermino(horario: string, duracaoMinutos: number): string {
  const [h, m] = horario.split(':').map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + duracaoMinutos;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Janela de análise de UMA solicitação — aprovação exige duração
 * digitada na hora (sempre em branco, nunca um padrão oculto) e
 * revalida conflito/dia bloqueado no SERVIDOR só no momento de
 * confirmar (nunca na abertura da janela). Fechar ou recusar nunca
 * ocupa a agenda.
 */
export function DialogAnaliseSolicitacao({
  solicitacao,
  onFechar,
  onDecidida,
}: {
  solicitacao: SolicitacaoAgendamento;
  onFechar: () => void;
  onDecidida: () => void;
}) {
  const container = useContainer();
  const [atual, setAtual] = useState(solicitacao);
  const [duracaoMinutos, setDuracaoMinutos] = useState(solicitacao.propostaHorario?.aceitoEm ? String(solicitacao.propostaHorario.duracaoMinutos) : '');
  const [erroDuracao, setErroDuracao] = useState<string | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aprovando, setAprovando] = useState(false);
  const [aguardandoPaciente, setAguardandoPaciente] = useState(false);
  const [horarioEncaixado, setHorarioEncaixado] = useState('');
  const [recusando, setRecusando] = useState(false);
  const [procedimentoEscolhido, setProcedimentoEscolhido] = useState(AVALIAR_NO_CONSULTORIO);
  const [definindoProcedimento, setDefinindoProcedimento] = useState(false);
  const [erroProcedimento, setErroProcedimento] = useState<string | null>(null);

  const duracaoNumero = duracaoMinutos.trim() === '' ? null : Number(duracaoMinutos);
  const duracaoValida = duracaoNumero !== null && Number.isInteger(duracaoNumero) && duracaoNumero > 0;
  const horarioEmAnalise = atual.propostaHorario?.aceitoEm ? atual.propostaHorario.horario : atual.horario;
  const termino = duracaoValida ? horarioDeTermino(horarioEmAnalise, duracaoNumero) : null;

  async function definirProcedimento(): Promise<void> {
    setErroProcedimento(null);
    setDefinindoProcedimento(true);
    try {
      const atualizada = await container.solicitacaoAgendamento.definirProcedimento.executar(
        atual.id,
        procedimentoEscolhido === AVALIAR_NO_CONSULTORIO ? null : procedimentoEscolhido,
      );
      setAtual(atualizada);
    } catch (e) {
      setErroProcedimento(mensagemDeErro(e, 'Não foi possível definir o procedimento agora.'));
    } finally {
      setDefinindoProcedimento(false);
    }
  }

  async function aprovar(): Promise<void> {
    if (!duracaoValida) {
      setErroDuracao(
        duracaoMinutos.trim() === ''
          ? 'A duração é obrigatória.'
          : 'Use um número inteiro de minutos, maior que zero.',
      );
      return;
    }
    setErroDuracao(null);
    setErro(null);
    setAprovando(true);
    try {
      const resultado = await container.solicitacaoAgendamento.aprovar.executar(atual.id, duracaoNumero);
      if (resultado.aguardandoPaciente) { setAguardandoPaciente(true); setHorarioEncaixado(resultado.horario ?? atual.horario); }
      else if (resultado.horario && resultado.horario !== atual.horario) setHorarioEncaixado(resultado.horario);
      else onDecidida();
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível aprovar esta solicitação agora.'));
    } finally {
      setAprovando(false);
    }
  }

  async function recusar(): Promise<void> {
    setErro(null);
    setRecusando(true);
    try {
      await container.solicitacaoAgendamento.recusar.executar(atual.id, motivoRecusa.trim() || undefined);
      onDecidida();
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível recusar esta solicitação agora.'));
    } finally {
      setRecusando(false);
    }
  }

  if (horarioEncaixado) return (
    <Dialog open onOpenChange={aberto => { if (!aberto) onDecidida(); }}>
      <DialogContent>
        <DialogTitle>{aguardandoPaciente ? 'Proposta aguardando aceite' : 'Agendamento confirmado'}</DialogTitle>
        <DialogDescription>
          {aguardandoPaciente ? `Proposta para ${horarioEncaixado} preparada para envio pelo WhatsApp. Após o aceite do paciente, faça a aprovação final no site. Nenhuma consulta foi criada. Confira o estado do envio na lista.` : `Horário confirmado: ${horarioEncaixado}.`}
        </DialogDescription>
        <Button onClick={onDecidida}>Concluir</Button>
      </DialogContent>
    </Dialog>
  );
  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent>
        <DialogTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <AlertTriangle className="h-5 w-5 text-warning-600" aria-hidden="true" /> Analisar solicitação de agendamento
        </DialogTitle>
        <DialogDescription asChild>
          <div className="mt-2 flex flex-col gap-3 text-sm text-neutral-700">
            <p className="font-medium text-neutral-900">{atual.pacienteNome ?? 'Paciente não encontrado'}</p>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-neutral-500">Data solicitada</dt>
                <dd className="text-neutral-800">{rotuloDataExtensa(atual.data)}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Horário solicitado</dt>
                <dd className="text-neutral-800">{atual.horario}</dd>
              </div>
              {atual.orcamento && (
                <div className="col-span-2">
                  <dt className="text-neutral-500">Procedimento</dt>
                  <dd className="text-neutral-800">{atual.orcamento.descricao}</dd>
                </div>
              )}
              {atual.motivoPaciente && (
                <div className="col-span-2">
                  <dt className="text-neutral-500">Motivo informado pelo paciente</dt>
                  <dd className="text-neutral-800">{atual.motivoPaciente}</dd>
                </div>
              )}
              {atual.ehEmergencia && (
                <div className="col-span-2 font-semibold text-danger-700">
                  Emergência — taxa adicional de {((atual.taxaEmergenciaCentavos ?? 15000)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                </div>
              )}
            </dl>

            {atual.motivoPendencia && (
              <Alert tone="warning" title="Procedimento não resolvido pelo formulário">
                <div className="flex flex-col gap-2">
                  <p>
                    {MOTIVO_PENDENCIA_PROCEDIMENTO_TEXTO[atual.motivoPendencia] ??
                      'Não foi possível identificar o procedimento desejado automaticamente.'}{' '}
                    Escolha abaixo (ou aprove mesmo assim para avaliar pessoalmente) — nunca é preciso pedir que a
                    pessoa preencha o formulário de novo.
                  </p>
                  <ProcedimentoAgendamento
                    valor={procedimentoEscolhido}
                    onChange={(id) => setProcedimentoEscolhido(id)}
                    emergencia={atual.ehEmergencia}
                  />
                  {erroProcedimento && (
                    <p role="alert" className="text-xs text-danger-700">
                      {erroProcedimento}
                    </p>
                  )}
                  <Button
                    variant="secondary"
                    className="self-start text-xs"
                    onClick={() => void definirProcedimento()}
                    loading={definindoProcedimento}
                  >
                    Definir procedimento
                  </Button>
                </div>
              </Alert>
            )}

            <Field label="Duração prevista (minutos)" required error={erroDuracao ?? undefined}>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                placeholder="Ex.: 30"
                value={duracaoMinutos}
                onChange={(e) => {
                  setDuracaoMinutos(e.target.value);
                  setErroDuracao(null);
                }}
                invalid={Boolean(erroDuracao)}
              />
            </Field>
            {termino && (
              <p className="text-xs text-neutral-500">
                Horário de término previsto: <strong>{termino}</strong> (de {horarioEmAnalise} a {termino})
              </p>
            )}

            <Field label="Motivo da recusa (opcional — só para registro interno)">
              <Input
                value={motivoRecusa}
                onChange={(e) => setMotivoRecusa(e.target.value)}
                placeholder="Ex.: horário indisponível"
              />
            </Field>

            {erro && (
              <p role="alert" className="text-xs text-danger-700">
                {erro}
              </p>
            )}
          </div>
        </DialogDescription>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <DialogClose className={buttonClassName('secondary')}>Fechar</DialogClose>
          <Button variant="danger" onClick={() => void recusar()} loading={recusando}>
            Recusar solicitação
          </Button>
          <Button onClick={() => void aprovar()} loading={aprovando}>
            {atual.propostaHorario?.aceitoEm ? 'Aprovar definitivamente' : 'Analisar horário e continuar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Aviso + lista das solicitações de agendamento do Google Forms ainda
 * pendentes de revisão — nunca aparece quando não há nenhuma. Lê do
 * `SolicitacoesPendentesProvider` compartilhado (mesmo dado do contador
 * na navegação), nunca busca por conta própria.
 */
export function PainelSolicitacoesAgendamento({ onDecidida }: { onDecidida: () => void }) {
  const { pendentes, recarregar } = useSolicitacoesPendentes();
  const [emAnalise, setEmAnalise] = useState<SolicitacaoAgendamento | null>(null);

  if (pendentes.length === 0) return null;

  return (
    <Alert tone="warning" title={`${pendentes.length} solicitação(ões) de agendamento aguardando análise`}>
      <div className="flex flex-col gap-2">
        <p>
          O Google Forms recebeu pedido(s) de horário que ainda não foram confirmados — nenhum deles ocupa a agenda
          até você aprovar ou recusar.
        </p>
        <ul className="flex flex-col gap-2">
          {pendentes.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning-200 bg-surface px-3 py-2"
            >
              <span className="text-sm text-neutral-800">
                <strong>{s.pacienteNome ?? 'Paciente não encontrado'}</strong> — {rotuloDataExtensa(s.data)} às{' '}
                {s.horario}
                {s.propostaHorario && <span className="block text-xs">Proposta: {s.propostaHorario.horario} — {s.propostaHorario.recusadoEm ? 'Recusada pelo paciente; combine outro horário' : s.propostaHorario.expira <= Date.now() ? 'Expirada; analise novamente' : s.propostaHorario.aceitoEm ? 'Aceita pelo paciente; aguarda aprovação final' : `Aguardando aceite. Envio: ${s.propostaHorario.envio}${s.propostaHorario.motivoEnvio ? ` — ${s.propostaHorario.motivoEnvio}` : ''}`}</span>}
                {s.ehEmergencia && <span className="ml-2 text-xs font-semibold text-danger-700">Emergência</span>}
              </span>
              <Button variant="secondary" onClick={() => setEmAnalise(s)}>
                Analisar solicitação
              </Button>
            </li>
          ))}
        </ul>
      </div>
      {emAnalise && (
        <DialogAnaliseSolicitacao
          solicitacao={emAnalise}
          onFechar={() => setEmAnalise(null)}
          onDecidida={() => {
            setEmAnalise(null);
            recarregar();
            onDecidida();
          }}
        />
      )}
    </Alert>
  );
}
