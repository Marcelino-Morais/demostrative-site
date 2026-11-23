import type {
  ArquivoPacienteProps,
  NovoArquivoPacienteInput,
} from '../../domain/entities/arquivo-paciente.js';

/**
 * Port do slice de ARQUIVOS por paciente COMPARTILHADOS (Etapa 19). É a
 * única parte do app que fala com o servidor (`server/`) para
 * imagens/documentos — o domínio e as telas não conhecem `fetch`.
 *
 * Quando este modo está ligado (`VITE_API_ARQUIVOS=on`), tanto os
 * METADADOS quanto os BYTES vivem no servidor (sistema de arquivos sob
 * `server/dados/arquivos/`); nada é gravado no `localStorage`/IndexedDB
 * do navegador, e o servidor **nunca** devolve um caminho de disco — só
 * o id opaco e os campos de `ArquivoPacienteProps`. Endpoints em
 * `server/index.mjs` e `docs/backend.spec.md`.
 */
export interface GatewayArquivos {
  /** `true` quando o servidor responde. O app decide modo remoto x local por isto. */
  disponivel(): Promise<boolean>;
  /** Metadados dos arquivos do paciente (sem bytes), mais recentes primeiro. */
  listar(pacienteId: string): Promise<ArquivoPacienteProps[]>;
  /** Envia um arquivo; devolve o metadado gravado (id gerado pelo servidor). */
  enviar(input: NovoArquivoPacienteInput, conteudo: Blob): Promise<ArquivoPacienteProps>;
  /** Bytes de um arquivo para abrir/baixar, ou `null` se o servidor não o tem. */
  baixar(id: string): Promise<Blob | null>;
  /**
   * Exclusão LÓGICA — move para a lixeira (continuação da reconstrução
   * do WIM VITOR). Nunca apaga bytes/metadado; ver `removerPermanente`.
   */
  remover(id: string): Promise<void>;
  /** Atualiza só a descrição/nota — equivalente a `XRayForm.setNotes` do original. */
  atualizarDescricao(id: string, descricao: string): Promise<ArquivoPacienteProps>;
  /** Itens do paciente que estão na lixeira, mais recentemente excluídos primeiro. */
  listarLixeira(pacienteId: string): Promise<ArquivoPacienteProps[]>;
  /** Tira da lixeira — devolve o item restaurado. */
  restaurar(id: string): Promise<ArquivoPacienteProps>;
  /** Exclusão PERMANENTE — só funciona a partir da lixeira; nunca recuperável depois. */
  removerPermanente(id: string): Promise<void>;
  /**
   * Exportação DICOM real (continuação do WIM VITOR — ver
   * `server/dicom-exportacao.mjs`). `null` quando o arquivo não é PNG
   * cinza 8 bits (único formato suportado — nunca inventa pixels).
   */
  baixarDicom(id: string): Promise<Blob | null>;
}
