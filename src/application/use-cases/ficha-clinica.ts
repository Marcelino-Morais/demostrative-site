import { hojeIsoLocal } from '../../domain/types.js';
import { resumoAnamnese } from '../../domain/entities/anamnese.js';
import type {
  RepositorioAnamneses,
  RepositorioConsultas,
  RepositorioEvolucoes,
  RepositorioPlanosTratamento,
  RepositorioRegistrosDentais,
} from '../ports/repositorios.js';

export interface ResumoDaFicha {
  anamnese: {
    existe: boolean;
    /** Fração preenchida da anamnese, 0 a 1 (0 quando ainda não existe). */
    percentual: number;
    /** Quantos pontos de atenção clínica a anamnese levantou. */
    pontosDeAtencao: number;
  };
  odontograma: number;
  planosTratamento: number;
  evolucoes: number;
  consultas: {
    total: number;
    /** Consultas ainda de pé — nem canceladas, nem realizadas, de hoje em diante. */
    futuras: number;
    proxima: { data: string; horario: string } | null;
  };
}

/**
 * Panorama de uma ficha clínica num olhar só (Etapa 7 — usabilidade):
 * quantos registros cada seção tem e o que ainda falta. Junta as
 * contagens que hoje cada aba buscava sozinha para a casca da Ficha
 * Clínica poder marcar cada seção com um indicador (contador, "a
 * preencher", pontos de atenção) sem a tela precisar saber COMO contar
 * cada coisa — a regra da anamnese, em particular, vem toda de
 * `resumoAnamnese` no domínio.
 */
export class ObterResumoDaFicha {
  constructor(
    private readonly anamneses: RepositorioAnamneses,
    private readonly registros: RepositorioRegistrosDentais,
    private readonly planos: RepositorioPlanosTratamento,
    private readonly evolucoes: RepositorioEvolucoes,
    private readonly consultas: RepositorioConsultas,
  ) {}

  async executar(pacienteId: string, hojeIso = hojeIsoLocal()): Promise<ResumoDaFicha> {
    const [anamnese, registros, planos, evolucoes, consultas] = await Promise.all([
      this.anamneses.buscarPorPacienteId(pacienteId),
      this.registros.listarPorPacienteId(pacienteId),
      this.planos.listarPorPacienteId(pacienteId),
      this.evolucoes.listarPorPacienteId(pacienteId),
      this.consultas.listarPorPacienteId(pacienteId),
    ]);

    const anamneseResumo = anamnese ? resumoAnamnese(anamnese.toSnapshot()) : null;

    const futuras = consultas
      .map((c) => c.toSnapshot())
      .filter((s) => s.status !== 'CANCELADA' && s.status !== 'REALIZADA' && s.data >= hojeIso)
      .sort((a, b) => `${a.data}T${a.horario}`.localeCompare(`${b.data}T${b.horario}`));

    return {
      anamnese: {
        existe: Boolean(anamnese),
        percentual: anamneseResumo ? anamneseResumo.percentual : 0,
        pontosDeAtencao: anamneseResumo ? anamneseResumo.pontosDeAtencao.length : 0,
      },
      odontograma: registros.length,
      planosTratamento: planos.length,
      evolucoes: evolucoes.length,
      consultas: {
        total: consultas.length,
        futuras: futuras.length,
        proxima: futuras[0] ? { data: futuras[0].data, horario: futuras[0].horario } : null,
      },
    };
  }
}
