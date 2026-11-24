/* Regras compartilhadas com o servidor; o simulador aceita apenas dados fictícios em memória. */
export function editarLancamentoFinanceiro(dados:any,colecao:string,id:string,corpo:any,em:string):{ok?:boolean;erro?:string;mensagem?:string;status?:number};
export function parcelasComSaldo(parcelas:any[],planos:any[]):any[];
export function valorDaParcelaEditavel(parcela:any,planos:any[],parcelas:any[]):boolean;
