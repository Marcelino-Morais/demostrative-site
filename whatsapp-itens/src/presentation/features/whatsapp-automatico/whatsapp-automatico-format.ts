import type {
  StatusFilaWhatsappAutomatica,
  StatusMensagemWhatsappAutomatica,
  TipoMensagemWhatsappAutomatica,
} from '../../../application/ports/porta-whatsapp-automatico.js';
import type { BadgeTone } from '../../../../../src/presentation/components/ui/badge.js';

const ROTULO_TIPO: Record<TipoMensagemWhatsappAutomatica, string> = {
  BOAS_VINDAS: 'Boas-vindas após cadastro',
  AVISO_FALTA: 'Aviso de falta',
  AVISO_RECUSA: 'Pedido não aprovado',
  REAGENDAMENTO: 'Alteração de horário',
  ANIVERSARIO: 'Felicitações de aniversário',
  CONFIRMACAO: 'Confirmação',
  LEMBRETE_24H: 'Lembrete — 24h antes',
  LEMBRETE_1H: 'Lembrete — 1h antes',
};

export function rotuloTipoMensagem(tipo: TipoMensagemWhatsappAutomatica): string {
  return ROTULO_TIPO[tipo];
}

const ROTULO_STATUS: Record<StatusMensagemWhatsappAutomatica, string> = {
  PENDENTE: 'Pendente',
  AGUARDANDO_PROVEDOR: 'Aguardando provedor',
  ENVIADA: 'Enviada',
  FALHA: 'Falha no envio',
  BLOQUEADA: 'Bloqueada',
};

export function rotuloStatusMensagem(status: StatusMensagemWhatsappAutomatica): string {
  return ROTULO_STATUS[status];
}

const TOM_STATUS: Record<StatusMensagemWhatsappAutomatica, BadgeTone> = {
  PENDENTE: 'neutral',
  AGUARDANDO_PROVEDOR: 'warning',
  ENVIADA: 'success',
  FALHA: 'danger',
  BLOQUEADA: 'neutral',
};

export function tomStatusMensagem(status: StatusMensagemWhatsappAutomatica): BadgeTone {
  return TOM_STATUS[status];
}

const DESTAQUE_LINHA: Partial<Record<StatusMensagemWhatsappAutomatica, string>> = {
  FALHA: 'bg-danger-50/60 dark:bg-danger-900/10',
  BLOQUEADA: 'bg-warning-50/60 dark:bg-warning-900/10',
};

/**
 * Classe de fundo para destacar, na lista, as linhas que pedem atenção
 * (falha no envio ou bloqueadas) — as demais não ganham destaque.
 */
export function destaqueLinhaPorStatus(status: StatusMensagemWhatsappAutomatica): string | undefined {
  return DESTAQUE_LINHA[status];
}

/** Ordem fixa de exibição dos contadores por status — sempre as 5, mesmo com contagem zero. */
export const ORDEM_STATUS: StatusMensagemWhatsappAutomatica[] = [
  'PENDENTE',
  'AGUARDANDO_PROVEDOR',
  'ENVIADA',
  'FALHA',
  'BLOQUEADA',
];

const ROTULO_MOTIVO: Record<string, string> = {
  'sem-provedor': 'Nenhum provedor de envio de WhatsApp foi configurado ainda.',
  'url-invalida': 'A URL do provedor configurada não é válida.',
  'url-insegura': 'A URL do provedor precisa ser HTTPS (exceto para teste em localhost).',
  'provedor-desabilitado': 'O envio automático está desligado de propósito — nenhuma mensagem é enviada enquanto a ativação explícita não for ligada.',
  'provedor-desconhecido': 'O tipo de provedor configurado não é reconhecido.',
  'meta-sem-configuracao': 'A integração oficial com a Meta (WhatsApp Cloud API) ainda não tem as variáveis obrigatórias configuradas.',
  'meta-versao-invalida': 'A versão configurada da Graph API da Meta não é válida.',
  'meta-identificador-invalido': 'O identificador do número configurado para a Meta não é válido.',
  'meta-url-invalida': 'O endereço configurado para a Meta não é válido.',
  'meta-url-insegura': 'O endereço configurado para a Meta precisa ser HTTPS (exceto para teste em localhost).',
  'meta-mapeamento-template-incompleto': 'Faltam templates aprovados configurados para a integração com a Meta.',
};

/**
 * Frase amigável para o `motivo` curto que o servidor devolve quando o
 * provedor não está configurado. Códigos desconhecidos (ex.: de uma
 * versão futura do servidor) caem num texto genérico — nunca mostra o
 * código cru pro usuário.
 */
export function rotuloMotivoProvedor(motivo: string | null): string {
  if (!motivo) return '';
  return ROTULO_MOTIVO[motivo] ?? 'O provedor de envio de WhatsApp não está disponível no momento.';
}

const ROTULO_ULTIMO_ERRO: Record<string, string> = {
  'aniversario-nao-elegivel-ou-interrompido': 'Envio impedido: confira a data, a autorização, o cadastro e a interrupção de mensagens pelo paciente.',
  'aniversario-requer-waha-conectado': 'Aguardando o WhatsApp conectado no WAHA.',
  'aniversario-envio-indeterminado-sem-retry': 'Resultado do envio não confirmado. Confira no WhatsApp antes de tentar novamente.',
  'telefone-compartilhado-ou-ausente': 'Telefone compartilhado ou ausente. Confira qual paciente usa esse número.',

  'sem-provedor': 'Sem provedor configurado',
  'sem-consentimento': 'Paciente sem consentimento de WhatsApp autorizado',
  'sem-numero': 'Número de celular inválido ou ausente',
  'consulta-indisponivel': 'Consulta cancelada, com falta ou já realizada',
  'lembrete-1h-desativado': 'Lembrete de 1h desativado para evitar um envio adicional',
  'clinica-fechada-na-data': 'Clínica fechada nessa data — confira a consulta e reagende',
  'consulta-reagendada': 'Consulta remarcada — uma nova mensagem foi criada para o horário novo',
  'maximo-tentativas-excedido': 'Falhou repetidamente e parou de tentar — confira o provedor',
  'meta-conta-ou-numero-restrito': 'Restrição externa da conta/número na Meta — requer ação fora do sistema',
  'meta-autenticacao-invalida': 'Credencial da Meta inválida ou expirada',
  'meta-payload-invalido': 'A Meta recusou o template/mensagem (configuração de template)',
  'meta-template-emergencia-nao-configurado': 'Falta o template de emergência aprovado para esta categoria',
  'meta-mapeamento-template-incompleto': 'Mapeamento de template da Meta incompleto',
};

/**
 * Mesma ideia de `rotuloMotivoProvedor`, para o `ultimoErro` de cada
 * mensagem da fila. Qualquer `meta-erro-http-<status>` (sem entrada
 * exata na tabela — erro da Meta não mapeado individualmente) ainda
 * ganha uma frase amigável, nunca o código cru.
 */
export function rotuloUltimoErro(codigo: string | null): string | null {
  if (!codigo) return null;
  if (ROTULO_ULTIMO_ERRO[codigo]) return ROTULO_ULTIMO_ERRO[codigo];
  if (codigo.startsWith('meta-erro-http-') || codigo.startsWith('provider-http-')) {
    return 'O provedor recusou o envio (erro HTTP) — tentativa automática continua, se ainda não atingiu o máximo';
  }
  if (codigo === 'provider-sem-resposta') return 'Não foi possível contatar o provedor (falha de rede)';
  return codigo;
}

const ROTULO_ENTREGA_PROVEDOR: Record<string, string> = {
  sent: 'aceita pela Meta',
  delivered: 'entregue pelo WhatsApp',
  read: 'lida no WhatsApp',
  failed: 'falhou depois do aceite da Meta',
};

export function rotuloStatusEntregaProvedor(status: string | null | undefined): string | null {
  if (!status) return null;
  return ROTULO_ENTREGA_PROVEDOR[status] ?? null;
}

/**
 * Estado geral do provedor (Etapa 28) — a tela usa isto para escolher
 * UM aviso de destaque no topo do cartão, em vez de o operador ter que
 * juntar sozinho "configurado?" + "tem falha?" + "já enviou algo?":
 *
 *  - `nao-configurado`   — sem provedor; a fila continua sendo montada
 *                          normalmente, só não sai nada de verdade;
 *  - `falhando`          — provedor configurado, mas a última rodada
 *                          teve pelo menos uma mensagem em `FALHA`
 *                          (credencial errada, URL fora do ar, etc.);
 *  - `funcionando`       — provedor configurado e já entregou pelo
 *                          menos uma mensagem (`ENVIADA`) sem falha
 *                          pendente;
 *  - `pronto-sem-envios` — provedor configurado, sem falha, mas ainda
 *                          nada foi enviado (fila pronta, aguardando o
 *                          horário de cada mensagem vencer).
 */
export type EstadoOperacionalProvedor = 'nao-configurado' | 'falhando' | 'funcionando' | 'pronto-sem-envios';

export function estadoOperacionalProvedor(status: StatusFilaWhatsappAutomatica): EstadoOperacionalProvedor {
  if (!status.provedorConfigurado) return 'nao-configurado';
  if ((status.porStatus.FALHA ?? 0) > 0) return 'falhando';
  if ((status.porStatus.ENVIADA ?? 0) > 0) return 'funcionando';
  return 'pronto-sem-envios';
}

/**
 * A partir de quantas mensagens "represadas" (Etapa 29) a tela avisa
 * que a fila está acumulando — `AGUARDANDO_PROVEDOR` + `FALHA`, nunca
 * `PENDENTE` (que só ainda não venceu, não é represamento: nada de
 * errado está acontecendo com uma mensagem pendente).
 */
export const LIMITE_MENSAGENS_REPRESADAS = 10;

export function contarMensagensRepresadas(status: StatusFilaWhatsappAutomatica): number {
  return (status.porStatus.AGUARDANDO_PROVEDOR ?? 0) + (status.porStatus.FALHA ?? 0);
}

/** `true` quando o número de mensagens represadas já pede atenção (ver `LIMITE_MENSAGENS_REPRESADAS`). */
export function filaComMuitasRepresadas(status: StatusFilaWhatsappAutomatica): boolean {
  return contarMensagensRepresadas(status) >= LIMITE_MENSAGENS_REPRESADAS;
}
