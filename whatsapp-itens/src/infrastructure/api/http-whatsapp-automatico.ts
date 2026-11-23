import { ErroApi } from '../../../../src/application/ports/api-client.js';
import type {
  DiagnosticoTemplatesMeta,
  MensagemWhatsappAutomatica,
  PortaWhatsappAutomatico,
  ResultadoProcessamentoWhatsappAutomatico,
  StatusFilaWhatsappAutomatica,
  StatusMensagemWhatsappAutomatica,
  TipoMensagemWhatsappAutomatica,
} from '../../application/ports/porta-whatsapp-automatico.js';

function lerTemplatesMeta(bruto: unknown): DiagnosticoTemplatesMeta | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const t = bruto as Record<string, unknown>;
  return {
    confirmacao: t.confirmacao === true,
    lembrete24h: t.lembrete24h === true,
    lembrete1h: t.lembrete1h === true,
    confirmacaoEmergencia: t.confirmacaoEmergencia === true,
    lembrete24hEmergencia: t.lembrete24hEmergencia === true,
    lembrete1hEmergencia: t.lembrete1hEmergencia === true,
  };
}

const TIPOS: TipoMensagemWhatsappAutomatica[] = ['CONFIRMACAO', 'LEMBRETE_24H', 'LEMBRETE_1H', 'BOAS_VINDAS', 'AVISO_FALTA', 'AVISO_RECUSA', 'REAGENDAMENTO', 'ANIVERSARIO'];
const STATUS: StatusMensagemWhatsappAutomatica[] = ['PENDENTE', 'AGUARDANDO_PROVEDOR', 'ENVIADA', 'FALHA', 'BLOQUEADA'];

function ehTipoValido(v: unknown): v is TipoMensagemWhatsappAutomatica {
  return typeof v === 'string' && (TIPOS as string[]).includes(v);
}

function ehStatusValido(v: unknown): v is StatusMensagemWhatsappAutomatica {
  return typeof v === 'string' && (STATUS as string[]).includes(v);
}

/** Nunca lança — uma mensagem em forma estranha só é ignorada, nunca quebra a tela inteira. */
function lerMensagem(bruto: unknown): MensagemWhatsappAutomatica | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const m = bruto as Record<string, unknown>;
  if (typeof m.id !== 'string' || typeof m.pacienteId !== 'string') return null;
  if (!ehTipoValido(m.tipo) || !ehStatusValido(m.status)) return null;
  return {
    id: m.id,
    pacienteId: m.pacienteId,
    pacienteNome: typeof m.pacienteNome === 'string' ? m.pacienteNome : null,
    tipo: m.tipo,
    status: m.status,
    numeroMascarado: typeof m.numeroMascarado === 'string' ? m.numeroMascarado : '',
    agendadaPara: typeof m.agendadaPara === 'string' ? m.agendadaPara : '',
    ultimoErro: typeof m.ultimoErro === 'string' ? m.ultimoErro : null,
    proximaTentativaEm: typeof m.proximaTentativaEm === 'string' ? m.proximaTentativaEm : null,
    statusEntregaProvedor: typeof m.statusEntregaProvedor === 'string' ? m.statusEntregaProvedor : null,
    statusEntregaAtualizadoEm: typeof m.statusEntregaAtualizadoEm === 'string' ? m.statusEntregaAtualizadoEm : null,
    codigoErroEntregaProvedor: typeof m.codigoErroEntregaProvedor === 'string' ? m.codigoErroEntregaProvedor : null,
  };
}

function numero(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * Adaptador HTTP da fila automática de WhatsApp (Etapa 26) — fala com
 * os dois endpoints bearer do servidor (`/api/whatsapp-automatico/*`).
 * O parser abaixo só reconhece os campos do contrato (nunca texto de
 * mensagem nem número completo — o servidor já não devolve isso); um
 * campo desconhecido é sempre ignorado, nunca repassado adiante.
 */
export class HttpWhatsappAutomatico implements PortaWhatsappAutomatico {
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

  async obterStatus(): Promise<StatusFilaWhatsappAutomatica> {
    const r = await this.chamar('/api/whatsapp-automatico/status', 'GET');
    if (!r.ok) throw new ErroApi(`Erro ${r.status} ao consultar a fila de WhatsApp.`, r.status);
    const corpo = (await r.json()) as {
      provedorConfigurado?: unknown;
      nomeProvedor?: unknown;
      motivo?: unknown;
      porStatus?: unknown;
      mensagens?: unknown;
      webhookMetaConfigurado?: unknown;
      templatesMeta?: unknown;
    };

    const porStatusBruto =
      corpo.porStatus && typeof corpo.porStatus === 'object' ? (corpo.porStatus as Record<string, unknown>) : {};
    const porStatus: StatusFilaWhatsappAutomatica['porStatus'] = {};
    for (const s of STATUS) {
      const v = porStatusBruto[s];
      if (typeof v === 'number') porStatus[s] = v;
    }

    const mensagens = Array.isArray(corpo.mensagens)
      ? corpo.mensagens.map(lerMensagem).filter((m): m is MensagemWhatsappAutomatica => m !== null)
      : [];

    return {
      provedorConfigurado: corpo.provedorConfigurado === true,
      nomeProvedor: typeof corpo.nomeProvedor === 'string' ? corpo.nomeProvedor : null,
      motivo: typeof corpo.motivo === 'string' ? corpo.motivo : null,
      porStatus,
      mensagens,
      webhookMetaConfigurado: corpo.webhookMetaConfigurado === true,
      templatesMeta: lerTemplatesMeta(corpo.templatesMeta),
    };
  }

  async processarAgora(): Promise<ResultadoProcessamentoWhatsappAutomatico> {
    const r = await this.chamar('/api/whatsapp-automatico/processar', 'POST');
    if (!r.ok) throw new ErroApi(`Erro ${r.status} ao processar a fila de WhatsApp.`, r.status);
    const corpo = (await r.json()) as Record<string, unknown>;
    return {
      enviadas: numero(corpo.enviadas),
      aguardandoProvedor: numero(corpo.aguardandoProvedor),
      bloqueadas: numero(corpo.bloqueadas),
      falhas: numero(corpo.falhas),
    };
  }
}
