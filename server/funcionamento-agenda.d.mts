export interface HorarioFuncionamento { inicio: string; fim: string }
export const FUNCIONAMENTO_PADRAO: Readonly<HorarioFuncionamento>;
export function funcionamentoValido(valor: unknown): valor is HorarioFuncionamento;
export function descansoDentroDoFuncionamento(descanso: { ativo: boolean; inicio: string; fim: string } | undefined, funcionamento: HorarioFuncionamento): boolean;
export function consultaForaDoFuncionamento(consulta: { horario: string; duracaoMinutos: number }, configuracao?: { funcionamento?: HorarioFuncionamento }): boolean;
