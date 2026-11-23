/**
 * Port do status/operação da sincronização automática do Google Forms
 * por planilha (Etapa 58) — só o necessário para uma tela de OPERAÇÃO
 * ler o estado e disparar uma rodada manual. Toda a regra de
 * deduplicação/importação já acontece no servidor
 * (`server/google-forms-processamento.mjs`); aqui é só o contrato de
 * leitura/ação, mesmo molde de `porta-whatsapp-automatico.ts`.
 *
 * Nunca carrega ID de planilha, e-mail da conta de serviço, caminho de
 * credencial, CPF/RG/celular, nome de paciente ou resposta clínica —
 * só contagens, carimbos de data/hora, e um código de erro curto.
 */

/**
 * Composição de "ignoradas" por TIPO de correspondência (Etapa 59) —
 * `legado` (chave nativa daquele canal), `conteudo-exato` (impressão
 * digital de conteúdo cru, Etapa 58) ou `normalizado` (impressão
 * digital semântica, reconhece a mesma resposta com formatação
 * diferente entre canais). Só contagem agregada — nunca detalhe de
 * qual paciente/linha.
 */
export interface DuplicatasPorCorrespondencia {
  legado: number;
  'conteudo-exato': number;
  normalizado: number;
}

export interface ResumoSincronizacaoPorTipo {
  recuperadas?: number;
  excluidas?: number;
  processadas?: number;
  ignoradas?: number;
  rejeitadas?: number;
  pendentes?: number;
  duplicatas?: DuplicatasPorCorrespondencia;
  /** Presente só quando esse tipo específico deu erro geral (ex.: falha ao buscar a planilha). */
  erro?: string;
}

export interface ResultadoUltimaSincronizacao {
  recuperadas?: number;
  excluidas?: number;
  processadas: number;
  ignoradas: number;
  rejeitadas: number;
  pendentes: number;
  duplicatas: DuplicatasPorCorrespondencia;
  porTipo: Partial<Record<'ficha-inicial' | 'anamnese' | 'agendamento', ResumoSincronizacaoPorTipo>>;
}

export interface StatusSincronizacaoGoogleSheets {
  configurado: boolean;
  /** Código curto (ex.: `sem-credencial`); `null` quando configurado. */
  motivoNaoConfigurado: string | null;
  emAndamento: boolean;
  intervaloMs: number;
  ultimaTentativaEm: string | null;
  ultimoSucessoEm: string | null;
  ultimoResultado: ResultadoUltimaSincronizacao | null;
  /** Código curto do último erro GERAL (ex.: `erro-busca`); `null` quando a última tentativa não teve erro geral. */
  ultimoErro: string | null;
  /** `null` quando não configurado ou já em andamento agora mesmo. */
  proximaExecucaoEm: string | null;
}

export interface ResultadoProcessamentoGoogleSheetsSync {
  configurado: boolean;
  jaEmAndamento?: boolean;
  motivo?: string;
}

export type TipoFormularioGoogle = 'ficha-inicial' | 'anamnese' | 'agendamento';

/**
 * Reconciliação do histórico de importação (achado real: apagar o
 * registro de destino sem reconciliar o dedup faz a sincronização
 * pular aquela resposta pra sempre). SÓ CONTAGENS — nunca nome/CPF/
 * conteúdo de resposta: `jaImportadas` (destino confirmado presente),
 * `ausentes` (destino não encontrado — soma de `recuperaveis` +
 * `ambiguas`), `recuperaveis` (identificável com segurança, pode ser
 * reaplicado), `ambiguas` (sem confiança suficiente — nunca associado
 * automaticamente, fica pendente de revisão).
 */
export interface ResumoReconciliacaoPorTipo {
  historicoSemLinha?: number;
  excluidas?: number;
  jaImportadas: number;
  ausentes: number;
  recuperaveis: number;
  ambiguas: number;
  /** Presente só quando esse tipo específico deu erro ao consultar a planilha (ex.: falha ao buscar). */
  erro?: string;
}

export interface ResultadoReconciliacao {
  porTipo: Partial<Record<TipoFormularioGoogle, ResumoReconciliacaoPorTipo>>;
}

export interface ResultadoRecuperacao {
  recuperadas: number;
  falharam: number;
  /** `true` quando uma sincronização (automática ou manual) já estava em curso — nada foi recuperado. */
  jaEmAndamento?: boolean;
  erro?: string;
}

export interface PortaGoogleSheetsSync {
  /** `GET /api/google-sheets-sync/status`. */
  obterStatus(): Promise<StatusSincronizacaoGoogleSheets>;
  /** `POST /api/google-sheets-sync/processar` — dispara na hora a mesma rotina do timer periódico. */
  processarAgora(): Promise<ResultadoProcessamentoGoogleSheetsSync>;
  /**
   * `GET /api/google-sheets-sync/reconciliacao` — diagnóstico, SÓ
   * leitura (ainda assim consulta a planilha ao vivo; nunca chamado
   * automaticamente/periodicamente, só quando a tela pede).
   */
  obterReconciliacao(): Promise<ResultadoReconciliacao>;
  /**
   * `POST /api/google-sheets-sync/reconciliacao/recuperar` — ação
   * EXPLÍCITA (nunca automática): reaplica as respostas `recuperavel`
   * daquele tipo pelo MESMO processador real de sempre.
   */
  recuperarRespostas(tipo: TipoFormularioGoogle): Promise<ResultadoRecuperacao>;
}
