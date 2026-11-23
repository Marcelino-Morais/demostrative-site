import { ErroApi } from '../../application/ports/api-client.js';
import type {
  GatewayCapturaWim,
  ResultadoCapturaWim,
  ResultadoConcluirCaptura,
  StatusCapturaWim,
  TrabalhoCaptura,
} from '../../application/ports/gateway-captura-wim.js';

type OpcoesFetch = NonNullable<Parameters<typeof fetch>[1]>;

/**
 * Adaptador HTTP do `GatewayCapturaWim`. Qualquer recusa de domínio
 * (paciente não encontrado, agente indisponível, trabalho não
 * encontrado, estado inválido…) vira um RESULTADO `{ok:false, motivo}` —
 * nunca uma exceção — porque a tela precisa reagir especificamente a
 * cada motivo (ver `visualizador-radiografia.tsx`/`aba-exames.tsx`).
 * Só falha de rede (sem resposta alguma) continua lançando `ErroApi`.
 */
export class HttpGatewayCapturaWim implements GatewayCapturaWim {
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

  private async motivoDoErro(r: Response): Promise<string> {
    try {
      const corpo = (await r.json()) as { erro?: { codigo?: string } };
      return corpo.erro?.codigo ?? `http-${r.status}`;
    } catch {
      return `http-${r.status}`;
    }
  }

  async status(): Promise<StatusCapturaWim> {
    const r = await this.chamar('/api/wim-captura/status', { method: 'GET' });
    if (!r.ok) return { habilitado: false, agenteOnline: false, modo: 'sintetico' };
    return (await r.json()) as StatusCapturaWim;
  }

  async iniciar(pacienteId: string, exameReferencia: string | null = null): Promise<ResultadoCapturaWim> {
    const r = await this.chamar(`/api/pacientes/${encodeURIComponent(pacienteId)}/wim-captura/iniciar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ exameReferencia }),
    });
    if (!r.ok) return { ok: false, motivo: await this.motivoDoErro(r) };
    return { ok: true, trabalho: (await r.json()) as TrabalhoCaptura };
  }

  private async acao(trabalhoId: string, nome: 'avancar' | 'repetir' | 'cancelar'): Promise<ResultadoCapturaWim> {
    const r = await this.chamar(`/api/wim-captura/${encodeURIComponent(trabalhoId)}/${nome}`, { method: 'POST' });
    if (!r.ok) return { ok: false, motivo: await this.motivoDoErro(r) };
    return { ok: true, trabalho: (await r.json()) as TrabalhoCaptura };
  }

  avancar(trabalhoId: string): Promise<ResultadoCapturaWim> {
    return this.acao(trabalhoId, 'avancar');
  }
  repetir(trabalhoId: string): Promise<ResultadoCapturaWim> {
    return this.acao(trabalhoId, 'repetir');
  }
  cancelar(trabalhoId: string): Promise<ResultadoCapturaWim> {
    return this.acao(trabalhoId, 'cancelar');
  }

  async obter(trabalhoId: string): Promise<ResultadoCapturaWim> {
    const r = await this.chamar(`/api/wim-captura/${encodeURIComponent(trabalhoId)}`, { method: 'GET' });
    if (!r.ok) return { ok: false, motivo: await this.motivoDoErro(r) };
    return { ok: true, trabalho: (await r.json()) as TrabalhoCaptura };
  }

  async concluir(trabalhoId: string): Promise<ResultadoConcluirCaptura> {
    const r = await this.chamar(`/api/wim-captura/${encodeURIComponent(trabalhoId)}/concluir`, { method: 'POST' });
    if (!r.ok) return { ok: false, motivo: await this.motivoDoErro(r) };
    const corpo = (await r.json()) as { arquivo: { id: string } };
    return { ok: true, arquivoId: corpo.arquivo.id };
  }
}
