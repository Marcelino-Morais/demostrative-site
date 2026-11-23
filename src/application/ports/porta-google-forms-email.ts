/**
 * Port da importação de Google Forms por e-mail (Etapa 53) — caminho
 * alternativo ao webhook direto (`server/index.mjs`,
 * `/api/integracoes/google-forms/{ficha-inicial,anamnese,agendamento}`)
 * para quando o servidor da clínica não tem um endereço alcançável da
 * internet (ver `docs/google-forms-email-comparacao.md`). Quando o
 * envio direto falha, o Apps Script manda um e-mail com um bloco de
 * dados estruturado; a Dra. Fernanda cola esse texto aqui.
 *
 * Toda a validação/regra de negócio (paciente encontrado, conflito de
 * horário, dia bloqueado...) já acontece no SERVIDOR, na MESMA função
 * que o webhook direto usaria — esta tela só manda o texto colado e
 * mostra o resultado. Nunca decide sozinha se os dados são válidos.
 */

export type TipoRespostaGoogleForms = 'ficha-inicial' | 'anamnese' | 'agendamento';

/** Pré-visualização (`dryRun`) — só extrai e mostra, nunca grava nada. */
export interface PreVisualizacaoImportacaoEmail {
  tipo: TipoRespostaGoogleForms;
  idResposta: string;
  /** `true` se esta resposta já tinha sido importada antes (evita duplicar sem querer) — por qualquer caminho. */
  jaImportadoAntes: boolean;
  /**
   * `true` quando `jaImportadoAntes` é por causa da sincronização
   * automática (ou do webhook direto) já ter pego esta MESMA resposta —
   * não pelo próprio `idResposta` do e-mail (Etapa 58). Ajuda a
   * explicar pra Dra. Fernanda POR QUE já está importada, mesmo sendo a
   * primeira vez que ela cola este e-mail específico.
   */
  jaImportadoPorOutroCaminho: boolean;
  /** Os campos extraídos do bloco de dados, tal como estão, pra conferência visual. */
  dados: Record<string, unknown>;
}

/**
 * Resultado de uma importação de verdade (não é pré-visualização). Não
 * repete `tipo`/`idResposta` — quem chama já sabe, de ter analisado o
 * mesmo texto antes (o servidor nem sempre devolve corpo no sucesso:
 * salvar anamnese é 204, sem nada pra ler).
 */
export interface ResultadoImportacaoEmail {
  /** `true` quando esta resposta JÁ tinha sido importada antes — nada foi duplicado. */
  jaImportadoAntes: boolean;
  /** Ver `PreVisualizacaoImportacaoEmail.jaImportadoPorOutroCaminho`. */
  jaImportadoPorOutroCaminho: boolean;
}

export interface PortaGoogleFormsEmail {
  /** Extrai e valida a FORMA do texto colado, sem gravar nada — pra conferência antes de importar. */
  analisar(textoEmail: string): Promise<PreVisualizacaoImportacaoEmail>;
  /** Importa de verdade (cria/atualiza paciente, salva anamnese ou agenda consulta) — idempotente por idResposta. */
  importar(textoEmail: string): Promise<ResultadoImportacaoEmail>;
}
