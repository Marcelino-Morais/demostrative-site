export interface PontoDental { x: number; y: number }
export interface TracoDental { cor: string; pontos: PontoDental[] }
export interface DesenhoDental { tracos: TracoDental[] }
export function desenhoDentalValido(desenho: unknown): boolean;
