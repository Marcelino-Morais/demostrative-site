import { ErroApi } from '../../application/ports/api-client.js';
import type { ComparacaoCopiasLocais, GatewayCopiasLocais } from '../../application/ports/porta-copias-locais.js';

export class HttpCopiasLocais implements GatewayCopiasLocais {
  constructor(private readonly base: string, private readonly token: string) {}
  private async enviar(acao: string, pacientes: Array<{ id: string }>): Promise<ComparacaoCopiasLocais> {
    const r = await fetch(`${this.base.replace(/\/$/, '')}/api/pacientes/${acao}-locais`, {
      method: 'POST', credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ pacientes }),
    });
    if (!r.ok) throw new ErroApi('Não foi possível comparar ou preservar a cópia protegida. Nenhum dado do navegador foi removido.', r.status);
    return r.json() as Promise<ComparacaoCopiasLocais>;
  }
  comparar(pacientes: Array<{ id: string }>) { return this.enviar('comparar', pacientes); }
  preservar(pacientes: Array<{ id: string }>) { return this.enviar('preservar', pacientes); }
}
