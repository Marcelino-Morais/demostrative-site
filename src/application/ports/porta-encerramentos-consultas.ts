import type { ConsultaProps } from '../../domain/entities/consulta.js';
export interface AtendimentoParaEncerrar {
  consulta: ConsultaProps;
  nomePaciente: string;
  financeiroIndisponivel?: boolean;
  planos: {id:string;descricao:string}[];
}
export interface DecisaoEncerramento {
  atualizadoEm:string;
  status:'REALIZADA'|'FALTOU'|'CANCELADA';
  modoFinanceiro:'NOVO'|'EXISTENTE';
  valorCentavos:number|null;
  planoId:string;
}
export interface PortaEncerramentosConsultas {
  listar():Promise<AtendimentoParaEncerrar[]>;
  obter(id:string):Promise<AtendimentoParaEncerrar|undefined>;
  decidir(id:string,corpo:DecisaoEncerramento):Promise<void>;
}
