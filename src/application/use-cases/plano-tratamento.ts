import { hojeIsoLocal } from '../../domain/types.js';
import {
  PlanoTratamento,
  type CondicoesDePagamento,
  type EditarItemTratamentoInput,
  type NovoItemTratamentoInput,
  type NovoPagamentoInput,
  type StatusPlanoTratamento,
} from '../../domain/entities/plano-tratamento.js';
import { Retorno } from '../../domain/entities/retorno.js';
import { ErroDominio } from '../../domain/types.js';
import type { GatewayComprovantes } from '../ports/gateway-comprovantes.js';
import type { RepositorioPlanosTratamento, RepositorioProcedimentosCatalogo, RepositorioRetornos } from '../ports/repositorios.js';

function adicionarDiasUtc(dataIso: string, n: number): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(ano, mes - 1, dia + n)).toISOString().slice(0, 10);
}

export class CriarPlanoTratamento {
  constructor(private readonly planos: RepositorioPlanosTratamento) {}

  async executar(pacienteId: string): Promise<PlanoTratamento> {
    const plano = PlanoTratamento.criar(pacienteId);
    await this.planos.salvar(plano);
    return plano;
  }
}

export class ListarPlanosDoPaciente {
  constructor(private readonly planos: RepositorioPlanosTratamento) {}

  async executar(pacienteId: string): Promise<PlanoTratamento[]> {
    const lista = await this.planos.listarPorPacienteId(pacienteId);
    return [...lista].sort((a, b) => b.toSnapshot().criadoEm.localeCompare(a.toSnapshot().criadoEm));
  }
}

export class ObterPlanoTratamento {
  constructor(private readonly planos: RepositorioPlanosTratamento) {}

  async executar(planoId: string): Promise<PlanoTratamento | undefined> {
    return this.planos.buscarPorId(planoId);
  }
}

async function carregarPlanoOuFalhar(
  planos: RepositorioPlanosTratamento,
  planoId: string,
): Promise<PlanoTratamento> {
  const plano = await planos.buscarPorId(planoId);
  if (!plano) throw new ErroDominio('Plano de tratamento não encontrado.');
  return plano;
}

export class AdicionarItemTratamento {
  constructor(private readonly planos: RepositorioPlanosTratamento) {}

  async executar(planoId: string, input: NovoItemTratamentoInput): Promise<PlanoTratamento> {
    const plano = await carregarPlanoOuFalhar(this.planos, planoId);
    plano.adicionarItem(input);
    await this.planos.salvar(plano);
    return plano;
  }
}

export class EditarItemTratamento {
  constructor(private readonly planos: RepositorioPlanosTratamento) {}

  async executar(planoId: string, itemId: string, input: EditarItemTratamentoInput): Promise<PlanoTratamento> {
    const plano = await carregarPlanoOuFalhar(this.planos, planoId);
    plano.editarItem(itemId, input);
    await this.planos.salvar(plano);
    return plano;
  }
}

/**
 * Concluir um item de orçamento que tem um procedimento do catálogo com
 * intervalo de retorno configurado gera um retorno/follow-up
 * automaticamente (pedido explícito do usuário) — nunca cria consulta
 * nenhuma, só um registro de acompanhamento pendente. `procedimentos`/
 * `retornos` são OPCIONAIS: quando omitidos (como em todo o histórico
 * de testes/chamadas existentes), o comportamento de sempre continua
 * idêntico — só marca o item como concluído, sem gerar retorno.
 */
export class MarcarItemTratamentoConcluido {
  constructor(
    private readonly planos: RepositorioPlanosTratamento,
    private readonly procedimentos?: RepositorioProcedimentosCatalogo,
    private readonly retornos?: RepositorioRetornos,
  ) {}

  async executar(planoId: string, itemId: string, concluido: boolean, hojeIso?: string): Promise<PlanoTratamento> {
    const plano = await carregarPlanoOuFalhar(this.planos, planoId);
    plano.marcarItemConcluido(itemId, concluido);
    await this.planos.salvar(plano);

    if (concluido && this.procedimentos && this.retornos) {
      await this.gerarRetornoAutomaticoSeAplicavel(plano, itemId, hojeIso ?? hojeIsoLocal());
    }
    return plano;
  }

  private async gerarRetornoAutomaticoSeAplicavel(plano: PlanoTratamento, itemId: string, hojeIso: string): Promise<void> {
    const item = plano.toSnapshot().itens.find((i) => i.id === itemId);
    if (!item?.procedimentoId) return;

    // Nunca gera um segundo retorno pro mesmo item concluído de novo
    // (ex.: desmarcar e marcar concluído outra vez).
    const jaExiste = await this.retornos!.buscarPorItemTratamentoOrigemId(itemId);
    if (jaExiste) return;

    const procedimento = await this.procedimentos!.buscarPorId(item.procedimentoId);
    const intervaloDias = procedimento?.intervaloRetornoDias;
    if (!intervaloDias) return;

    const retorno = Retorno.criar({
      pacienteId: plano.toSnapshot().pacienteId,
      dataPrevista: adicionarDiasUtc(hojeIso, intervaloDias),
      procedimentoOrigemId: item.procedimentoId,
      itemTratamentoOrigemId: itemId,
    });
    await this.retornos!.salvar(retorno);
  }
}

export class RemoverItemTratamento {
  constructor(private readonly planos: RepositorioPlanosTratamento) {}

  async executar(planoId: string, itemId: string): Promise<PlanoTratamento> {
    const plano = await carregarPlanoOuFalhar(this.planos, planoId);
    plano.removerItem(itemId);
    await this.planos.salvar(plano);
    return plano;
  }
}

export class RegistrarPagamento {
  constructor(private readonly planos: RepositorioPlanosTratamento) {}

  async executar(planoId: string, input: NovoPagamentoInput): Promise<PlanoTratamento> {
    const plano = await carregarPlanoOuFalhar(this.planos, planoId);
    plano.registrarPagamento(input);
    await this.planos.salvar(plano);
    return plano;
  }
}

export class RemoverPagamento {
  /**
   * `comprovantes` é OPCIONAL de propósito (Etapa 54) — mesmo padrão já
   * usado em `AgendarConsulta`/`ReagendarConsulta` (Etapa 51) pra não
   * quebrar os vários call sites existentes que só passam `planos`.
   * Quando presente, remover um pagamento que tinha comprovante também
   * apaga o arquivo (nunca deixa um comprovante órfão apontando pra um
   * pagamento que não existe mais); quando ausente (modo local, sem
   * servidor de comprovantes), o comportamento é EXATAMENTE o de antes.
   */
  constructor(
    private readonly planos: RepositorioPlanosTratamento,
    private readonly comprovantes?: GatewayComprovantes,
  ) {}

  async executar(planoId: string, pagamentoId: string): Promise<PlanoTratamento> {
    const plano = await carregarPlanoOuFalhar(this.planos, planoId);
    const comprovanteId = plano.comprovanteDoPagamento(pagamentoId);
    plano.removerPagamento(pagamentoId);
    await this.planos.salvar(plano);
    if (comprovanteId && this.comprovantes) {
      await this.comprovantes.remover(comprovanteId).catch(() => {
        // Nunca deixa a exclusão do pagamento falhar por causa de um
        // comprovante órfão que não conseguiu apagar (ex.: servidor de
        // arquivos fora do ar num instante) — o pagamento já foi
        // removido de verdade, que é a ação que a dentista pediu.
      });
    }
    return plano;
  }
}

/**
 * Segundo passo do fluxo de "registrar pagamento com comprovante"
 * (Etapa 54) — depois que `RegistrarPagamento` cria o pagamento (e a
 * tela já sabe o id de verdade), o arquivo é enviado ao servidor de
 * comprovantes e este caso de uso vincula o id devolvido ao pagamento.
 */
export class AnexarComprovantePagamento {
  constructor(private readonly planos: RepositorioPlanosTratamento) {}

  async executar(planoId: string, pagamentoId: string, arquivoId: string): Promise<PlanoTratamento> {
    const plano = await carregarPlanoOuFalhar(this.planos, planoId);
    plano.anexarComprovante(pagamentoId, arquivoId);
    await this.planos.salvar(plano);
    return plano;
  }
}

export class DefinirCondicoesDePagamento {
  constructor(private readonly planos: RepositorioPlanosTratamento) {}

  async executar(planoId: string, condicoes: CondicoesDePagamento): Promise<PlanoTratamento> {
    const plano = await carregarPlanoOuFalhar(this.planos, planoId);
    plano.definirCondicoesDePagamento(condicoes);
    await this.planos.salvar(plano);
    return plano;
  }
}

export class DefinirStatusPlanoTratamento {
  constructor(private readonly planos: RepositorioPlanosTratamento) {}

  async executar(planoId: string, status: StatusPlanoTratamento): Promise<PlanoTratamento> {
    const plano = await carregarPlanoOuFalhar(this.planos, planoId);
    plano.definirStatus(status);
    await this.planos.salvar(plano);
    return plano;
  }
}

/**
 * Marca/desmarca um orçamento como atendimento de emergência (taxa
 * adicional de R$ 150,00). Ação explícita da dentista — recalcular o
 * saldo é consequência esperada, e nenhum pagamento já lançado é
 * tocado.
 */
export class DefinirEmergenciaPlano {
  constructor(private readonly planos: RepositorioPlanosTratamento) {}

  async executar(planoId: string, emergencia: boolean): Promise<PlanoTratamento> {
    const plano = await carregarPlanoOuFalhar(this.planos, planoId);
    plano.definirEmergencia(emergencia);
    await this.planos.salvar(plano);
    return plano;
  }
}
