import {
  ARCADA_INFERIOR,
  ARCADA_SUPERIOR,
  type NumeroDente,
} from '../../../domain/value-objects/numeracao-dental.js';

export interface OverlayDente {
  numero: NumeroDente;
  /** Posição e tamanho em % da caixa da imagem de referência (`odontograma-referencia.png`, 649×332). */
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Mapa de sobreposição do odontograma sobre a imagem de referência
 * (`src/assets/odontograma-referencia.png` — quatro linhas de 16
 * dentes: vista oclusal e vestibular de cada arcada). Cada dente ganha
 * **uma** área clicável que cobre as duas linhas da sua arcada — a
 * mesma numeração FDI vale para as duas vistas do mesmo dente. As
 * posições são percentuais, então as áreas escalam com qualquer largura
 * da imagem sem recalcular nada (o alinhamento é independente do
 * viewport por construção).
 *
 * PRIMEIRA PASSADA: 16 colunas de largura igual por arcada. Molares são
 * mais largos que a coluna média e a borda de uma área pode encostar no
 * dente vizinho. A **calibração fina fica pendente** — para ajustar,
 * edite `left`/`width` por dente AQUI; nada mais no app muda.
 */
const MARGEM_ESQUERDA = 1.6;
const LARGURA_UTIL = 96.8;
const COLUNAS = 16;
const PASSO = LARGURA_UTIL / COLUNAS;
const FOLGA = 0.6;

function linha(arcada: readonly NumeroDente[], top: number, height: number): OverlayDente[] {
  return arcada.map((numero, indice) => ({
    numero,
    left: Number((MARGEM_ESQUERDA + indice * PASSO).toFixed(2)),
    top,
    width: Number((PASSO - FOLGA).toFixed(2)),
    height,
  }));
}

/**
 * Arcada superior à esquerda→direita da imagem: 18…11, 21…28 (linhas 1 e
 * 2). Arcada inferior: 48…41, 31…38 (linhas 3 e 4). Mesma convenção de
 * posição anatômica de `numeracao-dental.ts`.
 */
export const MAPA_ODONTOGRAMA: readonly OverlayDente[] = [
  ...linha(ARCADA_SUPERIOR, 2.5, 49),
  ...linha(ARCADA_INFERIOR, 53, 44.5),
];
