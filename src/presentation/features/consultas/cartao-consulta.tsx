import { ValorPrevistoConsulta } from './procedimento-agendamento.js';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Consulta } from '../../../domain/entities/consulta.js';
import { STATUS_CONSULTA_LABEL, TOM_POR_STATUS_CONSULTA } from '../../../domain/entities/consulta.js';
import { mensagemDeErro } from '../../lib/erros.js';
import { Alert } from '../../components/ui/alert.js';
import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Field } from '../../components/ui/field.js';
import { Input } from '../../components/ui/input.js';
import { cn } from '../../lib/cn.js';
import { formatarDataIso } from '../../lib/formatadores.js';
import { useRegistrarEdicaoPendente } from '../../providers/edicao-pendente-provider.js';
import { useContainer } from '../../providers/container-provider.js';
import { useEncerramentosConsultas } from '../../providers/encerramentos-consultas-provider.js';
import { BotaoWhatsapp } from '../../../../whatsapp-itens/src/presentation/features/whatsapp/botao-whatsapp.js';

export interface CartaoConsultaProps {
  consulta: Consulta;
  onAtualizado: () => void;
  /** Quando presente, mostra o nome do paciente (contexto de agenda do consultório, não da ficha do próprio paciente). */
  nomePaciente?: string;
  /** Quando presente, o nome vira um link pra ficha do paciente. */
  linkPaciente?: string;
  /** Destaca o cartão (ex.: veio de um deep-link "ir para esta consulta" no Painel). */
  destacado?: boolean;
  /** Mostra a ação de WhatsApp só quando o paciente tem um número utilizável. */
  podeWhatsapp?: boolean;
}

/**
 * Uma consulta como cartão de ação — usada tanto na aba Consultas de um
 * paciente quanto na Agenda do consultório inteiro. Toda transição de
 * status é uma chamada a um caso de uso (`container.consulta.*`), nunca
 * uma regra reimplementada aqui; cada ação só aparece quando a
 * transição é válida (ver `domain/entities/consulta.ts`).
 */
export function CartaoConsulta({
  consulta,
  onAtualizado,
  nomePaciente,
  linkPaciente,
  destacado,
  podeWhatsapp = false,
}: CartaoConsultaProps) {
  const container = useContainer();
  const encerramentos = useEncerramentosConsultas();
  const snap = consulta.toSnapshot();
  const [reagendando, setReagendando] = useState(false);
  const [novaData, setNovaData] = useState(snap.data);
  const [novoHorario, setNovoHorario] = useState(snap.horario);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  // Edição de reagendamento aberta — adia o popup automático de novas
  // solicitações enquanto a dentista está no meio dessa troca (sem
  // reabrir aviso de "sair sem salvar", decisão da Etapa 47 preservada).
  useRegistrarEdicaoPendente(useId(), reagendando);

  async function executar(acao: () => Promise<unknown>): Promise<void> {
    setProcessando(true);
    setErro(null);
    try {
      await acao();
      onAtualizado();
    } catch (erroCapturado) {
      setErro(mensagemDeErro(erroCapturado, 'Não foi possível atualizar a consulta.'));
    } finally {
      setProcessando(false);
    }
  }

  async function handleReagendar(): Promise<void> {
    await executar(() => container.consulta.reagendar.executar(snap.id, novaData, novoHorario));
    setReagendando(false);
  }

  const podeReagendar = snap.status !== 'CANCELADA' && snap.status !== 'REALIZADA';
  // Canceladas e faltas continuam visíveis (histórico do dia), só recuam
  // visualmente — mas na impressão voltam à opacidade cheia pra não sumir no papel.
  const discreto = snap.status === 'CANCELADA' || snap.status === 'FALTOU';

  return (
    <Card
      className={cn(
        'flex flex-col gap-2',
        discreto && 'opacity-60 print:opacity-100',
        destacado && 'ring-2 ring-brand-500 ring-offset-2 ring-offset-surface',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-neutral-900">
          {formatarDataIso(snap.data)} às {snap.horario}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {snap.ehEmergencia && <Badge tone="warning">Emergência · taxa do atendimento</Badge>}
          <Badge tone={TOM_POR_STATUS_CONSULTA[snap.status]}>{STATUS_CONSULTA_LABEL[snap.status]}</Badge>
        </span>
      </div>
      {nomePaciente &&
        (linkPaciente ? (
          <Link to={linkPaciente} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">
            {nomePaciente} <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span className="text-sm font-medium text-neutral-800">{nomePaciente}</span>
        ))}
      <p className="text-sm text-neutral-600">Duração prevista: {snap.duracaoMinutos} min</p>
      {snap.motivo && (
        <p className="text-sm text-neutral-800">
          <span className="text-neutral-500">Motivo:</span> {snap.motivo}
        </p>
      )}
      <ValorPrevistoConsulta orcamento={snap.orcamento} emergencia={snap.ehEmergencia} taxaEmergenciaCentavos={snap.taxaEmergenciaCentavos ?? 15000} />
      {erro && (
        <Alert tone="danger" className="no-print">
          {erro}
        </Alert>
      )}

      {reagendando ? (
        <div className="no-print flex flex-col gap-3 rounded-md border border-neutral-200 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nova data">
              <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
            </Field>
            <Field label="Novo horário">
              <Input type="time" value={novoHorario} onChange={(e) => setNovoHorario(e.target.value)} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void handleReagendar()} loading={processando} className="self-start">
              Confirmar novo horário
            </Button>
            <Button variant="secondary" onClick={() => setReagendando(false)} className="self-start">
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="no-print flex flex-wrap gap-3 text-xs font-medium">
          {snap.status==='REALIZADA'&&!snap.encerramentoFinanceiro&&container.encerramentosConsultas&&<button type="button" className="text-brand-700 hover:underline" onClick={()=>void encerramentos?.abrir(snap.id)}>Conferir financeiro</button>}
          {snap.encerramentoFinanceiro&&<Link className="text-brand-700 hover:underline" to={`/pacientes/${snap.pacienteId}/plano-tratamento`}>Ver plano e registrar pagamento</Link>}
          {snap.status === 'AGENDADA' && (
            <button
              type="button"
              onClick={() => void executar(() => container.consulta.confirmar.executar(snap.id))}
              className="text-brand-700 hover:underline dark:text-brand-400"
            >
              Confirmar
            </button>
          )}
          {(snap.status === 'AGENDADA' || snap.status === 'CONFIRMADA') && (
            <>
              <Link className="font-semibold text-brand-700 underline" to={`/pacientes/${snap.pacienteId}/atendimento?consulta=${encodeURIComponent(snap.id)}`}>Iniciar atendimento</Link>
              <button
                type="button"
                onClick={() => encerramentos && container.encerramentosConsultas ? void encerramentos.abrir(snap.id) : void executar(() => container.consulta.marcarRealizada.executar(snap.id))}
                className="text-success-700 hover:underline dark:text-success-500"
              >
                Marcar realizada
              </button>
              <button
                type="button"
                onClick={() => void executar(() => container.consulta.marcarFalta.executar(snap.id))}
                className="text-warning-700 hover:underline dark:text-warning-500"
              >
                Marcar falta
              </button>
              <button
                type="button"
                onClick={() => void executar(() => container.consulta.cancelar.executar(snap.id))}
                className="text-danger-600 hover:underline dark:text-danger-500"
              >
                Cancelar
              </button>
            </>
          )}
          {podeReagendar && (
            <button
              type="button"
              onClick={() => setReagendando(true)}
              className="text-neutral-600 hover:underline"
            >
              Reagendar
            </button>
          )}
          {podeWhatsapp && snap.status !== 'REALIZADA' && snap.status !== 'CANCELADA' && (
            <BotaoWhatsapp
              rotulo="Mensagem no WhatsApp"
              preparar={() => container.whatsapp.prepararDeConsulta.executar(snap.id)}
              aoAbrir={(numeroNormalizado, tipo) =>
                container.whatsapp.registrarAbertura.executar({ pacienteId: snap.pacienteId, tipo, numeroNormalizado })
              }
            />
          )}
        </div>
      )}

      {snap.historicoDeStatus.length > 1 && (
        <details className="no-print text-xs text-neutral-500">
          <summary className="cursor-pointer select-none">Histórico de alterações ({snap.historicoDeStatus.length})</summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {snap.historicoDeStatus.map((evento, indice) => (
              <li key={indice}>
                {STATUS_CONSULTA_LABEL[evento.status]} — {new Date(evento.em).toLocaleString('pt-BR')}
                {evento.motivo ? ` (${evento.motivo})` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
