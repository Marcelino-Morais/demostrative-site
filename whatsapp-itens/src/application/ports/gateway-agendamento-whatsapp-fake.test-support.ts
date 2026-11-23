/**
 * `GatewayAgendamentoWhatsapp` falso para testes das telas/casos de uso
 * do agendamento por link de WhatsApp — simula o servidor em memória
 * com a MESMA semântica de token (expiração/revogação). Nunca importado
 * pela apresentação.
 */
import { agoraIso, gerarId } from '../../../../src/domain/types.js';
import type {
  ConfirmarAgendamentoPublicoInput,
  GatewayAgendamentoWhatsapp,
  LinkAgendamentoRemoto,
  LinkAgendamentoRemotoProps,
  ResultadoAberturaAgendamento,
  ResultadoConfirmacaoAgendamento,
  StatusEfetivoLinkAgendamento,
} from './gateway-agendamento-whatsapp.js';

function gerarTokenFake(): string {
  return gerarId().replace(/-/g, '');
}

export class FakeGatewayAgendamentoWhatsapp implements GatewayAgendamentoWhatsapp {
  private links: LinkAgendamentoRemotoProps[] = [];
  private consultasCriadas: ResultadoConfirmacaoAgendamento['consulta'][] = [];

  private statusEfetivo(link: LinkAgendamentoRemotoProps, agora: string): StatusEfetivoLinkAgendamento {
    if (link.status === 'ATIVO' && agora > link.expiraEm) return 'EXPIRADO';
    return link.status;
  }

  private correnteDoPaciente(pacienteId: string): LinkAgendamentoRemotoProps | undefined {
    return this.links
      .filter((l) => l.pacienteId === pacienteId)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];
  }

  async gerarLink(pacienteId: string): Promise<LinkAgendamentoRemotoProps> {
    const anterior = this.correnteDoPaciente(pacienteId);
    if (anterior && anterior.status === 'ATIVO') anterior.status = 'REVOGADO';
    const agora = agoraIso();
    const expira = new Date(agora);
    expira.setUTCDate(expira.getUTCDate() + 14);
    const link: LinkAgendamentoRemotoProps = {
      id: gerarId(),
      token: gerarTokenFake(),
      pacienteId,
      status: 'ATIVO',
      criadoEm: agora,
      expiraEm: expira.toISOString(),
      revogadoEm: null,
    };
    this.links.push(link);
    return { ...link };
  }

  async abrirPublico(token: string): Promise<ResultadoAberturaAgendamento> {
    const link = this.links.find((l) => l.token === token);
    if (!link) return { ok: false, motivo: 'nao-encontrado' };
    const s = this.statusEfetivo(link, agoraIso());
    if (s === 'REVOGADO') return { ok: false, motivo: 'revogado' };
    if (s === 'EXPIRADO') return { ok: false, motivo: 'expirado' };
    return { ok: true, primeiroNomePaciente: '', podeAgendar: s === 'ATIVO', statusEfetivo: s };
  }

  async confirmarPublico(
    token: string,
    input: ConfirmarAgendamentoPublicoInput,
  ): Promise<ResultadoConfirmacaoAgendamento> {
    const link = this.links.find((l) => l.token === token);
    if (!link || this.statusEfetivo(link, agoraIso()) !== 'ATIVO') {
      throw new Error('link-indisponivel');
    }
    const consulta = {
      id: gerarId(),
      data: input.data,
      horario: input.horario,
      duracaoMinutos: 30,
      ehEmergencia: input.ehEmergencia,
    };
    this.consultasCriadas.push(consulta);
    return { ok: true, consulta };
  }

  async obterLinkDoPaciente(pacienteId: string): Promise<LinkAgendamentoRemoto | null> {
    const link = this.correnteDoPaciente(pacienteId);
    if (!link) return null;
    return { props: { ...link }, statusEfetivo: this.statusEfetivo(link, agoraIso()) };
  }

  async revogarLink(linkId: string): Promise<void> {
    const link = this.links.find((l) => l.id === linkId);
    if (link && link.status !== 'REVOGADO') link.status = 'REVOGADO';
  }
}
