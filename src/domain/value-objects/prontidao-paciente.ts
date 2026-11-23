import type { StatusConsentimentoWhatsapp } from '../../../whatsapp-itens/src/domain/value-objects/consentimento-whatsapp.js';

/**
 * Prontidão clínica de um paciente (Etapa 14) — um resumo/checklist do
 * que ainda falta para a ficha estar pronta para o trabalho de
 * consultório: anamnese preenchida, dado de contato mínimo, plano de
 * tratamento com itens, saldo quitado, próxima consulta confirmada.
 *
 * É REGRA de domínio: o que conta como "pendência" e a gravidade de
 * cada uma não pode morar num componente React. A função é PURA — o
 * caso de uso apura os fatos a partir dos repositórios e passa só
 * contagens/flags; nenhum dado clínico bruto (resposta de anamnese,
 * texto de evolução) entra aqui, e nenhum rótulo devolvido cita uma
 * resposta clínica específica (privacidade: a lista/painel mostram só
 * "Atenção clínica", nunca o teor).
 */

/** Nível geral: `completa` = pronta para o trabalho clínico (itens "info" não rebaixam). */
export type NivelProntidao = 'completa' | 'atencao' | 'pendente';

export type GravidadeProntidao = 'pendente' | 'atencao' | 'info';

export type ChaveProntidao =
  | 'anamnese-ausente'
  | 'anamnese-incompleta'
  | 'atencao-clinica'
  | 'contato-incompleto'
  | 'sem-odontograma'
  | 'plano-ativo-sem-itens'
  | 'saldo-aberto'
  | 'consulta-nao-confirmada'
  | 'consentimento-whatsapp'
  | 'arquivado-com-consulta-futura';

export interface IndicadorProntidao {
  chave: ChaveProntidao;
  /** Rótulo curto e NÃO sensível — nunca cita uma resposta clínica específica. */
  rotulo: string;
  gravidade: GravidadeProntidao;
}

/**
 * Fatos já apurados sobre um paciente. O caso de uso monta isto a
 * partir dos repositórios; só contagens e flags — nada de conteúdo
 * clínico.
 */
export interface EntradaProntidaoPaciente {
  arquivado: boolean;
  contato: {
    /** Tem algum celular cadastrado (qualquer texto não vazio — não precisa ser WhatsApp válido). */
    temCelular: boolean;
  };
  consentimentoWhatsapp: StatusConsentimentoWhatsapp;
  anamnese: {
    existe: boolean;
    completa: boolean;
    /** Quantos pontos de atenção clínica a anamnese levantou — SÓ a contagem, nunca o teor. */
    pontosDeAtencao: number;
  };
  odontogramaRegistros: number;
  planos: {
    total: number;
    ativos: number;
    /** Planos ATIVOS ainda sem nenhum item de trabalho lançado. */
    ativosSemItens: number;
  };
  /** Soma do saldo devedor de todos os planos ATIVOS, em centavos (nunca negativo). */
  saldoAbertoCentavos: number;
  consultas: {
    /** Consultas ainda de pé — nem canceladas, nem realizadas, de hoje em diante. */
    futuras: number;
    /** A próxima consulta futura está só AGENDADA (ainda não CONFIRMADA). */
    proximaNaoConfirmada: boolean;
  };
}

export interface ProntidaoPaciente {
  nivel: NivelProntidao;
  indicadores: IndicadorProntidao[];
  /** Atalhos usados por badges da lista e pelos filtros — derivados dos mesmos fatos. */
  anamneseIncompleta: boolean;
  temAtencaoClinica: boolean;
  contatoIncompleto: boolean;
  temSaldoAberto: boolean;
  saldoAbertoCentavos: number;
  temConsultaFutura: boolean;
  proximaConsultaNaoConfirmada: boolean;
  planoPendente: boolean;
  consentimentoWhatsapp: StatusConsentimentoWhatsapp;
  /** `true` para qualquer status diferente de AUTORIZADO (o filtro "faltando/negado"). */
  consentimentoWhatsappPendente: boolean;
}

export const NIVEL_PRONTIDAO_LABEL: Record<NivelProntidao, string> = {
  completa: 'Pronto',
  atencao: 'Atenção',
  pendente: 'Pendências',
};

/** Vocabulário de tom do resto do app — a apresentação decide a classe CSS. */
export const TOM_POR_NIVEL_PRONTIDAO: Record<NivelProntidao, 'success' | 'warning' | 'danger'> = {
  completa: 'success',
  atencao: 'warning',
  pendente: 'danger',
};

export const TOM_POR_GRAVIDADE_PRONTIDAO: Record<GravidadeProntidao, 'danger' | 'warning' | 'neutral'> = {
  pendente: 'danger',
  atencao: 'warning',
  info: 'neutral',
};

function nivelDe(indicadores: IndicadorProntidao[]): NivelProntidao {
  if (indicadores.some((i) => i.gravidade === 'pendente')) return 'pendente';
  if (indicadores.some((i) => i.gravidade === 'atencao')) return 'atencao';
  return 'completa';
}

export function avaliarProntidaoPaciente(entrada: EntradaProntidaoPaciente): ProntidaoPaciente {
  const anamneseIncompleta = !entrada.anamnese.existe || !entrada.anamnese.completa;
  const temAtencaoClinica = entrada.anamnese.pontosDeAtencao > 0;
  const contatoIncompleto = !entrada.contato.temCelular;
  const saldoAbertoCentavos = Math.max(0, entrada.saldoAbertoCentavos);
  const temSaldoAberto = saldoAbertoCentavos > 0;
  const temConsultaFutura = entrada.consultas.futuras > 0;
  const proximaConsultaNaoConfirmada = temConsultaFutura && entrada.consultas.proximaNaoConfirmada;
  const planoPendente = entrada.planos.ativosSemItens > 0;
  const consentimentoWhatsappPendente = entrada.consentimentoWhatsapp !== 'AUTORIZADO';

  const flags = {
    anamneseIncompleta,
    temAtencaoClinica,
    contatoIncompleto,
    temSaldoAberto,
    saldoAbertoCentavos,
    temConsultaFutura,
    proximaConsultaNaoConfirmada,
    planoPendente,
    consentimentoWhatsapp: entrada.consentimentoWhatsapp,
    consentimentoWhatsappPendente,
  };

  const indicadores: IndicadorProntidao[] = [];

  // Paciente arquivado saiu do fluxo ativo — a única coisa que ainda
  // merece destaque é a inconsistência de ter consulta futura marcada.
  if (entrada.arquivado) {
    if (temConsultaFutura) {
      indicadores.push({
        chave: 'arquivado-com-consulta-futura',
        rotulo: 'Arquivado com consulta futura',
        gravidade: 'pendente',
      });
    }
    return { ...flags, indicadores, nivel: nivelDe(indicadores) };
  }

  if (!entrada.anamnese.existe) {
    indicadores.push({ chave: 'anamnese-ausente', rotulo: 'Anamnese não iniciada', gravidade: 'pendente' });
  } else if (!entrada.anamnese.completa) {
    indicadores.push({ chave: 'anamnese-incompleta', rotulo: 'Anamnese incompleta', gravidade: 'atencao' });
  }
  if (temAtencaoClinica) {
    indicadores.push({ chave: 'atencao-clinica', rotulo: 'Atenção clínica', gravidade: 'atencao' });
  }
  if (contatoIncompleto) {
    indicadores.push({ chave: 'contato-incompleto', rotulo: 'Sem celular cadastrado', gravidade: 'atencao' });
  }
  if (temSaldoAberto) {
    indicadores.push({ chave: 'saldo-aberto', rotulo: 'Saldo em aberto', gravidade: 'pendente' });
  }
  if (planoPendente) {
    indicadores.push({ chave: 'plano-ativo-sem-itens', rotulo: 'Plano de tratamento sem itens', gravidade: 'atencao' });
  }
  if (proximaConsultaNaoConfirmada) {
    indicadores.push({ chave: 'consulta-nao-confirmada', rotulo: 'Consulta não confirmada', gravidade: 'atencao' });
  }
  // Odontograma vazio só vira sinal quando já há tratamento ativo — num
  // cadastro recém-criado seria só ruído.
  if (entrada.planos.ativos > 0 && entrada.odontogramaRegistros === 0) {
    indicadores.push({ chave: 'sem-odontograma', rotulo: 'Sem registro no odontograma', gravidade: 'info' });
  }
  if (consentimentoWhatsappPendente) {
    indicadores.push({
      chave: 'consentimento-whatsapp',
      rotulo:
        entrada.consentimentoWhatsapp === 'NAO_AUTORIZADO'
          ? 'WhatsApp não autorizado'
          : 'Consentimento WhatsApp pendente',
      gravidade: 'info',
    });
  }

  return { ...flags, indicadores, nivel: nivelDe(indicadores) };
}
