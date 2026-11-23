import type {
  GatewayCapturaWim,
  ResultadoCapturaWim,
  ResultadoConcluirCaptura,
  StatusCapturaWim,
} from '../ports/gateway-captura-wim.js';
import type { RepositorioPacientes } from '../ports/repositorios.js';
import { ErroDominio } from '../../domain/types.js';

/** Casos de uso da aquisição sintética (continuação do WIM VITOR). Finos — a máquina de estados mora no servidor/agente. */
export class ObterStatusCapturaWim {
  constructor(private readonly gateway: GatewayCapturaWim) {}
  executar(): Promise<StatusCapturaWim> {
    return this.gateway.status();
  }
}

export class IniciarCapturaWim {
  constructor(
    private readonly gateway: GatewayCapturaWim,
    private readonly pacientes: RepositorioPacientes,
  ) {}
  async executar(pacienteId: string, exameReferencia?: string | null): Promise<ResultadoCapturaWim> {
    // Confere no cliente antes de nem chamar a rede — o servidor revalida
    // de qualquer forma (nunca confia só nisto), mas evita uma chamada
    // óbvia quando a ficha nem carregou o paciente direito.
    const paciente = await this.pacientes.buscarPorId(pacienteId);
    if (!paciente) throw new ErroDominio('Paciente não encontrado.');
    return this.gateway.iniciar(pacienteId, exameReferencia ?? null);
  }
}

export class AvancarCapturaWim {
  constructor(private readonly gateway: GatewayCapturaWim) {}
  executar(trabalhoId: string): Promise<ResultadoCapturaWim> {
    return this.gateway.avancar(trabalhoId);
  }
}

export class RepetirCapturaWim {
  constructor(private readonly gateway: GatewayCapturaWim) {}
  executar(trabalhoId: string): Promise<ResultadoCapturaWim> {
    return this.gateway.repetir(trabalhoId);
  }
}

export class CancelarCapturaWim {
  constructor(private readonly gateway: GatewayCapturaWim) {}
  executar(trabalhoId: string): Promise<ResultadoCapturaWim> {
    return this.gateway.cancelar(trabalhoId);
  }
}

export class ObterTrabalhoCapturaWim {
  constructor(private readonly gateway: GatewayCapturaWim) {}
  executar(trabalhoId: string): Promise<ResultadoCapturaWim> {
    return this.gateway.obter(trabalhoId);
  }
}

export class ConcluirCapturaWim {
  constructor(private readonly gateway: GatewayCapturaWim) {}
  executar(trabalhoId: string): Promise<ResultadoConcluirCaptura> {
    return this.gateway.concluir(trabalhoId);
  }
}
