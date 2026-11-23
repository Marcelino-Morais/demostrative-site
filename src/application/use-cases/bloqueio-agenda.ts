import { BloqueioAgenda, diasDoBloqueio, type TipoBloqueioAgenda } from '../../domain/entities/bloqueio-agenda.js';
import { ErroDominio, gerarId } from '../../domain/types.js';
import type { RepositorioBloqueiosAgenda } from '../ports/repositorios.js';

export interface BloquearDiasInput {
  dataInicio: string;
  dataFim: string;
  tipo: TipoBloqueioAgenda;
  motivo?: string;
  /** Texto do aviso de funcionamento do WhatsApp — nunca usado para `AVULSO` (ver `whatsapp-funcionamento.mjs`). */
  motivoPublico?: string;
}

/**
 * Bloqueia um dia ou um intervalo de dias na Agenda de uma vez (pedido
 * do usuário: "bloquear dia/dias como feriado, finais de semana ou
 * dias avulso"). Cada dia vira seu próprio `BloqueioAgenda` — ver o
 * comentário da entidade. Um dia que já está bloqueado nunca é
 * sobrescrito (evita perder o motivo original de um bloqueio anterior
 * ao tentar bloquear de novo um intervalo que já inclui aquele dia).
 *
 * Todos os dias desta MESMA chamada compartilham um `grupoId` — é o que
 * deixa o aviso do WhatsApp reconhecer um período de verdade (ver
 * `BloqueioAgendaProps.grupoId`), sem nunca inferir isso só porque duas
 * datas calham de ser consecutivas.
 */
export class BloquearDias {
  constructor(private readonly bloqueios: RepositorioBloqueiosAgenda) {}

  async executar(input: BloquearDiasInput): Promise<BloqueioAgenda[]> {
    const dias = diasDoBloqueio(input.dataInicio, input.dataFim, input.tipo);
    if (dias.length === 0) {
      throw new ErroDominio('Nenhum dia desse tipo dentro do intervalo escolhido.');
    }
    const existentes = await this.bloqueios.listarTodos();
    const jaBloqueados = new Set(existentes.map((b) => b.data));

    const grupoId = gerarId();
    const criados: BloqueioAgenda[] = [];
    for (const data of dias) {
      if (jaBloqueados.has(data)) continue;
      const bloqueio = BloqueioAgenda.criar({
        data,
        tipo: input.tipo,
        motivo: input.motivo,
        motivoPublico: input.motivoPublico,
        grupoId,
      });
      await this.bloqueios.salvar(bloqueio);
      criados.push(bloqueio);
    }
    return criados;
  }
}

export class DesbloquearDia {
  constructor(private readonly bloqueios: RepositorioBloqueiosAgenda) {}

  async executar(id: string): Promise<void> {
    await this.bloqueios.remover(id);
  }
}

export class ListarBloqueiosAgenda {
  constructor(private readonly bloqueios: RepositorioBloqueiosAgenda) {}

  async executar(): Promise<BloqueioAgenda[]> {
    return this.bloqueios.listarTodos();
  }
}
