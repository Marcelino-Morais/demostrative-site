import {
  ProcedimentoCatalogo,
  type EditarProcedimentoCatalogoInput,
  type NovoProcedimentoCatalogoInput,
} from '../../domain/entities/procedimento-catalogo.js';
import { PROCEDIMENTOS_CATALOGO_SEMENTE } from '../../domain/entities/procedimentos-catalogo-semente.js';
import { ErroDominio } from '../../domain/types.js';
import type { RepositorioProcedimentosCatalogo } from '../ports/repositorios.js';

export class CriarProcedimentoCatalogo {
  constructor(private readonly procedimentos: RepositorioProcedimentosCatalogo) {}

  async executar(input: NovoProcedimentoCatalogoInput): Promise<ProcedimentoCatalogo> {
    const procedimento = ProcedimentoCatalogo.criar(input);
    await this.procedimentos.salvar(procedimento);
    return procedimento;
  }
}

export class EditarProcedimentoCatalogo {
  constructor(private readonly procedimentos: RepositorioProcedimentosCatalogo) {}

  async executar(id: string, input: EditarProcedimentoCatalogoInput): Promise<ProcedimentoCatalogo> {
    const procedimento = await this.procedimentos.buscarPorId(id);
    if (!procedimento) throw new ErroDominio('Procedimento não encontrado.');
    procedimento.editar(input);
    await this.procedimentos.salvar(procedimento);
    return procedimento;
  }
}

export class AtivarProcedimentoCatalogo {
  constructor(private readonly procedimentos: RepositorioProcedimentosCatalogo) {}

  async executar(id: string): Promise<void> {
    const procedimento = await this.procedimentos.buscarPorId(id);
    if (!procedimento) throw new ErroDominio('Procedimento não encontrado.');
    procedimento.ativar();
    await this.procedimentos.salvar(procedimento);
  }
}

export class DesativarProcedimentoCatalogo {
  constructor(private readonly procedimentos: RepositorioProcedimentosCatalogo) {}

  async executar(id: string): Promise<void> {
    const procedimento = await this.procedimentos.buscarPorId(id);
    if (!procedimento) throw new ErroDominio('Procedimento não encontrado.');
    procedimento.desativar();
    await this.procedimentos.salvar(procedimento);
  }
}

export class ObterProcedimentoCatalogo {
  constructor(private readonly procedimentos: RepositorioProcedimentosCatalogo) {}

  async executar(id: string): Promise<ProcedimentoCatalogo | undefined> {
    return this.procedimentos.buscarPorId(id);
  }
}

export interface ListarProcedimentosCatalogoInput {
  /** Texto de busca por nome (case-insensitive, sem acento) — vazio/ausente lista tudo. */
  termo?: string;
  /** `false` (padrão) esconde procedimentos desativados — a busca do orçamento nunca deve oferecer um inativo. */
  incluirInativos?: boolean;
}

/** Normaliza pra busca: sem acento, minúsculo, sem hífen/travessão/espaço — "Canal — pré-molar" e "premolar" batem. */
function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s\-–—]+/g, '');
}

/**
 * Listagem/busca usada tanto pela tela de gestão do catálogo (Configurações)
 * quanto pelo seletor de procedimento dentro do orçamento. O volume é
 * baixo (dezenas de itens) — filtra em memória, sem precisar de índice
 * nem paginação no repositório.
 */
export class ListarProcedimentosCatalogo {
  constructor(private readonly procedimentos: RepositorioProcedimentosCatalogo) {}

  async executar(input: ListarProcedimentosCatalogoInput = {}): Promise<ProcedimentoCatalogo[]> {
    let lista = await this.procedimentos.listarTodos();
    if (!input.incluirInativos) lista = lista.filter((p) => p.ativo);
    const termo = normalizarBusca((input.termo ?? '').trim());
    if (termo) {
      lista = lista.filter(
        (p) => normalizarBusca(p.nome).includes(termo) || normalizarBusca(p.toSnapshot().categoria).includes(termo),
      );
    }
    return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
}

export interface ResultadoSemeadura {
  criados: number;
  jaExistentes: number;
}

/**
 * Semeia o catálogo a partir de `PROCEDIMENTOS_CATALOGO_SEMENTE`
 * (planilha da clínica). Idempotente: identifica cada item pelo
 * `idSeed` fixo — se já existe (independente de a clínica ter mudado
 * preço/nome/categoria/ativo depois), **nunca toca nele**; só cria os
 * que ainda faltam. Seguro de chamar em toda inicialização do sistema.
 */
export class SemearCatalogoProcedimentos {
  constructor(private readonly procedimentos: RepositorioProcedimentosCatalogo) {}

  async executar(): Promise<ResultadoSemeadura> {
    const resultado: ResultadoSemeadura = { criados: 0, jaExistentes: 0 };
    for (const item of PROCEDIMENTOS_CATALOGO_SEMENTE) {
      const existente = await this.procedimentos.buscarPorId(item.idSeed);
      if (existente) {
        resultado.jaExistentes += 1;
        continue;
      }
      const procedimento = ProcedimentoCatalogo.criar(
        {
          nome: item.nome,
          categoria: item.categoria,
          precoCentavos: item.precoCentavos,
          precoMinimoCentavos: item.precoMinimoCentavos,
          precoMaximoCentavos: item.precoMaximoCentavos,
        },
        item.idSeed,
      );
      await this.procedimentos.salvar(procedimento);
      resultado.criados += 1;
    }
    return resultado;
  }
}
