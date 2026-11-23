import { agoraIso } from '../../../../src/domain/types.js';

/**
 * Consentimento do paciente para contato por WhatsApp (Fase 1 do
 * `docs/whatsapp-bot.spec.md`). Fica dentro de `PacienteProps` — é um
 * atributo do paciente, não uma entidade à parte. O padrão é
 * `NAO_INFORMADO`: nunca se assume autorização.
 */
export type StatusConsentimentoWhatsapp = 'AUTORIZADO' | 'NAO_AUTORIZADO' | 'NAO_INFORMADO';

export interface ConsentimentoWhatsapp {
  status: StatusConsentimentoWhatsapp;
  /** Data ISO em que passou a AUTORIZADO — `null` nos outros estados. */
  concedidoEm: string | null;
  /** Observação/origem livre (ex.: "presencial", "confirmou por telefone"). */
  observacao: string;
}

export const STATUS_CONSENTIMENTO_WHATSAPP_LABEL: Record<StatusConsentimentoWhatsapp, string> = {
  AUTORIZADO: 'Autorizado',
  NAO_AUTORIZADO: 'Não autorizado',
  NAO_INFORMADO: 'Não informado',
};

/**
 * Texto prático (não jurídico) que a Dra. Fernanda confirma ao marcar
 * "Autorizado". Guardado como constante — o que fica salvo por paciente
 * é só `status`/`concedidoEm`/`observacao`.
 */
export const CONSENTIMENTO_WHATSAPP_TEXTO =
  'Paciente autorizou contato pelo WhatsApp para lembretes, confirmações e informações administrativas do ' +
  'atendimento. Não enviar dados clínicos sensíveis por mensagem.';

export function consentimentoWhatsappEmBranco(): ConsentimentoWhatsapp {
  return { status: 'NAO_INFORMADO', concedidoEm: null, observacao: '' };
}

/**
 * Normaliza um consentimento vindo de um snapshot antigo (paciente
 * salvo antes deste campo existir).
 */
export function normalizarConsentimentoWhatsapp(valor: ConsentimentoWhatsapp | null | undefined): ConsentimentoWhatsapp {
  if (!valor || typeof valor !== 'object') return consentimentoWhatsappEmBranco();
  const status: StatusConsentimentoWhatsapp =
    valor.status === 'AUTORIZADO' || valor.status === 'NAO_AUTORIZADO' ? valor.status : 'NAO_INFORMADO';
  return {
    status,
    concedidoEm: status === 'AUTORIZADO' ? (valor.concedidoEm ?? null) : null,
    observacao: typeof valor.observacao === 'string' ? valor.observacao : '',
  };
}

/**
 * Calcula o novo consentimento a partir do atual + uma definição da
 * dentista. Regra da data: `concedidoEm` é preenchido quando o status
 * VIRA `AUTORIZADO` (mantém a data original se já estava autorizado) e
 * zerado em qualquer outro status. Pura e testável — a data só entra
 * aqui, nunca num componente.
 */
export function aplicarDefinicaoConsentimento(
  atual: ConsentimentoWhatsapp,
  status: StatusConsentimentoWhatsapp,
  observacao: string,
  agora: string = agoraIso(),
): ConsentimentoWhatsapp {
  return {
    status,
    concedidoEm: status === 'AUTORIZADO' ? (atual.concedidoEm ?? agora) : null,
    observacao: observacao.trim(),
  };
}
