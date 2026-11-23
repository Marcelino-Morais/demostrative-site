import {
  RegistroDental,
  derivarEstadoDosDentes,
  type EstadoDoDente,
  type NovoRegistroDentalInput,
} from '../../domain/entities/registro-dental.js';
import type { NumeroDente } from '../../domain/value-objects/numeracao-dental.js';
import type { RepositorioRegistrosDentais } from '../ports/repositorios.js';

export class RegistrarProcedimentoDental {
  constructor(private readonly registros: RepositorioRegistrosDentais) {}

  async executar(input: NovoRegistroDentalInput): Promise<RegistroDental> {
    const registro = RegistroDental.registrar(input);
    await this.registros.salvar(registro);
    return registro;
  }
}

export class ListarHistoricoDoOdontograma {
  constructor(private readonly registros: RepositorioRegistrosDentais) {}

  /** Todos os registros do paciente, mais recentes primeiro — a "linha do tempo" completa do odontograma. */
  async executar(pacienteId: string): Promise<RegistroDental[]> {
    const lista = await this.registros.listarPorPacienteId(pacienteId);
    return [...lista].sort((a, b) => {
      const snapA = a.toSnapshot();
      const snapB = b.toSnapshot();
      return snapB.data.localeCompare(snapA.data) || snapB.criadoEm.localeCompare(snapA.criadoEm);
    });
  }
}

export class ObterEstadoDoOdontograma {
  constructor(private readonly registros: RepositorioRegistrosDentais) {}

  /** Estado atual de cada dente com histórico — o que colore o gráfico interativo. */
  async executar(pacienteId: string): Promise<Map<NumeroDente, EstadoDoDente>> {
    const lista = await this.registros.listarPorPacienteId(pacienteId);
    return derivarEstadoDosDentes(lista.map((r) => r.toSnapshot()));
  }
}

export class RemoverRegistroDental {
  constructor(private readonly registros: RepositorioRegistrosDentais) {}

  async executar(id: string): Promise<void> {
    await this.registros.remover(id);
  }
}
