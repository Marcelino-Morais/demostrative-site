/**
 * Fakes em memória dos ports de repositório — usados só em testes (nunca
 * importados pela camada de apresentação). Provam que os casos de uso
 * dependem exclusivamente da interface (`application/ports`), nunca de
 * `localStorage`/qualquer detalhe do `infrastructure/storage` real.
 */
import type { Anamnese, SalvarAnamneseInput } from '../../domain/entities/anamnese.js';
import type { ArquivoPaciente } from '../../domain/entities/arquivo-paciente.js';
import type { BloqueioAgenda } from '../../domain/entities/bloqueio-agenda.js';
import type { Consulta } from '../../domain/entities/consulta.js';
import type { EvolucaoClinica } from '../../domain/entities/evolucao-clinica.js';
import type { LinkAnamnese } from '../../domain/entities/link-anamnese.js';
import type { Paciente } from '../../domain/entities/paciente.js';
import type { PlanoTratamento } from '../../domain/entities/plano-tratamento.js';
import type { CampanhaComemorativa } from '../../domain/entities/campanha-comemorativa.js';
import type { MensagemCortesia } from '../../domain/entities/mensagem-cortesia.js';
import type { ProcedimentoCatalogo } from '../../domain/entities/procedimento-catalogo.js';
import type { RegistroDental } from '../../domain/entities/registro-dental.js';
import type { Retorno } from '../../domain/entities/retorno.js';
import type { RegistroWhatsapp } from '../../../whatsapp-itens/src/domain/entities/registro-whatsapp.js';
import type {
  RepositorioAnamneses,
  RepositorioArquivosPaciente,
  RepositorioBlobsArquivo,
  RepositorioBloqueiosAgenda,
  RepositorioCampanhasComemorativas,
  RepositorioConsultas,
  RepositorioEvolucoes,
  RepositorioLinksAnamnese,
  RepositorioMensagensCortesia,
  RepositorioPacientes,
  RepositorioPlanosTratamento,
  RepositorioProcedimentosCatalogo,
  RepositorioRascunhoAnamnese,
  RepositorioRegistrosDentais,
  RepositorioRegistrosWhatsapp,
  RepositorioRetornos,
} from './repositorios.js';

export class RepositorioPacientesFake implements RepositorioPacientes {
  private itens = new Map<string, Paciente>();

  async salvar(paciente: Paciente): Promise<void> {
    this.itens.set(paciente.id, paciente);
  }

  async buscarPorId(id: string): Promise<Paciente | undefined> {
    return this.itens.get(id);
  }

  async listarTodos(): Promise<Paciente[]> {
    return [...this.itens.values()];
  }

  async remover(id: string): Promise<void> {
    this.itens.delete(id);
  }
}

export class RepositorioAnamnesesFake implements RepositorioAnamneses {
  private itens = new Map<string, Anamnese>();

  async salvar(anamnese: Anamnese): Promise<void> {
    this.itens.set(anamnese.id, anamnese);
  }

  async buscarPorPacienteId(pacienteId: string): Promise<Anamnese | undefined> {
    return [...this.itens.values()].find((a) => a.pacienteId === pacienteId);
  }

  async listarTodos(): Promise<Anamnese[]> {
    return [...this.itens.values()];
  }
}

export class RepositorioRascunhoAnamneseFake implements RepositorioRascunhoAnamnese {
  private itens = new Map<string, SalvarAnamneseInput>();

  async obter(pacienteId: string): Promise<SalvarAnamneseInput | undefined> {
    return this.itens.get(pacienteId);
  }

  async salvar(pacienteId: string, valores: SalvarAnamneseInput): Promise<void> {
    this.itens.set(pacienteId, valores);
  }

  async remover(pacienteId: string): Promise<void> {
    this.itens.delete(pacienteId);
  }
}

export class RepositorioRegistrosDentaisFake implements RepositorioRegistrosDentais {
  private itens = new Map<string, RegistroDental>();

  async salvar(registro: RegistroDental): Promise<void> {
    this.itens.set(registro.id, registro);
  }

  async listarPorPacienteId(pacienteId: string): Promise<RegistroDental[]> {
    return [...this.itens.values()].filter((r) => r.toSnapshot().pacienteId === pacienteId);
  }

  async remover(id: string): Promise<void> {
    this.itens.delete(id);
  }

  async listarTodos(): Promise<RegistroDental[]> {
    return [...this.itens.values()];
  }
}

export class RepositorioPlanosTratamentoFake implements RepositorioPlanosTratamento {
  private itens = new Map<string, PlanoTratamento>();

  async salvar(plano: PlanoTratamento): Promise<void> {
    this.itens.set(plano.id, plano);
  }

  async buscarPorId(id: string): Promise<PlanoTratamento | undefined> {
    return this.itens.get(id);
  }

  async listarPorPacienteId(pacienteId: string): Promise<PlanoTratamento[]> {
    return [...this.itens.values()].filter((p) => p.pacienteId === pacienteId);
  }

  async listarTodos(): Promise<PlanoTratamento[]> {
    return [...this.itens.values()];
  }
}

export class RepositorioEvolucoesFake implements RepositorioEvolucoes {
  private itens = new Map<string, EvolucaoClinica>();

  async salvar(evolucao: EvolucaoClinica): Promise<void> {
    this.itens.set(evolucao.id, evolucao);
  }

  async listarPorPacienteId(pacienteId: string): Promise<EvolucaoClinica[]> {
    return [...this.itens.values()].filter((e) => e.pacienteId === pacienteId);
  }

  async listarTodas(): Promise<EvolucaoClinica[]> {
    return [...this.itens.values()];
  }
}

export class RepositorioConsultasFake implements RepositorioConsultas {
  private itens = new Map<string, Consulta>();

  async salvar(consulta: Consulta): Promise<void> {
    this.itens.set(consulta.id, consulta);
  }

  async buscarPorId(id: string): Promise<Consulta | undefined> {
    return this.itens.get(id);
  }

  async listarPorPacienteId(pacienteId: string): Promise<Consulta[]> {
    return [...this.itens.values()].filter((c) => c.pacienteId === pacienteId);
  }

  async listarTodas(): Promise<Consulta[]> {
    return [...this.itens.values()];
  }
}

export class RepositorioBloqueiosAgendaFake implements RepositorioBloqueiosAgenda {
  private itens = new Map<string, BloqueioAgenda>();

  async salvar(bloqueio: BloqueioAgenda): Promise<void> {
    this.itens.set(bloqueio.id, bloqueio);
  }

  async buscarPorId(id: string): Promise<BloqueioAgenda | undefined> {
    return this.itens.get(id);
  }

  async listarTodos(): Promise<BloqueioAgenda[]> {
    return [...this.itens.values()];
  }

  async remover(id: string): Promise<void> {
    this.itens.delete(id);
  }
}

export class RepositorioProcedimentosCatalogoFake implements RepositorioProcedimentosCatalogo {
  private itens = new Map<string, ProcedimentoCatalogo>();

  async salvar(procedimento: ProcedimentoCatalogo): Promise<void> {
    this.itens.set(procedimento.id, procedimento);
  }

  async buscarPorId(id: string): Promise<ProcedimentoCatalogo | undefined> {
    return this.itens.get(id);
  }

  async listarTodos(): Promise<ProcedimentoCatalogo[]> {
    return [...this.itens.values()];
  }
}

export class RepositorioRetornosFake implements RepositorioRetornos {
  private itens = new Map<string, Retorno>();

  async salvar(retorno: Retorno): Promise<void> {
    this.itens.set(retorno.id, retorno);
  }

  async buscarPorId(id: string): Promise<Retorno | undefined> {
    return this.itens.get(id);
  }

  async listarTodos(): Promise<Retorno[]> {
    return [...this.itens.values()];
  }

  async listarPorPaciente(pacienteId: string): Promise<Retorno[]> {
    return [...this.itens.values()].filter((r) => r.pacienteId === pacienteId);
  }

  async buscarPorItemTratamentoOrigemId(itemTratamentoOrigemId: string): Promise<Retorno | undefined> {
    return [...this.itens.values()].find((r) => r.itemTratamentoOrigemId === itemTratamentoOrigemId);
  }
}

export class RepositorioCampanhasComemorativasFake implements RepositorioCampanhasComemorativas {
  private itens = new Map<string, CampanhaComemorativa>();

  async salvar(campanha: CampanhaComemorativa): Promise<void> {
    this.itens.set(campanha.id, campanha);
  }

  async buscarPorId(id: string): Promise<CampanhaComemorativa | undefined> {
    return this.itens.get(id);
  }

  async listarTodas(): Promise<CampanhaComemorativa[]> {
    return [...this.itens.values()];
  }
}

export class RepositorioMensagensCortesiaFake implements RepositorioMensagensCortesia {
  private itens = new Map<string, MensagemCortesia>();

  async salvar(mensagem: MensagemCortesia): Promise<void> {
    this.itens.set(mensagem.id, mensagem);
  }

  async buscarPorId(id: string): Promise<MensagemCortesia | undefined> {
    return this.itens.get(id);
  }

  async listarTodas(): Promise<MensagemCortesia[]> {
    return [...this.itens.values()];
  }

  async buscarExistente(input: {
    tipo: 'ANIVERSARIO' | 'CAMPANHA';
    pacienteId: string;
    campanhaId: string | null;
    anoReferencia: number;
  }): Promise<MensagemCortesia | undefined> {
    return [...this.itens.values()].find(
      (m) =>
        m.tipo === input.tipo &&
        m.pacienteId === input.pacienteId &&
        m.campanhaId === input.campanhaId &&
        m.anoReferencia === input.anoReferencia,
    );
  }
}

export class RepositorioRegistrosWhatsappFake implements RepositorioRegistrosWhatsapp {
  private itens = new Map<string, RegistroWhatsapp>();

  async salvar(registro: RegistroWhatsapp): Promise<void> {
    this.itens.set(registro.id, registro);
  }

  async listarPorPacienteId(pacienteId: string): Promise<RegistroWhatsapp[]> {
    return [...this.itens.values()].filter((r) => r.pacienteId === pacienteId);
  }

  async listarTodos(): Promise<RegistroWhatsapp[]> {
    return [...this.itens.values()];
  }
}

export class RepositorioLinksAnamneseFake implements RepositorioLinksAnamnese {
  private itens = new Map<string, LinkAnamnese>();

  async salvar(link: LinkAnamnese): Promise<void> {
    this.itens.set(link.id, link);
  }

  async buscarPorToken(token: string): Promise<LinkAnamnese | undefined> {
    return [...this.itens.values()].find((l) => l.token === token);
  }

  async buscarPorPacienteId(pacienteId: string): Promise<LinkAnamnese | undefined> {
    return [...this.itens.values()]
      .filter((l) => l.pacienteId === pacienteId)
      .sort(
        (a, b) =>
          b.toSnapshot().criadoEm.localeCompare(a.toSnapshot().criadoEm) || b.id.localeCompare(a.id),
      )[0];
  }

  async listarTodos(): Promise<LinkAnamnese[]> {
    return [...this.itens.values()];
  }
}

export class RepositorioArquivosPacienteFake implements RepositorioArquivosPaciente {
  private itens = new Map<string, ArquivoPaciente>();

  async salvar(arquivo: ArquivoPaciente): Promise<void> {
    this.itens.set(arquivo.id, arquivo);
  }

  async buscarPorId(id: string): Promise<ArquivoPaciente | undefined> {
    return this.itens.get(id);
  }

  async listarPorPacienteId(pacienteId: string): Promise<ArquivoPaciente[]> {
    return [...this.itens.values()].filter((a) => a.pacienteId === pacienteId);
  }

  async remover(id: string): Promise<void> {
    this.itens.delete(id);
  }

  async listarTodos(): Promise<ArquivoPaciente[]> {
    return [...this.itens.values()];
  }
}

export class RepositorioBlobsArquivoFake implements RepositorioBlobsArquivo {
  private itens = new Map<string, Blob>();

  async salvar(id: string, blob: Blob): Promise<void> {
    this.itens.set(id, blob);
  }

  async obter(id: string): Promise<Blob | undefined> {
    return this.itens.get(id);
  }

  async existe(id: string): Promise<boolean> {
    return this.itens.has(id);
  }

  async remover(id: string): Promise<void> {
    this.itens.delete(id);
  }
}
