export interface ConflitoGoogleCalendar {
  id: string;
  tipo: 'consulta' | 'bloqueio';
  data: string | null;
  horario: string | null;
  motivo: string;
  token?: string;
  podeUsarSistema?: boolean;
}
export interface FeriadoGoogle {
  id: string;
  data: string;
  nome: string;
  nacional: boolean;
  ignorado: boolean;
  municipal?: boolean;
  fonte?: string;
}
export interface RegiaoClinica { municipioId: string; cidade: string; uf: string }
export interface UnidadeFederacao { id: string; sigla: string }
export interface LocalidadesClinica { ufs: UnidadeFederacao[]; municipios: RegiaoClinica[] }
export interface MalhaLocalidades {
  type: 'FeatureCollection';
  features: { properties: { codarea: string }; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] } }[];
}
export interface StatusFeriadosGoogle {
  habilitado: boolean;
  fonte: string;
  atualizadoEm: string | null;
  erro: string | null;
  eventos: FeriadoGoogle[];
  regiao: RegiaoClinica | null;
  coberturaRegional: { municipal: number[]; estadual: number[] };
}
export interface StatusGoogleCalendar {
  configurado: boolean;
  executando: boolean;
  ultimoSucessoEm: string | null;
  ultimoErro: string | null;
  conflitos: number;
  detalhesConflitos?: ConflitoGoogleCalendar[];
  eventosVinculados?: number;
  erroConfiguracao?: string | null;
}
