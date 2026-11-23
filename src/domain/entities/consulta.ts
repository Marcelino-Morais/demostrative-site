import { agoraIso, ErroDominio, gerarId } from '../types.js';
import { dataCalendarioValida } from '../value-objects/data-cadastral.js';

export type StatusConsulta = 'AGENDADA' | 'CONFIRMADA' | 'REALIZADA' | 'CANCELADA' | 'FALTOU';

export const STATUS_CONSULTA_LABEL: Record<StatusConsulta, string> = {
  AGENDADA: 'Agendada',
  CONFIRMADA: 'Confirmada',
  REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada',
  FALTOU: 'Faltou',
};

/** Mesmo vocabulário de tom usado pelo resto do app — só a apresentação decide a classe CSS. */
export type TomStatusConsulta = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

export const TOM_POR_STATUS_CONSULTA: Record<StatusConsulta, TomStatusConsulta> = {
  AGENDADA: 'brand',
  CONFIRMADA: 'success',
  REALIZADA: 'neutral',
  CANCELADA: 'danger',
  FALTOU: 'warning',
};

/** Um evento no histórico de status — a "auditoria" pedida: nunca se reescreve o passado, só se acrescenta. */
export interface EventoDeStatusConsulta {
  status: StatusConsulta;
  em: string;
  motivo?: string;
}

/** Valor previsto, congelado ao agendar; nunca representa pagamento recebido. */
export interface OrcamentoConsulta {
  procedimentoId: string | null;
  descricao: string;
  valorCentavos: number | null;
  valorMinimoCentavos: number | null;
  valorMaximoCentavos: number | null;
  definirNoConsultorio: boolean;
}

export interface ConsultaProps {
  encerramentoFinanceiro?: {planoId:string;modo:'NOVO'|'EXISTENTE';valorCentavos?:number;conferidoEm:string} | null;
  id: string;
  pacienteId: string;
  /** `YYYY-MM-DD`, mesmo formato de `<input type="date">` usado no resto do app. */
  data: string;
  /** `HH:mm`, 24 horas. */
  horario: string;
  duracaoMinutos: number;
  motivo: string;
  orcamento?: OrcamentoConsulta | null;
  /** Atendimento de emergência — taxa adicional de R$ 150,00 (ver `value-objects/atendimento-emergencia.ts`). */
  ehEmergencia: boolean;
  taxaEmergenciaCentavos?: number;
  status: StatusConsulta;
  historicoDeStatus: EventoDeStatusConsulta[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface AgendarConsultaInput {
  pacienteId: string;
  data: string;
  horario: string;
  duracaoMinutos: number;
  motivo: string;
  procedimentoId?: string;
  definirValorNoConsultorio?: boolean;
  orcamento?: OrcamentoConsulta | null;
  ehEmergencia?: boolean;
}

const PADRAO_HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

function validarDataEHorario(data: string, horario: string): void {
  if (!data) throw new ErroDominio('Data da consulta é obrigatória.');
  if (!dataCalendarioValida(data)) throw new ErroDominio('Data da consulta inválida.');
  if (!PADRAO_HORARIO.test(horario)) throw new ErroDominio('Horário inválido — use o formato HH:mm.');
}

/**
 * Consulta agendada (front "Appointment workflow" — pedido explícito:
 * "add a simple scheduling flow", "connect appointments to the
 * patient record", "keep status transitions clear and auditable").
 * Consultório de profissional única — não há conflito entre
 * profissionais diferentes pra resolver, só contra a própria agenda da
 * Dra. Fernanda (`consultasSeSobrepoem`, usada pelo caso de uso ao
 * agendar/reagendar, já que checar contra OUTRAS consultas exige o
 * repositório, não cabe dentro da entidade).
 */
export class Consulta {
  private constructor(private props: ConsultaProps) {}

  static agendar(input: AgendarConsultaInput): Consulta {
    if (!input.pacienteId) {
      throw new ErroDominio('Consulta precisa estar vinculada a um paciente.');
    }
    validarDataEHorario(input.data, input.horario);
    if (!Number.isFinite(input.duracaoMinutos) || input.duracaoMinutos <= 0) {
      throw new ErroDominio('Duração deve ser maior que zero.');
    }
    const agora = agoraIso();
    return new Consulta({
      id: gerarId(),
      pacienteId: input.pacienteId,
      data: input.data,
      horario: input.horario,
      duracaoMinutos: input.duracaoMinutos,
      motivo: input.motivo.trim(),
      orcamento: input.orcamento ? { ...input.orcamento } : null,
      ehEmergencia: input.ehEmergencia ?? false,
      taxaEmergenciaCentavos: 35000,
      status: 'AGENDADA',
      historicoDeStatus: [{ status: 'AGENDADA', em: agora }],
      criadoEm: agora,
      atualizadoEm: agora,
    });
  }

  static restaurar(props: ConsultaProps): Consulta {
    // `historicoDeStatus` e `ehEmergencia` foram adicionados depois de já
    // existirem consultas salvas — normalizados aqui pra nunca vazar
    // `undefined` pra UI/backup.
    return new Consulta({
      ...props,
      ehEmergencia: props.ehEmergencia ?? false,
      taxaEmergenciaCentavos: props.taxaEmergenciaCentavos ?? 15000,
      historicoDeStatus: props.historicoDeStatus ?? [],
    });
  }

  private transicionar(novoStatus: StatusConsulta, motivo?: string): void {
    this.props.status = novoStatus;
    this.props.atualizadoEm = agoraIso();
    this.props.historicoDeStatus.push({ status: novoStatus, em: this.props.atualizadoEm, motivo });
  }

  confirmar(): void {
    if (this.props.status !== 'AGENDADA') {
      throw new ErroDominio('Só uma consulta agendada pode ser confirmada.');
    }
    this.transicionar('CONFIRMADA');
  }

  marcarRealizada(): void {
    if (this.props.status === 'CANCELADA' || this.props.status === 'REALIZADA') {
      throw new ErroDominio('Esta consulta não pode ser marcada como realizada.');
    }
    this.transicionar('REALIZADA');
  }

  marcarFalta(): void {
    if (this.props.status !== 'AGENDADA' && this.props.status !== 'CONFIRMADA') {
      throw new ErroDominio('Só uma consulta agendada ou confirmada pode ser marcada como falta.');
    }
    this.transicionar('FALTOU');
  }

  cancelar(motivo = ''): void {
    if (this.props.status === 'REALIZADA') {
      throw new ErroDominio('Uma consulta já realizada não pode ser cancelada.');
    }
    if (this.props.status === 'CANCELADA') {
      throw new ErroDominio('Esta consulta já está cancelada.');
    }
    this.transicionar('CANCELADA', motivo.trim() || undefined);
  }

  /** Reagendar sempre volta o status pra AGENDADA — quem reagenda precisa confirmar de novo. */
  reagendar(novaData: string, novoHorario: string): void {
    if (this.props.status === 'CANCELADA' || this.props.status === 'REALIZADA') {
      throw new ErroDominio('Esta consulta não pode ser reagendada.');
    }
    validarDataEHorario(novaData, novoHorario);
    this.props.data = novaData;
    this.props.horario = novoHorario;
    this.transicionar('AGENDADA', `Reagendada para ${novaData} ${novoHorario}`);
  }

  get id(): string {
    return this.props.id;
  }

  get pacienteId(): string {
    return this.props.pacienteId;
  }

  get status(): StatusConsulta {
    return this.props.status;
  }

  toSnapshot(): Readonly<ConsultaProps> {
    return { ...this.props, orcamento: this.props.orcamento ? { ...this.props.orcamento } : null, historicoDeStatus: [...this.props.historicoDeStatus] };
  }
}

function horarioParaMinutos(horario: string): number {
  const [horas, minutos] = horario.split(':').map(Number);
  return horas! * 60 + minutos!;
}

/**
 * Duas consultas se sobrepõem quando caem no mesmo dia e seus
 * intervalos de horário se cruzam — usada pelo caso de uso ao
 * agendar/reagendar pra evitar marcar dois pacientes no mesmo horário
 * (consultório de profissional única, sem múltiplas agendas pra
 * conciliar). Função pura de domínio: não sabe nada de repositório,
 * só compara os dados de duas consultas.
 */
export function consultasSeSobrepoem(
  a: Pick<ConsultaProps, 'data' | 'horario' | 'duracaoMinutos'>,
  b: Pick<ConsultaProps, 'data' | 'horario' | 'duracaoMinutos'>,
): boolean {
  const inicioA = Date.parse(a.data + 'T00:00:00Z') / 60000 + horarioParaMinutos(a.horario);
  const fimA = inicioA + a.duracaoMinutos;
  const inicioB = Date.parse(b.data + 'T00:00:00Z') / 60000 + horarioParaMinutos(b.horario);
  const fimB = inicioB + b.duracaoMinutos;
  return inicioA < fimB && inicioB < fimA;
}
