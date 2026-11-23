import { EvolucaoClinica, type RegistrarEvolucaoInput } from '../../domain/entities/evolucao-clinica.js';
import { ErroDominio } from '../../domain/types.js';
import type { RepositorioEvolucoes, RepositorioPacientes } from '../ports/repositorios.js';

export class RegistrarEvolucao {
  constructor(private readonly evolucoes: RepositorioEvolucoes) {}

  async executar(input: RegistrarEvolucaoInput): Promise<EvolucaoClinica> {
    const evolucao = EvolucaoClinica.registrar(input);
    await this.evolucoes.salvar(evolucao);
    return evolucao;
  }
}

export class ListarEvolucoesDoPaciente {
  constructor(private readonly evolucoes: RepositorioEvolucoes) {}

  async executar(pacienteId: string): Promise<EvolucaoClinica[]> {
    const lista = await this.evolucoes.listarPorPacienteId(pacienteId);
    return [...lista].sort((a, b) => b.toSnapshot().data.localeCompare(a.toSnapshot().data));
  }
}

export class ConfirmarAssinaturaEvolucao {
  constructor(private readonly evolucoes: RepositorioEvolucoes) {}

  async executar(pacienteId: string, evolucaoId: string): Promise<EvolucaoClinica> {
    const lista = await this.evolucoes.listarPorPacienteId(pacienteId);
    const evolucao = lista.find((e) => e.id === evolucaoId);
    if (!evolucao) throw new ErroDominio('Evolução clínica não encontrada.');
    evolucao.confirmarAssinaturaPaciente();
    await this.evolucoes.salvar(evolucao);
    return evolucao;
  }
}

export interface EvolucaoRecente {
  evolucao: ReturnType<EvolucaoClinica['toSnapshot']>;
  nomePaciente: string;
}

/** Lista as evoluções mais recentes de TODOS os pacientes, já com o nome do paciente — alimenta "Últimos atendimentos" no Painel. */
export class ListarEvolucoesRecentes {
  constructor(
    private readonly evolucoes: RepositorioEvolucoes,
    private readonly pacientes: RepositorioPacientes,
  ) {}

  async executar(limite = 8): Promise<EvolucaoRecente[]> {
    const [todas, todosPacientes] = await Promise.all([
      this.evolucoes.listarTodas(),
      this.pacientes.listarTodos(),
    ]);
    const nomesPorId = new Map(todosPacientes.map((p) => [p.id, p.nomeCompleto]));
    return [...todas]
      .map((e) => e.toSnapshot())
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      .slice(0, limite)
      .map((evolucao) => ({
        evolucao,
        nomePaciente: nomesPorId.get(evolucao.pacienteId) ?? 'Paciente removido',
      }));
  }
}
