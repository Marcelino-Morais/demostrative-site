import { hojeIsoLocal } from '../../domain/types.js';
import type { StatusConsulta } from '../../domain/entities/consulta.js';
import { calcularResumoFinanceiro } from '../../domain/entities/plano-tratamento.js';
import { resumirCiclosRecebimentos, type CicloRecebimentos } from '../../domain/value-objects/ciclo-recebimentos.js';
import { avaliarProntidaoPaciente } from '../../domain/value-objects/prontidao-paciente.js';
import type {
  RepositorioAnamneses,
  RepositorioConsultas,
  RepositorioPacientes,
  RepositorioPlanosTratamento,
  RepositorioRegistrosDentais,
} from '../ports/repositorios.js';
import { apurarProntidaoDoPaciente, type RepositoriosProntidao } from './prontidao.js';

/**
 * Relatórios de gestão (Etapa 15) — agregações simples e úteis para um
 * consultório único. TODO o cálculo (totais, contagens por status,
 * filtragem por data) mora aqui, não em React. As saídas são
 * deliberadamente **agregadas ou operacionais**: nenhuma resposta de
 * anamnese, motivo de consulta ou dado clínico livre entra num
 * relatório. Nada é logado.
 */

// ---------------------------------------------------------------------------
// Relatório clínico — só contagens
// ---------------------------------------------------------------------------

export interface RelatorioClinico {
  pacientesTotal: number;
  pacientesAtivos: number;
  pacientesArquivados: number;
  /** Pacientes ATIVOS sem anamnese, ou com anamnese ainda incompleta. */
  anamneseIncompleta: number;
  /** Pacientes ATIVOS com pelo menos um registro no odontograma. */
  comRegistroOdontograma: number;
  /** Pacientes ATIVOS cuja prontidão não está "completa" (algum indicador aberto). */
  comPendenciaClinica: number;
}

export class GerarRelatorioClinico {
  private readonly repos: RepositoriosProntidao;

  constructor(
    private readonly pacientes: RepositorioPacientes,
    anamneses: RepositorioAnamneses,
    registros: RepositorioRegistrosDentais,
    planos: RepositorioPlanosTratamento,
    consultas: RepositorioConsultas,
  ) {
    this.repos = { anamneses, registros, planos, consultas };
  }

  async executar(hojeIso = hojeIsoLocal()): Promise<RelatorioClinico> {
    const todos = await this.pacientes.listarTodos();
    const ativos = todos.filter((p) => !p.estaArquivado);

    let anamneseIncompleta = 0;
    let comRegistroOdontograma = 0;
    let comPendenciaClinica = 0;

    for (const paciente of ativos) {
      const { entrada } = await apurarProntidaoDoPaciente(paciente, this.repos, hojeIso);
      if (!entrada.anamnese.existe || !entrada.anamnese.completa) anamneseIncompleta += 1;
      if (entrada.odontogramaRegistros > 0) comRegistroOdontograma += 1;
      if (avaliarProntidaoPaciente(entrada).nivel !== 'completa') comPendenciaClinica += 1;
    }

    return {
      pacientesTotal: todos.length,
      pacientesAtivos: ativos.length,
      pacientesArquivados: todos.length - ativos.length,
      anamneseIncompleta,
      comRegistroOdontograma,
      comPendenciaClinica,
    };
  }
}

// ---------------------------------------------------------------------------
// Relatório financeiro — planos ATIVOS
// ---------------------------------------------------------------------------

export interface PagamentoPorMetodo {
  /** Texto normalizado (`Não informado` quando o pagamento não registrou método). */
  metodo: string;
  totalCentavos: number;
  quantidade: number;
}

export interface PacienteComSaldo {
  pacienteId: string;
  nomePaciente: string;
  saldoDevedorCentavos: number;
}

export interface RelatorioFinanceiro {
  ciclosRecebimentos: { atual: CicloRecebimentos; anteriores: CicloRecebimentos[] };
  planosAtivos: number;
  /** Soma dos itens + taxa de emergência de todos os planos ATIVOS. */
  valorPlanejadoCentavos: number;
  valorPagoCentavos: number;
  saldoDevedorCentavos: number;
  /** Soma da taxa de emergência (R$ 150,00 por plano de emergência ATIVO). */
  taxaEmergenciaCentavos: number;
  planosEmergencia: number;
  /** Pagamentos dos planos ATIVOS agrupados por método, maior total primeiro. */
  pagamentosPorMetodo: PagamentoPorMetodo[];
  /** Pacientes com saldo devedor em algum plano ATIVO, maior saldo primeiro. */
  pacientesComSaldo: PacienteComSaldo[];
}

export class GerarRelatorioFinanceiro {
  constructor(
    private readonly pacientes: RepositorioPacientes,
    private readonly planos: RepositorioPlanosTratamento,
  ) {}

  async executar(hoje?: string): Promise<RelatorioFinanceiro> {
    const [todosPlanos, todosPacientes] = await Promise.all([
      this.planos.listarTodos(),
      this.pacientes.listarTodos(),
    ]);
    const nomePorId = new Map(todosPacientes.map((p) => [p.id, p.nomeCompleto]));

    const snapshots = todosPlanos.map(p => p.toSnapshot());
    const ativos = snapshots.filter(p => p.status === 'ATIVO');
    const ciclosRecebimentos = resumirCiclosRecebimentos(snapshots.flatMap(p => p.pagamentos), hoje);

    let valorPlanejadoCentavos = 0;
    let valorPagoCentavos = 0;
    let saldoDevedorCentavos = 0;
    let taxaEmergenciaCentavos = 0;
    let planosEmergencia = 0;
    const porMetodo = new Map<string, { totalCentavos: number; quantidade: number }>();
    const saldoPorPaciente = new Map<string, number>();

    for (const plano of ativos) {
      const resumo = calcularResumoFinanceiro(plano);
      valorPlanejadoCentavos += resumo.valorTotalCentavos;
      valorPagoCentavos += resumo.valorPagoCentavos;
      saldoDevedorCentavos += resumo.saldoDevedorCentavos;
      taxaEmergenciaCentavos += resumo.taxaEmergenciaCentavos;
      if (plano.emergencia) planosEmergencia += 1;

      for (const pagamento of plano.pagamentos) {
        const chave = pagamento.metodo.trim() || 'Não informado';
        const atual = porMetodo.get(chave) ?? { totalCentavos: 0, quantidade: 0 };
        atual.totalCentavos += pagamento.valorCentavos;
        atual.quantidade += 1;
        porMetodo.set(chave, atual);
      }

      if (resumo.saldoDevedorCentavos > 0) {
        saldoPorPaciente.set(
          plano.pacienteId,
          (saldoPorPaciente.get(plano.pacienteId) ?? 0) + resumo.saldoDevedorCentavos,
        );
      }
    }

    const pagamentosPorMetodo: PagamentoPorMetodo[] = [...porMetodo.entries()]
      .map(([metodo, v]) => ({ metodo, totalCentavos: v.totalCentavos, quantidade: v.quantidade }))
      .sort((a, b) => b.totalCentavos - a.totalCentavos || a.metodo.localeCompare(b.metodo, 'pt-BR'));

    const pacientesComSaldo: PacienteComSaldo[] = [...saldoPorPaciente.entries()]
      .map(([pacienteId, saldo]) => ({
        pacienteId,
        nomePaciente: nomePorId.get(pacienteId) ?? 'Paciente removido',
        saldoDevedorCentavos: saldo,
      }))
      .sort(
        (a, b) =>
          b.saldoDevedorCentavos - a.saldoDevedorCentavos ||
          a.nomePaciente.localeCompare(b.nomePaciente, 'pt-BR'),
      );

    return {
      ciclosRecebimentos,
      planosAtivos: ativos.length,
      valorPlanejadoCentavos,
      valorPagoCentavos,
      saldoDevedorCentavos,
      taxaEmergenciaCentavos,
      planosEmergencia,
      pagamentosPorMetodo,
      pacientesComSaldo,
    };
  }
}

// ---------------------------------------------------------------------------
// Relatório de consultas — por período
// ---------------------------------------------------------------------------

export const STATUS_CONSULTA_ORDEM: StatusConsulta[] = [
  'AGENDADA',
  'CONFIRMADA',
  'REALIZADA',
  'CANCELADA',
  'FALTOU',
];

export interface ConsultaNoRelatorio {
  id: string;
  data: string;
  horario: string;
  status: StatusConsulta;
  ehEmergencia: boolean;
  pacienteId: string;
  nomePaciente: string;
}

export interface RelatorioConsultas {
  dataInicio: string;
  dataFim: string;
  total: number;
  porStatus: Record<StatusConsulta, number>;
  emergencias: number;
  /** As consultas do período em ordem cronológica — sem o campo `motivo` (texto livre). */
  consultas: ConsultaNoRelatorio[];
}

export class GerarRelatorioConsultas {
  constructor(
    private readonly consultas: RepositorioConsultas,
    private readonly pacientes: RepositorioPacientes,
  ) {}

  async executar(dataInicio: string, dataFim: string): Promise<RelatorioConsultas> {
    const [todas, todosPacientes] = await Promise.all([
      this.consultas.listarTodas(),
      this.pacientes.listarTodos(),
    ]);
    const nomePorId = new Map(todosPacientes.map((p) => [p.id, p.nomeCompleto]));

    const noPeriodo = todas
      .map((c) => c.toSnapshot())
      .filter((s) => s.data >= dataInicio && s.data <= dataFim)
      .sort((a, b) => `${a.data}T${a.horario}`.localeCompare(`${b.data}T${b.horario}`));

    const porStatus: Record<StatusConsulta, number> = {
      AGENDADA: 0,
      CONFIRMADA: 0,
      REALIZADA: 0,
      CANCELADA: 0,
      FALTOU: 0,
    };
    let emergencias = 0;

    const consultas: ConsultaNoRelatorio[] = noPeriodo.map((s) => {
      porStatus[s.status] += 1;
      if (s.ehEmergencia) emergencias += 1;
      return {
        id: s.id,
        data: s.data,
        horario: s.horario,
        status: s.status,
        ehEmergencia: s.ehEmergencia,
        pacienteId: s.pacienteId,
        nomePaciente: nomePorId.get(s.pacienteId) ?? 'Paciente removido',
      };
    });

    return { dataInicio, dataFim, total: noPeriodo.length, porStatus, emergencias, consultas };
  }
}
