export interface ComparacaoCopiasLocais {
  resultado: Array<{ id: string; status: 'identico' | 'divergente' | 'ausente-no-servidor' }>;
  preservada?: boolean;
  recibo?: string;
}
export interface GatewayCopiasLocais {
  comparar(pacientes: Array<{ id: string }>): Promise<ComparacaoCopiasLocais>;
  preservar(pacientes: Array<{ id: string }>): Promise<ComparacaoCopiasLocais>;
}
export interface ResumoCopiasLocais { total: number; identicos: number; divergentes: number; ausentes: number; removidos?: number; recibo?: string }
