import { Anamnese, type AnamneseProps } from '../../domain/entities/anamnese.js';
import { BloqueioAgenda, type BloqueioAgendaProps } from '../../domain/entities/bloqueio-agenda.js';
import { CampanhaComemorativa, type CampanhaComemorativaProps } from '../../domain/entities/campanha-comemorativa.js';
import { Consulta, type ConsultaProps } from '../../domain/entities/consulta.js';
import { MensagemCortesia, type MensagemCortesiaProps } from '../../domain/entities/mensagem-cortesia.js';
import { EvolucaoClinica, type EvolucaoClinicaProps } from '../../domain/entities/evolucao-clinica.js';
import { Paciente, type PacienteProps } from '../../domain/entities/paciente.js';
import { PlanoTratamento, type PlanoTratamentoProps } from '../../domain/entities/plano-tratamento.js';
import { ProcedimentoCatalogo, type ProcedimentoCatalogoProps } from '../../domain/entities/procedimento-catalogo.js';
import { RegistroDental, type RegistroDentalProps } from '../../domain/entities/registro-dental.js';
import { Retorno, type RetornoProps } from '../../domain/entities/retorno.js';
import { RegistroWhatsapp, type RegistroWhatsappProps } from '../../../whatsapp-itens/src/domain/entities/registro-whatsapp.js';
import type {
  RepositorioAnamneses,
  RepositorioBloqueiosAgenda,
  RepositorioCampanhasComemorativas,
  RepositorioConsultas,
  RepositorioEvolucoes,
  RepositorioMensagensCortesia,
  RepositorioPacientes,
  RepositorioPlanosTratamento,
  RepositorioProcedimentosCatalogo,
  RepositorioRegistrosDentais,
  RepositorioRetornos,
  RepositorioRegistrosWhatsapp,
} from '../../application/ports/repositorios.js';
import type { HttpNucleoApi } from './http-nucleo-api.js';

/**
 * Repositórios do NÚCLEO clínico contra o servidor de `server/`
 * (Etapas 21–22). Implementam os **mesmos ports** que as versões
 * `LocalStorage*` — por isso NENHUM caso de uso e NENHUMA tela mudam ao
 * trocar de um para o outro. O composition root (`container.ts`) escolhe
 * qual usar pela flag `CONFIGURACAO_API.nucleo`.
 *
 * Toda a regra de negócio (conflito de horário, transições de status,
 * totais financeiros, "mais recente vence" no odontograma, paciente
 * arquivável) continua nos casos de uso / entidades, que só consomem
 * `listar*`/`buscar*`/`salvar` — aqui é só transporte.
 */

export class PacienteBackendRepository implements RepositorioPacientes {
  constructor(private readonly api: HttpNucleoApi) {}

  async salvar(paciente: Paciente): Promise<void> {
    const props = paciente.toSnapshot() as PacienteProps;
    await this.api.salvar('pacientes', props.id, props);
  }

  async buscarPorId(id: string): Promise<Paciente | undefined> {
    const props = await this.api.obter<PacienteProps>('pacientes', id);
    return props ? Paciente.restaurar(props) : undefined;
  }

  async listarTodos(): Promise<Paciente[]> {
    const props = await this.api.listar<PacienteProps>('pacientes');
    return props.map((p) => Paciente.restaurar(p));
  }

  async remover(id: string): Promise<void> {
    await this.api.remover('pacientes', id);
  }

  async buscarIdsPorDocumento(termo: string): Promise<string[]> {
    return this.api.buscarPacientesPorDocumento(termo);
  }
}

export class ConsultaBackendRepository implements RepositorioConsultas {
  constructor(private readonly api: HttpNucleoApi) {}

  async salvar(consulta: Consulta): Promise<void> {
    const props = consulta.toSnapshot() as ConsultaProps;
    await this.api.salvar('consultas', props.id, props);
  }

  async buscarPorId(id: string): Promise<Consulta | undefined> {
    const props = await this.api.obter<ConsultaProps>('consultas', id);
    return props ? Consulta.restaurar(props) : undefined;
  }

  async listarPorPacienteId(pacienteId: string): Promise<Consulta[]> {
    const props = await this.api.listarPorPaciente<ConsultaProps>('consultas', pacienteId);
    return props.map((c) => Consulta.restaurar(c));
  }

  async listarTodas(): Promise<Consulta[]> {
    const props = await this.api.listar<ConsultaProps>('consultas');
    return props.map((c) => Consulta.restaurar(c));
  }
}

export class PlanoTratamentoBackendRepository implements RepositorioPlanosTratamento {
  constructor(private readonly api: HttpNucleoApi) {}

  async salvar(plano: PlanoTratamento): Promise<void> {
    const props = plano.toSnapshot() as PlanoTratamentoProps;
    await this.api.salvar('planos', props.id, props);
  }

  async buscarPorId(id: string): Promise<PlanoTratamento | undefined> {
    const props = await this.api.obter<PlanoTratamentoProps>('planos', id);
    return props ? PlanoTratamento.restaurar(props) : undefined;
  }

  async listarPorPacienteId(pacienteId: string): Promise<PlanoTratamento[]> {
    const props = await this.api.listarPorPaciente<PlanoTratamentoProps>('planos', pacienteId);
    return props.map((p) => PlanoTratamento.restaurar(p));
  }

  async listarTodos(): Promise<PlanoTratamento[]> {
    const props = await this.api.listar<PlanoTratamentoProps>('planos');
    return props.map((p) => PlanoTratamento.restaurar(p));
  }
}

export class EvolucaoBackendRepository implements RepositorioEvolucoes {
  constructor(private readonly api: HttpNucleoApi) {}

  async salvar(evolucao: EvolucaoClinica): Promise<void> {
    const props = evolucao.toSnapshot() as EvolucaoClinicaProps;
    await this.api.salvar('evolucoes', props.id, props);
  }

  async listarPorPacienteId(pacienteId: string): Promise<EvolucaoClinica[]> {
    const props = await this.api.listarPorPaciente<EvolucaoClinicaProps>('evolucoes', pacienteId);
    return props.map((e) => EvolucaoClinica.restaurar(e));
  }

  async listarTodas(): Promise<EvolucaoClinica[]> {
    const props = await this.api.listar<EvolucaoClinicaProps>('evolucoes');
    return props.map((e) => EvolucaoClinica.restaurar(e));
  }
}

export class RegistroDentalBackendRepository implements RepositorioRegistrosDentais {
  constructor(private readonly api: HttpNucleoApi) {}

  async salvar(registro: RegistroDental): Promise<void> {
    const props = registro.toSnapshot() as RegistroDentalProps;
    await this.api.salvar('registros-dentais', props.id, props);
  }

  async listarPorPacienteId(pacienteId: string): Promise<RegistroDental[]> {
    const props = await this.api.listarPorPaciente<RegistroDentalProps>('registros-dentais', pacienteId);
    return props.map((r) => RegistroDental.restaurar(r));
  }

  async remover(id: string): Promise<void> {
    await this.api.remover('registros-dentais', id);
  }

  async listarTodos(): Promise<RegistroDental[]> {
    const props = await this.api.listar<RegistroDentalProps>('registros-dentais');
    return props.map((r) => RegistroDental.restaurar(r));
  }
}

export class RegistroWhatsappBackendRepository implements RepositorioRegistrosWhatsapp {
  constructor(private readonly api: HttpNucleoApi) {}

  async salvar(registro: RegistroWhatsapp): Promise<void> {
    const props = registro.toSnapshot() as RegistroWhatsappProps;
    await this.api.salvar('registros-whatsapp', props.id, props);
  }

  async listarPorPacienteId(pacienteId: string): Promise<RegistroWhatsapp[]> {
    const props = await this.api.listarPorPaciente<RegistroWhatsappProps>('registros-whatsapp', pacienteId);
    return props.map((r) => RegistroWhatsapp.restaurar(r));
  }

  async listarTodos(): Promise<RegistroWhatsapp[]> {
    const props = await this.api.listar<RegistroWhatsappProps>('registros-whatsapp');
    return props.map((r) => RegistroWhatsapp.restaurar(r));
  }
}

/**
 * Dias bloqueados na Agenda — mesma coleção genérica de `planos`/
 * `evolucoes`, chaveada pelo próprio `id` (não pelo paciente).
 */
export class BloqueioAgendaBackendRepository implements RepositorioBloqueiosAgenda {
  constructor(private readonly api: HttpNucleoApi) {}

  async salvar(bloqueio: BloqueioAgenda): Promise<void> {
    const props = bloqueio.toSnapshot() as BloqueioAgendaProps;
    await this.api.salvar('bloqueios-agenda', props.id, props);
  }

  async buscarPorId(id: string): Promise<BloqueioAgenda | undefined> {
    const props = await this.api.obter<BloqueioAgendaProps>('bloqueios-agenda', id);
    return props ? BloqueioAgenda.restaurar(props) : undefined;
  }

  async listarTodos(): Promise<BloqueioAgenda[]> {
    const props = await this.api.listar<BloqueioAgendaProps>('bloqueios-agenda');
    return props.map((b) => BloqueioAgenda.restaurar(b));
  }

  async remover(id: string): Promise<void> {
    await this.api.remover('bloqueios-agenda', id);
  }
}

export class ProcedimentoCatalogoBackendRepository implements RepositorioProcedimentosCatalogo {
  constructor(private readonly api: HttpNucleoApi) {}

  async salvar(procedimento: ProcedimentoCatalogo): Promise<void> {
    const props = procedimento.toSnapshot() as ProcedimentoCatalogoProps;
    await this.api.salvar('procedimentos-catalogo', props.id, props);
  }

  async buscarPorId(id: string): Promise<ProcedimentoCatalogo | undefined> {
    const props = await this.api.obter<ProcedimentoCatalogoProps>('procedimentos-catalogo', id);
    return props ? ProcedimentoCatalogo.restaurar(props) : undefined;
  }

  async listarTodos(): Promise<ProcedimentoCatalogo[]> {
    const props = await this.api.listar<ProcedimentoCatalogoProps>('procedimentos-catalogo');
    return props.map((p) => ProcedimentoCatalogo.restaurar(p));
  }
}

export class RetornoBackendRepository implements RepositorioRetornos {
  constructor(private readonly api: HttpNucleoApi) {}

  async salvar(retorno: Retorno): Promise<void> {
    const props = retorno.toSnapshot() as RetornoProps;
    await this.api.salvar('retornos', props.id, props);
  }

  async buscarPorId(id: string): Promise<Retorno | undefined> {
    const props = await this.api.obter<RetornoProps>('retornos', id);
    return props ? Retorno.restaurar(props) : undefined;
  }

  async listarTodos(): Promise<Retorno[]> {
    const props = await this.api.listar<RetornoProps>('retornos');
    return props.map((r) => Retorno.restaurar(r));
  }

  async listarPorPaciente(pacienteId: string): Promise<Retorno[]> {
    const props = await this.api.listarPorPaciente<RetornoProps>('retornos', pacienteId);
    return props.map((r) => Retorno.restaurar(r));
  }

  /** Sem rota dedicada no servidor — o volume de retornos é baixo, então lista tudo e filtra aqui mesmo. */
  async buscarPorItemTratamentoOrigemId(itemTratamentoOrigemId: string): Promise<Retorno | undefined> {
    const todos = await this.listarTodos();
    return todos.find((r) => r.itemTratamentoOrigemId === itemTratamentoOrigemId);
  }
}

export class CampanhaComemorativaBackendRepository implements RepositorioCampanhasComemorativas {
  constructor(private readonly api: HttpNucleoApi) {}

  async salvar(campanha: CampanhaComemorativa): Promise<void> {
    const props = campanha.toSnapshot() as CampanhaComemorativaProps;
    await this.api.salvar('campanhas-comemorativas', props.id, props);
  }

  async buscarPorId(id: string): Promise<CampanhaComemorativa | undefined> {
    const props = await this.api.obter<CampanhaComemorativaProps>('campanhas-comemorativas', id);
    return props ? CampanhaComemorativa.restaurar(props) : undefined;
  }

  async listarTodas(): Promise<CampanhaComemorativa[]> {
    const props = await this.api.listar<CampanhaComemorativaProps>('campanhas-comemorativas');
    return props.map((c) => CampanhaComemorativa.restaurar(c));
  }
}

export class MensagemCortesiaBackendRepository implements RepositorioMensagensCortesia {
  constructor(private readonly api: HttpNucleoApi) {}

  async salvar(mensagem: MensagemCortesia): Promise<void> {
    const props = mensagem.toSnapshot() as MensagemCortesiaProps;
    await this.api.salvar('mensagens-cortesia', props.id, props);
  }

  async buscarPorId(id: string): Promise<MensagemCortesia | undefined> {
    const props = await this.api.obter<MensagemCortesiaProps>('mensagens-cortesia', id);
    return props ? MensagemCortesia.restaurar(props) : undefined;
  }

  async listarTodas(): Promise<MensagemCortesia[]> {
    const props = await this.api.listar<MensagemCortesiaProps>('mensagens-cortesia');
    return props.map((m) => MensagemCortesia.restaurar(m));
  }

  /** Sem rota dedicada no servidor — volume baixo, lista tudo e filtra aqui mesmo (mesmo padrão de `RetornoBackendRepository`). */
  async buscarExistente(input: {
    tipo: 'ANIVERSARIO' | 'CAMPANHA';
    pacienteId: string;
    campanhaId: string | null;
    anoReferencia: number;
  }): Promise<MensagemCortesia | undefined> {
    const todas = await this.listarTodas();
    return todas.find(
      (m) =>
        m.tipo === input.tipo &&
        m.pacienteId === input.pacienteId &&
        m.campanhaId === input.campanhaId &&
        m.anoReferencia === input.anoReferencia,
    );
  }
}

/**
 * Anamnese é 1:1 com o paciente — no servidor a linha é chaveada pelo
 * `pacienteId` (rota `/api/anamneses/:pacienteId`). Nada de resposta
 * clínica em log; o servidor só valida a forma.
 */
export class AnamneseBackendRepository implements RepositorioAnamneses {
  constructor(private readonly api: HttpNucleoApi) {}

  async salvar(anamnese: Anamnese): Promise<void> {
    const props = anamnese.toSnapshot() as AnamneseProps;
    await this.api.salvar('anamneses', props.pacienteId, props);
  }

  async buscarPorPacienteId(pacienteId: string): Promise<Anamnese | undefined> {
    const props = await this.api.obter<AnamneseProps>('anamneses', pacienteId);
    return props ? Anamnese.restaurar(props) : undefined;
  }

  async listarTodos(): Promise<Anamnese[]> {
    const props = await this.api.listar<AnamneseProps>('anamneses');
    return props.map((a) => Anamnese.restaurar(a));
  }
}
