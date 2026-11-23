/**
 * `GatewayNucleo` falso para os testes dos casos de uso de migração
 * (Etapas 21–22). Guarda ids "já no servidor" por coleção e reproduz a
 * semântica "só os novos, nunca sobrescreve". Nunca importado pela
 * apresentação.
 */
import type {
  ColecaoNucleo,
  ContagemNucleo,
  GatewayNucleo,
  ResultadoMigracaoNucleo,
} from './gateway-nucleo.js';
import { COLECOES_NUCLEO, contagemNucleoVazia } from './gateway-nucleo.js';

export class FakeGatewayNucleo implements GatewayNucleo {
  online = true;
  /** ids já existentes no "servidor", por coleção. */
  existentes: Record<ColecaoNucleo, Set<string>> = Object.fromEntries(
    COLECOES_NUCLEO.map((c) => [c, new Set<string>()]),
  ) as Record<ColecaoNucleo, Set<string>>;

  private chave(colecao: ColecaoNucleo, row: unknown): string {
    const r = row as { id?: string; pacienteId?: string };
    return colecao === 'anamneses' ? String(r.pacienteId) : String(r.id);
  }

  async disponivel(): Promise<boolean> {
    return this.online;
  }

  async contar(): Promise<ContagemNucleo> {
    if (!this.online) throw new Error('offline');
    const c = contagemNucleoVazia();
    for (const colecao of COLECOES_NUCLEO) c[colecao] = this.existentes[colecao].size;
    return c;
  }

  async migrar(colecoes: Partial<Record<ColecaoNucleo, unknown[]>>): Promise<ResultadoMigracaoNucleo> {
    if (!this.online) throw new Error('offline');
    let gravados = 0;
    let ignorados = 0;
    const porColecao: ResultadoMigracaoNucleo['porColecao'] = {};
    for (const colecao of COLECOES_NUCLEO) {
      const rows = colecoes[colecao] ?? [];
      let g = 0;
      let i = 0;
      for (const row of rows) {
        const k = this.chave(colecao, row);
        if (this.existentes[colecao].has(k)) i += 1;
        else {
          this.existentes[colecao].add(k);
          g += 1;
        }
      }
      if (rows.length > 0) porColecao[colecao] = { gravados: g, ignorados: i };
      gravados += g;
      ignorados += i;
    }
    return { gravados, ignorados, porColecao };
  }
}
