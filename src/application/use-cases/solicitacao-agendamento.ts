import type {
  PortaSolicitacoesAgendamento,
  ResultadoAprovacaoSolicitacao,
  SolicitacaoAgendamento,
} from '../ports/porta-solicitacoes-agendamento.js';

/**
 * Casos de uso da revisão de solicitações de agendamento do Google
 * Forms — só delegam para a porta, mesmo molde de
 * `google-sheets-sync.ts`/`whatsapp-automatico.ts`. A regra de
 * negócio (nunca ocupar a agenda sem aprovação, revalidar conflito no
 * servidor) mora no servidor, não aqui.
 */
export class ListarSolicitacoesAgendamento {
  constructor(private readonly porta: PortaSolicitacoesAgendamento) {}

  async executar(): Promise<SolicitacaoAgendamento[]> {
    return this.porta.listar();
  }
}

export class AprovarSolicitacaoAgendamento {
  constructor(private readonly porta: PortaSolicitacoesAgendamento) {}

  async executar(id: string, duracaoMinutos: number): Promise<ResultadoAprovacaoSolicitacao> {
    return this.porta.aprovar(id, duracaoMinutos);
  }
}

export class RecusarSolicitacaoAgendamento {
  constructor(private readonly porta: PortaSolicitacoesAgendamento) {}

  async executar(id: string, motivo?: string): Promise<void> {
    return this.porta.recusar(id, motivo);
  }
}

/** Reconhecimento EXPLÍCITO (nunca automático) — ver `vistaPorEsteDispositivo` na porta. */
export class MarcarSolicitacoesVistas {
  constructor(private readonly porta: PortaSolicitacoesAgendamento) {}

  async executar(ids: string[]): Promise<void> {
    return this.porta.marcarVistas(ids);
  }
}

/** Resolve uma pendência de procedimento sem aprovar — ver `PortaSolicitacoesAgendamento.definirProcedimento`. */
export class DefinirProcedimentoSolicitacaoAgendamento {
  constructor(private readonly porta: PortaSolicitacoesAgendamento) {}

  async executar(id: string, procedimentoId: string | null): Promise<SolicitacaoAgendamento> {
    return this.porta.definirProcedimento(id, procedimentoId);
  }
}
