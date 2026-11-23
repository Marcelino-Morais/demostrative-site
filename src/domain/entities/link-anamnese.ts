import { agoraIso, ErroDominio, gerarId } from '../types.js';

/**
 * Link compartilhável para o paciente responder a própria anamnese num
 * dispositivo dele (Etapa 16). O identificador da URL é um **token
 * opaco** (128 bits aleatórios), nunca o id sequencial/adivinhável do
 * paciente. Nenhuma resposta clínica entra na URL — o token só serve
 * para o app achar de qual paciente é o formulário.
 *
 * LIMITAÇÃO ATUAL: o app é 100% `localStorage`. Um link só "funciona"
 * no MESMO navegador que o gerou — é um protótipo local. Submissão
 * entre dispositivos de verdade exige persistência compartilhada (um
 * back-end). Os ports/casos de uso já isolam isso: trocar o
 * `RepositorioLinksAnamnese` por um adaptador HTTP não mexe na UI.
 */
export type StatusLinkAnamnese = 'ATIVO' | 'RESPONDIDO' | 'REVOGADO';

/** Status "de verdade" na hora de olhar — inclui `EXPIRADO`, derivado da data. */
export type StatusEfetivoLinkAnamnese = StatusLinkAnamnese | 'EXPIRADO';

export const STATUS_EFETIVO_LINK_ANAMNESE_LABEL: Record<StatusEfetivoLinkAnamnese, string> = {
  ATIVO: 'Ativo',
  RESPONDIDO: 'Respondido',
  REVOGADO: 'Revogado',
  EXPIRADO: 'Expirado',
};

export interface LinkAnamneseProps {
  id: string;
  /** Token opaco, seguro para URL. */
  token: string;
  pacienteId: string;
  status: StatusLinkAnamnese;
  criadoEm: string;
  /** ISO — depois disso um link `ATIVO` conta como `EXPIRADO`. */
  expiraEm: string;
  respondidoEm: string | null;
  revogadoEm: string | null;
}

const DIAS_VALIDADE_PADRAO = 14;

/** Token URL-safe de 128 bits (base64url sem padding, ~22 caracteres). */
export function gerarTokenAnamnese(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // Fallback só para runtimes sem WebCrypto — ainda não sequencial.
  return `${gerarId()}${gerarId()}`.replace(/-/g, '').slice(0, 22);
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString();
}

/** Deriva o status efetivo (com `EXPIRADO`) sem tocar a entidade. Puro. */
export function statusEfetivoLink(props: LinkAnamneseProps, agora: string = agoraIso()): StatusEfetivoLinkAnamnese {
  if (props.status === 'ATIVO' && agora > props.expiraEm) return 'EXPIRADO';
  return props.status;
}

/** Caminho relativo da página pública da anamnese para um token. */
export function caminhoAnamnesePublica(token: string): string {
  return `/anamnese/${encodeURIComponent(token)}`;
}

export class LinkAnamnese {
  private constructor(private props: LinkAnamneseProps) {}

  static gerar(
    pacienteId: string,
    agora: string = agoraIso(),
    diasValidade: number = DIAS_VALIDADE_PADRAO,
  ): LinkAnamnese {
    if (!pacienteId) throw new ErroDominio('Link de anamnese precisa estar vinculado a um paciente.');
    return new LinkAnamnese({
      id: gerarId(),
      token: gerarTokenAnamnese(),
      pacienteId,
      status: 'ATIVO',
      criadoEm: agora,
      expiraEm: somarDias(agora, diasValidade),
      respondidoEm: null,
      revogadoEm: null,
    });
  }

  static restaurar(props: LinkAnamneseProps): LinkAnamnese {
    return new LinkAnamnese({
      ...props,
      respondidoEm: props.respondidoEm ?? null,
      revogadoEm: props.revogadoEm ?? null,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get token(): string {
    return this.props.token;
  }

  get pacienteId(): string {
    return this.props.pacienteId;
  }

  statusEfetivo(agora: string = agoraIso()): StatusEfetivoLinkAnamnese {
    return statusEfetivoLink(this.props, agora);
  }

  /** `true` quando o paciente ainda pode enviar respostas por este link. */
  podeResponder(agora: string = agoraIso()): boolean {
    return this.statusEfetivo(agora) === 'ATIVO';
  }

  registrarResposta(agora: string = agoraIso()): void {
    if (this.statusEfetivo(agora) !== 'ATIVO') {
      throw new ErroDominio('Este link de anamnese não está mais disponível para responder.');
    }
    this.props.status = 'RESPONDIDO';
    this.props.respondidoEm = agora;
  }

  revogar(agora: string = agoraIso()): void {
    if (this.props.status === 'REVOGADO') return;
    this.props.status = 'REVOGADO';
    this.props.revogadoEm = agora;
  }

  toSnapshot(): Readonly<LinkAnamneseProps> {
    return { ...this.props };
  }
}
