import { ErroDominio } from '../types.js';
import { ARCADA_SUPERIOR, ARCADA_INFERIOR, ehNumeroDenteValido, type NumeroDente } from './numeracao-dental.js';

export function interpretarDentesTratamento(texto: string): { numeroDente: NumeroDente | null; numerosDentes: NumeroDente[]; todosOsDentes?: boolean } {
  const normalizado = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (['todos','todas','tudo','todos os dentes','todos dentes','dentes todos','toda a boca','boca toda','boca inteira','denticao completa','denticao inteira','toda a denticao','todos os elementos','todos os elementos dentarios','ambas as arcadas','geral'].includes(normalizado)) {
    const numerosDentes = [...ARCADA_SUPERIOR, ...ARCADA_INFERIOR];
    return { numeroDente: numerosDentes[0]!, numerosDentes, todosOsDentes: true };
  }
  const partes = texto.trim() ? texto.split(/[,;]/).map(p => p.trim()) : [];
  if (partes.some(p => !/^\d{2}$/.test(p) || !ehNumeroDenteValido(Number(p)))) {
    throw new ErroDominio('Informe dentes válidos separados por vírgula ou ponto e vírgula. Ex.: 11, 12; 21, ou digite Todos.');
  }
  const numerosDentes = [...new Set(partes.map(Number))] as NumeroDente[];
  return { numeroDente: numerosDentes[0] ?? null, numerosDentes };
}

export function dentesDoTratamento(item: { numeroDente: NumeroDente | null; numerosDentes?: NumeroDente[] }): NumeroDente[] {
  return item.numerosDentes ?? (item.numeroDente === null ? [] : [item.numeroDente]);
}

export function textoDentesTratamento(item: { numeroDente: NumeroDente | null; numerosDentes?: NumeroDente[]; todosOsDentes?: boolean }): string {
 return item.todosOsDentes ? 'Todos os dentes' : dentesDoTratamento(item).join(', ');
}
