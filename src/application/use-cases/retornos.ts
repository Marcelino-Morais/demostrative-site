import { Retorno, statusApresentacaoRetorno, type RetornoProps } from '../../domain/entities/retorno.js';
import { ErroDominio } from '../../domain/types.js';
import type { RepositorioRetornos } from '../ports/repositorios.js';

export interface CriarRetornoManualInput {
  pacienteId: string;
  dataPrevista: string;
  observacao?: string;
}

/** Criação manual, com data exata — nunca depende de nenhum procedimento do catálogo. */
export class CriarRetornoManual {
  constructor(private readonly retornos: RepositorioRetornos) {}

  async executar(input: CriarRetornoManualInput): Promise<Retorno> {
    const retorno = Retorno.criar(input);
    await this.retornos.salvar(retorno);
    return retorno;
  }
}

async function carregarRetornoOuFalhar(repo: RepositorioRetornos, id: string): Promise<Retorno> {
  const retorno = await repo.buscarPorId(id);
  if (!retorno) throw new ErroDominio('Retorno não encontrado.');
  return retorno;
}

export class MarcarRetornoAgendado {
  constructor(private readonly retornos: RepositorioRetornos) {}
  async executar(id: string): Promise<void> {
    const retorno = await carregarRetornoOuFalhar(this.retornos, id);
    retorno.marcarAgendado();
    await this.retornos.salvar(retorno);
  }
}

export class MarcarRetornoConcluido {
  constructor(private readonly retornos: RepositorioRetornos) {}
  async executar(id: string): Promise<void> {
    const retorno = await carregarRetornoOuFalhar(this.retornos, id);
    retorno.marcarConcluido();
    await this.retornos.salvar(retorno);
  }
}

export class DispensarRetorno {
  constructor(private readonly retornos: RepositorioRetornos) {}
  async executar(id: string): Promise<void> {
    const retorno = await carregarRetornoOuFalhar(this.retornos, id);
    retorno.dispensar();
    await this.retornos.salvar(retorno);
  }
}

export class AdiarRetorno {
  constructor(private readonly retornos: RepositorioRetornos) {}
  async executar(id: string, novaData: string): Promise<void> {
    const retorno = await carregarRetornoOuFalhar(this.retornos, id);
    retorno.adiarPara(novaData);
    await this.retornos.salvar(retorno);
  }
}

export class ListarRetornosDoPaciente {
  constructor(private readonly retornos: RepositorioRetornos) {}
  async executar(pacienteId: string): Promise<Retorno[]> {
    return this.retornos.listarPorPaciente(pacienteId);
  }
}

export interface GrupoOperacionalRetornos {
  atrasados: RetornoProps[];
  hoje: RetornoProps[];
  proximos7Dias: RetornoProps[];
  depois: RetornoProps[];
  historico: RetornoProps[];
}

function adicionarDiasUtc(dataIso: string, n: number): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(ano, mes - 1, dia + n)).toISOString().slice(0, 10);
}

/**
 * Agrupa os retornos pra tela operacional: atrasado / devido hoje /
 * próximos 7 dias / mais tarde / histórico (concluído ou dispensado).
 * Pura — recebe "hoje" explícito, nunca lê o relógio sozinha (mesmo
 * raciocínio de `calcularIdade`/`listarPendentes` no resto do sistema:
 * nunca gerar um resultado que muda sozinho entre o teste rodar e o
 * relógio de verdade avançar).
 */
export function agruparRetornosParaOperacao(retornos: RetornoProps[], hojeIso: string): GrupoOperacionalRetornos {
  const limite7Dias = adicionarDiasUtc(hojeIso, 7);
  const grupos: GrupoOperacionalRetornos = { atrasados: [], hoje: [], proximos7Dias: [], depois: [], historico: [] };

  for (const retorno of retornos) {
    if (retorno.status === 'CONCLUIDO' || retorno.status === 'DISPENSADO') {
      grupos.historico.push(retorno);
      continue;
    }
    const apresentacao = statusApresentacaoRetorno(retorno, hojeIso);
    if (apresentacao === 'ATRASADO') grupos.atrasados.push(retorno);
    else if (retorno.dataPrevista === hojeIso) grupos.hoje.push(retorno);
    else if (retorno.dataPrevista <= limite7Dias) grupos.proximos7Dias.push(retorno);
    else grupos.depois.push(retorno);
  }

  const porData = (a: RetornoProps, b: RetornoProps) => a.dataPrevista.localeCompare(b.dataPrevista);
  grupos.atrasados.sort(porData);
  grupos.proximos7Dias.sort(porData);
  grupos.depois.sort(porData);
  grupos.historico.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
  return grupos;
}

export class ListarRetornosOperacional {
  constructor(private readonly retornos: RepositorioRetornos) {}
  async executar(hojeIso: string): Promise<GrupoOperacionalRetornos> {
    const todos = await this.retornos.listarTodos();
    return agruparRetornosParaOperacao(
      todos.map((r) => r.toSnapshot()),
      hojeIso,
    );
  }
}
