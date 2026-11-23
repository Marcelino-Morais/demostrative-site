import { agoraIso, ErroDominio, gerarId } from '../types.js';

/**
 * Registro de fila de mensagem de cortesia (aniversário ou campanha
 * comemorativa) — Fase de preparo/revisão manual apenas: NUNCA é
 * enviado pelo sistema nesta etapa. Guarda só o necessário pra
 * deduplicar por ano e pra tela operacional mostrar o que já foi
 * preparado/tratado — nunca o texto da mensagem nem o número completo
 * (só a máscara, mesmo padrão de `registro-whatsapp.ts`/
 * `whatsapp-automatico.mjs`).
 */

export type TipoMensagemCortesia = 'ANIVERSARIO' | 'CAMPANHA';
export type StatusMensagemCortesia = 'PREPARADA' | 'REVISADA_MANUALMENTE' | 'DISPENSADA';

export const STATUS_MENSAGEM_CORTESIA_LABEL: Record<StatusMensagemCortesia, string> = {
  PREPARADA: 'Preparada, aguardando revisão',
  REVISADA_MANUALMENTE: 'Revisada manualmente',
  DISPENSADA: 'Dispensada',
};

export interface MensagemCortesiaProps {
  id: string;
  tipo: TipoMensagemCortesia;
  pacienteId: string;
  /** `null` para aniversário; id da campanha para o tipo CAMPANHA. */
  campanhaId: string | null;
  /** Ano civil de referência — chave de deduplicação junto com tipo/paciente/campanha. */
  anoReferencia: number;
  /** `YYYY-MM-DD` — dia da data comemorativa/aniversário naquele ano. */
  dataAgendada: string;
  status: StatusMensagemCortesia;
  numeroMascarado: string;
  /** Metadado reservado para quando um envio real existir (Fase futura) — sempre `0` nesta fase. */
  tentativas: number;
  ultimoErro: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface NovaMensagemCortesiaInput {
  tipo: TipoMensagemCortesia;
  pacienteId: string;
  campanhaId?: string | null;
  anoReferencia: number;
  dataAgendada: string;
  numeroMascarado: string;
}

export class MensagemCortesia {
  private constructor(private props: MensagemCortesiaProps) {}

  static criar(input: NovaMensagemCortesiaInput): MensagemCortesia {
    if (!input.pacienteId) throw new ErroDominio('Paciente é obrigatório.');
    if (input.tipo === 'CAMPANHA' && !input.campanhaId) {
      throw new ErroDominio('Mensagem de campanha precisa de uma campanha de origem.');
    }
    const agora = agoraIso();
    return new MensagemCortesia({
      id: gerarId(),
      tipo: input.tipo,
      pacienteId: input.pacienteId,
      campanhaId: input.tipo === 'CAMPANHA' ? (input.campanhaId ?? null) : null,
      anoReferencia: input.anoReferencia,
      dataAgendada: input.dataAgendada,
      status: 'PREPARADA',
      numeroMascarado: input.numeroMascarado,
      tentativas: 0,
      ultimoErro: null,
      criadoEm: agora,
      atualizadoEm: agora,
    });
  }

  static restaurar(props: MensagemCortesiaProps): MensagemCortesia {
    return new MensagemCortesia({ ...props });
  }

  marcarRevisadaManualmente(): void {
    this.props.status = 'REVISADA_MANUALMENTE';
    this.props.atualizadoEm = agoraIso();
  }

  dispensar(): void {
    this.props.status = 'DISPENSADA';
    this.props.atualizadoEm = agoraIso();
  }

  get id(): string {
    return this.props.id;
  }

  get pacienteId(): string {
    return this.props.pacienteId;
  }

  get tipo(): TipoMensagemCortesia {
    return this.props.tipo;
  }

  get campanhaId(): string | null {
    return this.props.campanhaId;
  }

  get anoReferencia(): number {
    return this.props.anoReferencia;
  }

  toSnapshot(): Readonly<MensagemCortesiaProps> {
    return { ...this.props };
  }
}
