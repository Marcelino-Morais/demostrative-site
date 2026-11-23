import type { EstadoDoDente } from '../../../domain/entities/registro-dental.js';
import { CONDICAO_DENTAL_LABEL } from '../../../domain/entities/registro-dental.js';
import type { NumeroDente } from '../../../domain/value-objects/numeracao-dental.js';

/**
 * Rótulo acessível de um dente no odontograma (achado real de revisão
 * de acessibilidade, Etapa 2): o nome acessível vinha só do número
 * ("26"), sem dizer se havia histórico/condição — um leitor de tela não
 * diferenciava um dente hígido de um com tratamento em andamento sem
 * abrir o resumo visual. Puro e testável isoladamente, sem montar o
 * componente React.
 */
export function descricaoAcessivel(numero: NumeroDente, estado: EstadoDoDente | undefined): string {
  const partes = [`Dente ${numero}`];
  if (estado?.condicaoAtual) {
    partes.push(`condição atual: ${CONDICAO_DENTAL_LABEL[estado.condicaoAtual]}`);
  }
  if (estado && estado.totalDeRegistros > 0) {
    partes.push(`${estado.totalDeRegistros} registro${estado.totalDeRegistros !== 1 ? 's' : ''} no histórico`);
  } else {
    partes.push('sem registros no histórico');
  }
  return partes.join(', ');
}
