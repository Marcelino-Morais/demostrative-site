export const CAMPOS_CORRECAO:string[];
export function estadoOperacaoVazio():Record<string,any>;
export function consultarOperacao(dados:Record<string,any>,recurso:string,pacienteId?:string):any;
export function aplicarOperacao(dados:Record<string,any>,acao:string,corpo:Record<string,any>,agora:string,assinatura:string):{ok:boolean;id:string;repetida?:boolean};
export function validarEstadoOperacao(estado:unknown):{ok:boolean;erros:string[]};
