import {
  montarAnamneseParaLeitura,
  resumoAnamnese,
  type SecaoAnamneseLegivel,
} from '../../domain/entities/anamnese.js';
import type { ConsultaProps } from '../../domain/entities/consulta.js';
import type { EvolucaoClinicaProps } from '../../domain/entities/evolucao-clinica.js';
import { calcularIdade, type PacienteProps } from '../../domain/entities/paciente.js';
import {
  calcularPlanoDePagamento,
  calcularResumoFinanceiro,
  type PlanoDePagamentoCalculado,
  type PlanoTratamentoProps,
  type ResumoFinanceiroPlano,
} from '../../domain/entities/plano-tratamento.js';
import {
  agruparHistoricoPorDente,
  type GrupoHistoricoDente,
} from '../../domain/entities/registro-dental.js';
import { ErroDominio } from '../../domain/types.js';
import type {
  RepositorioAnamneses,
  RepositorioConsultas,
  RepositorioEvolucoes,
  RepositorioPacientes,
  RepositorioPlanosTratamento,
  RepositorioRegistrosDentais,
} from '../ports/repositorios.js';

export interface DocumentoPlano {
  props: PlanoTratamentoProps;
  resumo: ResumoFinanceiroPlano;
  planoDePagamento: PlanoDePagamentoCalculado;
}

export interface DocumentoAnamnese {
  atualizadoEm: string;
  /** 0 a 1 — quanto da anamnese já foi respondido. */
  percentualPreenchido: number;
  secoes: SecaoAnamneseLegivel[];
  pontosDeAtencao: string[];
  consentimento: { confirmado: boolean; localEData: string };
}

export interface DocumentosDoPaciente {
  paciente: PacienteProps;
  idade: number | null;
  geradoEm: string;
  anamnese: DocumentoAnamnese | null;
  odontograma: {
    totalRegistros: number;
    dentesComRegistro: number;
    dentes: GrupoHistoricoDente[];
  };
  /** Planos do mais recente para o mais antigo. */
  planos: DocumentoPlano[];
  /** Evoluções em ordem cronológica (mais antiga primeiro). */
  evolucoes: EvolucaoClinicaProps[];
  /** Consultas em ordem cronológica (mais antiga primeiro). */
  consultas: ConsultaProps[];
}

/**
 * Reúne, num objeto só e já pronto para virar documento, tudo que a
 * central de impressões do paciente precisa: cadastro, anamnese
 * legível (perguntas e respostas), histórico do odontograma agrupado
 * por dente, planos com totais calculados, evoluções e consultas em
 * ordem cronológica. A montagem (o quê entra, como agrupar, em que
 * ordem, como virar texto) mora aqui e no domínio; os componentes React
 * só desenham as seções — nunca recalculam nada.
 */
export class MontarDocumentosDoPaciente {
  constructor(
    private readonly pacientes: RepositorioPacientes,
    private readonly anamneses: RepositorioAnamneses,
    private readonly registros: RepositorioRegistrosDentais,
    private readonly planos: RepositorioPlanosTratamento,
    private readonly evolucoes: RepositorioEvolucoes,
    private readonly consultas: RepositorioConsultas,
  ) {}

  async executar(pacienteId: string, geradoEm = new Date().toISOString()): Promise<DocumentosDoPaciente> {
    const [paciente, anamnese, registros, planos, evolucoes, consultas] = await Promise.all([
      this.pacientes.buscarPorId(pacienteId),
      this.anamneses.buscarPorPacienteId(pacienteId),
      this.registros.listarPorPacienteId(pacienteId),
      this.planos.listarPorPacienteId(pacienteId),
      this.evolucoes.listarPorPacienteId(pacienteId),
      this.consultas.listarPorPacienteId(pacienteId),
    ]);
    if (!paciente) throw new ErroDominio('Paciente não encontrado.');

    const pacienteSnap = paciente.toSnapshot();
    const registrosSnap = registros.map((r) => r.toSnapshot());

    const anamneseSnap = anamnese?.toSnapshot() ?? null;
    let anamneseDoc: DocumentoAnamnese | null = null;
    if (anamneseSnap) {
      const resumo = resumoAnamnese(anamneseSnap);
      anamneseDoc = {
        atualizadoEm: anamneseSnap.atualizadoEm,
        percentualPreenchido: resumo.percentual,
        secoes: montarAnamneseParaLeitura(anamneseSnap),
        pontosDeAtencao: resumo.pontosDeAtencao,
        consentimento: {
          confirmado: anamneseSnap.pacienteConfirmouDados,
          localEData: anamneseSnap.localEDataAssinatura,
        },
      };
    }

    const dentes = agruparHistoricoPorDente(registrosSnap);

    const planosDoc: DocumentoPlano[] = [...planos]
      .map((p) => p.toSnapshot())
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      .map((props) => {
        const resumo = calcularResumoFinanceiro(props);
        return {
          props,
          resumo,
          planoDePagamento: calcularPlanoDePagamento(resumo.valorTotalCentavos, props.condicoesDePagamento),
        };
      });

    const evolucoesSnap = evolucoes
      .map((e) => e.toSnapshot())
      .sort((a, b) => a.data.localeCompare(b.data) || a.criadoEm.localeCompare(b.criadoEm));

    const consultasSnap = consultas
      .map((c) => c.toSnapshot())
      .sort((a, b) => `${a.data}T${a.horario}`.localeCompare(`${b.data}T${b.horario}`));

    return {
      paciente: pacienteSnap,
      // Idade "na data do documento" — determinística e coerente com o cabeçalho impresso.
      idade: calcularIdade(pacienteSnap.dataNascimento, new Date(geradoEm)),
      geradoEm,
      anamnese: anamneseDoc,
      odontograma: {
        totalRegistros: registrosSnap.length,
        dentesComRegistro: dentes.length,
        dentes,
      },
      planos: planosDoc,
      evolucoes: evolucoesSnap,
      consultas: consultasSnap,
    };
  }
}
