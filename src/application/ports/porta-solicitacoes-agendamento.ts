import type { OrcamentoConsulta } from '../../domain/entities/consulta.js';

/**
 * Port das solicitações de agendamento vindas do Google Forms — nunca
 * ocupam a agenda por conta própria; a clínica precisa aprovar
 * (digitando a duração) ou recusar explicitamente (ver
 * `server/index.mjs`, `/api/solicitacoes-agendamento/*`). `APROVANDO`
 * é um estado transiente (queda simulada entre criar a consulta e
 * concluir a aprovação) — a tela nunca oferece ação nesse estado, só
 * avisa que precisa de verificação manual.
 */
export type StatusSolicitacaoAgendamento = 'PENDENTE' | 'APROVANDO' | 'APROVADA' | 'RECUSADA';

export interface SolicitacaoAgendamento {
  propostaHorario?: { horario: string; data: string; duracaoMinutos: number; aceitoEm: string | null; recusadoEm?: string; envio: string; motivoEnvio?: string; expira: number };
  id: string;
  pacienteId: string;
  /** `null` quando o paciente não foi encontrado (removido depois da solicitação). */
  pacienteNome: string | null;
  data: string;
  horario: string;
  motivoPaciente: string;
  ehEmergencia: boolean;
  taxaEmergenciaCentavos?: number;
  orcamento: OrcamentoConsulta | null;
  /**
   * Código curto de por que o procedimento não foi resolvido pelo
   * Forms (ex.: `procedimento-nao-informado`, `procedimento-exige-revisao`)
   * — `null` quando resolvido ou nunca aplicável (solicitação criada por
   * outro caminho). NUNCA some sozinho: só é limpo por
   * `definirProcedimento` (ação explícita da equipe) ou se a própria
   * resposta do Forms já veio com o procedimento certo.
   */
  motivoPendencia: string | null;
  status: StatusSolicitacaoAgendamento;
  /** Só existe a partir de `APROVADA` — nunca um padrão, sempre digitada pela clínica na aprovação. */
  duracaoMinutos: number | null;
  consultaId: string | null;
  motivoRecusa: string | null;
  criadoEm: string;
  atualizadoEm: string;
  decididoEm: string | null;
  /**
   * Reconhecimento POR DISPOSITIVO (nunca global, nunca por "usuário" —
   * este sistema não distingue contas individuais): `true` só depois de
   * uma ação EXPLÍCITA deste mesmo navegador (fechar a janela, abrir
   * pra analisar) — nunca só por a janela automática ter aparecido na
   * tela. Fechar/reconhecer numa máquina nunca muda isto em outra.
   */
  vistaPorEsteDispositivo: boolean;
}

/** Explicação curta e segura (sem dado de paciente) de cada `motivoPendencia` — pra tela de revisão. */
export const MOTIVO_PENDENCIA_PROCEDIMENTO_TEXTO: Record<string, string> = {
  'procedimento-nao-informado': 'O formulário não trouxe qual procedimento a pessoa quer.',
  'procedimento-exige-revisao': 'A resposta do formulário não corresponde a nenhum procedimento conhecido.',
  'procedimento-indisponivel': 'O procedimento informado não está mais disponível no catálogo.',
  'procedimento-preco-alterado': 'O preço deste procedimento no catálogo mudou desde que o formulário foi publicado.',
};

export interface ResultadoAprovacaoSolicitacao {
  aguardandoPaciente?: boolean;
  horario?: string;
  data?: string;
  ok: true;
  consultaId: string;
}

export interface PortaSolicitacoesAgendamento {
  /** `GET /api/solicitacoes-agendamento` — manda `x-dispositivo-id` pra calcular `vistaPorEsteDispositivo`. */
  listar(): Promise<SolicitacaoAgendamento[]>;
  /** `POST /api/solicitacoes-agendamento/:id/aprovar` — duração obrigatória, revalidada no servidor. */
  aprovar(id: string, duracaoMinutos: number): Promise<ResultadoAprovacaoSolicitacao>;
  /** `POST /api/solicitacoes-agendamento/:id/recusar`. */
  recusar(id: string, motivo?: string): Promise<void>;
  /** `POST /api/solicitacoes-agendamento/marcar-vistas` — reconhecimento EXPLÍCITO, só deste dispositivo. */
  marcarVistas(ids: string[]): Promise<void>;
  /**
   * `POST /api/solicitacoes-agendamento/:id/definir-procedimento` —
   * resolve `motivoPendencia` escolhendo um procedimento de VERDADE do
   * catálogo (preço sempre calculado no servidor, nunca enviado por
   * aqui) ou `null` para "avaliar no consultório". Nunca aprova nem
   * cria consulta — devolve a solicitação atualizada.
   */
  definirProcedimento(id: string, procedimentoId: string | null): Promise<SolicitacaoAgendamento>;
}
