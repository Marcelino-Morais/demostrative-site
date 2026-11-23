/**
 * Port da importação de radiografias do WIM Dental (Etapa 61, Fase 3). Só
 * existe quando o modo servidor está ligado (`container.sincronizacaoArquivos`
 * — mesma flag de `GatewayArquivos`, porque a importação do WIM depende do
 * mesmo armazenamento de arquivos do servidor). Nunca expõe caminho de
 * disco; `wimPatientId`/`wimExamId` são só metadado informativo do WIM —
 * a tela NUNCA deve usá-los para escolher o paciente sozinha.
 */

export interface WimImportStatus {
  habilitado: boolean;
  pastaDisponivel: boolean;
  watcherAtivo: boolean;
  configuracaoInvalida: string | null;
  ultimoErro: string | null;
  totalCandidatos: number;
  prontosCount: number;
}

export type PapelCandidatoWim = 'ORIGINAL' | 'FILTERED' | 'DESCONHECIDO' | string;

export interface WimCandidato {
  id: string;
  wimPatientId: number | null;
  wimExamId: number | null;
  arquivo: string | null;
  papel: PapelCandidatoWim;
  chaveAquisicao: string | null;
  detectadoEm: string;
  estavelEm: string | null;
  escritoEm: string | null;
  tamanhoBytes: number | null;
  hash: string | null;
  formato: string | null;
  largura: number | null;
  altura: number | null;
  status: string;
}

export interface GatewayWimImport {
  /** Estado do serviço — para o pequeno indicador de status na tela. */
  status(): Promise<WimImportStatus>;
  /** Candidatos PRONTOS dentro da janela recente, mais recente primeiro. */
  listarRecentes(janelaMinutos?: number): Promise<WimCandidato[]>;
  /** Bytes já validados de um candidato, para preview — nunca lê disco arbitrário. */
  obterPreview(candidatoId: string): Promise<Blob | null>;
  /** A ação real: anexa ao paciente. O servidor decide tudo (bytes/MIME/nome); nunca envia caminho. */
  confirmarImportacao(pacienteId: string, candidatoId: string): Promise<{ arquivoId: string }>;
  /** Dispensa explícita — "não é este". */
  ignorar(candidatoId: string): Promise<void>;
}
