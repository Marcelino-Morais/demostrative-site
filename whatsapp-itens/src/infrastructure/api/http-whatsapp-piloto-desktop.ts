import { ErroApi } from '../../../../src/application/ports/api-client.js';
import type {
  EstadoSupervisionado,
  EtapasVerificacaoPilotoDesktop,
  PortaWhatsappPilotoDesktop,
  RespostaAcaoPiloto,
  ResultadoTestePilotoDesktop,
  StatusPilotoDesktop,
  StatusTentativaSupervisionada,
  TentativaSupervisionada,
} from '../../application/ports/porta-whatsapp-piloto-desktop.js';

const STATUS_TENTATIVA_VALIDOS = new Set<string>([
  'PRONTA',
  'EM_ANDAMENTO',
  'ENTER_PRESSIONADO',
  'INCERTO',
  'CANCELADA',
  'FALHA_RECUPERAVEL',
  'CONFIRMADO_MANUALMENTE',
  'NAO_CONFIRMADO',
]);

function lerTentativa(bruto: unknown): TentativaSupervisionada | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const t = bruto as Record<string, unknown>;
  if (typeof t.idTentativa !== 'string' || typeof t.status !== 'string') return null;
  if (!STATUS_TENTATIVA_VALIDOS.has(t.status)) return null;
  return {
    idTentativa: t.idTentativa,
    status: t.status as StatusTentativaSupervisionada,
    fase: typeof t.fase === 'string' ? t.fase : '',
    enterPressionado: t.enterPressionado === true,
    criadoEm: typeof t.criadoEm === 'string' ? t.criadoEm : '',
    atualizadoEm: typeof t.atualizadoEm === 'string' ? t.atualizadoEm : '',
    ultimoErro: typeof t.ultimoErro === 'string' ? t.ultimoErro : null,
  };
}

function lerRespostaAcao(bruto: unknown): RespostaAcaoPiloto {
  if (!bruto || typeof bruto !== 'object') return { ok: false, codigo: 'resposta-invalida' };
  const r = bruto as Record<string, unknown>;
  return {
    ok: r.ok === true,
    codigo: typeof r.codigo === 'string' ? r.codigo : 'resposta-invalida',
    idTentativa: typeof r.idTentativa === 'string' ? r.idTentativa : undefined,
  };
}

function lerEtapas(bruto: unknown): EtapasVerificacaoPilotoDesktop | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const e = bruto as Record<string, unknown>;
  return {
    desktopDesbloqueado: e.desktopDesbloqueado === true,
    whatsappLogado: e.whatsappLogado === true,
    cabecalho: e.cabecalho === true,
    telefone: e.telefone === true,
    editor: e.editor === true,
  };
}

function lerResultadoTeste(bruto: unknown): ResultadoTestePilotoDesktop | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const r = bruto as Record<string, unknown>;
  if (typeof r.codigo !== 'string') return null;
  return {
    ok: r.ok === true,
    codigo: r.codigo,
    etapas: lerEtapas(r.etapas),
    em: typeof r.em === 'string' ? r.em : '',
  };
}

/**
 * Adaptador HTTP do piloto de WhatsApp Desktop (Etapa 62, Etapa A). O
 * parser só reconhece os campos seguros do contrato — nunca telefone,
 * nome ou texto de mensagem (o servidor já não devolve isso).
 */
export class HttpWhatsappPilotoDesktop implements PortaWhatsappPilotoDesktop {
  private readonly base: string;
  private readonly token: string;

  constructor(baseUrl: string, tokenApi: string) {
    this.base = baseUrl.replace(/\/$/, '');
    this.token = tokenApi;
  }

  private async chamar(caminho: string, metodo: 'GET' | 'POST', corpo?: unknown): Promise<Response> {
    try {
      return await fetch(`${this.base}${caminho}`, {
        method: metodo,
        headers: {
          authorization: `Bearer ${this.token}`,
          ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}),
        },
        ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
      });
    } catch {
      throw new ErroApi('Sem conexão com o servidor da clínica.', 0);
    }
  }

  async obterStatus(): Promise<StatusPilotoDesktop> {
    const r = await this.chamar('/api/whatsapp-piloto-desktop/status', 'GET');
    if (!r.ok) throw new ErroApi(`Erro ${r.status} ao consultar o piloto de WhatsApp Desktop.`, r.status);
    const corpo = (await r.json()) as Record<string, unknown>;
    return {
      habilitado: corpo.habilitado === true,
      motivo: typeof corpo.motivo === 'string' ? corpo.motivo : null,
      modo: typeof corpo.modo === 'string' ? corpo.modo : null,
      ultimoResultadoTeste: lerResultadoTeste(corpo.ultimoResultadoTeste),
    };
  }

  async testarComMeuNumero(): Promise<ResultadoTestePilotoDesktop> {
    const r = await this.chamar('/api/whatsapp-piloto-desktop/testar', 'POST');
    // 409 é uma resposta válida do contrato (ex.: automação já em andamento,
    // verificação que não passou) — o corpo ainda é o resultado estruturado,
    // não um erro de transporte.
    if (!r.ok && r.status !== 409) {
      throw new ErroApi(`Erro ${r.status} ao testar o piloto de WhatsApp Desktop.`, r.status);
    }
    const corpo = (await r.json()) as Record<string, unknown>;
    const resultado = lerResultadoTeste(corpo);
    if (!resultado) throw new ErroApi('Resposta inesperada do servidor ao testar o piloto.', r.status);
    return resultado;
  }

  async obterEstadoSupervisionado(): Promise<EstadoSupervisionado> {
    const r = await this.chamar('/api/whatsapp-piloto-desktop/supervisionado/status', 'GET');
    if (!r.ok) throw new ErroApi(`Erro ${r.status} ao consultar o autoteste supervisionado.`, r.status);
    const corpo = (await r.json()) as Record<string, unknown>;
    return {
      habilitado: corpo.habilitado === true,
      motivo: typeof corpo.motivo === 'string' ? corpo.motivo : null,
      numeroMascarado: typeof corpo.numeroMascarado === 'string' ? corpo.numeroMascarado : null,
      tentativaAtual: lerTentativa(corpo.tentativaAtual),
      killSwitchAtivo: corpo.killSwitchAtivo === true,
    };
  }

  async iniciarTesteSupervisionado(confirmado: boolean): Promise<RespostaAcaoPiloto> {
    // 202/409 são respostas válidas do contrato — o corpo é sempre o
    // resultado estruturado, nunca um erro de transporte.
    const r = await this.chamar('/api/whatsapp-piloto-desktop/supervisionado/iniciar', 'POST', { confirmado });
    if (r.status !== 202 && r.status !== 409) {
      throw new ErroApi(`Erro ${r.status} ao iniciar o autoteste supervisionado.`, r.status);
    }
    return lerRespostaAcao(await r.json());
  }

  async cancelarTesteSupervisionado(): Promise<RespostaAcaoPiloto> {
    const r = await this.chamar('/api/whatsapp-piloto-desktop/supervisionado/cancelar', 'POST');
    if (r.status !== 200 && r.status !== 409) {
      throw new ErroApi(`Erro ${r.status} ao cancelar o autoteste supervisionado.`, r.status);
    }
    return lerRespostaAcao(await r.json());
  }

  async confirmarResultadoSupervisionado(resultado: 'confirmado' | 'nao-confirmado'): Promise<RespostaAcaoPiloto> {
    const r = await this.chamar('/api/whatsapp-piloto-desktop/supervisionado/confirmar', 'POST', { resultado });
    if (r.status !== 200 && r.status !== 409) {
      throw new ErroApi(`Erro ${r.status} ao confirmar o resultado do autoteste.`, r.status);
    }
    return lerRespostaAcao(await r.json());
  }

  async ativarKillSwitch(): Promise<RespostaAcaoPiloto> {
    const r = await this.chamar('/api/whatsapp-piloto-desktop/kill-switch/ativar', 'POST');
    if (!r.ok) throw new ErroApi(`Erro ${r.status} ao ativar o kill switch.`, r.status);
    return lerRespostaAcao(await r.json());
  }

  async desarmarKillSwitch(): Promise<RespostaAcaoPiloto> {
    const r = await this.chamar('/api/whatsapp-piloto-desktop/kill-switch/desarmar', 'POST');
    if (!r.ok) throw new ErroApi(`Erro ${r.status} ao desarmar o kill switch.`, r.status);
    return lerRespostaAcao(await r.json());
  }
}
