import type { SalvarAnamneseInput } from '../../domain/entities/anamnese.js';
import type { ApiClient } from '../ports/api-client.js';
export const VERSAO_INTERFACE='1.3.1';
export interface Espera {id:string;pacienteId:string;nomePaciente:string;pacienteDisponivel:boolean;preferencia:string;observacao:string;status:'AGUARDANDO'|'CONTATADO'|'RESOLVIDO'|'CANCELADO';versao:number;criadoEm:string}
export interface Material {id:string;nome:string;unidade:string;lote:string;validade:string|null;minimo:number;quantidade:number;arquivado:boolean}
export interface MovimentoMaterial {id:string;materialId:string;tipo:'ENTRADA'|'SAIDA';quantidade:number;motivo:string;criadoEm:string}
export interface Correcao {id:string;pacienteId:string;motivo:string;criadoEm:string;responsavel:string;antes:Record<string,string|null>;depois:Record<string,string|null>}
export interface RelatoProblema {id:string;descricao:string;pagina:string;versaoAplicativo:string;criadoEm:string;status:string}
export interface AnamneseRecebida {recebidaEm:string;atualizadaEm:string|null;pendente:boolean;dados:SalvarAnamneseInput}
export class OperacaoClinica {
 constructor(private readonly api:ApiClient|null){}
 get disponivel(){return Boolean(this.api);}
 private exigir(){if(!this.api)throw Error('Inicie o servidor da clínica para usar esta área.');return this.api;}
 async anamneseRecebida(id:string){return await this.exigir().get<AnamneseRecebida>(`/api/pacientes/${encodeURIComponent(id)}/anamnese-recebida`)??null;}
 aplicarAnamneseRecebida(id:string,r:AnamneseRecebida){return this.exigir().post(`/api/pacientes/${encodeURIComponent(id)}/anamnese-recebida/aplicar`,{recebidaEm:r.recebidaEm,atualizadaEm:r.atualizadaEm});}
 async espera(){return await this.exigir().get<Espera[]>('/api/operacao/espera')??[];}
 async materiais(){return await this.exigir().get<{materiais:Material[];movimentos:MovimentoMaterial[]}>('/api/operacao/materiais')??{materiais:[],movimentos:[]};}
 async correcoes(id:string){return await this.exigir().get<Correcao[]>(`/api/operacao/correcoes/${encodeURIComponent(id)}`)??[];}
 async relatos(){return await this.exigir().get<RelatoProblema[]>('/api/operacao/relatos')??[];}
 acao(acao:'espera'|'espera-status'|'material'|'movimento'|'material-arquivar'|'correcao'|'relato',dados:Record<string,unknown>){return this.exigir().post<{ok:boolean;id:string;repetida?:boolean}>(`/api/operacao/${acao}`,dados);}
}
