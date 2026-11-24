interface HorarioConsulta { id?: string; data: string; horario: string; duracaoMinutos: number; status?: string }
interface Configuracao { pausaPosConsultaMinutos?: number; funcionamento?: {inicio:string;fim:string}; descanso?: { ativo: boolean; inicio: string; fim: string } }
export function encontrarProximoHorario(consulta: HorarioConsulta, consultas: HorarioConsulta[], configuracao?: Configuracao):
  { data: string; horario: string } | null;
