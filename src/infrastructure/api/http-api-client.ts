import { ErroApi, type ApiClient } from '../../application/ports/api-client.js';

/** Segundo argumento de `fetch` (evita citar o tipo global `RequestInit` diretamente). */
type OpcoesFetch = NonNullable<Parameters<typeof fetch>[1]>;

/**
 * Implementação real do `ApiClient` sobre `fetch` (Etapa 17). **Não é
 * usada por padrão** — o app continua 100% local. É o adaptador que
 * `criarContainerRemoto` (composition root) usa quando o servidor de
 * `docs/backend.spec.md` existir.
 *
 * - `credentials: 'include'` → o cookie de sessão (`HttpOnly`) vai junto.
 * - Falha de rede vira `ErroApi(status 0)` com mensagem amigável — nunca
 *   vaza detalhe técnico nem corpo da requisição.
 * - 404 em `get`/`getBlob` vira `undefined` (recurso ausente ≠ erro).
 */
export class HttpApiClient implements ApiClient {
  private readonly base: string;

  constructor(baseUrl: string, private readonly tokenApi?: string) {
    this.base = baseUrl.replace(/\/$/, '');
  }

  private url(caminho: string): string {
    return `${this.base}${caminho.startsWith('/') ? caminho : `/${caminho}`}`;
  }

  private async requisitar(caminho: string, init: OpcoesFetch): Promise<Response> {
    try {
      const headers = { ...(init.headers as Record<string,string>), ...(this.tokenApi ? { authorization: `Bearer ${this.tokenApi}` } : {}) };
      return await fetch(this.url(caminho), { credentials: 'include', ...init, headers });
    } catch {
      throw new ErroApi('Sem conexão com o servidor da clínica. Tente novamente.', 0);
    }
  }

  private async falhar(resposta: Response): Promise<never> {
    let codigo: string | undefined;
    let mensagem = `Erro ${resposta.status} do servidor.`;
    try {
      const corpo = (await resposta.json()) as { erro?: { codigo?: string; mensagem?: string } };
      codigo = corpo.erro?.codigo;
      if (corpo.erro?.mensagem) mensagem = corpo.erro.mensagem;
    } catch {
      /* corpo não-JSON — mantém a mensagem genérica */
    }
    throw new ErroApi(mensagem, resposta.status, codigo);
  }

  async get<T>(caminho: string): Promise<T | undefined> {
    const r = await this.requisitar(caminho, { method: 'GET' });
    if (r.status === 404) return undefined;
    if (!r.ok) return this.falhar(r);
    return (await r.json()) as T;
  }

  async post<T>(caminho: string, corpo?: unknown): Promise<T> {
    const r = await this.requisitar(caminho, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    if (!r.ok) return this.falhar(r);
    return (r.status === 204 ? undefined : await r.json()) as T;
  }

  async put<T>(caminho: string, corpo?: unknown): Promise<T> {
    const r = await this.requisitar(caminho, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    if (!r.ok) return this.falhar(r);
    return (r.status === 204 ? undefined : await r.json()) as T;
  }

  async delete(caminho: string): Promise<void> {
    const r = await this.requisitar(caminho, { method: 'DELETE' });
    if (!r.ok && r.status !== 404) await this.falhar(r);
  }

  async postForm<T>(
    caminho: string,
    arquivo: Blob,
    nomeArquivo: string,
    campos: Record<string, string>,
  ): Promise<T> {
    const form = new FormData();
    for (const [chave, valor] of Object.entries(campos)) form.append(chave, valor);
    form.append('arquivo', arquivo, nomeArquivo);
    const r = await this.requisitar(caminho, { method: 'POST', body: form });
    if (!r.ok) return this.falhar(r);
    return (r.status === 204 ? undefined : await r.json()) as T;
  }

  async getBlob(caminho: string): Promise<Blob | undefined> {
    const r = await this.requisitar(caminho, { method: 'GET' });
    if (r.status === 404) return undefined;
    if (!r.ok) return this.falhar(r);
    return r.blob();
  }

  async existe(caminho: string): Promise<boolean> {
    const r = await this.requisitar(caminho, { method: 'HEAD' });
    return r.ok;
  }
}
