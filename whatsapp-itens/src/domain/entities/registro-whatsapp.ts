import { agoraIso, ErroDominio, gerarId } from '../../../../src/domain/types.js';
import { mascararNumeroWhatsapp } from '../value-objects/whatsapp.js';

export type TipoAcaoWhatsapp =
  | 'CONTATO'
  | 'CONFIRMACAO_CONSULTA'
  | 'LEMBRETE_PAGAMENTO'
  | 'AVISO_EMERGENCIA'
  | 'LINK_ANAMNESE'
  | 'LINK_AGENDAMENTO';

export const TIPO_ACAO_WHATSAPP_LABEL: Record<TipoAcaoWhatsapp, string> = {
  CONTATO: 'Contato',
  CONFIRMACAO_CONSULTA: 'Confirmação/lembrete de consulta',
  LEMBRETE_PAGAMENTO: 'Lembrete de pagamento',
  AVISO_EMERGENCIA: 'Aviso de consulta de emergência',
  LINK_ANAMNESE: 'Link de anamnese',
  LINK_AGENDAMENTO: 'Link de agendamento',
};

const TIPOS_VALIDOS: TipoAcaoWhatsapp[] = [
  'CONTATO',
  'CONFIRMACAO_CONSULTA',
  'LEMBRETE_PAGAMENTO',
  'AVISO_EMERGENCIA',
  'LINK_ANAMNESE',
  'LINK_AGENDAMENTO',
];

export interface RegistroWhatsappProps {
  id: string;
  pacienteId: string;
  tipo: TipoAcaoWhatsapp;
  /**
   * Só os 4 últimos dígitos do número — auditoria de "preparamos um
   * contato para este paciente", não o número completo (que já vive em
   * `Paciente.celular`).
   */
  numeroMascarado: string;
  /** Quem preparou a ação (a profissional). */
  responsavel: string;
  criadoEm: string;
}

export interface RegistrarAcaoWhatsappInput {
  pacienteId: string;
  tipo: TipoAcaoWhatsapp;
  /** Número normalizado (E.164) — é mascarado ANTES de virar registro. Nunca o corpo da mensagem. */
  numeroNormalizado: string;
  responsavel: string;
}

/**
 * Registro local de que a dentista **preparou/abriu** uma ação de
 * WhatsApp para um paciente (Fase 1 do `docs/whatsapp-bot.spec.md`).
 * Como o envio é manual pelo WhatsApp dela, isto NÃO prova entrega —
 * só que o link foi aberto. Guarda o mínimo: paciente, data/hora,
 * tipo, número mascarado e responsável. **Nunca guarda o texto da
 * mensagem.**
 */
export class RegistroWhatsapp {
  private constructor(private props: RegistroWhatsappProps) {}

  static registrar(input: RegistrarAcaoWhatsappInput): RegistroWhatsapp {
    if (!input.pacienteId) {
      throw new ErroDominio('Registro de WhatsApp precisa estar vinculado a um paciente.');
    }
    if (!TIPOS_VALIDOS.includes(input.tipo)) {
      throw new ErroDominio(`Tipo de ação de WhatsApp inválido: ${input.tipo}.`);
    }
    return new RegistroWhatsapp({
      id: gerarId(),
      pacienteId: input.pacienteId,
      tipo: input.tipo,
      numeroMascarado: mascararNumeroWhatsapp(input.numeroNormalizado),
      responsavel: input.responsavel.trim() || 'Dra. Fernanda Morais Mendes',
      criadoEm: agoraIso(),
    });
  }

  static restaurar(props: RegistroWhatsappProps): RegistroWhatsapp {
    return new RegistroWhatsapp(props);
  }

  get id(): string {
    return this.props.id;
  }

  get pacienteId(): string {
    return this.props.pacienteId;
  }

  toSnapshot(): Readonly<RegistroWhatsappProps> {
    return { ...this.props };
  }
}

/**
 * Guarda anti-spam simples e local (pedido: "avisar antes de preparar
 * mensagens repetidas do mesmo tipo pro mesmo paciente na mesma
 * janela — ex.: mesmo dia"). Pura: recebe o histórico e diz se JÁ houve
 * uma ação do mesmo tipo, pro mesmo paciente, no mesmo dia de `agora`.
 * Não bloqueia nada — a tela decide pedir confirmação.
 */
export function houveAcaoWhatsappRecente(
  historico: readonly RegistroWhatsappProps[],
  pacienteId: string,
  tipo: TipoAcaoWhatsapp,
  agoraIsoRef: string,
): boolean {
  const diaDeHoje = agoraIsoRef.slice(0, 10);
  return historico.some(
    (r) => r.pacienteId === pacienteId && r.tipo === tipo && r.criadoEm.slice(0, 10) === diaDeHoje,
  );
}
