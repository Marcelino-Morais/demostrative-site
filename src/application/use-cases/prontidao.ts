import { hojeIsoLocal } from '../../domain/types.js';
import { resumoAnamnese } from '../../domain/entities/anamnese.js';
import type { Paciente } from '../../domain/entities/paciente.js';
import { pacienteCorrespondeABusca } from '../../domain/entities/paciente.js';
import { calcularResumoFinanceiro } from '../../domain/entities/plano-tratamento.js';
import { centavosParaReaisTexto } from '../../domain/value-objects/dinheiro.js';
import {
  avaliarProntidaoPaciente,
  type EntradaProntidaoPaciente,
  type ProntidaoPaciente,
} from '../../domain/value-objects/prontidao-paciente.js';
import type {
  RepositorioAnamneses,
  RepositorioConsultas,
  RepositorioPacientes,
  RepositorioPlanosTratamento,
  RepositorioRegistrosDentais,
} from '../ports/repositorios.js';

/**
 * Prontidão clínica e pendências operacionais (Etapa 14). Todo o
 * cálculo do que significa cada fato vive no domínio
 * (`avaliarProntidaoPaciente`); estes casos de uso só apuram os fatos a
 * partir dos repositórios — mesma disciplina de `ObterResumoDaFicha` e
 * `ObterResumoDoPainel`, sem cache nem estado próprio.
 */

export interface RepositoriosProntidao {
  anamneses: RepositorioAnamneses;
  registros: RepositorioRegistrosDentais;
  planos: RepositorioPlanosTratamento;
  consultas: RepositorioConsultas;
}

export interface ApuracaoPaciente {
  entrada: EntradaProntidaoPaciente;
  /** A próxima consulta futura (nem cancelada, nem realizada, de hoje em diante), ou `null`. */
  proximaConsulta: { id: string; data: string; horario: string; confirmada: boolean } | null;
}

function temTextoUtil(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && valor.trim() !== '';
}

/** `YYYY-MM-DD` → `DD/MM/YYYY` sem passar por `new Date` (evita recuo de fuso). */
function dataCurtaBr(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : iso;
}

/**
 * Apura, para um paciente, os fatos que alimentam `avaliarProntidaoPaciente`
 * mais a próxima consulta futura. Exportado para os relatórios (Etapa 15)
 * reaproveitarem exatamente a mesma apuração — sem reimplementar contagem.
 */
export async function apurarProntidaoDoPaciente(
  paciente: Paciente,
  repos: RepositoriosProntidao,
  hojeIso: string,
): Promise<ApuracaoPaciente> {
  const snap = paciente.toSnapshot();
  const [anamnese, registros, planos, consultas] = await Promise.all([
    repos.anamneses.buscarPorPacienteId(paciente.id),
    repos.registros.listarPorPacienteId(paciente.id),
    repos.planos.listarPorPacienteId(paciente.id),
    repos.consultas.listarPorPacienteId(paciente.id),
  ]);

  const anamneseResumo = anamnese ? resumoAnamnese(anamnese.toSnapshot()) : null;

  const planosSnap = planos.map((p) => p.toSnapshot());
  const ativos = planosSnap.filter((p) => p.status === 'ATIVO');
  const saldoAbertoCentavos = ativos.reduce(
    (soma, p) => soma + Math.max(0, calcularResumoFinanceiro(p).saldoDevedorCentavos),
    0,
  );

  const futuras = consultas
    .map((c) => c.toSnapshot())
    .filter((s) => s.status !== 'CANCELADA' && s.status !== 'REALIZADA' && s.data >= hojeIso)
    .sort((a, b) => `${a.data}T${a.horario}`.localeCompare(`${b.data}T${b.horario}`));
  const primeira = futuras[0];

  const entrada: EntradaProntidaoPaciente = {
    arquivado: snap.arquivadoEm !== null,
    contato: { temCelular: temTextoUtil(snap.celular) },
    consentimentoWhatsapp: snap.consentimentoWhatsapp.status,
    anamnese: {
      existe: Boolean(anamnese),
      completa: anamneseResumo ? anamneseResumo.completa : false,
      pontosDeAtencao: anamneseResumo ? anamneseResumo.pontosDeAtencao.length : 0,
    },
    odontogramaRegistros: registros.length,
    planos: {
      total: planosSnap.length,
      ativos: ativos.length,
      ativosSemItens: ativos.filter((p) => p.itens.length === 0).length,
    },
    saldoAbertoCentavos,
    consultas: {
      futuras: futuras.length,
      proximaNaoConfirmada: primeira ? primeira.status === 'AGENDADA' : false,
    },
  };

  return {
    entrada,
    proximaConsulta: primeira
      ? { id: primeira.id, data: primeira.data, horario: primeira.horario, confirmada: primeira.status === 'CONFIRMADA' }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Lista de pacientes com prontidão + filtros
// ---------------------------------------------------------------------------

export interface FiltrosProntidao {
  anamneseIncompleta: boolean;
  saldoAberto: boolean;
  comConsultaFutura: boolean;
  consentimentoWhatsappPendente: boolean;
}

export const FILTROS_PRONTIDAO_VAZIO: FiltrosProntidao = {
  anamneseIncompleta: false,
  saldoAberto: false,
  comConsultaFutura: false,
  consentimentoWhatsappPendente: false,
};

export interface PacienteComProntidao {
  paciente: Paciente;
  prontidao: ProntidaoPaciente;
}

export interface OpcoesListaProntidao {
  incluirArquivados?: boolean;
  termo?: string;
  filtros?: Partial<FiltrosProntidao>;
}

/**
 * Mesma listagem de `ListarPacientes` (busca via `pacienteCorrespondeABusca`
 * + `buscarIdsPorDocumento` quando o termo tem 3+ dígitos — CPF/RG nunca
 * comparado em claro aqui, a resposta comum de `listarTodos()` já vem
 * mascarada; ver comentário de `ListarPacientes`), ordem alfabética,
 * arquivados escondidos por padrão, + a prontidão de cada um anexada, e
 * filtros por estado de prontidão aplicados DEPOIS do cálculo. A tela
 * nunca decide o que cada filtro significa.
 */
export class ListarPacientesComProntidao {
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

  async executar(
    opcoes: OpcoesListaProntidao = {},
    hojeIso = hojeIsoLocal(),
  ): Promise<PacienteComProntidao[]> {
    const filtros: FiltrosProntidao = { ...FILTROS_PRONTIDAO_VAZIO, ...opcoes.filtros };
    const incluirArquivados = opcoes.incluirArquivados ?? false;
    const termo = opcoes.termo ?? '';

    const todos = await this.pacientes.listarTodos();
    const digitosTermo = termo.replace(/\D/g, '');
    const idsPorDocumento =
      digitosTermo.length >= 3 && this.pacientes.buscarIdsPorDocumento
        ? new Set(await this.pacientes.buscarIdsPorDocumento(termo.trim()))
        : null;
    const base = todos.filter((p) => {
      if (p.estaArquivado && !incluirArquivados) return false;
      if (idsPorDocumento?.has(p.id)) return true;
      return pacienteCorrespondeABusca(p.toSnapshot(), termo);
    });

    const comProntidao = await Promise.all(
      base.map(async (paciente) => {
        const { entrada } = await apurarProntidaoDoPaciente(paciente, this.repos, hojeIso);
        return { paciente, prontidao: avaliarProntidaoPaciente(entrada) };
      }),
    );

    const filtrada = comProntidao.filter(({ prontidao }) => {
      if (filtros.anamneseIncompleta && !prontidao.anamneseIncompleta) return false;
      if (filtros.saldoAberto && !prontidao.temSaldoAberto) return false;
      if (filtros.comConsultaFutura && !prontidao.temConsultaFutura) return false;
      if (filtros.consentimentoWhatsappPendente && !prontidao.consentimentoWhatsappPendente) return false;
      return true;
    });

    return filtrada.sort((a, b) =>
      a.paciente.nomeCompleto.localeCompare(b.paciente.nomeCompleto, 'pt-BR'),
    );
  }
}

// ---------------------------------------------------------------------------
// Painel — pendências operacionais da clínica
// ---------------------------------------------------------------------------

export interface PendenciaPaciente {
  pacienteId: string;
  nomePaciente: string;
  /** Resumo curto e não sensível (ex.: "Ainda não iniciada", "R$ 450,00"). */
  detalhe: string;
}

export interface PendenciaConsulta {
  pacienteId: string;
  nomePaciente: string;
  consultaId: string;
  data: string;
  horario: string;
}

export interface ResumoPendencias {
  anamneseIncompleta: PendenciaPaciente[];
  saldoAberto: PendenciaPaciente[];
  consultasNaoConfirmadas: PendenciaConsulta[];
  semConsentimentoWhatsapp: PendenciaPaciente[];
  arquivadosComConsultaFutura: PendenciaPaciente[];
  /** `true` quando nenhuma das listas tem item. */
  vazio: boolean;
}

/**
 * Agrega, para o Painel, as pendências que a Dra. Fernanda precisa
 * resolver: anamneses incompletas, saldos em aberto, próximas consultas
 * ainda não confirmadas, pacientes sem consentimento de WhatsApp
 * registrado, e a inconsistência de paciente arquivado com consulta
 * futura. Cada item carrega os ids necessários para a tela montar o
 * link (a rota em si é decisão de apresentação).
 */
export class ResumoPendenciasDaClinica {
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

  async executar(hojeIso = hojeIsoLocal()): Promise<ResumoPendencias> {
    const todos = await this.pacientes.listarTodos();

    const resumo: ResumoPendencias = {
      anamneseIncompleta: [],
      saldoAberto: [],
      consultasNaoConfirmadas: [],
      semConsentimentoWhatsapp: [],
      arquivadosComConsultaFutura: [],
      vazio: true,
    };

    for (const paciente of todos) {
      const { entrada, proximaConsulta } = await apurarProntidaoDoPaciente(paciente, this.repos, hojeIso);
      const base = { pacienteId: paciente.id, nomePaciente: paciente.nomeCompleto };

      if (entrada.arquivado) {
        if (entrada.consultas.futuras > 0) {
          resumo.arquivadosComConsultaFutura.push({
            ...base,
            detalhe: proximaConsulta
              ? `Próxima em ${dataCurtaBr(proximaConsulta.data)} às ${proximaConsulta.horario}`
              : `${entrada.consultas.futuras} consulta(s) futura(s)`,
          });
        }
        continue;
      }

      const prontidao = avaliarProntidaoPaciente(entrada);

      if (prontidao.anamneseIncompleta) {
        resumo.anamneseIncompleta.push({
          ...base,
          detalhe: entrada.anamnese.existe ? 'Preenchimento incompleto' : 'Ainda não iniciada',
        });
      }
      if (prontidao.temSaldoAberto) {
        resumo.saldoAberto.push({ ...base, detalhe: centavosParaReaisTexto(prontidao.saldoAbertoCentavos) });
      }
      if (proximaConsulta && !proximaConsulta.confirmada) {
        resumo.consultasNaoConfirmadas.push({
          ...base,
          consultaId: proximaConsulta.id,
          data: proximaConsulta.data,
          horario: proximaConsulta.horario,
        });
      }
      if (entrada.consentimentoWhatsapp === 'NAO_INFORMADO') {
        resumo.semConsentimentoWhatsapp.push({ ...base, detalhe: 'Consentimento ainda não registrado' });
      }
    }

    const porNome = (a: PendenciaPaciente, b: PendenciaPaciente) =>
      a.nomePaciente.localeCompare(b.nomePaciente, 'pt-BR');
    resumo.anamneseIncompleta.sort(porNome);
    resumo.saldoAberto.sort(porNome);
    resumo.semConsentimentoWhatsapp.sort(porNome);
    resumo.arquivadosComConsultaFutura.sort(porNome);
    resumo.consultasNaoConfirmadas.sort(
      (a, b) => `${a.data}T${a.horario}`.localeCompare(`${b.data}T${b.horario}`),
    );

    resumo.vazio =
      resumo.anamneseIncompleta.length === 0 &&
      resumo.saldoAberto.length === 0 &&
      resumo.consultasNaoConfirmadas.length === 0 &&
      resumo.semConsentimentoWhatsapp.length === 0 &&
      resumo.arquivadosComConsultaFutura.length === 0;

    return resumo;
  }
}
