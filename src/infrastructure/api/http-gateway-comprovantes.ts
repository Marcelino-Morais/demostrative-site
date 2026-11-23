import { ErroDominio } from '../../domain/types.js';
import { ErroApi } from '../../application/ports/api-client.js';
import type {
  ComprovanteProps,
  GatewayComprovantes,
  NovoComprovanteInput,
} from '../../application/ports/gateway-comprovantes.js';

/** Segundo argumento de `fetch` (evita citar o tipo global `RequestInit`). */
type OpcoesFetch = NonNullable<Parameters<typeof fetch>[1]>;

/** Códigos de validação do servidor (`server/comprovantes-regras.mjs`) → texto pra dentista. */
const MOTIVO_VALIDACAO: Record<string, string> = {
  'pagamento-obrigatorio': 'Comprovante precisa estar vinculado a um pagamento.',
  'plano-obrigatorio': 'Comprovante precisa estar vinculado a um plano de tratamento.',
  'paciente-obrigatorio': 'Comprovante precisa estar vinculado a um paciente.',
  'nome-invalido': 'Nome de arquivo inválido. Renomeie o arquivo e tente de novo.',
  'tipo-nao-aceito': 'Tipo de arquivo não aceito. Envie uma imagem (JPG, PNG, WEBP) ou um PDF.',
  'extensao-incompativel': 'A extensão do arquivo não bate com o tipo dele.',
  'arquivo-vazio': 'Arquivo vazio ou inválido.',
  'arquivo-grande': 'Arquivo muito grande (máximo 10 MB). Reduza a imagem antes de anexar.',
};

/**
 * Adaptador HTTP do `GatewayComprovantes` (Etapa 54) — mesmo molde de
 * `HttpGatewayArquivos`, coleção separada (`/api/comprovantes`). Nunca
 * loga corpo de requisição/resposta.
 */
export class HttpGatewayComprovantes implements GatewayComprovantes {
  private readonly base: string;
  private readonly token: string;

  constructor(baseUrl: string, tokenApi: string) {
    this.base = baseUrl.replace(/\/$/, '');
    this.token = tokenApi;
  }

  private async chamar(caminho: string, init: OpcoesFetch): Promise<Response> {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string>),
      authorization: `Bearer ${this.token}`,
    };
    try {
      return await fetch(`${this.base}${caminho}`, { ...init, headers });
    } catch {
      throw new ErroApi('Sem conexão com o servidor de comprovantes da clínica.', 0);
    }
  }

  private async falhar(r: Response): Promise<never> {
    let corpo: { erro?: { codigo?: string; detalhes?: unknown } } = {};
    try {
      corpo = (await r.json()) as typeof corpo;
    } catch {
      /* corpo não-JSON */
    }
    if (r.status === 422) {
      const detalhes = Array.isArray(corpo.erro?.detalhes) ? (corpo.erro?.detalhes as string[]) : [];
      const texto = detalhes.map((d) => MOTIVO_VALIDACAO[d]).find(Boolean);
      throw new ErroDominio(texto ?? 'O servidor recusou o comprovante na validação.');
    }
    throw new ErroApi(`Erro ${r.status} do servidor de comprovantes.`, r.status, corpo.erro?.codigo);
  }

  async disponivel(): Promise<boolean> {
    try {
      const r = await fetch(`${this.base}/health`, { method: 'GET' });
      return r.ok;
    } catch {
      return false;
    }
  }

  async enviar(input: NovoComprovanteInput, conteudo: Blob): Promise<ComprovanteProps> {
    const headers: Record<string, string> = {
      'content-type': input.tipoMime || 'application/octet-stream',
      'x-comprovante-pagamento-id': input.pagamentoId,
      'x-comprovante-plano-id': input.planoId,
      'x-comprovante-paciente-id': input.pacienteId,
      'x-comprovante-nome': encodeURIComponent(input.nome),
    };
    const r = await this.chamar('/api/comprovantes', { method: 'POST', headers, body: conteudo });
    if (!r.ok) return this.falhar(r);
    return (await r.json()) as ComprovanteProps;
  }

  async obterMeta(id: string): Promise<ComprovanteProps | undefined> {
    const r = await this.chamar(`/api/comprovantes/${encodeURIComponent(id)}`, { method: 'GET' });
    if (!r.ok) return this.falhar(r);
    return ((await r.json()) as ComprovanteProps | null) ?? undefined;
  }

  async baixar(id: string): Promise<Blob | null> {
    const r = await this.chamar(`/api/comprovantes/${encodeURIComponent(id)}/conteudo`, { method: 'GET' });
    if (r.status === 404) return null;
    if (!r.ok) return this.falhar(r);
    return r.blob();
  }

  async remover(id: string): Promise<void> {
    const r = await this.chamar(`/api/comprovantes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok && r.status !== 404) await this.falhar(r);
  }
}
