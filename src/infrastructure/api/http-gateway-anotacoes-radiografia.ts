import { ErroApi } from '../../application/ports/api-client.js';
import type {
  Anotacao,
  GatewayAnotacoesRadiografia,
  RegistroAnotacoes,
  ResultadoSalvarAnotacoes,
} from '../../application/ports/gateway-anotacoes-radiografia.js';

type OpcoesFetch = NonNullable<Parameters<typeof fetch>[1]>;

/**
 * Adaptador HTTP do `GatewayAnotacoesRadiografia` — mesmo padrão de
 * `HttpGatewayArquivos` (token Bearer, nunca loga corpo). O 409 de
 * conflito de versão é tratado como um RESULTADO normal (nunca uma
 * exceção) — é o próprio contrato de concorrência otimista.
 */
export class HttpGatewayAnotacoesRadiografia implements GatewayAnotacoesRadiografia {
  private readonly base: string;
  private readonly token: string;

  constructor(baseUrl: string, tokenApi: string) {
    this.base = baseUrl.replace(/\/$/, '');
    this.token = tokenApi;
  }

  private async chamar(caminho: string, init: OpcoesFetch = {}): Promise<Response> {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string>),
      authorization: `Bearer ${this.token}`,
    };
    try {
      return await fetch(`${this.base}${caminho}`, { ...init, headers });
    } catch {
      throw new ErroApi('Sem conexão com o servidor da clínica.', 0);
    }
  }

  private async falhar(r: Response): Promise<never> {
    let corpo: { erro?: { codigo?: string } } = {};
    try {
      corpo = (await r.json()) as typeof corpo;
    } catch {
      /* corpo não-JSON */
    }
    throw new ErroApi(`Erro ${r.status} ao salvar anotações.`, r.status, corpo.erro?.codigo);
  }

  async obter(arquivoId: string): Promise<RegistroAnotacoes> {
    const r = await this.chamar(`/api/arquivos/${encodeURIComponent(arquivoId)}/anotacoes`, { method: 'GET' });
    if (!r.ok) return this.falhar(r);
    return (await r.json()) as RegistroAnotacoes;
  }

  async salvar(arquivoId: string, versaoEsperada: number, itens: Anotacao[]): Promise<ResultadoSalvarAnotacoes> {
    const r = await this.chamar(`/api/arquivos/${encodeURIComponent(arquivoId)}/anotacoes`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ versaoEsperada, itens }),
    });
    if (r.status === 409) {
      const corpo = (await r.json()) as { atual: RegistroAnotacoes };
      return { ok: false, motivo: 'conflito', atual: corpo.atual };
    }
    if (!r.ok) return this.falhar(r);
    return { ok: true, registro: (await r.json()) as RegistroAnotacoes };
  }
}
