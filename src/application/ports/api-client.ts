/**
 * Port de acesso HTTP (Etapa 17 — preparo para persistência
 * compartilhada). O domínio e a aplicação **nunca** falam `fetch`
 * direto: os adaptadores remotos de repositório (`infrastructure/api/`)
 * dependem só desta interface. Trocar `fetch` por outra coisa (ou por
 * um mock em teste) é implementar `ApiClient` de novo, sem tocar em
 * caso de uso nem componente.
 *
 * Ver `docs/backend.spec.md` §5 para a superfície de API que estes
 * caminhos assumem.
 */

/** Erro de uma chamada de API — rede indisponível ou resposta HTTP não-2xx. */
export class ErroApi extends Error {
  constructor(
    message: string,
    /** Status HTTP quando houve resposta; 0 quando a requisição nem completou (offline). */
    readonly status: number,
    /** Código curto do corpo `{ erro: { codigo } }`, quando veio. */
    readonly codigo?: string,
  ) {
    super(message);
    this.name = 'ErroApi';
  }
}

export interface ApiClient {
  /** GET `caminho`. `T` é o JSON esperado. Lança `ErroApi` em 4xx/5xx (menos 404, que vira `undefined`). */
  get<T>(caminho: string): Promise<T | undefined>;
  post<T>(caminho: string, corpo?: unknown): Promise<T>;
  put<T>(caminho: string, corpo?: unknown): Promise<T>;
  /** DELETE `caminho`. 204 e 404 são sucesso (idempotente). */
  delete(caminho: string): Promise<void>;
  /** Envia um arquivo (multipart). `campos` são pares de texto que acompanham o binário. */
  postForm<T>(caminho: string, arquivo: Blob, nomeArquivo: string, campos: Record<string, string>): Promise<T>;
  /** Baixa bytes de `caminho`. `undefined` em 404. */
  getBlob(caminho: string): Promise<Blob | undefined>;
  /** `true`/`false` conforme `caminho` responde 2xx/404, sem baixar corpo (HEAD). */
  existe(caminho: string): Promise<boolean>;
}
