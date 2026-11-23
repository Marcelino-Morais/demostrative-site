import { ErroDominio } from '../../domain/types.js';
import type {
  ComprovanteProps,
  GatewayComprovantes,
  NovoComprovanteInput,
} from '../ports/gateway-comprovantes.js';

/**
 * Casos de uso de comprovantes de pagamento (Etapa 54). Finos de
 * propósito, mesmo molde de `arquivos-remoto.ts`: a validação de
 * tipo/tamanho mora no servidor (o front só confere o básico antes de
 * subir, pra uma mensagem de erro mais rápida). Nunca loga conteúdo de
 * arquivo nem dado de pagamento/paciente.
 */

/** Mesmo limite do servidor (`server/comprovantes-regras.mjs`) — checagem rápida antes de subir. */
export const TAMANHO_MAXIMO_COMPROVANTE_BYTES = 10 * 1024 * 1024;

export const TIPOS_MIME_COMPROVANTE_ACEITOS: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
];

export class VerificarServidorComprovantes {
  constructor(private readonly gateway: GatewayComprovantes) {}
  executar(): Promise<boolean> {
    return this.gateway.disponivel();
  }
}

export class EnviarComprovantePagamento {
  constructor(private readonly gateway: GatewayComprovantes) {}

  async executar(input: NovoComprovanteInput, conteudo: Blob): Promise<ComprovanteProps> {
    if (!TIPOS_MIME_COMPROVANTE_ACEITOS.includes(input.tipoMime.trim().toLowerCase())) {
      throw new ErroDominio('Tipo de arquivo não aceito. Envie uma imagem (JPG, PNG, WEBP) ou um PDF.');
    }
    if (conteudo.size <= 0) throw new ErroDominio('Arquivo vazio ou inválido.');
    if (conteudo.size > TAMANHO_MAXIMO_COMPROVANTE_BYTES) {
      throw new ErroDominio('Arquivo muito grande (máximo 10 MB). Reduza a imagem antes de anexar.');
    }
    return this.gateway.enviar(input, conteudo);
  }
}

export class ObterMetaComprovante {
  constructor(private readonly gateway: GatewayComprovantes) {}
  executar(id: string): Promise<ComprovanteProps | undefined> {
    return this.gateway.obterMeta(id);
  }
}

export class BaixarComprovantePagamento {
  constructor(private readonly gateway: GatewayComprovantes) {}
  executar(id: string): Promise<Blob | null> {
    return this.gateway.baixar(id);
  }
}

export class RemoverComprovantePagamento {
  constructor(private readonly gateway: GatewayComprovantes) {}
  executar(id: string): Promise<void> {
    return this.gateway.remover(id);
  }
}
