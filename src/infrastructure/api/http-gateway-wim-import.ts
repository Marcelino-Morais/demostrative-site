import { ErroApi } from '../../application/ports/api-client.js';
import type { GatewayWimImport, WimCandidato, WimImportStatus } from '../../application/ports/gateway-wim-import.js';

type OpcoesFetch = NonNullable<Parameters<typeof fetch>[1]>;

const MOTIVO_ERRO: Record<string, string> = {
  'id-invalido': 'Radiografia não encontrada (identificador inválido).',
  'nao-encontrado': 'Esta radiografia não está mais disponível.',
  NAO_PRONTO: 'Esta radiografia não está mais disponível para importar (verifique se já foi importada ou descartada).',
  JA_IMPORTADO_OUTRO_PACIENTE: 'Esta radiografia já foi importada para outro paciente.',
  ORIGEM_MUDOU: 'O WIM gravou uma nova captura por cima desta antes da confirmação. Atualize a lista e tente de novo.',
  ORIGEM_PERDIDA: 'O arquivo original no WIM não está mais disponível.',
  ORIGEM_INDISPONIVEL: 'O arquivo original no WIM não está mais disponível.',
  REVALIDACAO_FALHOU: 'A imagem não passou na validação do servidor. Tente novamente.',
  'paciente-obrigatorio': 'Selecione o paciente antes de confirmar.',
  FALHA_ARMAZENAMENTO: 'Não foi possível gravar o arquivo no servidor. Tente novamente.',
};

/**
 * Adaptador HTTP do `GatewayWimImport` (Etapa 61) — mesmo padrão de
 * `HttpGatewayArquivos`: token Bearer, nunca loga corpo, converte erro
 * de rede em `ErroApi(status 0)`. O servidor nunca devolve caminho de
 * disco; este gateway nunca envia um.
 */
export class HttpGatewayWimImport implements GatewayWimImport {
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
    const codigo = corpo.erro?.codigo;
    const texto = (codigo && MOTIVO_ERRO[codigo]) || `Erro ${r.status} ao falar com o servidor.`;
    throw new ErroApi(texto, r.status, codigo);
  }

  async status(): Promise<WimImportStatus> {
    const r = await this.chamar('/api/wim-import/status', { method: 'GET' });
    if (!r.ok) return this.falhar(r);
    return (await r.json()) as WimImportStatus;
  }

  async listarRecentes(janelaMinutos?: number): Promise<WimCandidato[]> {
    const query = new URLSearchParams({ status: 'PRONTO' });
    if (janelaMinutos != null) query.set('janelaMinutos', String(janelaMinutos));
    const r = await this.chamar(`/api/wim-import/candidatos?${query.toString()}`, { method: 'GET' });
    if (!r.ok) return this.falhar(r);
    const corpo = (await r.json()) as { candidatos: WimCandidato[] };
    return corpo.candidatos ?? [];
  }

  async obterPreview(candidatoId: string): Promise<Blob | null> {
    const r = await this.chamar(`/api/wim-import/candidatos/${encodeURIComponent(candidatoId)}/bytes`, {
      method: 'GET',
    });
    if (r.status === 404 || r.status === 409) return null;
    if (!r.ok) return this.falhar(r);
    return r.blob();
  }

  async confirmarImportacao(pacienteId: string, candidatoId: string): Promise<{ arquivoId: string }> {
    const r = await this.chamar(
      `/api/pacientes/${encodeURIComponent(pacienteId)}/wim-import/${encodeURIComponent(candidatoId)}`,
      { method: 'POST' },
    );
    if (!r.ok) return this.falhar(r);
    const corpo = (await r.json()) as { arquivoId: string };
    return { arquivoId: corpo.arquivoId };
  }

  async ignorar(candidatoId: string): Promise<void> {
    const r = await this.chamar(`/api/wim-import/candidatos/${encodeURIComponent(candidatoId)}/ignorar`, {
      method: 'POST',
    });
    if (!r.ok) await this.falhar(r);
  }
}
