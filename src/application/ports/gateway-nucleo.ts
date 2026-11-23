/**
 * Port do NÚCLEO clínico compartilhado (Etapas 21–22). O CRUD de cada
 * coleção passa pelos repositórios backend
 * (`infrastructure/api/repositorios-backend-nucleo.ts`), que implementam
 * os MESMOS ports de `application/ports/repositorios.ts`. Este gateway
 * cobre só o que NÃO é CRUD de entidade: contagem e migração. Nenhuma
 * regra de negócio aqui — só transporte.
 */

/** Coleções do núcleo que vivem no servidor quando `VITE_API_PACIENTES` / `VITE_API` está ligado. */
export type ColecaoNucleo =
  | 'pacientes'
  | 'consultas'
  | 'planos'
  | 'evolucoes'
  | 'registros-dentais'
  | 'registros-whatsapp'
  | 'anamneses'
  | 'bloqueios-agenda'
  | 'procedimentos-catalogo'
  | 'retornos'
  | 'campanhas-comemorativas'
  | 'mensagens-cortesia';

export const COLECOES_NUCLEO: readonly ColecaoNucleo[] = [
  'pacientes',
  'consultas',
  'planos',
  'evolucoes',
  'registros-dentais',
  'registros-whatsapp',
  'anamneses',
  'bloqueios-agenda',
  'procedimentos-catalogo',
  'retornos',
  'campanhas-comemorativas',
  'mensagens-cortesia',
];

export const ROTULO_COLECAO_NUCLEO: Record<ColecaoNucleo, string> = {
  pacientes: 'pacientes',
  consultas: 'consultas',
  planos: 'planos de tratamento',
  evolucoes: 'evoluções clínicas',
  'registros-dentais': 'registros do odontograma',
  'registros-whatsapp': 'ações de WhatsApp',
  anamneses: 'anamneses',
  'bloqueios-agenda': 'dias bloqueados na agenda',
  'procedimentos-catalogo': 'procedimentos do catálogo',
  retornos: 'retornos de pacientes',
  'campanhas-comemorativas': 'campanhas comemorativas',
  'mensagens-cortesia': 'mensagens de cortesia',
};

export type ContagemNucleo = Record<ColecaoNucleo, number>;

export function contagemNucleoVazia(): ContagemNucleo {
  return {
    pacientes: 0,
    consultas: 0,
    planos: 0,
    evolucoes: 0,
    'registros-dentais': 0,
    'registros-whatsapp': 0,
    anamneses: 0,
    'bloqueios-agenda': 0,
    'procedimentos-catalogo': 0,
    retornos: 0,
    'campanhas-comemorativas': 0,
    'mensagens-cortesia': 0,
  };
}

export interface ResultadoMigracaoNucleo {
  /** Total de registros novos gravados no servidor, somando todas as coleções. */
  gravados: number;
  /** Total de registros que já existiam no servidor (ignorados, nada sobrescrito). */
  ignorados: number;
  porColecao: Partial<Record<ColecaoNucleo, { gravados: number; ignorados: number }>>;
}

export interface GatewayNucleo {
  /** `true` quando o servidor responde. */
  disponivel(): Promise<boolean>;
  /** Quantos registros de cada coleção já existem no servidor. */
  contar(): Promise<ContagemNucleo>;
  /**
   * Envia os registros locais de cada coleção. O servidor grava só os
   * ids que ainda não existem lá — **nunca sobrescreve** — e devolve as
   * contagens. Repetir é seguro (a 2ª chamada grava 0).
   */
  migrar(colecoes: Partial<Record<ColecaoNucleo, unknown[]>>): Promise<ResultadoMigracaoNucleo>;
}
