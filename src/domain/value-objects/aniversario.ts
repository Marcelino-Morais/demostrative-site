/**
 * Cálculo de aniversário a partir da data de nascimento — sempre com
 * aritmética de data em string/UTC, nunca com `new Date(...)` lido por
 * getters locais (mesmo raciocínio documentado em `calcularIdade`,
 * `paciente.ts`, e em `bloqueio-agenda.ts`: evita o aniversário
 * "deslocar" um dia perto da meia-noite em fusos negativos como o do
 * Brasil).
 *
 * ## Regra explícita para 29 de fevereiro
 *
 * Em ano NÃO bissexto, um paciente nascido em 29/fev tem o aniversário
 * tratado como caindo em **28/fev** (convenção escolhida — é a mesma
 * adotada pela maioria dos sistemas de uso geral, ex.: Facebook). A
 * alternativa (1º de março) também seria defensável; esta foi a
 * escolhida e fica documentada aqui para nunca precisar ser redescoberta
 * lendo o código.
 */

import { dataCalendarioValida, normalizarDataCadastral } from './data-cadastral.js';

function ehAnoBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function diffDiasUtc(dataIsoA: string, dataIsoB: string): number {
  const [anoA, mesA, diaA] = dataIsoA.split('-').map(Number);
  const [anoB, mesB, diaB] = dataIsoB.split('-').map(Number);
  const msA = Date.UTC(anoA!, mesA! - 1, diaA!);
  const msB = Date.UTC(anoB!, mesB! - 1, diaB!);
  return Math.round((msB - msA) / 86_400_000);
}

export interface ProximoAniversario {
  /** `YYYY-MM-DD` — o dia em que o aniversário efetivamente cai (já ajustado pra 29/fev). */
  dataComemorada: string;
  /** `0` = hoje; nunca negativo (sempre a PRÓXIMA ocorrência, deste ano ou do que vem). */
  diasAte: number;
  /** Idade que o paciente vai completar nessa data. */
  idadeQueVaiCompletar: number;
}

/**
 * Próxima ocorrência do aniversário a partir de hoje (inclusive — se o
 * aniversário é hoje, `diasAte` é `0`). `dataNascimentoIso`/`hojeIso`
 * sempre `YYYY-MM-DD`. Devolve `null` para data de nascimento ausente
 * ou em formato inválido — nunca lança (quem chama decide o que fazer
 * com "sem data de nascimento", normalmente agrupar como pendência).
 */
export function proximoAniversario(dataNascimentoIso: string | null, hojeIso: string): ProximoAniversario | null {
  dataNascimentoIso = normalizarDataCadastral(dataNascimentoIso);
  if (!dataNascimentoIso || !dataCalendarioValida(dataNascimentoIso) || !dataCalendarioValida(hojeIso) || dataNascimentoIso > hojeIso) return null;
  const partes = dataNascimentoIso.split('-').map(Number);
  const [anoNascimento, mes, dia] = partes;
  if (partes.length !== 3 || [anoNascimento, mes, dia].some((n) => n === undefined || Number.isNaN(n))) return null;

  const [anoHoje] = hojeIso.split('-').map(Number) as [number];

  function dataComemoradaNoAno(ano: number): string {
    const diaAjustado = mes === 2 && dia === 29 && !ehAnoBissexto(ano) ? 28 : dia!;
    return `${ano}-${pad2(mes!)}-${pad2(diaAjustado)}`;
  }

  let dataComemorada = dataComemoradaNoAno(anoHoje);
  if (dataComemorada < hojeIso) {
    dataComemorada = dataComemoradaNoAno(anoHoje + 1);
  }

  return {
    dataComemorada,
    diasAte: diffDiasUtc(hojeIso, dataComemorada),
    idadeQueVaiCompletar: Number(dataComemorada.slice(0, 4)) - anoNascimento!,
  };
}

export function aniversarioEhHoje(dataNascimentoIso: string | null, hojeIso: string): boolean {
  return proximoAniversario(dataNascimentoIso, hojeIso)?.diasAte === 0;
}

/** `diasAte` entre `0` (hoje, inclusive) e `maximoDias` (inclusive). */
export function aniversarioDentroDeDias(dataNascimentoIso: string | null, hojeIso: string, maximoDias: number): boolean {
  const resultado = proximoAniversario(dataNascimentoIso, hojeIso);
  return resultado !== null && resultado.diasAte >= 0 && resultado.diasAte <= maximoDias;
}
