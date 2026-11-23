/**
 * `ApiClient` falso para testes dos adaptadores remotos — grava cada
 * requisição feita e devolve respostas/erros programados. Nunca
 * importado pela apresentação.
 */
import { ErroApi, type ApiClient } from './api-client.js';

export interface RequisicaoGravada {
  metodo: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'POSTFORM' | 'GETBLOB' | 'HEAD';
  caminho: string;
  corpo?: unknown;
  /** Para `postForm`: os campos de texto e o tamanho do binário (nunca o conteúdo). */
  form?: { campos: Record<string, string>; nomeArquivo: string; tamanhoBytes: number };
}

export class FakeApiClient implements ApiClient {
  readonly requisicoes: RequisicaoGravada[] = [];
  private respostas = new Map<string, unknown>();
  private erros = new Map<string, ErroApi>();
  private blobs = new Map<string, Blob>();

  /** Programa o JSON devolvido para `METODO caminho` (ex.: `programar('GET /pacientes', [...])`). */
  programar(chave: string, resposta: unknown): this {
    this.respostas.set(chave, resposta);
    return this;
  }

  programarErro(chave: string, erro: ErroApi): this {
    this.erros.set(chave, erro);
    return this;
  }

  programarBlob(chave: string, blob: Blob): this {
    this.blobs.set(chave, blob);
    return this;
  }

  private resolver<T>(metodo: string, caminho: string): T {
    const chave = `${metodo} ${caminho}`;
    const erro = this.erros.get(chave);
    if (erro) throw erro;
    return this.respostas.get(chave) as T;
  }

  async get<T>(caminho: string): Promise<T | undefined> {
    this.requisicoes.push({ metodo: 'GET', caminho });
    return this.resolver<T | undefined>('GET', caminho);
  }

  async post<T>(caminho: string, corpo?: unknown): Promise<T> {
    this.requisicoes.push({ metodo: 'POST', caminho, corpo });
    return this.resolver<T>('POST', caminho);
  }

  async put<T>(caminho: string, corpo?: unknown): Promise<T> {
    this.requisicoes.push({ metodo: 'PUT', caminho, corpo });
    return this.resolver<T>('PUT', caminho);
  }

  async delete(caminho: string): Promise<void> {
    this.requisicoes.push({ metodo: 'DELETE', caminho });
    this.resolver<void>('DELETE', caminho);
  }

  async postForm<T>(
    caminho: string,
    arquivo: Blob,
    nomeArquivo: string,
    campos: Record<string, string>,
  ): Promise<T> {
    this.requisicoes.push({
      metodo: 'POSTFORM',
      caminho,
      form: { campos, nomeArquivo, tamanhoBytes: arquivo.size },
    });
    return this.resolver<T>('POSTFORM', caminho);
  }

  async getBlob(caminho: string): Promise<Blob | undefined> {
    this.requisicoes.push({ metodo: 'GETBLOB', caminho });
    return this.blobs.get(`GETBLOB ${caminho}`);
  }

  async existe(caminho: string): Promise<boolean> {
    this.requisicoes.push({ metodo: 'HEAD', caminho });
    return Boolean(this.respostas.get(`HEAD ${caminho}`));
  }
}
