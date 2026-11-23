/**
 * Tipos e enums compartilhados do domínio clínico. Nada aqui depende de
 * React, localStorage ou qualquer detalhe de infraestrutura — só regras
 * e vocabulário do próprio negócio (ficha clínica de um consultório
 * odontológico).
 */

/** Resposta sim/não/não informado — recorrente na anamnese (docx original usa "(  ) sim (  ) não"). */
export type SimNao = 'SIM' | 'NAO' | null;

/** Erro de violação de invariante de domínio (ex.: nome obrigatório, valor negativo). */
export class ErroDominio extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErroDominio';
  }
}

export function gerarId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback só para ambientes sem crypto.randomUUID (ex.: alguns runtimes de teste antigos).
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function agoraIso(): string {
  return new Date().toISOString();
}

/** Dia do calendário local; ISO de timestamp usa UTC e pode já ser amanhã. */
export function hojeIsoLocal(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
}
