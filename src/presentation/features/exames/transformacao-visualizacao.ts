/**
 * Transformação de visualização de uma radiografia — zoom, deslocamento
 * (pan), rotação (múltiplos de 90°, igual ao original — `XRayForm.
 * actionRotateLeft/actionRotateRight`, nunca ângulo livre) e espelhamento
 * H/V (`actionFlipHorizontally/Vertically`). Ver `PARITY_MATRIX.md`,
 * seção "Visualização".
 *
 * NUNCA altera o arquivo original — é só o estado de como ele é
 * desenhado na tela. `cssTransform` abaixo gera exatamente a mesma
 * composição que `imagemParaTela`/`telaParaImagem` calculam, para que uma
 * marcação/medida clicada na tela sempre volte pro pixel certo da
 * imagem original, em qualquer zoom/rotação/espelhamento — ver
 * `transformacao-visualizacao.test.ts` para a prova disso.
 *
 * Importante sobre a ORDEM das transformações (por que o cálculo abaixo
 * é correto e não arbitrário): espelhar e depois rotacionar comuta com
 * aplicar um ESCALAR uniforme (`escala`) antes ou depois — multiplicar
 * por um número não muda sob rotação. Isso permite que o CSS
 * (`scale` aplicado ANTES do `rotate`, por como o navegador compõe
 * `transform`) e este modelo (mirror -> rotate -> scale) cheguem ao
 * MESMO resultado — não são duas fórmulas coincidentemente parecidas,
 * são a mesma transformação, só fatorada em ordens diferentes.
 */

export type AnguloRotacao = 0 | 90 | 180 | 270;

export interface EstadoVisualizacao {
  escala: number;
  anguloGraus: AnguloRotacao;
  espelhoHorizontal: boolean;
  espelhoVertical: boolean;
  /** Deslocamento em pixels de TELA (não de imagem) — soma-se depois de escala/rotação. */
  deslocX: number;
  deslocY: number;
}

export const ESTADO_VISUALIZACAO_PADRAO: EstadoVisualizacao = {
  escala: 1,
  anguloGraus: 0,
  espelhoHorizontal: false,
  espelhoVertical: false,
  deslocX: 0,
  deslocY: 0,
};

export const ZOOM_MINIMO = 0.1;
export const ZOOM_MAXIMO = 8;
export const PASSO_ZOOM = 1.25;

export function aplicarZoom(estado: EstadoVisualizacao, fator: number): EstadoVisualizacao {
  const escala = Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, estado.escala * fator));
  return { ...estado, escala };
}

export function girar(estado: EstadoVisualizacao, sentido: 'esquerda' | 'direita'): EstadoVisualizacao {
  const passo = sentido === 'direita' ? 90 : -90;
  const anguloGraus = (((estado.anguloGraus + passo) % 360) + 360) % 360;
  return { ...estado, anguloGraus: anguloGraus as AnguloRotacao };
}

export function espelhar(estado: EstadoVisualizacao, eixo: 'horizontal' | 'vertical'): EstadoVisualizacao {
  return eixo === 'horizontal'
    ? { ...estado, espelhoHorizontal: !estado.espelhoHorizontal }
    : { ...estado, espelhoVertical: !estado.espelhoVertical };
}

export function deslocar(estado: EstadoVisualizacao, dx: number, dy: number): EstadoVisualizacao {
  return { ...estado, deslocX: estado.deslocX + dx, deslocY: estado.deslocY + dy };
}

/** String de `transform` CSS — ver nota de composição no comentário do módulo. */
export function cssTransform(estado: EstadoVisualizacao): string {
  const sx = estado.escala * (estado.espelhoHorizontal ? -1 : 1);
  const sy = estado.escala * (estado.espelhoVertical ? -1 : 1);
  return `translate(${estado.deslocX}px, ${estado.deslocY}px) rotate(${estado.anguloGraus}deg) scale(${sx}, ${sy})`;
}

/** Ponto em pixels da IMAGEM ORIGINAL (origem no canto superior-esquerdo, 0≤x≤largura, 0≤y≤altura). */
export interface PontoImagem {
  x: number;
  y: number;
}

/** Ponto em pixels de TELA, relativo ao centro do contêiner do visualizador. */
export interface PontoTela {
  x: number;
  y: number;
}

function rotacionar(x: number, y: number, anguloGraus: AnguloRotacao): { x: number; y: number } {
  switch (anguloGraus) {
    case 0:
      return { x, y };
    case 90:
      return { x: -y, y: x };
    case 180:
      return { x: -x, y: -y };
    case 270:
      return { x: y, y: -x };
  }
}

function rotacionarInverso(x: number, y: number, anguloGraus: AnguloRotacao): { x: number; y: number } {
  switch (anguloGraus) {
    case 0:
      return { x, y };
    case 90:
      // inverso de (x,y) -> (-y,x) é (x,y) -> (y,-x)
      return { x: y, y: -x };
    case 180:
      return { x: -x, y: -y };
    case 270:
      // inverso de (x,y) -> (y,-x) é (x,y) -> (-y,x)
      return { x: -y, y: x };
  }
}

/**
 * Pixel da imagem original -> posição na tela (relativa ao centro do
 * contêiner do visualizador, ANTES de somar o centro do viewport em si
 * — quem desenha soma `viewportCenter` por conta própria).
 */
export function imagemParaTela(
  ponto: PontoImagem,
  estado: EstadoVisualizacao,
  largura: number,
  altura: number,
): PontoTela {
  const xc = ponto.x - largura / 2;
  const yc = ponto.y - altura / 2;
  const xm = estado.espelhoHorizontal ? -xc : xc;
  const ym = estado.espelhoVertical ? -yc : yc;
  const { x: xr, y: yr } = rotacionar(xm, ym, estado.anguloGraus);
  const xs = xr * estado.escala;
  const ys = yr * estado.escala;
  return { x: xs + estado.deslocX, y: ys + estado.deslocY };
}

/** Inverso de `imagemParaTela` — usado para converter um clique na tela de volta pro pixel certo da imagem original. */
export function telaParaImagem(
  ponto: PontoTela,
  estado: EstadoVisualizacao,
  largura: number,
  altura: number,
): PontoImagem {
  const xs = ponto.x - estado.deslocX;
  const ys = ponto.y - estado.deslocY;
  const xr = xs / estado.escala;
  const yr = ys / estado.escala;
  const { x: xm, y: ym } = rotacionarInverso(xr, yr, estado.anguloGraus);
  const xc = estado.espelhoHorizontal ? -xm : xm;
  const yc = estado.espelhoVertical ? -ym : ym;
  return { x: xc + largura / 2, y: yc + altura / 2 };
}

/** Distância em pixels da IMAGEM ORIGINAL entre dois pontos — invariante a zoom/rotação/espelhamento/pan, por definição (é medida no espaço da imagem, não da tela). */
export function distanciaEmPixels(a: PontoImagem, b: PontoImagem): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
