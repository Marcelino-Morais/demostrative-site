/**
 * Coleção genérica persistida em `localStorage` como um array JSON sob
 * uma chave própria. Cada repositório concreto (`infrastructure/storage`)
 * é uma casca fina em cima disto, só traduzindo entre snapshot (dado
 * plano, serializável) e entidade de domínio (`Entidade.restaurar`).
 *
 * Isolado da entidade de domínio de propósito — esta classe nunca
 * importa nada de `domain`/`application`, só sabe ler/escrever um
 * array de objetos com `id`. Trocar por uma API HTTP no futuro é
 * escrever uma implementação nova de cada `Repositorio*` (a interface
 * do port), sem tocar aqui.
 */
import { comTravaColecao } from './trava-colecao.js';
export class LocalStorageCollection<T extends { id: string }> {
  constructor(private readonly chave: string) {}

  private lerTudo(): T[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const bruto = window.localStorage.getItem(this.chave);
      if (!bruto) return [];
      const parsed = JSON.parse(bruto) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      // Conteúdo corrompido/inacessível (modo privado restrito, JSON inválido) — trata como coleção vazia.
      return [];
    }
  }

  private escreverTudo(itens: T[]): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(this.chave, JSON.stringify(itens));
    } catch {
      // Armazenamento cheio/indisponível — a UI trata a falha ao reler os dados depois, não aqui.
    }
  }

  async listarTodos(): Promise<T[]> {
    return this.lerTudo();
  }

  async buscarPorId(id: string): Promise<T | undefined> {
    return this.lerTudo().find((item) => item.id === id);
  }

  async filtrar(predicado: (item: T) => boolean): Promise<T[]> {
    return this.lerTudo().filter(predicado);
  }

  async salvar(item: T): Promise<void> {
    return comTravaColecao(this.chave, () => {
    const itens = this.lerTudo();
    const indice = itens.findIndex((i) => i.id === item.id);
    if (indice >= 0) {
      itens[indice] = item;
    } else {
      itens.push(item);
    }
    this.escreverTudo(itens);
    });
  }

  async remover(id: string): Promise<void> {
    return comTravaColecao(this.chave, () => {
    const itens = this.lerTudo().filter((item) => item.id !== id);
    this.escreverTudo(itens);
    });
  }
}
