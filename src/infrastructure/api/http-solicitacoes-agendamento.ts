import { ErroApi } from '../../application/ports/api-client.js';
import type {
  PortaSolicitacoesAgendamento,
  SolicitacaoAgendamento,
  StatusSolicitacaoAgendamento,
} from '../../application/ports/porta-solicitacoes-agendamento.js';
import { obterDispositivoId } from '../dispositivo-id.js';

const STATUS_VALIDOS: StatusSolicitacaoAgendamento[] = ['PENDENTE', 'APROVANDO', 'APROVADA', 'RECUSADA'];

const MENSAGEM_POR_CODIGO: Record<string, string> = {
  'aceite-sem-consentimento': 'O horário precisa de aceite pelo WhatsApp, mas o paciente não autorizou esse contato. Revise o consentimento com o paciente.',
  'sem-horario-no-dia': 'Não há espaço para esta duração até as 17h. Escolha outra data.',
  'conflito-horario': 'Já existe uma consulta nesse horário — escolha outra duração ou confirme na Agenda antes de tentar de novo.',
  'horario-descanso': 'Este atendimento cruza o descanso diário. Escolha outro horário ou revise o intervalo em Configurações.',
  'dia-bloqueado': 'Este dia está bloqueado na agenda da clínica — não é possível aprovar para esta data.',
  'duracao-invalida': 'Informe a duração prevista em minutos (um número inteiro maior que zero).',
  'solicitacao-ja-decidida': 'Esta solicitação já foi aprovada ou recusada por outra pessoa/aba — a lista foi atualizada.',
  'aprovacao-em-andamento': 'Esta solicitação já está sendo decidida agora — aguarde um instante e atualize a lista.',
  'aprovacao-incompleta-requer-verificacao':
    'Esta solicitação ficou com uma aprovação incompleta (uma queda no meio do processo) — confira a Agenda antes de decidir; pode já existir uma consulta criada.',
  'paciente-nao-encontrado': 'O paciente desta solicitação não foi encontrado — pode ter sido removido.',
  'solicitacao-nao-encontrada': 'Esta solicitação não existe mais — a lista foi atualizada.',
  'procedimento-indisponivel': 'Este procedimento não está mais disponível no catálogo — escolha outro.',
};

function lerSolicitacao(bruto: unknown): SolicitacaoAgendamento | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const s = bruto as Record<string, unknown>;
  if (typeof s.id !== 'string' || typeof s.pacienteId !== 'string') return null;
  const status = STATUS_VALIDOS.includes(s.status as StatusSolicitacaoAgendamento)
    ? (s.status as StatusSolicitacaoAgendamento)
    : 'PENDENTE';
  return {
    id: s.id,
    pacienteId: s.pacienteId,
    propostaHorario: s.propostaHorario as SolicitacaoAgendamento['propostaHorario'],
    pacienteNome: typeof s.pacienteNome === 'string' ? s.pacienteNome : null,
    data: typeof s.data === 'string' ? s.data : '',
    horario: typeof s.horario === 'string' ? s.horario : '',
    motivoPaciente: typeof s.motivoPaciente === 'string' ? s.motivoPaciente : '',
    ehEmergencia: s.ehEmergencia === true,
    taxaEmergenciaCentavos: typeof s.taxaEmergenciaCentavos === 'number' ? s.taxaEmergenciaCentavos : 15000,
    orcamento: (s.orcamento as SolicitacaoAgendamento['orcamento']) ?? null,
    motivoPendencia: typeof s.motivoPendencia === 'string' ? s.motivoPendencia : null,
    status,
    duracaoMinutos: typeof s.duracaoMinutos === 'number' ? s.duracaoMinutos : null,
    consultaId: typeof s.consultaId === 'string' ? s.consultaId : null,
    motivoRecusa: typeof s.motivoRecusa === 'string' ? s.motivoRecusa : null,
    criadoEm: typeof s.criadoEm === 'string' ? s.criadoEm : '',
    atualizadoEm: typeof s.atualizadoEm === 'string' ? s.atualizadoEm : '',
    decididoEm: typeof s.decididoEm === 'string' ? s.decididoEm : null,
    vistaPorEsteDispositivo: s.vistaPorEsteDispositivo === true,
  };
}

/**
 * Adaptador HTTP das solicitações de agendamento do Google Forms —
 * fala com `/api/solicitacoes-agendamento/*`. Nunca inventa um status
 * desconhecido: cai em `PENDENTE` (mais conservador — nunca escondido
 * da revisão) se o servidor um dia mandar algo que esta versão não
 * reconhece.
 */
export class HttpSolicitacoesAgendamento implements PortaSolicitacoesAgendamento {
  private readonly base: string;
  private readonly token: string;

  constructor(baseUrl: string, tokenApi: string) {
    this.base = baseUrl.replace(/\/$/, '');
    this.token = tokenApi;
  }

  private async chamar(
    caminho: string,
    metodo: 'GET' | 'POST',
    corpo?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<Response> {
    try {
      return await fetch(`${this.base}${caminho}`, {
        method: metodo,
        headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json', ...extraHeaders },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    } catch {
      throw new ErroApi('Sem conexão com o servidor da clínica.', 0);
    }
  }

  private async falhar(r: Response): Promise<never> {
    let codigo: string | undefined;
    try {
      const c = (await r.json()) as { erro?: { codigo?: string } };
      codigo = c.erro?.codigo;
    } catch {
      /* corpo não-JSON */
    }
    throw new ErroApi(
      (codigo && MENSAGEM_POR_CODIGO[codigo]) || `Erro ${r.status} ao falar com o servidor da clínica.`,
      r.status,
      codigo,
    );
  }

  async listar(): Promise<SolicitacaoAgendamento[]> {
    const r = await this.chamar('/api/solicitacoes-agendamento', 'GET', undefined, {
      'x-dispositivo-id': obterDispositivoId(),
    });
    if (!r.ok) return this.falhar(r);
    const bruto = (await r.json()) as unknown;
    return Array.isArray(bruto) ? bruto.map(lerSolicitacao).filter((s): s is SolicitacaoAgendamento => s !== null) : [];
  }

  async aprovar(id: string, duracaoMinutos: number) {
    const r = await this.chamar(`/api/solicitacoes-agendamento/${encodeURIComponent(id)}/aprovar`, 'POST', { duracaoMinutos });
    if (!r.ok) return this.falhar(r);
    const corpo = (await r.json()) as { consultaId?: unknown; aguardandoPaciente?: boolean; horario?: string; data?: string };
    return { ok: true as const, consultaId: typeof corpo.consultaId === 'string' ? corpo.consultaId : '',
      aguardandoPaciente: corpo.aguardandoPaciente, horario: corpo.horario, data: corpo.data };
  }

  async recusar(id: string, motivo?: string): Promise<void> {
    const r = await this.chamar(`/api/solicitacoes-agendamento/${encodeURIComponent(id)}/recusar`, 'POST', { motivo });
    if (!r.ok) return this.falhar(r);
  }

  async marcarVistas(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const r = await this.chamar('/api/solicitacoes-agendamento/marcar-vistas', 'POST', {
      dispositivoId: obterDispositivoId(),
      ids,
    });
    if (!r.ok) return this.falhar(r);
  }

  async definirProcedimento(id: string, procedimentoId: string | null): Promise<SolicitacaoAgendamento> {
    const r = await this.chamar(`/api/solicitacoes-agendamento/${encodeURIComponent(id)}/definir-procedimento`, 'POST', {
      procedimentoId,
    });
    if (!r.ok) return this.falhar(r);
    const bruto = (await r.json()) as unknown;
    const solicitacao = lerSolicitacao(bruto);
    if (!solicitacao) throw new ErroApi('Resposta inesperada do servidor ao definir o procedimento.', r.status);
    return solicitacao;
  }
}

