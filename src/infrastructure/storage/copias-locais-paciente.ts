import type { ComparacaoCopiasLocais, GatewayCopiasLocais, ResumoCopiasLocais } from '../../application/ports/porta-copias-locais.js';
import { comTravaColecao } from './trava-colecao.js';

const CHAVE = 'projfernanda:pacientes';
function ler(bruto: string | null): Array<{ id: string }> {
  let dados: unknown;
  try { dados = JSON.parse(bruto ?? '[]'); }
  catch { throw new Error('A cópia local está ilegível. Nenhum dado foi alterado. Peça auxílio à manutenção.'); }
  if (!Array.isArray(dados) || dados.some(p => !p || typeof p.id !== 'string') || new Set(dados.map(p => p.id)).size !== dados.length) throw new Error('A cópia local tem formato inválido. Nenhum dado foi alterado.');
  return dados;
}
function resumo(dados: Array<{ id: string }>, comparacao: ComparacaoCopiasLocais): ResumoCopiasLocais {
  const r = comparacao.resultado;
  if (!Array.isArray(r) || r.length !== dados.length || new Set(r.map(v => v.id)).size !== dados.length ||
      r.some(v => !dados.some(p => p.id === v.id) || !['identico', 'divergente', 'ausente-no-servidor'].includes(v.status))) throw new Error('A comparação não foi concluída. Nenhum dado foi removido.');
  return { total: dados.length, identicos: r.filter(v => v.status === 'identico').length,
    divergentes: r.filter(v => v.status === 'divergente').length, ausentes: r.filter(v => v.status === 'ausente-no-servidor').length };
}
export class CopiasLocaisPaciente {
  constructor(private readonly gateway: GatewayCopiasLocais, private readonly storage = () => window.localStorage,
    private readonly trava: typeof comTravaColecao = comTravaColecao) {}
  async comparar(): Promise<ResumoCopiasLocais> {
    const dados = ler(this.storage().getItem(CHAVE));
    if (!dados.length) return { total: 0, identicos: 0, divergentes: 0, ausentes: 0 };
    return resumo(dados, await this.gateway.comparar(dados));
  }
  async limparIdenticos(): Promise<ResumoCopiasLocais> {
    return this.trava(CHAVE, async () => {
      const storage = this.storage();
      const antes = storage.getItem(CHAVE);
      const dados = ler(antes);
      if (!dados.length) return { total: 0, identicos: 0, divergentes: 0, ausentes: 0, removidos: 0 };
      // Preservar TODOS os registros e repetir a comparação imediatamente antes da limpeza.
      const copia = await this.gateway.preservar(dados);
      const resultado = resumo(dados, copia);
      if (!copia.preservada || !copia.recibo) throw new Error('A cópia protegida não foi confirmada. Nenhum dado foi removido.');
      if (storage.getItem(CHAVE) !== antes) throw new Error('Os dados deste navegador mudaram durante a conferência. Compare novamente; nada foi removido.');
      const ids = new Set(copia.resultado.filter(v => v.status === 'identico').map(v => v.id));
      if (ids.size) storage.setItem(CHAVE, JSON.stringify(dados.filter(p => !ids.has(p.id))));
      return { ...resultado, removidos: ids.size, recibo: copia.recibo };
    }, true);
  }
}
