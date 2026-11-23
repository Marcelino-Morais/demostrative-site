import { ErroApi } from '../../../../src/application/ports/api-client.js';
import type { PortaSupressaoCortesiaWhatsapp } from '../../application/ports/porta-supressao-cortesia-whatsapp.js';

/** Adaptador HTTP de `PortaSupressaoCortesiaWhatsapp` — fala com `/api/whatsapp-atendimento/supressao-cortesia/verificar`. */
export class HttpSupressaoCortesiaWhatsapp implements PortaSupressaoCortesiaWhatsapp {
  private readonly base: string;
  private readonly token: string;

  constructor(baseUrl: string, tokenApi: string) {
    this.base = baseUrl.replace(/\/$/, '');
    this.token = tokenApi;
  }

  async verificarSuprimidos(numeros: string[]): Promise<Set<string>> {
    if (numeros.length === 0) return new Set();
    let r: Response;
    try {
      r = await fetch(`${this.base}/api/whatsapp-atendimento/supressao-cortesia/verificar`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ numeros }),
      });
    } catch {
      throw new ErroApi('Sem conexão com o servidor da clínica.', 0);
    }
    if (!r.ok) throw new ErroApi(`Erro ${r.status} ao verificar supressão de contato por WhatsApp.`, r.status);
    const corpo = (await r.json()) as { suprimidos?: unknown };
    const lista = Array.isArray(corpo.suprimidos) ? corpo.suprimidos.filter((n): n is string => typeof n === 'string') : [];
    return new Set(lista);
  }
}
