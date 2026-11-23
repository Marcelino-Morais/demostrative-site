import { dataCalendarioValida } from '../value-objects/data-cadastral.js';
import { agoraIso, ErroDominio, gerarId } from '../types.js';

/**
 * Campanha comemorativa configurável (ex.: Dia das Mães, Natal) — nunca
 * hardcoded/enviada automaticamente por nenhum feriado embutido no
 * sistema; só existe se a clínica cadastrar e ativar explicitamente.
 * `referenciaModeloMensagem` é só uma referência/identificador de qual
 * modelo de mensagem usar — o texto de verdade (quando um envio real
 * algum dia existir) precisa de aprovação própria na Meta, separada dos
 * 6 modelos de consulta já documentados em
 * `whatsapp-itens/docs/whatsapp-meta-cloud-api.spec.md`.
 */

export interface CampanhaComemorativaProps {
  id: string;
  titulo: string;
  /** `MM-DD` — mês e dia da data comemorativa (sem ano; repete todo ano). */
  dataComemorativa: string;
  ativa: boolean;
  /** Identificador do modelo de mensagem — nunca o texto pronto; aprovação/conteúdo fica fora do sistema. */
  referenciaModeloMensagem: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface NovaCampanhaComemorativaInput {
  titulo: string;
  dataComemorativa: string;
  referenciaModeloMensagem: string;
}

export type EditarCampanhaComemorativaInput = NovaCampanhaComemorativaInput;

const RE_DATA_MM_DD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class CampanhaComemorativa {
  private constructor(private props: CampanhaComemorativaProps) {}

  static criar(input: NovaCampanhaComemorativaInput): CampanhaComemorativa {
    const titulo = input.titulo.trim();
    if (!titulo) throw new ErroDominio('Título da campanha é obrigatório.');
    if (!RE_DATA_MM_DD.test(input.dataComemorativa) || !dataCalendarioValida(`2000-${input.dataComemorativa}`)) {
      throw new ErroDominio('Data comemorativa inválida — use o formato MM-DD (ex.: 12-25).');
    }
    const referenciaModeloMensagem = input.referenciaModeloMensagem.trim();
    if (!referenciaModeloMensagem) throw new ErroDominio('Referência do modelo de mensagem é obrigatória.');

    const agora = agoraIso();
    return new CampanhaComemorativa({
      id: gerarId(),
      titulo,
      dataComemorativa: input.dataComemorativa,
      ativa: false,
      referenciaModeloMensagem,
      criadoEm: agora,
      atualizadoEm: agora,
    });
  }

  static restaurar(props: CampanhaComemorativaProps): CampanhaComemorativa {
    return new CampanhaComemorativa({ ...props });
  }

  editar(input: EditarCampanhaComemorativaInput): void {
    const titulo = input.titulo.trim();
    if (!titulo) throw new ErroDominio('Título da campanha é obrigatório.');
    if (!RE_DATA_MM_DD.test(input.dataComemorativa) || !dataCalendarioValida(`2000-${input.dataComemorativa}`)) {
      throw new ErroDominio('Data comemorativa inválida — use o formato MM-DD (ex.: 12-25).');
    }
    const referenciaModeloMensagem = input.referenciaModeloMensagem.trim();
    if (!referenciaModeloMensagem) throw new ErroDominio('Referência do modelo de mensagem é obrigatória.');

    this.props.titulo = titulo;
    this.props.dataComemorativa = input.dataComemorativa;
    this.props.referenciaModeloMensagem = referenciaModeloMensagem;
    this.props.atualizadoEm = agoraIso();
  }

  ativar(): void {
    this.props.ativa = true;
    this.props.atualizadoEm = agoraIso();
  }

  desativar(): void {
    this.props.ativa = false;
    this.props.atualizadoEm = agoraIso();
  }

  get id(): string {
    return this.props.id;
  }

  get ativa(): boolean {
    return this.props.ativa;
  }

  get dataComemorativa(): string {
    return this.props.dataComemorativa;
  }

  toSnapshot(): Readonly<CampanhaComemorativaProps> {
    return { ...this.props };
  }
}
