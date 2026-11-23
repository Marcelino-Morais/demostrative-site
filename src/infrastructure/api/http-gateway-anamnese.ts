import type { SalvarAnamneseInput } from '../../domain/entities/anamnese.js';
import type { LinkAnamneseProps } from '../../domain/entities/link-anamnese.js';
import { ErroApi } from '../../application/ports/api-client.js';
import type {
  AnamneseSubmetida,
  GatewayAnamnese,
  LinkAnamneseRemoto,
  ResultadoAberturaRemota,
} from '../../application/ports/gateway-anamnese.js';

/** Segundo argumento de `fetch` (evita citar o tipo global `RequestInit`). */
type OpcoesFetch = NonNullable<Parameters<typeof fetch>[1]>;

/**
 * Adaptador HTTP do `GatewayAnamnese` (Etapa 18) — fala com o servidor
 * de `server/`. Endpoints `/api/*` levam `Authorization: Bearer <token>`;
 * `/publico/*` não levam nada. Falha de rede vira `ErroApi(status 0)`
 * com mensagem amigável; nunca loga corpo de requisição/resposta.
 */
export class HttpGatewayAnamnese implements GatewayAnamnese {
  private readonly base: string;
  private readonly token: string;

  constructor(baseUrl: string, tokenApi: string) {
    this.base = baseUrl.replace(/\/$/, '');
    this.token = tokenApi;
  }

  private async chamar(caminho: string, init: OpcoesFetch, comAuth: boolean): Promise<Response> {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    if (comAuth) headers.authorization = `Bearer ${this.token}`;
    try {
      return await fetch(`${this.base}${caminho}`, { ...init, headers });
    } catch {
      throw new ErroApi('Sem conexão com o servidor de sincronização da anamnese.', 0);
    }
  }

  private async falhar(r: Response): Promise<never> {
    let codigo: string | undefined;
    try {
      const c = (await r.json()) as { erro?: { codigo?: string } };
      codigo = c.erro?.codigo;
    } catch {
      /* corpo não-JSON */
    }
    throw new ErroApi(`Erro ${r.status} do servidor de anamnese.`, r.status, codigo);
  }

  async disponivel(): Promise<boolean> {
    try {
      const r = await this.chamar('/health', { method: 'GET' }, false);
      return r.ok;
    } catch {
      return false;
    }
  }

  async gerarLink(pacienteId: string, primeiroNome: string): Promise<LinkAnamneseProps> {
    const r = await this.chamar(
      '/api/links-anamnese',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pacienteId, primeiroNome }),
      },
      true,
    );
    if (!r.ok) return this.falhar(r);
    return (await r.json()) as LinkAnamneseProps;
  }

  async obterLinkDoPaciente(pacienteId: string): Promise<LinkAnamneseRemoto | null> {
    const r = await this.chamar(
      `/api/pacientes/${encodeURIComponent(pacienteId)}/link-anamnese`,
      { method: 'GET' },
      true,
    );
    if (r.status === 404) return null;
    if (!r.ok) return this.falhar(r);
    return ((await r.json()) as LinkAnamneseRemoto | null) ?? null;
  }

  async revogarLink(linkId: string): Promise<void> {
    const r = await this.chamar(
      `/api/links-anamnese/${encodeURIComponent(linkId)}/revogar`,
      { method: 'POST' },
      true,
    );
    if (!r.ok && r.status !== 404) await this.falhar(r);
  }

  async obterAnamneseSubmetida(pacienteId: string): Promise<AnamneseSubmetida | null> {
    const r = await this.chamar(
      `/api/pacientes/${encodeURIComponent(pacienteId)}/anamnese`,
      { method: 'GET' },
      true,
    );
    if (r.status === 404) return null;
    if (!r.ok) return this.falhar(r);
    const c = (await r.json()) as { dados: SalvarAnamneseInput; atualizadoEm: string } | null;
    return c ? { dados: c.dados, atualizadoEm: c.atualizadoEm } : null;
  }

  async abrirPublica(token: string): Promise<ResultadoAberturaRemota> {
    const r = await this.chamar(`/publico/anamnese/${encodeURIComponent(token)}`, { method: 'GET' }, false);
    if (!r.ok) return this.falhar(r);
    return (await r.json()) as ResultadoAberturaRemota;
  }

  async submeterPublica(token: string, valores: SalvarAnamneseInput): Promise<void> {
    const r = await this.chamar(
      `/publico/anamnese/${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(valores),
      },
      false,
    );
    if (!r.ok) await this.falhar(r);
  }
}
