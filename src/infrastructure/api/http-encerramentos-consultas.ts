import type { ApiClient } from '../../application/ports/api-client.js';
import { ErroApi } from '../../application/ports/api-client.js';
import type { AtendimentoParaEncerrar, DecisaoEncerramento, PortaEncerramentosConsultas } from '../../application/ports/porta-encerramentos-consultas.js';
export class HttpEncerramentosConsultas implements PortaEncerramentosConsultas {
  constructor(private readonly api:ApiClient){}
  async listar(){return await this.api.get<AtendimentoParaEncerrar[]>('/api/encerramentos-consultas') ?? [];}
  obter(id:string){return this.api.get<AtendimentoParaEncerrar>(`/api/consultas/${encodeURIComponent(id)}/encerramento`);}
  async decidir(id:string,corpo:DecisaoEncerramento){
    try{await this.api.post(`/api/consultas/${encodeURIComponent(id)}/encerramento`,corpo);}
    catch(e){if(e instanceof ErroApi&&e.status===409)throw new ErroApi('A consulta mudou ou a sincronização está em andamento. Volte, confira a consulta novamente e tente concluir.',409,e.codigo);throw e;}
  }
}
