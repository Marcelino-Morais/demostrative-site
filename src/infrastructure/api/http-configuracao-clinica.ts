import { ErroApi } from '../../application/ports/api-client.js';
import type {
  ConfiguracaoClinicaEditavel,
  PortaConfiguracaoClinica,
} from '../../application/ports/porta-configuracao-clinica.js';

/** Segundo argumento de `fetch` (evita citar o tipo global `RequestInit`). */
type OpcoesFetch = NonNullable<Parameters<typeof fetch>[1]>;

/**
 * Adaptador HTTP das configurações editáveis da clínica — mesmo molde
 * de `HttpWhatsappAutomatico`. Autenticado com o Bearer de sempre da
 * SPA (`GET/PUT /api/clinica/configuracoes`).
 */
export class HttpConfiguracaoClinica implements PortaConfiguracaoClinica {
  private readonly base: string;
  private readonly token: string;

  constructor(baseUrl: string, tokenApi: string) {
    this.base = baseUrl.replace(/\/$/, '');
    this.token = tokenApi;
  }

  private async chamar(init: OpcoesFetch): Promise<Response> {
    try {
      return await fetch(`${this.base}/api/clinica/configuracoes`, {
        ...init,
        credentials: 'include',
        headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${this.token}` },
      });
    } catch {
      throw new ErroApi('Sem conexão com o servidor da clínica.', 0);
    }
  }

  private ler(corpo: unknown): ConfiguracaoClinicaEditavel {
    const c = (corpo ?? {}) as Record<string, unknown>;
    return { endereco: typeof c.endereco === 'string' ? c.endereco : '',
      ...(c.pausaPosConsultaMinutos !== undefined ? {pausaPosConsultaMinutos: c.pausaPosConsultaMinutos as number} : {}),
      ...(c.funcionamento ? { funcionamento: c.funcionamento as ConfiguracaoClinicaEditavel['funcionamento'] } : {}),
      ...(c.descanso ? { descanso: c.descanso as ConfiguracaoClinicaEditavel['descanso'] } : {}) };
  }

  async obter(): Promise<ConfiguracaoClinicaEditavel> {
    const r = await this.chamar({ method: 'GET' });
    if (!r.ok) throw new ErroApi(`Erro ${r.status} ao consultar as configurações da clínica.`, r.status);
    return this.ler(await r.json());
  }

  async salvar(config: ConfiguracaoClinicaEditavel): Promise<ConfiguracaoClinicaEditavel> {
    const r = await this.chamar({
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!r.ok) throw new ErroApi(`Erro ${r.status} ao salvar as configurações da clínica.`, r.status);
    return this.ler(await r.json());
  }
}
