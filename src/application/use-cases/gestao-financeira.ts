import type { ApiClient } from '../ports/api-client.js';
export interface LancamentoFinanceiro { id: string; versao?:number;valorEditavel?:boolean;historicoEdicoes?:{em:string;motivo:string;antes:{data:string;descricao:string;valorCentavos:number};depois:{data:string;descricao:string;valorCentavos:number}}[]; canceladoEm?: string; data: string; descricao: string; valorCentavos: number; planoId?: string; pacienteId?: string; saldoCentavos?: number; avisos?: Record<string,string> }
export interface PlanoFinanceiro { id: string; pacienteId: string; nome: string; status: string; totalCentavos: number; pagoCentavos: number }
export interface ResumoGestaoFinanceira { despesas: LancamentoFinanceiro[]; parcelas: LancamentoFinanceiro[]; planos: PlanoFinanceiro[]; recebimentos: {id: string; data: string; valorCentavos: number; nome: string; planoId: string; pacienteId: string; metodo: string}[] }
export class GestaoFinanceira {
 constructor(private readonly api: ApiClient | null) {}
 async listar(): Promise<ResumoGestaoFinanceira> { if(!this.api) throw Error('Conecte o servidor para usar o fechamento e as parcelas.');const r=await this.api.get<ResumoGestaoFinanceira>('/api/gestao-financeira');if(!r)throw Error('Não foi possível carregar o financeiro.');return r; }
 async editar(tipo:'despesas'|'parcelas',id:string,dados:{data:string;descricao:string;valorCentavos:number;motivo:string;versao:number}):Promise<void>{if(!this.api)throw Error('Servidor indisponível.');await this.api.post('/api/gestao-financeira/'+tipo+'/'+encodeURIComponent(id)+'/editar',dados);}
 async estornar(tipo:'despesas'|'parcelas',id:string):Promise<void>{if(!this.api)throw Error('Servidor indisponível.');await this.api.post('/api/gestao-financeira/'+tipo+'/'+encodeURIComponent(id)+'/estornar');}
 async registrar(tipo:'despesas'|'parcelas', dados:Omit<LancamentoFinanceiro,'id'> & {id?:string}):Promise<void>{if(!this.api)throw Error('Servidor indisponível.');await this.api.post('/api/gestao-financeira/'+tipo,dados);}
}
