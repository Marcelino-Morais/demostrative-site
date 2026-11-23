/**
 * Port do slice de COMPROVANTES DE PAGAMENTO (Etapa 54) — coleção
 * separada da de arquivos de paciente (Etapa 19), por decisão
 * explícita do usuário: um comprovante pertence a um PAGAMENTO
 * específico, não à aba geral de documentos do paciente.
 *
 * Só existe em modo servidor (`server/`) — não há versão 100% local
 * (IndexedDB), decisão de escopo desta etapa (mesmo padrão já usado
 * pra WhatsApp automático e Google Forms por e-mail: uma tela/recurso
 * "operacional" que só faz sentido quando o núcleo está no servidor).
 * Sem servidor, a tela simplesmente não oferece anexar comprovante —
 * registrar pagamento sem comprovante sempre funciona, do jeito de
 * sempre.
 */
export interface ComprovanteProps {
  id: string;
  pagamentoId: string;
  planoId: string;
  pacienteId: string;
  /** Nome original do arquivo enviado. */
  nome: string;
  tipoMime: string;
  tamanhoBytes: number;
  criadoEm: string;
}

export interface NovoComprovanteInput {
  pagamentoId: string;
  planoId: string;
  pacienteId: string;
  nome: string;
  tipoMime: string;
}

export interface GatewayComprovantes {
  /** `true` quando o servidor responde. A tela decide se mostra o controle de anexar por isto. */
  disponivel(): Promise<boolean>;
  /** Envia o comprovante; devolve o metadado gravado (id gerado pelo servidor). */
  enviar(input: NovoComprovanteInput, conteudo: Blob): Promise<ComprovanteProps>;
  /** Metadado de um comprovante (nome/tamanho, pra mostrar sem baixar o arquivo inteiro). */
  obterMeta(id: string): Promise<ComprovanteProps | undefined>;
  /** Bytes do comprovante para abrir/baixar, ou `null` se o servidor não o tem. */
  baixar(id: string): Promise<Blob | null>;
  /** Remove metadado + bytes no servidor. */
  remover(id: string): Promise<void>;
}
