/**
 * `GatewayAnamnese` falso para testes das telas/casos de uso do slice
 * remoto — simula o servidor em memória com a MESMA semântica de token
 * (expiração/revogação/1ª resposta trava). Nunca importado pela
 * apresentação.
 */
import type { SalvarAnamneseInput } from '../../domain/entities/anamnese.js';
import { gerarTokenAnamnese, type LinkAnamneseProps } from '../../domain/entities/link-anamnese.js';
import { agoraIso, gerarId } from '../../domain/types.js';
import type {
  AnamneseSubmetida,
  GatewayAnamnese,
  LinkAnamneseRemoto,
} from './gateway-anamnese.js';

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome.trim();
}

export class FakeGatewayAnamnese implements GatewayAnamnese {
  online = true;
  private links: LinkAnamneseProps[] = [];
  private nomes = new Map<string, string>();
  private anamneses = new Map<string, AnamneseSubmetida>();

  async disponivel(): Promise<boolean> {
    return this.online;
  }

  private statusEfetivo(link: LinkAnamneseProps, agora: string): LinkAnamneseRemoto['statusEfetivo'] {
    if (link.status === 'ATIVO' && agora > link.expiraEm) return 'EXPIRADO';
    return link.status;
  }

  private correnteDoPaciente(pacienteId: string): LinkAnamneseProps | undefined {
    return this.links
      .filter((l) => l.pacienteId === pacienteId)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];
  }

  async gerarLink(pacienteId: string, primeiroNomePaciente: string): Promise<LinkAnamneseProps> {
    const anterior = this.correnteDoPaciente(pacienteId);
    if (anterior && anterior.status === 'ATIVO') anterior.status = 'REVOGADO';
    const agora = agoraIso();
    const expira = new Date(agora);
    expira.setUTCDate(expira.getUTCDate() + 14);
    const link: LinkAnamneseProps = {
      id: gerarId(),
      token: gerarTokenAnamnese(),
      pacienteId,
      status: 'ATIVO',
      criadoEm: agora,
      expiraEm: expira.toISOString(),
      respondidoEm: null,
      revogadoEm: null,
    };
    this.links.push(link);
    this.nomes.set(pacienteId, primeiroNome(primeiroNomePaciente));
    return { ...link };
  }

  async obterLinkDoPaciente(pacienteId: string): Promise<LinkAnamneseRemoto | null> {
    const link = this.correnteDoPaciente(pacienteId);
    if (!link) return null;
    return { props: { ...link }, statusEfetivo: this.statusEfetivo(link, agoraIso()) };
  }

  async revogarLink(linkId: string): Promise<void> {
    const link = this.links.find((l) => l.id === linkId);
    if (link && link.status !== 'REVOGADO') link.status = 'REVOGADO';
  }

  async obterAnamneseSubmetida(pacienteId: string): Promise<AnamneseSubmetida | null> {
    return this.anamneses.get(pacienteId) ?? null;
  }

  async abrirPublica(token: string): ReturnType<GatewayAnamnese['abrirPublica']> {
    const link = this.links.find((l) => l.token === token);
    if (!link) return { ok: false, motivo: 'nao-encontrado' };
    const s = this.statusEfetivo(link, agoraIso());
    if (s === 'REVOGADO') return { ok: false, motivo: 'revogado' };
    if (s === 'EXPIRADO') return { ok: false, motivo: 'expirado' };
    return {
      ok: true,
      primeiroNomePaciente: this.nomes.get(link.pacienteId) ?? '',
      podeResponder: s === 'ATIVO',
      statusEfetivo: s,
    };
  }

  async submeterPublica(token: string, valores: SalvarAnamneseInput): Promise<void> {
    const link = this.links.find((l) => l.token === token);
    const agora = agoraIso();
    if (!link || this.statusEfetivo(link, agora) !== 'ATIVO') {
      throw new Error('link-indisponivel');
    }
    // pacienteId vale o do token
    this.anamneses.set(link.pacienteId, { dados: { ...valores, pacienteId: link.pacienteId }, atualizadoEm: agora });
    link.status = 'RESPONDIDO';
    link.respondidoEm = agora;
  }
}
