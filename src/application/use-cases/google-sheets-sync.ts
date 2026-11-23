import type {
  PortaGoogleSheetsSync,
  ResultadoProcessamentoGoogleSheetsSync,
  ResultadoReconciliacao,
  ResultadoRecuperacao,
  StatusSincronizacaoGoogleSheets,
  TipoFormularioGoogle,
} from '../ports/porta-google-sheets-sync.js';

/**
 * Casos de uso da tela de status "Sincronização do Google Forms"
 * (Etapa 58) — só delegam para a porta, mesmo molde de
 * `whatsapp-automatico.ts`.
 */
export class ObterStatusSincronizacaoGoogleSheets {
  constructor(private readonly porta: PortaGoogleSheetsSync) {}

  async executar(): Promise<StatusSincronizacaoGoogleSheets> {
    return this.porta.obterStatus();
  }
}

export class SincronizarGoogleSheetsAgora {
  constructor(private readonly porta: PortaGoogleSheetsSync) {}

  async executar(): Promise<ResultadoProcessamentoGoogleSheetsSync> {
    return this.porta.processarAgora();
  }
}

export class ObterReconciliacaoGoogleSheets {
  constructor(private readonly porta: PortaGoogleSheetsSync) {}

  async executar(): Promise<ResultadoReconciliacao> {
    return this.porta.obterReconciliacao();
  }
}

export class RecuperarRespostasGoogleSheets {
  constructor(private readonly porta: PortaGoogleSheetsSync) {}

  async executar(tipo: TipoFormularioGoogle): Promise<ResultadoRecuperacao> {
    return this.porta.recuperarRespostas(tipo);
  }
}
