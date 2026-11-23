export interface PerfilForms {
  foto: {disponivel:boolean;status:string;erro:string|null;atualizadaEm:string|null};
  revisao: {id:string;candidato:Record<string,string>;temFoto:boolean;recebidaEm:string}|null;
  importacaoFotosConfigurada:boolean;
}
export interface PortaPerfilForms {
  obter(id:string):Promise<PerfilForms|undefined>;
  foto(id:string):Promise<Blob|undefined>;
  decidir(id:string,revisaoId:string,aplicar:boolean,identidadeConferida:boolean):Promise<void>;
}
