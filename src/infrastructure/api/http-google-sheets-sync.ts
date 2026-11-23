import { ErroApi } from '../../application/ports/api-client.js';
import type {
  DuplicatasPorCorrespondencia,
  PortaGoogleSheetsSync,
  ResultadoProcessamentoGoogleSheetsSync,
  ResultadoReconciliacao,
  ResultadoRecuperacao,
  ResultadoUltimaSincronizacao,
  ResumoReconciliacaoPorTipo,
  ResumoSincronizacaoPorTipo,
  StatusSincronizacaoGoogleSheets,
  TipoFormularioGoogle,
} from '../../application/ports/porta-google-sheets-sync.js';

const TIPOS_FORMULARIO = ['ficha-inicial', 'anamnese', 'agendamento'] as const;

function lerResumoReconciliacaoPorTipo(bruto: unknown): ResumoReconciliacaoPorTipo {
  if (!bruto || typeof bruto !== 'object') return { jaImportadas: 0, ausentes: 0, recuperaveis: 0, ambiguas: 0 };
  const r = bruto as Record<string, unknown>;
  if (typeof r.erro === 'string') return { jaImportadas: 0, ausentes: 0, recuperaveis: 0, ambiguas: 0, erro: r.erro };
  return {
    jaImportadas: numero(r.jaImportadas),
    historicoSemLinha: numero(r.historicoSemLinha),
    excluidas: numero(r.excluidas),
    ausentes: numero(r.ausentes),
    recuperaveis: numero(r.recuperaveis),
    ambiguas: numero(r.ambiguas),
  };
}

function numero(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function lerDuplicatas(bruto: unknown): DuplicatasPorCorrespondencia {
  const d = bruto && typeof bruto === 'object' ? (bruto as Record<string, unknown>) : {};
  return {
    legado: numero(d.legado),
    'conteudo-exato': numero(d['conteudo-exato']),
    normalizado: numero(d.normalizado),
  };
}

function lerResumoPorTipo(bruto: unknown): ResumoSincronizacaoPorTipo {
  if (!bruto || typeof bruto !== 'object') return {};
  const r = bruto as Record<string, unknown>;
  const resumo: ResumoSincronizacaoPorTipo = {};
  if (typeof r.processadas === 'number') resumo.processadas = r.processadas;
  if (typeof r.ignoradas === 'number') resumo.ignoradas = r.ignoradas;
  if (typeof r.rejeitadas === 'number') resumo.rejeitadas = r.rejeitadas;
  if (typeof r.pendentes === 'number') resumo.pendentes = r.pendentes;
  if (typeof r.recuperadas === 'number') resumo.recuperadas = r.recuperadas;
  if (typeof r.excluidas === 'number') resumo.excluidas = r.excluidas;
  if (r.duplicatas) resumo.duplicatas = lerDuplicatas(r.duplicatas);
  if (typeof r.erro === 'string') resumo.erro = r.erro;
  return resumo;
}

function lerUltimoResultado(bruto: unknown): ResultadoUltimaSincronizacao | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const r = bruto as Record<string, unknown>;
  const porTipoBruto = r.porTipo && typeof r.porTipo === 'object' ? (r.porTipo as Record<string, unknown>) : {};
  const porTipo: ResultadoUltimaSincronizacao['porTipo'] = {};
  for (const tipo of ['ficha-inicial', 'anamnese', 'agendamento'] as const) {
    if (tipo in porTipoBruto) porTipo[tipo] = lerResumoPorTipo(porTipoBruto[tipo]);
  }
  return {
    recuperadas: numero(r.recuperadas),
    excluidas: numero(r.excluidas),
    processadas: numero(r.processadas),
    ignoradas: numero(r.ignoradas),
    rejeitadas: numero(r.rejeitadas),
    pendentes: numero(r.pendentes),
    duplicatas: lerDuplicatas(r.duplicatas),
    porTipo,
  };
}

/**
 * Adaptador HTTP do status/operação da sincronização por planilha
 * (Etapa 58) — fala com `/api/google-sheets-sync/*`. O parser abaixo só
 * reconhece contagens/carimbos/código curto — o servidor já não devolve
 * nada além disso (nunca ID de planilha, e-mail, credencial, ou dado de
 * paciente), mas mesmo assim nunca repassa um campo desconhecido adiante.
 */
export class HttpGoogleSheetsSync implements PortaGoogleSheetsSync {
  private readonly base: string;
  private readonly token: string;

  constructor(baseUrl: string, tokenApi: string) {
    this.base = baseUrl.replace(/\/$/, '');
    this.token = tokenApi;
  }

  private async chamar(caminho: string, metodo: 'GET' | 'POST'): Promise<Response> {
    try {
      return await fetch(`${this.base}${caminho}`, {
        method: metodo,
        headers: { authorization: `Bearer ${this.token}` },
      });
    } catch {
      throw new ErroApi('Sem conexão com o servidor da clínica.', 0);
    }
  }

  async obterStatus(): Promise<StatusSincronizacaoGoogleSheets> {
    const r = await this.chamar('/api/google-sheets-sync/status', 'GET');
    if (!r.ok) throw new ErroApi(`Erro ${r.status} ao consultar a sincronização do Google Forms.`, r.status);
    const corpo = (await r.json()) as Record<string, unknown>;
    return {
      configurado: corpo.configurado === true,
      motivoNaoConfigurado: typeof corpo.motivoNaoConfigurado === 'string' ? corpo.motivoNaoConfigurado : null,
      emAndamento: corpo.emAndamento === true,
      intervaloMs: numero(corpo.intervaloMs),
      ultimaTentativaEm: typeof corpo.ultimaTentativaEm === 'string' ? corpo.ultimaTentativaEm : null,
      ultimoSucessoEm: typeof corpo.ultimoSucessoEm === 'string' ? corpo.ultimoSucessoEm : null,
      ultimoResultado: lerUltimoResultado(corpo.ultimoResultado),
      ultimoErro: typeof corpo.ultimoErro === 'string' ? corpo.ultimoErro : null,
      proximaExecucaoEm: typeof corpo.proximaExecucaoEm === 'string' ? corpo.proximaExecucaoEm : null,
    };
  }

  async processarAgora(): Promise<ResultadoProcessamentoGoogleSheetsSync> {
    const r = await this.chamar('/api/google-sheets-sync/processar', 'POST');
    if (!r.ok) throw new ErroApi(`Erro ${r.status} ao sincronizar o Google Forms.`, r.status);
    const corpo = (await r.json()) as Record<string, unknown>;
    return {
      configurado: corpo.configurado === true,
      jaEmAndamento: corpo.jaEmAndamento === true,
      motivo: typeof corpo.motivo === 'string' ? corpo.motivo : undefined,
    };
  }

  async obterReconciliacao(): Promise<ResultadoReconciliacao> {
    const r = await this.chamar('/api/google-sheets-sync/reconciliacao', 'GET');
    if (!r.ok) throw new ErroApi(`Erro ${r.status} ao verificar a consistência do histórico.`, r.status);
    const corpo = (await r.json()) as Record<string, unknown>;
    const porTipoBruto = corpo.porTipo && typeof corpo.porTipo === 'object' ? (corpo.porTipo as Record<string, unknown>) : {};
    const porTipo: ResultadoReconciliacao['porTipo'] = {};
    for (const tipo of TIPOS_FORMULARIO) {
      if (tipo in porTipoBruto) porTipo[tipo] = lerResumoReconciliacaoPorTipo(porTipoBruto[tipo]);
    }
    return { porTipo };
  }

  async recuperarRespostas(tipo: TipoFormularioGoogle): Promise<ResultadoRecuperacao> {
    let r: Response;
    try {
      r = await fetch(`${this.base}/api/google-sheets-sync/reconciliacao/recuperar`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ tipo, todosRecuperaveis: true }),
      });
    } catch {
      throw new ErroApi('Sem conexão com o servidor da clínica.', 0);
    }
    if (r.status === 409) return { recuperadas: 0, falharam: 0, jaEmAndamento: true };
    if (!r.ok) throw new ErroApi(`Erro ${r.status} ao recuperar respostas.`, r.status);
    const corpo = (await r.json()) as Record<string, unknown>;
    return {
      recuperadas: numero(corpo.recuperadas),
      falharam: numero(corpo.falharam),
    };
  }
}
