export interface LinkAgendamentoRemotoProps {
  id: string;
  token: string;
  pacienteId: string;
  status: 'ATIVO' | 'REVOGADO';
  criadoEm: string;
  expiraEm: string;
  revogadoEm: string | null;
}

export type StatusEfetivoLinkAgendamento = 'ATIVO' | 'REVOGADO' | 'EXPIRADO';

export type ResultadoAberturaAgendamento =
  | {
      ok: true;
      primeiroNomePaciente: string;
      podeAgendar: boolean;
      statusEfetivo: StatusEfetivoLinkAgendamento;
    }
  | { ok: false; motivo: 'nao-encontrado' | 'revogado' | 'expirado' };

export interface LinkAgendamentoRemoto {
  props: LinkAgendamentoRemotoProps;
  statusEfetivo: StatusEfetivoLinkAgendamento;
}

export interface ConfirmarAgendamentoPublicoInput {
  data: string;
  horario: string;
  motivo?: string;
  ehEmergencia: boolean;
}

export interface ResultadoConfirmacaoAgendamento {
  ok: true;
  consulta: {
    id: string;
    data: string;
    horario: string;
    duracaoMinutos: number;
    ehEmergencia: boolean;
  };
}

export interface GatewayAgendamentoWhatsapp {
  gerarLink(pacienteId: string): Promise<LinkAgendamentoRemotoProps>;
  abrirPublico(token: string): Promise<ResultadoAberturaAgendamento>;
  confirmarPublico(token: string, input: ConfirmarAgendamentoPublicoInput): Promise<ResultadoConfirmacaoAgendamento>;
  /** `null` quando o paciente nunca teve um link de agendamento gerado. */
  obterLinkDoPaciente(pacienteId: string): Promise<LinkAgendamentoRemoto | null>;
  revogarLink(linkId: string): Promise<void>;
}
