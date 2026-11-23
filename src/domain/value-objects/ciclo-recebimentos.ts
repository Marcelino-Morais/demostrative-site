import type { Pagamento } from '../entities/plano-tratamento.js';
import { dataCalendarioValida } from './data-cadastral.js';

const dataDaClinica = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function hojeNaClinica(agora = new Date()): string {
  const partes = dataDaClinica.formatToParts(agora);
  return ['year', 'month', 'day'].map(tipo => partes.find(p => p.type === tipo)?.value).join('-');
}

function deslocarData(data: string, meses: number, dia: number): string {
  const ano = Number(data.slice(0, 4));
  const mes = Number(data.slice(5, 7));
  return new Date(Date.UTC(ano, mes - 1 + meses, dia)).toISOString().slice(0, 10);
}

function inicioDoCiclo(data: string): string {
  return deslocarData(data, Number(data.slice(8)) < 5 ? -1 : 0, 5);
}

export interface CicloRecebimentos {
  inicio: string;
  fim: string;
  totalCentavos: number;
  quantidade: number;
}

export function resumirCiclosRecebimentos(pagamentos: readonly Pagamento[], hoje = hojeNaClinica()) {
  const ciclos = new Map<string, CicloRecebimentos>();
  function obterCiclo(inicio: string): CicloRecebimentos {
    const existente = ciclos.get(inicio);
    if (existente) return existente;
    const ciclo = { inicio, fim: deslocarData(inicio, 1, 4), totalCentavos: 0, quantidade: 0 };
    ciclos.set(inicio, ciclo);
    return ciclo;
  }
  const atual = obterCiclo(inicioDoCiclo(hoje));
  for (const pagamento of pagamentos) {
    if (!dataCalendarioValida(pagamento.data) || pagamento.data > hoje) continue;
    const ciclo = obterCiclo(inicioDoCiclo(pagamento.data));
    ciclo.totalCentavos += pagamento.valorCentavos;
    ciclo.quantidade++;
  }
  const anteriores = [...ciclos.values()].filter(ciclo => ciclo !== atual)
    .sort((a, b) => b.inicio.localeCompare(a.inicio));
  return { atual, anteriores };
}
