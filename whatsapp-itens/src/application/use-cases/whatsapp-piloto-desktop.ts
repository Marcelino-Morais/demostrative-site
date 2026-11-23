import type {
  EstadoSupervisionado,
  PortaWhatsappPilotoDesktop,
  RespostaAcaoPiloto,
  ResultadoTestePilotoDesktop,
  StatusPilotoDesktop,
} from '../ports/porta-whatsapp-piloto-desktop.js';

/**
 * Casos de uso da seção "Piloto de WhatsApp Desktop" (Etapa 62, Etapa
 * A) — só delegam para a porta. Toda a decisão de habilitação,
 * allowlist e verificação já acontece no servidor.
 */
export class ObterStatusPilotoDesktop {
  constructor(private readonly porta: PortaWhatsappPilotoDesktop) {}

  async executar(): Promise<StatusPilotoDesktop> {
    return this.porta.obterStatus();
  }
}

export class TestarPilotoDesktopComMeuNumero {
  constructor(private readonly porta: PortaWhatsappPilotoDesktop) {}

  async executar(): Promise<ResultadoTestePilotoDesktop> {
    return this.porta.testarComMeuNumero();
  }
}

/**
 * Casos de uso da Etapa B — autoteste supervisionado (um envio real, só
 * para o dono, sob confirmação explícita). Mesmo espírito dos acima:
 * puro repasse para a porta, nenhuma decisão de negócio aqui.
 */
export class ObterEstadoSupervisionadoPiloto {
  constructor(private readonly porta: PortaWhatsappPilotoDesktop) {}

  async executar(): Promise<EstadoSupervisionado> {
    return this.porta.obterEstadoSupervisionado();
  }
}

export class IniciarTestePilotoSupervisionado {
  constructor(private readonly porta: PortaWhatsappPilotoDesktop) {}

  async executar(confirmado: boolean): Promise<RespostaAcaoPiloto> {
    return this.porta.iniciarTesteSupervisionado(confirmado);
  }
}

export class CancelarTestePilotoSupervisionado {
  constructor(private readonly porta: PortaWhatsappPilotoDesktop) {}

  async executar(): Promise<RespostaAcaoPiloto> {
    return this.porta.cancelarTesteSupervisionado();
  }
}

export class ConfirmarResultadoPilotoSupervisionado {
  constructor(private readonly porta: PortaWhatsappPilotoDesktop) {}

  async executar(resultado: 'confirmado' | 'nao-confirmado'): Promise<RespostaAcaoPiloto> {
    return this.porta.confirmarResultadoSupervisionado(resultado);
  }
}

export class AtivarKillSwitchPiloto {
  constructor(private readonly porta: PortaWhatsappPilotoDesktop) {}

  async executar(): Promise<RespostaAcaoPiloto> {
    return this.porta.ativarKillSwitch();
  }
}

export class DesarmarKillSwitchPiloto {
  constructor(private readonly porta: PortaWhatsappPilotoDesktop) {}

  async executar(): Promise<RespostaAcaoPiloto> {
    return this.porta.desarmarKillSwitch();
  }
}
