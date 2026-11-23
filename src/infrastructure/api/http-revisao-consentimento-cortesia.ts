import { ErroApi } from '../../application/ports/api-client.js';
import type { PortaRevisaoConsentimentoCortesia } from '../../application/ports/porta-revisao-consentimento-cortesia.js';

const MENSAGEM_POR_CODIGO: Record<string, string> = {
  'nenhuma-revisao-pendente': 'Esta pendência já foi resolvida por outra pessoa/aba — a tela foi atualizada.',
  'decisao-em-andamento': 'Esta pendência já está sendo decidida agora — aguarde um instante e atualize a tela.',
  'paciente-nao-encontrado': 'Este paciente não foi encontrado — pode ter sido removido.',
};

/** Adaptador HTTP de `PortaRevisaoConsentimentoCortesia` — fala com `/api/pacientes/:id/consentimento-cortesia-revisao/*`. */
export class HttpRevisaoConsentimentoCortesia implements PortaRevisaoConsentimentoCortesia {
  private readonly base: string;
  private readonly token: string;

  constructor(baseUrl: string, tokenApi: string) {
    this.base = baseUrl.replace(/\/$/, '');
    this.token = tokenApi;
  }

  private async chamar(pacienteId: string, acao: 'aplicar' | 'manter'): Promise<void> {
    let r: Response;
    try {
      r = await fetch(
        `${this.base}/api/pacientes/${encodeURIComponent(pacienteId)}/consentimento-cortesia-revisao/${acao}`,
        { method: 'POST', headers: { authorization: `Bearer ${this.token}` } },
      );
    } catch {
      throw new ErroApi('Sem conexão com o servidor da clínica.', 0);
    }
    if (r.ok) return;
    let codigo: string | undefined;
    try {
      codigo = ((await r.json()) as { erro?: { codigo?: string } })?.erro?.codigo;
    } catch {
      /* corpo não-JSON */
    }
    throw new ErroApi(
      (codigo && MENSAGEM_POR_CODIGO[codigo]) || `Erro ${r.status} ao decidir esta pendência.`,
      r.status,
      codigo,
    );
  }

  async aplicar(pacienteId: string): Promise<void> {
    return this.chamar(pacienteId, 'aplicar');
  }

  async manter(pacienteId: string): Promise<void> {
    return this.chamar(pacienteId, 'manter');
  }
}
