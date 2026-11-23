import type { PacienteProps } from '../../domain/entities/paciente.js';

export type StatusComparacaoLocal = 'identico' | 'divergente' | 'ausente-no-servidor';

export interface ItemComparacaoLocal {
  id: string;
  status: StatusComparacaoLocal;
  /** Só os NOMES dos campos que divergem — nunca o valor. */
  camposDivergentes?: string[];
}

/**
 * Compara cópias de pacientes do `localStorage` deste navegador com o
 * que está de verdade no servidor — base da limpeza segura de dado
 * antigo no navegador (ver `server/index.mjs`,
 * `POST /api/pacientes/comparar-locais`). Nunca devolve nenhum valor de
 * campo, nem mascarado — só o veredito por id.
 */
export interface PortaComparacaoLocalPacientes {
  comparar(pacientes: PacienteProps[]): Promise<ItemComparacaoLocal[]>;
}
