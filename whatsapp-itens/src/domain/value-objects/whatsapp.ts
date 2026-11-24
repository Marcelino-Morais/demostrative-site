import { TAXA_EMERGENCIA_CENTAVOS } from '../../../../src/domain/value-objects/atendimento-emergencia.js';
import type { StatusConsentimentoWhatsapp } from './consentimento-whatsapp.js';

/**
 * MVP de WhatsApp SEM provedor externo (ver `docs/whatsapp-bot.spec.md`):
 * o app só monta um link `https://wa.me/<numero>?text=<texto>` já
 * preenchido. Ninguém envia nada automaticamente — a Dra. Fernanda
 * abre o WhatsApp dela, confere a mensagem e manda.
 *
 * Este módulo é PURO: normaliza o número, valida, monta a URL e monta
 * o texto das mensagens permitidas. Nenhuma mensagem carrega dado
 * clínico (motivo da consulta, condição, valor de item, anamnese,
 * evolução) — só data/hora, identidade da clínica, pedido genérico de
 * confirmação e, quando for o caso, o aviso da taxa de emergência.
 */

/**
 * Reduz um celular digitado a dígitos no formato E.164 sem o `+`
 * (ex.: `5534988123344`), assumindo Brasil quando não há código de
 * país. Devolve `null` quando não dá pra montar um número plausível.
 */
export function normalizarNumeroWhatsapp(celular: string | null | undefined): string | null {
  if (!celular) return null;
  let digitos = celular.replace(/\D/g, '');
  // Já veio com o código do país (55 + DDD + número): 12 ou 13 dígitos.
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
    return digitos;
  }
  // DDD + número (fixo 10 / celular 11): prefixa 55.
  if (digitos.length === 10 || digitos.length === 11) {
    digitos = `55${digitos}`;
    return digitos;
  }
  return null;
}

/** `true` quando o celular do paciente vira um número de WhatsApp utilizável. */
export function numeroWhatsappValido(celular: string | null | undefined): boolean {
  return normalizarNumeroWhatsapp(celular) !== null;
}

/**
 * Monta a URL `wa.me` com o texto já codificado. `null` quando o
 * número não é utilizável (a UI então esconde/desabilita o botão).
 */
export function montarUrlWhatsapp(celular: string | null | undefined, texto: string): string | null {
  const numero = normalizarNumeroWhatsapp(celular);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/**
 * Número normalizado com só os 4 últimos dígitos à mostra — é o que
 * fica gravado no histórico de ações de WhatsApp (auditoria "contatamos
 * este paciente", não "prove qual número exato").
 */
export function mascararNumeroWhatsapp(numeroNormalizado: string | null | undefined): string {
  if (!numeroNormalizado) return '';
  const digitos = numeroNormalizado.replace(/\D/g, '');
  if (digitos.length < 4) return '••••';
  return `••••••${digitos.slice(-4)}`;
}

export type MotivoIndisponibilidadeWhatsapp =
  | 'ok'
  | 'sem-numero'
  | 'consentimento-nao-informado'
  | 'consentimento-negado';

export interface DisponibilidadeWhatsapp {
  /** Pode abrir o WhatsApp para este paciente agora? */
  liberado: boolean;
  motivo: MotivoIndisponibilidadeWhatsapp;
}

/** Frases prontas para a tela explicar por que a ação não está liberada. */
export const MENSAGEM_INDISPONIBILIDADE_WHATSAPP: Record<MotivoIndisponibilidadeWhatsapp, string> = {
  ok: '',
  'sem-numero': 'Este paciente não tem um número de celular válido cadastrado.',
  'consentimento-nao-informado':
    'Registre o consentimento do paciente para WhatsApp (aba Dados) antes de preparar mensagens.',
  'consentimento-negado': 'O paciente não autorizou contato por WhatsApp.',
};

/**
 * Regra combinada — número válido E consentimento AUTORIZADO. É a
 * checagem que a UI faz para mostrar/esconder o botão, e que os casos
 * de uso de "preparar mensagem" fazem antes de devolver uma `url`.
 * Mora aqui, no domínio, não em condicionais de React.
 */
export function avaliarDisponibilidadeWhatsapp(
  celular: string | null | undefined,
  statusConsentimento: StatusConsentimentoWhatsapp,
): DisponibilidadeWhatsapp {
  if (!numeroWhatsappValido(celular)) return { liberado: false, motivo: 'sem-numero' };
  if (statusConsentimento === 'NAO_AUTORIZADO') return { liberado: false, motivo: 'consentimento-negado' };
  if (statusConsentimento !== 'AUTORIZADO') return { liberado: false, motivo: 'consentimento-nao-informado' };
  return { liberado: true, motivo: 'ok' };
}

export interface IdentidadeClinica {
  nomeClinica: string;
  nomeProfissional: string;
}

function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? nomeCompleto.trim();
}

export interface MensagemConsultaInput {
  nomeCompletoPaciente: string;
  /** Data já formatada para leitura (ex.: "18/09/2026"). */
  dataFormatada: string;
  /** `HH:mm`. */
  horario: string;
  ehEmergencia: boolean;
  taxaEmergenciaCentavos?: number;
  clinica: IdentidadeClinica;
}

/**
 * Mensagem de lembrete/confirmação de consulta. Sem motivo/procedimento
 * — só o que o paciente precisa pra saber quando e com quem, o pedido
 * de confirmar, e o aviso da taxa quando a consulta é de emergência
 * (mesma frase de `atendimento-emergencia.ts`).
 */
export function montarMensagemConsultaWhatsapp(input: MensagemConsultaInput): string {
  const linhas = [
    `Olá, ${primeiroNome(input.nomeCompletoPaciente)}! Aqui é do ${input.clinica.nomeClinica}.`,
    `Lembrete da sua consulta com ${input.clinica.nomeProfissional} em ${input.dataFormatada} às ${input.horario}.`,
  ];
  if (input.ehEmergencia) {
    linhas.push(`Atendimento de emergência tem taxa adicional de ${((input.taxaEmergenciaCentavos ?? TAXA_EMERGENCIA_CENTAVOS)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}).replace(/\u00a0/g,' ')}, somada ao valor da consulta ou tratamento.`);
  }
  linhas.push('Você pode confirmar respondendo esta mensagem? Se precisar remarcar, é só avisar.');
  return linhas.join('\n\n');
}

/**
 * Lembrete de pagamento — genérico de propósito: NUNCA cita valor,
 * itens ou saldo (isso é dito pessoalmente ou no orçamento impresso).
 */
export function montarMensagemLembretePagamentoWhatsapp(input: {
  nomeCompletoPaciente: string;
  clinica: IdentidadeClinica;
}): string {
  return [
    `Olá, ${primeiroNome(input.nomeCompletoPaciente)}! Aqui é do ${input.clinica.nomeClinica}.`,
    `Passando para lembrar que há um valor em aberto referente ao seu tratamento com ${input.clinica.nomeProfissional}.`,
    'Podemos combinar o pagamento? Qualquer dúvida, é só responder por aqui.',
  ].join('\n\n');
}

/** Saudação curta para abrir uma conversa a partir da ficha do paciente. */
export function montarMensagemContatoWhatsapp(input: {
  nomeCompletoPaciente: string;
  clinica: IdentidadeClinica;
}): string {
  return `Olá, ${primeiroNome(input.nomeCompletoPaciente)}! Aqui é do ${input.clinica.nomeClinica}.`;
}

/**
 * Monta a(s) linha(s) de link pra uma mensagem que vai pro PACIENTE
 * (Etapa 45). Sempre URL crua, nunca `[texto](url)` — WhatsApp não
 * interpreta Markdown; o paciente veria os colchetes literalmente, e
 * o link não abriria clicando.
 *
 * Prefere o endereço de rede (LAN, `enderecoLan`) quando o servidor
 * sabe qual é: é o único que funciona no celular/tablet da paciente —
 * `localhost`/`127.0.0.1` só existe no computador da própria Dra.
 * Fernanda. Quando a página atual (`origemAtual`, tipicamente
 * `window.location.origin`) É `localhost`/`127.0.0.1` E existe um
 * endereço de LAN conhecido, mostra as duas, cada uma com um rótulo
 * claro em português, pra nunca mandar pro paciente um link que só
 * funciona no computador da clínica. Nos outros casos (já está na
 * LAN, ou a LAN é desconhecida) devolve uma linha só — não tem por
 * que duplicar quando as duas seriam iguais, nem dá pra mostrar uma
 * LAN que o servidor não sabe qual é.
 */
export function montarLinhaDeLinkParaPaciente(input: {
  origemAtual: string;
  enderecoLan: string | null;
  caminho: string;
}): string {
  const urlAtual = `${input.origemAtual.replace(/\/$/, '')}${input.caminho}`;
  if (!input.enderecoLan) return urlAtual;

  let porta = '';
  let hostnameAtual = '';
  try {
    const u = new URL(input.origemAtual);
    porta = u.port;
    hostnameAtual = u.hostname;
  } catch {
    return urlAtual; // origem inválida — melhor devolver algo certo do que quebrar em tentar montar a LAN
  }

  const urlLan = `http://${input.enderecoLan}${porta ? `:${porta}` : ''}${input.caminho}`;
  const atualEhLocalhost = hostnameAtual === 'localhost' || hostnameAtual === '127.0.0.1';
  if (!atualEhLocalhost) return urlLan;

  return [`Para abrir no celular/tablet da paciente: ${urlLan}`, `Para abrir neste computador: ${urlAtual}`].join(
    '\n',
  );
}

/**
 * Convite para o paciente responder a anamnese pelo link próprio dele.
 * Carrega SÓ a URL do formulário (que tem um token, nunca respostas) e
 * uma instrução curta — nenhum dado clínico. `url` normalmente vem de
 * `montarLinhaDeLinkParaPaciente` — pode ser uma linha só ou duas
 * (LAN + localhost, rotuladas), nunca Markdown.
 */
export function montarMensagemLinkAnamneseWhatsapp(input: {
  nomeCompletoPaciente: string;
  clinica: IdentidadeClinica;
  url: string;
}): string {
  return [
    `Olá, ${primeiroNome(input.nomeCompletoPaciente)}! Aqui é do ${input.clinica.nomeClinica}.`,
    'Para agilizar seu atendimento, você pode responder sua ficha de anamnese (histórico de saúde) por este link, do seu próprio celular:',
    input.url,
    'Leva poucos minutos e as respostas ficam só com a Dra. Fernanda. Qualquer dúvida, é só responder por aqui.',
  ].join('\n\n');
}

export function saudacaoPorHorario(data = new Date()): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  const hora = data.getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Convite para o paciente abrir o fluxo público de agendamento. O link
 * leva só um token opaco; a escolha de data/horário acontece no próprio
 * sistema, e a consulta confirmada cai na agenda da clínica. `url`
 * normalmente vem de `montarLinhaDeLinkParaPaciente` — pode ser uma
 * linha só ou duas (LAN + localhost, rotuladas), nunca Markdown.
 */
export function montarMensagemLinkAgendamentoWhatsapp(input: {
  nomeCompletoPaciente: string;
  clinica: IdentidadeClinica;
  url: string;
}): string {
  return [
    `${saudacaoPorHorario()}, ${primeiroNome(input.nomeCompletoPaciente)}! Aqui é do ${input.clinica.nomeClinica}.`,
    'Para solicitar uma consulta, preencha o Google Forms abaixo:',
    input.url,
    'Use o mesmo CPF, RG ou celular do cadastro. O envio do formulário não confirma o horário: aguarde a confirmação da clínica. Se for emergência, confira no formulário a taxa adicional ao procedimento.',
  ].join('\n\n');
}

export function montarMensagemConfirmacaoAgendamentoWhatsapp(input: {
  dataFormatada: string;
  horario: string;
  ehEmergencia: boolean;
  taxaEmergenciaCentavos?: number;
}): string {
  const linhas = [`Consulta confirmada para o dia ${input.dataFormatada}, às ${input.horario}.`];
  if (input.ehEmergencia) linhas.push(`Atendimento de emergência tem taxa adicional de ${((input.taxaEmergenciaCentavos ?? TAXA_EMERGENCIA_CENTAVOS)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}).replace(/\u00a0/g,' ')}, somada ao valor da consulta ou tratamento.`);
  return linhas.join('\n\n');
}

export function montarMensagemLembreteConsultaWhatsapp(input: { dataFormatada: string; horario: string }): string {
  return `Consulta marcada pro dia ${input.dataFormatada}, às ${input.horario}.`;
}
