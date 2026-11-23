import { desenhoDentalValido, type DesenhoDental } from '../../../server/desenho-dental.mjs';
import { agoraIso, ErroDominio, gerarId } from '../types.js';
import {
  ehNumeroDenteValido,
  nomePopularDoDente,
  type FaceDental,
  type NumeroDente,
} from '../value-objects/numeracao-dental.js';

export type CondicaoDental =
  | 'SAUDAVEL'
  | 'CARIADO'
  | 'RESTAURADO'
  | 'TRATAMENTO_DE_CANAL'
  | 'COROA_OU_PROTESE'
  | 'IMPLANTE'
  | 'FRATURADO'
  | 'EM_TRATAMENTO'
  | 'AUSENTE';

export const CONDICAO_DENTAL_LABEL: Record<CondicaoDental, string> = {
  SAUDAVEL: 'Saudável',
  CARIADO: 'Cariado',
  RESTAURADO: 'Restaurado',
  TRATAMENTO_DE_CANAL: 'Tratamento de canal',
  COROA_OU_PROTESE: 'Coroa/prótese',
  IMPLANTE: 'Implante',
  FRATURADO: 'Fraturado',
  EM_TRATAMENTO: 'Em tratamento',
  AUSENTE: 'Ausente/extraído',
};

/**
 * Cor de destaque por condição, no mesmo vocabulário de tom usado pelos
 * componentes visuais (`Badge`/`Alert` da área de apresentação) — o
 * domínio só decide QUAL tom, nunca a classe CSS em si (isso é
 * responsabilidade da camada de apresentação).
 */
export type TomCondicao = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'tooth';

export const TOM_POR_CONDICAO: Record<CondicaoDental, TomCondicao> = {
  SAUDAVEL: 'success',
  CARIADO: 'danger',
  RESTAURADO: 'info',
  TRATAMENTO_DE_CANAL: 'warning',
  COROA_OU_PROTESE: 'tooth',
  IMPLANTE: 'tooth',
  FRATURADO: 'danger',
  EM_TRATAMENTO: 'warning',
  AUSENTE: 'neutral',
};

export type TipoRegistroDental = 'PROCEDIMENTO' | 'OBSERVACAO' | 'CONDICAO_INICIAL';

export const TIPO_REGISTRO_DENTAL_LABEL: Record<TipoRegistroDental, string> = {
  PROCEDIMENTO: 'Procedimento realizado',
  OBSERVACAO: 'Observação clínica',
  CONDICAO_INICIAL: 'Condição registrada no exame',
};

export interface RegistroDentalProps {
  id: string;
  pacienteId: string;
  numeroDente: NumeroDente;
  face: FaceDental | null;
  tipo: TipoRegistroDental;
  /** Quando presente, este registro passa a definir o estado visual atual do dente (o mais recente vence). */
  condicao: CondicaoDental | null;
  descricao: string;
  data: string;
  profissionalResponsavel: string;
  /**
   * Valor de referência do procedimento — puramente informativo (ex.:
   * "essa restauração ficou por R$150"). NUNCA é somado a nenhum total
   * financeiro: o Plano de Tratamento é a única fonte de verdade sobre
   * valores a cobrar/receber (`calcularResumoFinanceiro`). Duplicar
   * esse cálculo aqui criaria dois números que poderiam divergir.
   */
  valorCentavos: number | null;
  desenho?: DesenhoDental | null;
  criadoEm: string;
}

export interface NovoRegistroDentalInput {
  pacienteId: string;
  numeroDente: number;
  face: FaceDental | null;
  tipo: TipoRegistroDental;
  condicao: CondicaoDental | null;
  descricao: string;
  data: string;
  profissionalResponsavel: string;
  valorCentavos?: number | null;
  desenho?: DesenhoDental | null;
}

/**
 * Um lançamento no histórico de um dente específico — a "linha do
 * tempo" que dá sentido ao odontograma interativo (pedido do usuário:
 * "cada item selecionado deve permitir registrar nota/procedimento/
 * tratamento/histórico", "ver quais dentes já têm registros").
 */
export class RegistroDental {
  private constructor(private props: RegistroDentalProps) {}

  static registrar(input: NovoRegistroDentalInput): RegistroDental {
    if (!input.pacienteId) {
      throw new ErroDominio('Registro dental precisa estar vinculado a um paciente.');
    }
    if (!ehNumeroDenteValido(input.numeroDente)) {
      throw new ErroDominio(`Número de dente inválido: ${input.numeroDente}.`);
    }
    if (!desenhoDentalValido(input.desenho)) throw new ErroDominio('Desenho dental inválido ou muito grande.');
    if (!input.descricao.trim() && !input.condicao && !input.desenho?.tracos.length) {
      throw new ErroDominio('Informe uma descrição ou uma condição para o registro.');
    }
    if (!input.data) {
      throw new ErroDominio('Data do registro é obrigatória.');
    }
    const valorCentavos = input.valorCentavos ?? null;
    if (valorCentavos !== null && valorCentavos < 0) {
      throw new ErroDominio('Valor não pode ser negativo.');
    }
    return new RegistroDental({
      id: gerarId(),
      pacienteId: input.pacienteId,
      numeroDente: input.numeroDente,
      face: input.face,
      tipo: input.tipo,
      condicao: input.condicao,
      descricao: input.descricao.trim(),
      data: input.data,
      profissionalResponsavel: input.profissionalResponsavel.trim() || 'Dra. Fernanda Morais Mendes',
      valorCentavos,
      desenho: input.desenho ? structuredClone(input.desenho) : null,
      criadoEm: agoraIso(),
    });
  }

  static restaurar(props: RegistroDentalProps): RegistroDental {
    // `valorCentavos` foi adicionado depois de já existirem registros salvos —
    // um snapshot antigo sem essa chave chega aqui como `undefined`, não
    // `null`. Normalizado aqui pra nunca vazar `undefined` pra UI/formatador.
    return new RegistroDental({ ...props, valorCentavos: props.valorCentavos ?? null });
  }

  get id(): string {
    return this.props.id;
  }

  get numeroDente(): NumeroDente {
    return this.props.numeroDente;
  }

  toSnapshot(): Readonly<RegistroDentalProps> {
    return structuredClone(this.props);
  }
}

/**
 * Estado atual de um dente, derivado do histórico — nunca guardado à
 * parte (a condição "atual" é sempre uma projeção do registro mais
 * recente que trouxe uma `condicao`, nunca um campo mutável separado
 * que pudesse ficar dessincronizado do histórico).
 */
export interface EstadoDoDente {
  numeroDente: NumeroDente;
  condicaoAtual: CondicaoDental | null;
  totalDeRegistros: number;
  ultimoRegistro: RegistroDentalProps | null;
}

/** Ordena por data do registro (desc) e, em empate, por criadoEm (desc) — o mais recente sempre primeiro. */
export function compararMaisRecentePrimeiro(a: RegistroDentalProps, b: RegistroDentalProps): number {
  const porData = b.data.localeCompare(a.data);
  if (porData !== 0) return porData;
  return b.criadoEm.localeCompare(a.criadoEm);
}

/**
 * Agrupa os registros de um paciente por dente e deriva o estado atual
 * de cada um — usado tanto para colorir o odontograma quanto para
 * alimentar o resumo rápido (hover/seleção) pedido pelo usuário.
 */
export function derivarEstadoDosDentes(
  registros: readonly RegistroDentalProps[],
): Map<NumeroDente, EstadoDoDente> {
  const porDente = new Map<NumeroDente, RegistroDentalProps[]>();
  for (const registro of registros) {
    const lista = porDente.get(registro.numeroDente) ?? [];
    lista.push(registro);
    porDente.set(registro.numeroDente, lista);
  }

  const estados = new Map<NumeroDente, EstadoDoDente>();
  for (const [numeroDente, lista] of porDente) {
    const ordenados = [...lista].sort(compararMaisRecentePrimeiro);
    const comCondicao = ordenados.find((r) => r.condicao !== null) ?? null;
    estados.set(numeroDente, {
      numeroDente,
      condicaoAtual: comCondicao?.condicao ?? null,
      totalDeRegistros: ordenados.length,
      ultimoRegistro: ordenados[0] ?? null,
    });
  }
  return estados;
}

export interface ResumoRapidoDoDente {
  numeroDente: NumeroDente;
  nomePopular: string;
  condicaoAtual: CondicaoDental | null;
  totalDeRegistros: number;
  /** Campos-chave do último registro do dente, ou `null` quando o dente não tem histórico. */
  ultimoRegistro: {
    tipo: TipoRegistroDental;
    data: string;
    profissionalResponsavel: string;
    /** Descrição/observação do último registro — a apresentação trunca visualmente. */
    observacao: string;
  } | null;
}

/**
 * Monta o resumo rápido de um dente (número, nome popular, condição
 * atual e os campos-chave do último registro) para o "peek" ao passar o
 * mouse ou focar um dente no odontograma interativo. É regra de
 * apresentação de dados clínicos — QUAIS campos entram no resumo mora
 * aqui, nunca num componente React. Recebe o estado já derivado
 * (`derivarEstadoDosDentes`); sempre devolve um objeto (com
 * `ultimoRegistro: null` quando o dente não tem registro nenhum).
 */
export function resumoRapidoDoDente(
  numeroDente: NumeroDente,
  estado: EstadoDoDente | undefined,
): ResumoRapidoDoDente {
  const ultimo = estado?.ultimoRegistro ?? null;
  return {
    numeroDente,
    nomePopular: nomePopularDoDente(numeroDente),
    condicaoAtual: estado?.condicaoAtual ?? null,
    totalDeRegistros: estado?.totalDeRegistros ?? 0,
    ultimoRegistro: ultimo
      ? {
          tipo: ultimo.tipo,
          data: ultimo.data,
          profissionalResponsavel: ultimo.profissionalResponsavel,
          observacao: ultimo.descricao,
        }
      : null,
  };
}

export interface GrupoHistoricoDente {
  numeroDente: NumeroDente;
  nomePopular: string;
  condicaoAtual: CondicaoDental | null;
  totalRegistros: number;
  /** Registros do dente, do mais recente para o mais antigo. */
  registros: RegistroDentalProps[];
}

/**
 * Agrupa o histórico dental por dente para o documento impresso do
 * odontograma (pedido: "histórico por dente legível mesmo com muitos
 * dentes"): um bloco por dente, com nome popular, condição atual
 * derivada e a lista de lançamentos em ordem cronológica inversa.
 * Dentes ordenados pelo número (11, 12, …, 48). Puro e testável — a
 * tela só desenha os blocos.
 */
export function agruparHistoricoPorDente(
  registros: readonly RegistroDentalProps[],
): GrupoHistoricoDente[] {
  const estados = derivarEstadoDosDentes(registros);
  const porDente = new Map<NumeroDente, RegistroDentalProps[]>();
  for (const registro of registros) {
    const lista = porDente.get(registro.numeroDente) ?? [];
    lista.push(registro);
    porDente.set(registro.numeroDente, lista);
  }

  return [...porDente.entries()]
    .sort(([a], [b]) => a - b)
    .map(([numeroDente, lista]) => ({
      numeroDente,
      nomePopular: nomePopularDoDente(numeroDente),
      condicaoAtual: estados.get(numeroDente)?.condicaoAtual ?? null,
      totalRegistros: lista.length,
      registros: [...lista].sort(compararMaisRecentePrimeiro),
    }));
}
