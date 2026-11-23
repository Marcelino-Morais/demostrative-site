import { ErroApi } from '../../application/ports/api-client.js';
import type { DocumentosImpressao, PortaDocumentosImpressao } from '../../application/ports/porta-documentos-impressao.js';

export class HttpDocumentosImpressao implements PortaDocumentosImpressao {
  private readonly base: string;
  private readonly token: string;

  constructor(baseUrl: string, tokenApi: string) {
    this.base = baseUrl.replace(/\/$/, '');
    this.token = tokenApi;
  }

  async obter(pacienteId: string): Promise<DocumentosImpressao> {
    let r: Response;
    try {
      r = await fetch(`${this.base}/api/pacientes/${encodeURIComponent(pacienteId)}/documentos-impressao`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.token}` },
      });
    } catch {
      throw new ErroApi('Sem conexão com o servidor da clínica.', 0);
    }
    if (!r.ok) throw new ErroApi('Não foi possível obter os documentos para impressão.', r.status);
    const corpo = (await r.json()) as Partial<DocumentosImpressao> | null;
    return { cpf: corpo?.cpf ?? null, rg: corpo?.rg ?? null };
  }
}
