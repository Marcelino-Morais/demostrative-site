/**
 * Port das anotações persistentes sobre radiografias (continuação da
 * reconstrução do WIM VITOR — equivalente a `protoxrayform.Layer`/
 * `LayerList` do original). Só existe no modo servidor
 * (`container.sincronizacaoArquivos`), mesma dependência de
 * `GatewayArquivos` — a anotação é sempre amarrada a um `arquivoId` já
 * gravado no servidor.
 *
 * Coordenadas (`pontos`) são SEMPRE em espaço da IMAGEM (pixels da
 * imagem original) — ver `src/presentation/features/exames/
 * transformacao-visualizacao.ts`. Isto é o que garante que uma anotação
 * continua no lugar certo depois de zoom/rotação/espelho/pan.
 *
 * `salvar` escreve o array INTEIRO (nunca uma anotação isolada) com
 * concorrência otimista por `versao` — um conflito (alguém mais salvou
 * entretanto) nunca lança, devolve `{ok:false, motivo:'conflito', atual}`
 * para a tela reconciliar explicitamente (nunca perder uma edição
 * silenciosamente). Falha de rede/servidor continua lançando `ErroApi`
 * — aí sim é uma falha de gravação, não uma edição concorrente.
 */

export type TipoAnotacao = 'TEXTO' | 'CIRCULO' | 'RETANGULO' | 'LAPIS' | 'REGUA';

export interface PontoAnotacao {
  x: number;
  y: number;
}

export interface Anotacao {
  id: string;
  tipo: TipoAnotacao;
  pontos: PontoAnotacao[];
  texto?: string;
  cor?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface RegistroAnotacoes {
  arquivoId: string;
  versao: number;
  itens: Anotacao[];
  atualizadoEm: string | null;
}

export type ResultadoSalvarAnotacoes =
  | { ok: true; registro: RegistroAnotacoes }
  | { ok: false; motivo: 'conflito'; atual: RegistroAnotacoes };

export interface GatewayAnotacoesRadiografia {
  obter(arquivoId: string): Promise<RegistroAnotacoes>;
  salvar(arquivoId: string, versaoEsperada: number, itens: Anotacao[]): Promise<ResultadoSalvarAnotacoes>;
}
