/**
 * Numeração dentária FDI/ISO-3950 (padrão adotado no Brasil) para a
 * dentição permanente — 32 dentes, quatro quadrantes de 8.
 *
 * Quadrante 1 (superior direito): 11-18
 * Quadrante 2 (superior esquerdo): 21-28
 * Quadrante 3 (inferior esquerdo): 31-38
 * Quadrante 4 (inferior direito): 41-48
 *
 * Convenção de exibição (posição anatômica, como o profissional vê o
 * paciente de frente): arcada superior mostrada com o quadrante 1 à
 * esquerda da tela e o quadrante 2 à direita; arcada inferior com o
 * quadrante 4 à esquerda e o quadrante 3 à direita. Dentição decídua
 * (dentes de leite) fica fora do escopo desta etapa — ver README.
 */

export type NumeroDente =
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18
  | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28
  | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38
  | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48;

const QUADRANTE_1: NumeroDente[] = [18, 17, 16, 15, 14, 13, 12, 11];
const QUADRANTE_2: NumeroDente[] = [21, 22, 23, 24, 25, 26, 27, 28];
const QUADRANTE_3: NumeroDente[] = [31, 32, 33, 34, 35, 36, 37, 38];
const QUADRANTE_4: NumeroDente[] = [48, 47, 46, 45, 44, 43, 42, 41];

/** Arcada superior, esquerda→direita da tela (posição anatômica). */
export const ARCADA_SUPERIOR: NumeroDente[] = [...QUADRANTE_1, ...QUADRANTE_2];
/** Arcada inferior, esquerda→direita da tela (posição anatômica). */
export const ARCADA_INFERIOR: NumeroDente[] = [...QUADRANTE_4, ...QUADRANTE_3];

export const TODOS_OS_DENTES: readonly NumeroDente[] = [...ARCADA_SUPERIOR, ...ARCADA_INFERIOR];

const CONJUNTO_DENTES = new Set<number>(TODOS_OS_DENTES);

export function ehNumeroDenteValido(valor: number): valor is NumeroDente {
  return CONJUNTO_DENTES.has(valor);
}

/** Nome popular do dente pela posição no quadrante — usado em resumos/tooltips. */
const NOMES_POR_POSICAO = [
  'Terceiro molar (siso)',
  'Segundo molar',
  'Primeiro molar',
  'Segundo pré-molar',
  'Primeiro pré-molar',
  'Canino',
  'Incisivo lateral',
  'Incisivo central',
];

export function nomePopularDoDente(numero: NumeroDente): string {
  const posicaoNoQuadrante = numero % 10; // 1-8
  const nome = NOMES_POR_POSICAO[8 - posicaoNoQuadrante];
  return nome ?? 'Dente';
}

export type FaceDental = 'OCLUSAL' | 'VESTIBULAR' | 'LINGUAL_PALATINA' | 'MESIAL' | 'DISTAL';

export const FACES_DENTAIS: readonly FaceDental[] = [
  'OCLUSAL',
  'VESTIBULAR',
  'LINGUAL_PALATINA',
  'MESIAL',
  'DISTAL',
];

export const FACE_DENTAL_LABEL: Record<FaceDental, string> = {
  OCLUSAL: 'Oclusal/Incisal',
  VESTIBULAR: 'Vestibular',
  LINGUAL_PALATINA: 'Lingual/Palatina',
  MESIAL: 'Mesial',
  DISTAL: 'Distal',
};
