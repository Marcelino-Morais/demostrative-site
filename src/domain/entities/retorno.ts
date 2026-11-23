import { dataCalendarioValida } from '../value-objects/data-cadastral.js';
import { agoraIso, ErroDominio, gerarId } from '../types.js';

/**
 * Retorno/follow-up — acompanhamento de um paciente depois de um
 * procedimento (ex.: revisão de canal em 6 meses, reavaliação de
 * periodontal em 3 meses). NUNCA cria uma consulta sozinho — "Agendado"
 * é só um status marcado manualmente pela clínica depois de agendar de
 * verdade pela Agenda (que continua sendo a única fonte de verdade de
 * horário/conflito/dia bloqueado). Este domínio não guarda nenhuma
 * referência a uma `Consulta` específica — a ligação entre o retorno e
 * a consulta real é só operacional (a clínica sabe por que agendou),
 * nunca automática.
 */

export type StatusRetorno = 'PENDENTE' | 'AGENDADO' | 'CONCLUIDO' | 'DISPENSADO';

export const STATUS_RETORNO_LABEL: Record<StatusRetorno, string> = {
  PENDENTE: 'Pendente',
  AGENDADO: 'Agendado',
  CONCLUIDO: 'Concluído',
  DISPENSADO: 'Dispensado',
};

/** `ATRASADO` nunca é gravado — é sempre calculado na hora, comparando `dataPrevista` com hoje (ver `statusApresentacaoRetorno`). */
export type StatusApresentacaoRetorno = StatusRetorno | 'ATRASADO';

export interface RetornoProps {
  id: string;
  pacienteId: string;
  /** `YYYY-MM-DD` — data em que o retorno deveria acontecer. */
  dataPrevista: string;
  observacao: string;
  status: StatusRetorno;
  /**
   * Procedimento do catálogo que originou este retorno automaticamente
   * — `null` quando foi criado manualmente ou o procedimento não tinha
   * intervalo de retorno configurado.
   */
  procedimentoOrigemId: string | null;
  /**
   * Item de orçamento concluído que originou este retorno — usado só
   * pra nunca gerar um segundo retorno automático pro MESMO item
   * concluído de novo. `null` para um retorno manual.
   */
  itemTratamentoOrigemId: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface NovoRetornoInput {
  pacienteId: string;
  dataPrevista: string;
  observacao?: string;
  procedimentoOrigemId?: string | null;
  itemTratamentoOrigemId?: string | null;
}


export class Retorno {
  private constructor(private props: RetornoProps) {}

  static criar(input: NovoRetornoInput): Retorno {
    if (!input.pacienteId) throw new ErroDominio('Paciente é obrigatório para criar um retorno.');
    if (!dataCalendarioValida(input.dataPrevista)) {
      throw new ErroDominio('Data prevista inválida — use o formato AAAA-MM-DD.');
    }
    const agora = agoraIso();
    return new Retorno({
      id: gerarId(),
      pacienteId: input.pacienteId,
      dataPrevista: input.dataPrevista,
      observacao: (input.observacao ?? '').trim(),
      status: 'PENDENTE',
      procedimentoOrigemId: input.procedimentoOrigemId ?? null,
      itemTratamentoOrigemId: input.itemTratamentoOrigemId ?? null,
      criadoEm: agora,
      atualizadoEm: agora,
    });
  }

  static restaurar(props: RetornoProps): Retorno {
    return new Retorno({
      ...props,
      observacao: props.observacao ?? '',
      procedimentoOrigemId: props.procedimentoOrigemId ?? null,
      itemTratamentoOrigemId: props.itemTratamentoOrigemId ?? null,
    });
  }

  private garantirNaoFinalizado(acao: string): void {
    if (this.props.status === 'CONCLUIDO' || this.props.status === 'DISPENSADO') {
      throw new ErroDominio(`Não é possível ${acao} um retorno que já está ${STATUS_RETORNO_LABEL[this.props.status].toLowerCase()}.`);
    }
  }

  /** Marcado manualmente pela clínica DEPOIS de agendar de verdade pela Agenda — nunca cria consulta nenhuma. */
  marcarAgendado(): void {
    this.garantirNaoFinalizado('marcar como agendado');
    this.props.status = 'AGENDADO';
    this.props.atualizadoEm = agoraIso();
  }

  marcarConcluido(): void {
    this.garantirNaoFinalizado('concluir');
    this.props.status = 'CONCLUIDO';
    this.props.atualizadoEm = agoraIso();
  }

  dispensar(): void {
    this.garantirNaoFinalizado('dispensar');
    this.props.status = 'DISPENSADO';
    this.props.atualizadoEm = agoraIso();
  }

  /** Adia a data prevista — nunca muda o status (continua Pendente/Agendado). */
  adiarPara(novaData: string): void {
    this.garantirNaoFinalizado('adiar');
    if (!dataCalendarioValida(novaData)) throw new ErroDominio('Data inválida — use o formato AAAA-MM-DD.');
    this.props.dataPrevista = novaData;
    this.props.atualizadoEm = agoraIso();
  }

  get id(): string {
    return this.props.id;
  }

  get pacienteId(): string {
    return this.props.pacienteId;
  }

  get status(): StatusRetorno {
    return this.props.status;
  }

  get itemTratamentoOrigemId(): string | null {
    return this.props.itemTratamentoOrigemId;
  }

  toSnapshot(): Readonly<RetornoProps> {
    return { ...this.props };
  }
}

/**
 * `ATRASADO` é só uma lente de apresentação sobre Pendente/Agendado
 * cuja `dataPrevista` já passou — nunca gravado no domínio, sempre
 * recalculado contra a data de hoje.
 */
export function statusApresentacaoRetorno(props: RetornoProps, hojeIso: string): StatusApresentacaoRetorno {
  if ((props.status === 'PENDENTE' || props.status === 'AGENDADO') && props.dataPrevista < hojeIso) return 'ATRASADO';
  return props.status;
}
