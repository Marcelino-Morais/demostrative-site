import { calcularResumoFinanceiro } from '../../domain/entities/plano-tratamento.js';
import { resumirCiclosRecebimentos, type CicloRecebimentos } from '../../domain/value-objects/ciclo-recebimentos.js';
import type {
  RepositorioEvolucoes,
  RepositorioPacientes,
  RepositorioPlanosTratamento,
  RepositorioRegistrosDentais,
} from '../ports/repositorios.js';

export interface ResumoDoPainel {
  totalPacientes: number;
  planosDeTratamentoAtivos: number;
  registrosNoOdontograma: number;
  evolucoesRegistradas: number;
  /** Soma dos itens de todos os planos ATIVOS. */
  valorPlanejadoTotalCentavos: number;
  /** Soma dos pagamentos de todos os planos ATIVOS. */
  valorPagoTotalCentavos: number;
  recebimentosDoCiclo: CicloRecebimentos;
  /** Planejado − pago dos planos ATIVOS (o "a receber"). */
  saldoDevedorTotalCentavos: number;
  /** Quantos pacientes distintos têm ao menos um plano ATIVO com saldo em aberto. */
  pacientesComSaldoAberto: number;
}

/**
 * Agrega números reais (nunca dados fictícios) das entidades já
 * cadastradas para dar ao Painel inicial uma sensação de sistema em
 * uso de verdade, não uma tela decorativa. Cada número é derivado, sem
 * cache/estado próprio — sempre reflete o que está persistido agora.
 */
export class ObterResumoDoPainel {
  constructor(
    private readonly pacientes: RepositorioPacientes,
    private readonly planos: RepositorioPlanosTratamento,
    private readonly registros: RepositorioRegistrosDentais,
    private readonly evolucoes: RepositorioEvolucoes,
  ) {}

  async executar(hoje?: string): Promise<ResumoDoPainel> {
    const todosPacientes = await this.pacientes.listarTodos();
    const todosRegistros = await Promise.all(
      todosPacientes.map((p) => this.registros.listarPorPacienteId(p.id)),
    );
    const todosPlanos = await Promise.all(todosPacientes.map((p) => this.planos.listarPorPacienteId(p.id)));
    const todasEvolucoes = await this.evolucoes.listarTodas();

    const planosFlat = todosPlanos.flat();
    const recebimentosDoCiclo = resumirCiclosRecebimentos(planosFlat.flatMap(p => p.toSnapshot().pagamentos), hoje).atual;
    const planosAtivos = planosFlat.filter((p) => p.toSnapshot().status === 'ATIVO');
    const resumosAtivos = planosAtivos.map((plano) => ({
      pacienteId: plano.pacienteId,
      financeiro: calcularResumoFinanceiro(plano.toSnapshot()),
    }));
    const valorPlanejadoTotalCentavos = resumosAtivos.reduce((s, r) => s + r.financeiro.valorTotalCentavos, 0);
    const valorPagoTotalCentavos = resumosAtivos.reduce((s, r) => s + r.financeiro.valorPagoCentavos, 0);
    const saldoDevedorTotalCentavos = resumosAtivos.reduce((s, r) => s + r.financeiro.saldoDevedorCentavos, 0);
    const pacientesComSaldoAberto = new Set(
      resumosAtivos.filter((r) => r.financeiro.saldoDevedorCentavos > 0).map((r) => r.pacienteId),
    ).size;

    // "Pacientes cadastrados" reflete casos ATIVOS (número mais útil no dia
    // a dia) — mas saldo devedor/registros/planos continuam somando todo
    // mundo: arquivar um paciente nunca apaga uma dívida em aberto ou
    // histórico clínico dele.
    const pacientesAtivos = todosPacientes.filter((p) => !p.estaArquivado);

    return {
      totalPacientes: pacientesAtivos.length,
      planosDeTratamentoAtivos: planosAtivos.length,
      registrosNoOdontograma: todosRegistros.flat().length,
      evolucoesRegistradas: todasEvolucoes.length,
      valorPlanejadoTotalCentavos,
      valorPagoTotalCentavos,
      recebimentosDoCiclo,
      saldoDevedorTotalCentavos,
      pacientesComSaldoAberto,
    };
  }
}
