import { encontrarProximoHorario } from '../../../server/encaixe-agenda.mjs';
import { hojeIsoLocal } from '../../domain/types.js';
import { TIPO_BLOQUEIO_AGENDA_LABEL } from '../../domain/entities/bloqueio-agenda.js';
import { Consulta, type AgendarConsultaInput } from '../../domain/entities/consulta.js';
import { ErroDominio } from '../../domain/types.js';
import type { PortaConfiguracaoClinica } from '../ports/porta-configuracao-clinica.js';
import { avaliarDisponibilidadeWhatsapp } from '../../../whatsapp-itens/src/domain/value-objects/whatsapp.js';
import type { RepositorioBloqueiosAgenda, RepositorioConsultas, RepositorioPacientes, RepositorioProcedimentosCatalogo } from '../ports/repositorios.js';

async function carregarConsultaOuFalhar(consultas: RepositorioConsultas, id: string): Promise<Consulta> {
  const consulta = await consultas.buscarPorId(id);
  if (!consulta) throw new ErroDominio('Consulta não encontrada.');
  return consulta;
}

/**
 * Regra de ciclo de vida (Etapa 6 — agenda do consultório): não se
 * agenda nem se reagenda consulta pra paciente arquivado — isso é
 * atividade de agendamento ativo, e paciente arquivado saiu do fluxo
 * ativo. As ações sobre consultas que JÁ existem (confirmar, marcar
 * realizada/falta, cancelar) continuam liberadas — é assim que se
 * fecha o histórico depois de arquivar. A tela nunca decide isso: a
 * regra mora aqui.
 */
async function garantirPacienteAgendavel(pacientes: RepositorioPacientes, pacienteId: string): Promise<void> {
  const paciente = await pacientes.buscarPorId(pacienteId);
  if (!paciente) throw new ErroDominio('Paciente não encontrado.');
  if (paciente.estaArquivado) {
    throw new ErroDominio('Paciente arquivado — reative o paciente antes de agendar uma nova consulta.');
  }
}

/**
 * Confere conflito de horário contra a agenda inteira (consultório de
 * profissional única — não há "agenda de outro dentista" pra separar).
 * Consultas já canceladas nunca contam como conflito: um horário
 * liberado por cancelamento pode ser reaproveitado.
 */
/**
 * Recusa agendar/reagendar num dia bloqueado (feriado, final de
 * semana marcado como fechado, dia avulso — pedido do usuário: "que
 * esses dias não possam ser registrados pra consulta"). `bloqueios` é
 * OPCIONAL de propósito: os dois casos de uso já tinham vários
 * construtores em uso (testes, backup, outras telas) antes deste
 * bloqueio existir — tornar o parâmetro obrigatório quebraria todos
 * eles só para passar um repositório vazio. Sem o repositório
 * (`undefined`), o comportamento é o de antes desta checagem existir:
 * nada é bloqueado.
 */
async function garantirDiaNaoBloqueado(bloqueios: RepositorioBloqueiosAgenda | undefined, data: string): Promise<void> {
  if (!bloqueios) return;
  const todos = await bloqueios.listarTodos();
  const bloqueio = todos.find((b) => b.data === data);
  if (bloqueio) {
    const rotuloTipo = TIPO_BLOQUEIO_AGENDA_LABEL[bloqueio.tipo];
    const detalhe = bloqueio.motivo ? ` (${rotuloTipo.toLowerCase()} — ${bloqueio.motivo})` : ` (${rotuloTipo.toLowerCase()})`;
    throw new ErroDominio(`Este dia está bloqueado na agenda${detalhe} — não é possível agendar consulta.`);
  }
}

export class AgendarConsulta {
  constructor(
    private readonly consultas: RepositorioConsultas,
    private readonly pacientes: RepositorioPacientes,
    private readonly bloqueios?: RepositorioBloqueiosAgenda,
    private readonly procedimentos?: RepositorioProcedimentosCatalogo,
    private readonly configuracao?: PortaConfiguracaoClinica,
  ) {}

  async executar(input: AgendarConsultaInput): Promise<Consulta> {
    await garantirPacienteAgendavel(this.pacientes, input.pacienteId);
    await garantirDiaNaoBloqueado(this.bloqueios, input.data);
    const encaixe = encontrarProximoHorario(input, (await this.consultas.listarTodas()).map(c => c.toSnapshot()),
      await this.configuracao?.obter());
    if (!encaixe) throw new ErroDominio('Não há espaço para esta duração no restante do dia. Escolha outra data.');
    input = { ...input, ...encaixe };
    let orcamento = null;
    if (input.procedimentoId) {
      if (input.definirValorNoConsultorio) throw new ErroDominio('Escolha um procedimento ou avaliação no consultório.');
      const procedimento = await this.procedimentos?.buscarPorId(input.procedimentoId);
      if (!procedimento || !procedimento.toSnapshot().ativo) throw new ErroDominio('Procedimento indisponível. Atualize o catálogo e tente novamente.');
      const p = procedimento.toSnapshot();
      orcamento = { procedimentoId: p.id, descricao: p.nome, valorCentavos: p.precoCentavos,
        valorMinimoCentavos: p.precoMinimoCentavos, valorMaximoCentavos: p.precoMaximoCentavos,
        definirNoConsultorio: p.precoCentavos == null };
    } else if (input.definirValorNoConsultorio) {
      orcamento = { procedimentoId: null, descricao: 'Avaliar no consultório', valorCentavos: null,
        valorMinimoCentavos: null, valorMaximoCentavos: null, definirNoConsultorio: true };
    }
    const consulta = Consulta.agendar({ ...input, orcamento });
    await this.consultas.salvar(consulta);
    return await this.consultas.buscarPorId(consulta.id) ?? consulta;
  }
}

export class ReagendarConsulta {
  constructor(
    private readonly consultas: RepositorioConsultas,
    private readonly pacientes: RepositorioPacientes,
    private readonly bloqueios?: RepositorioBloqueiosAgenda,
    private readonly configuracao?: PortaConfiguracaoClinica,
  ) {}

  async executar(id: string, novaData: string, novoHorario: string): Promise<Consulta> {
    const consulta = await carregarConsultaOuFalhar(this.consultas, id);
    await garantirPacienteAgendavel(this.pacientes, consulta.pacienteId);
    const duracaoMinutos = consulta.toSnapshot().duracaoMinutos;
    await garantirDiaNaoBloqueado(this.bloqueios, novaData);
    const encaixe = encontrarProximoHorario({ id, data: novaData, horario: novoHorario, duracaoMinutos },
      (await this.consultas.listarTodas()).map(c => c.toSnapshot()), await this.configuracao?.obter());
    if (!encaixe) throw new ErroDominio('Não há espaço para esta duração no restante do dia. Escolha outra data.');
    novoHorario = encaixe.horario;
    consulta.reagendar(novaData, novoHorario);
    await this.consultas.salvar(consulta);
    return await this.consultas.buscarPorId(consulta.id) ?? consulta;
  }
}

export class ConfirmarConsulta {
  constructor(private readonly consultas: RepositorioConsultas) {}

  async executar(id: string): Promise<Consulta> {
    const consulta = await carregarConsultaOuFalhar(this.consultas, id);
    consulta.confirmar();
    await this.consultas.salvar(consulta);
    return await this.consultas.buscarPorId(consulta.id) ?? consulta;
  }
}

export class MarcarConsultaRealizada {
  constructor(private readonly consultas: RepositorioConsultas) {}

  async executar(id: string): Promise<Consulta> {
    const consulta = await carregarConsultaOuFalhar(this.consultas, id);
    consulta.marcarRealizada();
    await this.consultas.salvar(consulta);
    return await this.consultas.buscarPorId(consulta.id) ?? consulta;
  }
}

export class MarcarFaltaConsulta {
  constructor(private readonly consultas: RepositorioConsultas) {}

  async executar(id: string): Promise<Consulta> {
    const consulta = await carregarConsultaOuFalhar(this.consultas, id);
    consulta.marcarFalta();
    await this.consultas.salvar(consulta);
    return await this.consultas.buscarPorId(consulta.id) ?? consulta;
  }
}

export class CancelarConsulta {
  constructor(private readonly consultas: RepositorioConsultas) {}

  async executar(id: string, motivo = ''): Promise<Consulta> {
    const consulta = await carregarConsultaOuFalhar(this.consultas, id);
    consulta.cancelar(motivo);
    await this.consultas.salvar(consulta);
    return await this.consultas.buscarPorId(consulta.id) ?? consulta;
  }
}

export class ListarConsultasDoPaciente {
  constructor(private readonly consultas: RepositorioConsultas) {}

  /** Ordem cronológica (mais antiga primeiro) — a tela decide como agrupar em "próximas"/"histórico". */
  async executar(pacienteId: string): Promise<Consulta[]> {
    const lista = await this.consultas.listarPorPacienteId(pacienteId);
    return [...lista].sort((a, b) => {
      const snapA = a.toSnapshot();
      const snapB = b.toSnapshot();
      return `${snapA.data}T${snapA.horario}`.localeCompare(`${snapB.data}T${snapB.horario}`);
    });
  }
}

export interface ResumoConsultasFuturas {
  /** Consultas ainda de pé: nem canceladas, nem já realizadas, data de hoje em diante. */
  total: number;
  /** A mais próxima delas (pra dar um exemplo concreto no aviso), ou `null` se não há nenhuma. */
  proxima: { data: string; horario: string; motivo: string } | null;
}

/**
 * Conta as consultas que ainda vão acontecer para um paciente — a mesma
 * definição de "próxima" que o Painel usa (`ListarProximasConsultas`):
 * status diferente de CANCELADA/REALIZADA e data de hoje em diante. É o
 * conjunto exato que some da Agenda do consultório e do Painel quando o
 * paciente é arquivado (as duas telas ignoram paciente arquivado), então
 * a tela de arquivamento usa isto pra avisar ANTES. Nada é cancelado nem
 * apagado: o histórico inteiro continua na aba Consultas do paciente.
 */
export class ResumoConsultasFuturasDoPaciente {
  constructor(private readonly consultas: RepositorioConsultas) {}

  async executar(
    pacienteId: string,
    hojeIso = hojeIsoLocal(),
  ): Promise<ResumoConsultasFuturas> {
    const daPaciente = await this.consultas.listarPorPacienteId(pacienteId);
    const futuras = daPaciente
      .map((c) => c.toSnapshot())
      .filter((s) => s.status !== 'CANCELADA' && s.status !== 'REALIZADA' && s.data >= hojeIso)
      .sort((a, b) => `${a.data}T${a.horario}`.localeCompare(`${b.data}T${b.horario}`));

    const primeira = futuras[0];
    return {
      total: futuras.length,
      proxima: primeira ? { data: primeira.data, horario: primeira.horario, motivo: primeira.motivo } : null,
    };
  }
}

function ordenarPorDataEHorario(a: Consulta, b: Consulta): number {
  const snapA = a.toSnapshot();
  const snapB = b.toSnapshot();
  return `${snapA.data}T${snapA.horario}`.localeCompare(`${snapB.data}T${snapB.horario}`);
}

export interface ConsultaProxima {
  consulta: Consulta;
  nomePaciente: string;
}

/**
 * Agenda do Painel — próximas consultas de todos os pacientes ATIVOS
 * (hoje em diante, nunca canceladas/já realizadas), mesmo padrão de
 * junção de nome já usado em `ListarEvolucoesRecentes`. Consistente
 * com a agenda do consultório (`ListarAgendaDoIntervalo`): as duas
 * ignoram pacientes arquivados.
 */
export class ListarProximasConsultas {
  constructor(
    private readonly consultas: RepositorioConsultas,
    private readonly pacientes: RepositorioPacientes,
  ) {}

  async executar(limite = 5, hojeIso = hojeIsoLocal()): Promise<ConsultaProxima[]> {
    const [todas, todosPacientes] = await Promise.all([this.consultas.listarTodas(), this.pacientes.listarTodos()]);
    const ativosPorId = new Map(todosPacientes.filter((p) => !p.estaArquivado).map((p) => [p.id, p.nomeCompleto]));

    const futuras = todas
      .filter((c) => {
        const snap = c.toSnapshot();
        if (!ativosPorId.has(c.pacienteId)) return false;
        return snap.status !== 'CANCELADA' && snap.status !== 'REALIZADA' && snap.data >= hojeIso;
      })
      .sort(ordenarPorDataEHorario)
      .slice(0, limite);

    return futuras.map((consulta) => ({
      consulta,
      nomePaciente: ativosPorId.get(consulta.pacienteId) ?? 'Paciente removido',
    }));
  }
}

export interface ConsultaNaAgenda {
  consulta: Consulta;
  nomePaciente: string;
  /** `true` quando o paciente tem número válido E consentimento de WhatsApp AUTORIZADO — a tela mostra/esconde a ação. */
  podeWhatsapp: boolean;
}

/**
 * Agenda do consultório inteiro num intervalo de datas (day view /
 * week view) — TODAS as consultas de pacientes ativos naquele
 * intervalo, em qualquer status: canceladas e faltas continuam
 * visíveis como histórico do dia (pedido explícito). Pacientes
 * arquivados ficam de fora — a agenda mostra só quem está no fluxo
 * ativo; o histórico de consultas do arquivado continua acessível na
 * aba Consultas dele. `dataInicio`/`dataFim` são inclusivos, formato
 * `YYYY-MM-DD` (comparação lexicográfica basta nesse formato).
 */
export class ListarAgendaDoIntervalo {
  constructor(
    private readonly consultas: RepositorioConsultas,
    private readonly pacientes: RepositorioPacientes,
  ) {}

  async executar(dataInicio: string, dataFim: string): Promise<ConsultaNaAgenda[]> {
    const [todas, todosPacientes] = await Promise.all([this.consultas.listarTodas(), this.pacientes.listarTodos()]);
    const ativosPorId = new Map(todosPacientes.filter((p) => !p.estaArquivado).map((p) => [p.id, p.toSnapshot()]));

    return todas
      .filter((c) => {
        const { data } = c.toSnapshot();
        return ativosPorId.has(c.pacienteId) && data >= dataInicio && data <= dataFim;
      })
      .sort(ordenarPorDataEHorario)
      .map((consulta) => {
        const paciente = ativosPorId.get(consulta.pacienteId);
        return {
          consulta,
          nomePaciente: paciente?.nomeCompleto ?? 'Paciente removido',
          podeWhatsapp: paciente
            ? avaliarDisponibilidadeWhatsapp(paciente.celular, paciente.consentimentoWhatsapp.status).liberado
            : false,
        };
      });
  }
}
