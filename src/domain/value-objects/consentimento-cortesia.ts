import { agoraIso } from '../types.js';

/**
 * Forma REUTILIZÁVEL de consentimento de cortesia — usada por DOIS
 * campos INDEPENDENTES em `Paciente` (`consentimentoCortesia`, escopo
 * ANIVERSÁRIO; `consentimentoCampanhas`, escopo CAMPANHAS/outras
 * mensagens comemorativas). Autorizar um nunca autoriza o outro — são
 * dois consentimentos distintos, cada um com seu próprio padrão seguro
 * `NAO_INFORMADO` (nunca se assume autorização), e SEPARADOS do
 * consentimento de WhatsApp para avisos de consulta
 * (`consentimento-whatsapp.ts`).
 *
 * Importante (achado de revisão): mudar só o TEXTO de um consentimento
 * genérico nunca limita seu alcance de verdade — o que decide o que
 * cada consentimento autoriza é qual CAMPO cada consumidor lê
 * (`PrepararMensagensCortesiaDoDia` lê `consentimentoCortesia` só para
 * aniversário e `consentimentoCampanhas` só para campanhas — nunca o
 * mesmo campo para os dois).
 */
export type StatusConsentimentoCortesia = 'AUTORIZADO' | 'NAO_AUTORIZADO' | 'NAO_INFORMADO';

/**
 * De onde veio a ÚLTIMA decisão (qualquer status, não só AUTORIZADO) —
 * rastreabilidade própria, nunca embutida em `observacao` como texto
 * livre. `CLINICA` = decisão manual da equipe pela tela do paciente;
 * as outras são canais externos automatizados. Uma decisão `CLINICA`
 * nunca é sobrescrita automaticamente por um canal externo (ver
 * `decidirAtualizacaoConsentimentoCortesia` no servidor) — só por outra
 * ação manual da equipe.
 */
export type OrigemConsentimentoCortesia = 'CLINICA' | 'GOOGLE_FORMS' | 'LINK_UNIVERSAL';

export interface ConsentimentoCortesia {
  status: StatusConsentimentoCortesia;
  /** Data ISO em que passou a AUTORIZADO — `null` nos outros estados. Sempre a data de PROCESSAMENTO (nunca uma data de manifestação externa invented). */
  concedidoEm: string | null;
  observacao: string;
  /**
   * Quando esta DECISÃO foi registrada por último — para QUALQUER
   * status (diferente de `concedidoEm`, que só existe para AUTORIZADO).
   * Serve só para comparação temporal segura entre decisões (nunca
   * exibido como se fosse a data em que a pessoa manifestou algo,
   * quando a origem é um canal externo com evidência própria de
   * manifestação — ver `decididoEm` vs. a data do carimbo do Forms no
   * servidor). `null` em `NAO_INFORMADO` (nenhuma decisão existe).
   */
  decididoEm: string | null;
  /** Origem da ÚLTIMA decisão — `null` em `NAO_INFORMADO`. */
  origem: OrigemConsentimentoCortesia | null;
}

export const STATUS_CONSENTIMENTO_CORTESIA_LABEL: Record<StatusConsentimentoCortesia, string> = {
  AUTORIZADO: 'Autorizado',
  NAO_AUTORIZADO: 'Não autorizado',
  NAO_INFORMADO: 'Não informado',
};

export const CONSENTIMENTO_CORTESIA_TEXTO =
  'Receber felicitações de aniversário pelo WhatsApp — escolha SEPARADA dos avisos de consulta e de qualquer ' +
  'campanha/outra mensagem comemorativa. Autorizar uma não autoriza as outras. Nunca inclui dado clínico.';

/** Padrão seguro: nunca assume autorização — o mesmo paciente pode já ter autorizado lembretes de consulta (ou o OUTRO consentimento de cortesia) sem isto estar definido. */
export function consentimentoCortesiaEmBranco(): ConsentimentoCortesia {
  return { status: 'NAO_INFORMADO', concedidoEm: null, observacao: '', decididoEm: null, origem: null };
}

/** Normaliza um consentimento vindo de um snapshot antigo (paciente salvo antes deste campo, ou antes de `decididoEm`/`origem`, existirem). */
export function normalizarConsentimentoCortesia(valor: ConsentimentoCortesia | null | undefined): ConsentimentoCortesia {
  if (!valor || typeof valor !== 'object') return consentimentoCortesiaEmBranco();
  const status: StatusConsentimentoCortesia =
    valor.status === 'AUTORIZADO' || valor.status === 'NAO_AUTORIZADO' ? valor.status : 'NAO_INFORMADO';
  const origemValida: OrigemConsentimentoCortesia[] = ['CLINICA', 'GOOGLE_FORMS', 'LINK_UNIVERSAL'];
  return {
    status,
    concedidoEm: status === 'AUTORIZADO' ? (valor.concedidoEm ?? null) : null,
    observacao: typeof valor.observacao === 'string' ? valor.observacao : '',
    // Snapshot anterior a esta etapa nunca tem `decididoEm`/`origem` —
    // ficam `null` (nunca inventa uma data/origem que não existiu;
    // ver `decidirAtualizacaoConsentimentoCortesia`: isso só faz uma
    // futura resposta do Forms exigir revisão antes de mudar nada,
    // nunca o contrário).
    decididoEm: status === 'NAO_INFORMADO' ? null : typeof valor.decididoEm === 'string' ? valor.decididoEm : null,
    origem: status === 'NAO_INFORMADO' ? null : origemValida.includes(valor.origem as OrigemConsentimentoCortesia) ? (valor.origem as OrigemConsentimentoCortesia) : null,
  };
}

/**
 * Mesma regra de data de `aplicarDefinicaoConsentimento` (WhatsApp):
 * `concedidoEm` só entra quando VIRA AUTORIZADO, e nunca é inventado —
 * sempre a data de PROCESSAMENTO (`agora`). `decididoEm` registra a
 * MESMA decisão para qualquer status (inclusive `NAO_AUTORIZADO`, que
 * `concedidoEm` não registra) — é o que permite comparar no tempo duas
 * decisões futuras sem depender só de `concedidoEm`.
 */
export function aplicarDefinicaoConsentimentoCortesia(
  atual: ConsentimentoCortesia,
  status: StatusConsentimentoCortesia,
  observacao: string,
  origem: OrigemConsentimentoCortesia = 'CLINICA',
  agora: string = agoraIso(),
): ConsentimentoCortesia {
  if (status === 'NAO_INFORMADO') {
    return { status, concedidoEm: null, observacao: observacao.trim(), decididoEm: null, origem: null };
  }
  return {
    status,
    concedidoEm: status === 'AUTORIZADO' ? (atual.concedidoEm ?? agora) : null,
    observacao: observacao.trim(),
    decididoEm: agora,
    origem,
  };
}

/**
 * Pendência de REVISÃO HUMANA de `consentimentoCortesia` — gerada quando
 * o servidor (`decidirAtualizacaoConsentimentoCortesia`) recebe uma
 * resposta externa (Google Forms) que entra em conflito com a decisão
 * atual e não tem autoridade/evidência temporal suficiente pra aplicar
 * sozinho. NUNCA aplica a resposta em silêncio — só guarda o que
 * chegou, pra alguém da equipe decidir («Aplicar» ou «Manter atual»)
 * pela tela do paciente. `null` = nenhuma pendência aberta.
 *
 * `status` `'MANTIDA'` registra que a equipe já revisou EXATAMENTE esta
 * resposta (mesmo `respostaExplicita`+`manifestadoEm`) e decidiu manter
 * o consentimento atual — impede que a MESMA resposta antiga reabra a
 * pendência pra sempre a cada sincronização; uma resposta GENUINAMENTE
 * diferente (boolean oposto, ou um carimbo mais novo) sempre cria uma
 * pendência nova.
 */
export type StatusRevisaoConsentimentoCortesia = 'PENDENTE' | 'MANTIDA';

export interface RevisaoConsentimentoCortesia {
  status: StatusRevisaoConsentimentoCortesia;
  /** A resposta explícita (Sim/Não) que gerou o conflito — nunca aplicada sem revisão humana. */
  respostaExplicita: boolean;
  /** Carimbo confiável de manifestação (planilha); `null` para webhook sem carimbo ou planilha sem data confiável. */
  manifestadoEm: string | null;
  origem: OrigemConsentimentoCortesia;
  /** Código curto do motivo (ex.: `'decisao-manual-da-clinica-exige-revisao'`) — nunca texto livre de paciente. */
  motivo: string;
  detectadoEm: string;
  /** Preenchido quando `status` vira `'MANTIDA'`; `null` enquanto `'PENDENTE'`. */
  revisadoEm: string | null;
}

const ORIGENS_VALIDAS: OrigemConsentimentoCortesia[] = ['CLINICA', 'GOOGLE_FORMS', 'LINK_UNIVERSAL'];

/** Mesmo princípio de `normalizarConsentimentoCortesia`: nunca inventa uma pendência — snapshot sem o formato esperado vira `null` (nenhuma pendência). */
export function normalizarRevisaoConsentimentoCortesia(valor: unknown): RevisaoConsentimentoCortesia | null {
  if (!valor || typeof valor !== 'object') return null;
  const r = valor as Record<string, unknown>;
  if (r.status !== 'PENDENTE' && r.status !== 'MANTIDA') return null;
  if (typeof r.respostaExplicita !== 'boolean') return null;
  if (typeof r.motivo !== 'string' || !r.motivo) return null;
  if (typeof r.detectadoEm !== 'string' || !r.detectadoEm) return null;
  return {
    status: r.status,
    respostaExplicita: r.respostaExplicita,
    manifestadoEm: typeof r.manifestadoEm === 'string' ? r.manifestadoEm : null,
    origem: ORIGENS_VALIDAS.includes(r.origem as OrigemConsentimentoCortesia) ? (r.origem as OrigemConsentimentoCortesia) : 'GOOGLE_FORMS',
    motivo: r.motivo,
    detectadoEm: r.detectadoEm,
    revisadoEm: typeof r.revisadoEm === 'string' ? r.revisadoEm : null,
  };
}

/** Explicação curta e segura (sem dado de paciente) de cada motivo de revisão — para a tela do paciente. */
export const MOTIVO_REVISAO_CONSENTIMENTO_CORTESIA_TEXTO: Record<string, string> = {
  'decisao-manual-da-clinica-exige-revisao':
    'O consentimento atual foi definido manualmente pela equipe — uma resposta automática nunca o substitui sem revisão.',
  'resposta-sem-evidencia-temporal-suficiente':
    'A resposta recebida não tem uma data confiável que comprove ser mais recente que a decisão atual.',
};
