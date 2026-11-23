import {
  ArquivoPaciente,
  compararArquivoMaisRecente,
  type ArquivoPacienteProps,
  type NovoArquivoPacienteInput,
} from '../../domain/entities/arquivo-paciente.js';
import { ErroDominio } from '../../domain/types.js';
import type { GatewayArquivos } from '../ports/gateway-arquivos.js';
import type { RepositorioPacientes } from '../ports/repositorios.js';
import type { ArquivoNaLista } from './arquivos-paciente.js';

/**
 * Casos de uso do slice de ARQUIVOS COMPARTILHADOS (Etapa 19). Finos de
 * propósito: a validação de tipo/tamanho/campos mora na entidade
 * `ArquivoPaciente` (a mesma do modo local) e é refeita pelo servidor;
 * estas classes só mantêm React fora do transporte e do formato.
 * Devolvem a MESMA forma de `arquivos-paciente.ts` (`ArquivoNaLista`)
 * para a aba "Documentos e imagens" não precisar saber em que modo
 * está.
 */

export class VerificarServidorArquivos {
  constructor(private readonly gateway: GatewayArquivos) {}
  executar(): Promise<boolean> {
    return this.gateway.disponivel();
  }
}

export class ListarArquivosRemotos {
  constructor(private readonly gateway: GatewayArquivos) {}

  async executar(pacienteId: string): Promise<ArquivoNaLista[]> {
    const props = await this.gateway.listar(pacienteId);
    // No servidor os bytes sempre acompanham o metadado — `disponivelLocalmente`
    // (o nome vem do modo local) é sempre `true` aqui: dá para abrir/baixar.
    return [...props]
      .sort(compararArquivoMaisRecente)
      .map((p) => ({ props: p, disponivelLocalmente: true }));
  }
}

export class EnviarArquivoRemoto {
  constructor(
    private readonly gateway: GatewayArquivos,
    private readonly pacientes: RepositorioPacientes,
  ) {}

  async executar(input: NovoArquivoPacienteInput, conteudo: Blob): Promise<ArquivoPacienteProps> {
    const paciente = await this.pacientes.buscarPorId(input.pacienteId);
    if (!paciente) throw new ErroDominio('Paciente não encontrado.');
    // Valida ANTES de subir — mensagens amigáveis, idênticas às do modo
    // local. O servidor revalida por conta própria de qualquer forma.
    ArquivoPaciente.registrar(input);
    return this.gateway.enviar(input, conteudo);
  }
}

export class BaixarArquivoRemoto {
  constructor(private readonly gateway: GatewayArquivos) {}
  executar(id: string): Promise<Blob | null> {
    return this.gateway.baixar(id);
  }
}

export class RemoverArquivoRemoto {
  constructor(private readonly gateway: GatewayArquivos) {}
  executar(id: string): Promise<void> {
    return this.gateway.remover(id);
  }
}

/** Continuação do WIM VITOR — equivalente a `XRayForm.setNotes` do original. */
export class AtualizarDescricaoArquivoRemoto {
  constructor(private readonly gateway: GatewayArquivos) {}
  executar(id: string, descricao: string): Promise<ArquivoPacienteProps> {
    return this.gateway.atualizarDescricao(id, descricao);
  }
}

export class ListarLixeiraArquivosRemotos {
  constructor(private readonly gateway: GatewayArquivos) {}
  async executar(pacienteId: string): Promise<ArquivoNaLista[]> {
    const props = await this.gateway.listarLixeira(pacienteId);
    return [...props]
      .sort((a, b) => (b.excluidoEm ?? '').localeCompare(a.excluidoEm ?? ''))
      .map((p) => ({ props: p, disponivelLocalmente: true }));
  }
}

export class RestaurarArquivoRemoto {
  constructor(private readonly gateway: GatewayArquivos) {}
  executar(id: string): Promise<ArquivoPacienteProps> {
    return this.gateway.restaurar(id);
  }
}

export class RemoverArquivoPermanenteRemoto {
  constructor(private readonly gateway: GatewayArquivos) {}
  executar(id: string): Promise<void> {
    return this.gateway.removerPermanente(id);
  }
}

/** Exportação DICOM real (continuação do WIM VITOR). `null` quando o formato não é suportado (só PNG cinza 8 bits). */
export class BaixarDicomRemoto {
  constructor(private readonly gateway: GatewayArquivos) {}
  executar(id: string): Promise<Blob | null> {
    return this.gateway.baixarDicom(id);
  }
}
