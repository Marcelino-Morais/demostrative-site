import type { ApiClient } from '../../application/ports/api-client.js';
import type { PerfilForms, PortaPerfilForms } from '../../application/ports/porta-perfil-forms.js';
export class HttpPerfilForms implements PortaPerfilForms {
  constructor(private readonly api:ApiClient){}
  obter(id:string){return this.api.get<PerfilForms>(`/api/pacientes/${encodeURIComponent(id)}/perfil-forms`);}
  foto(id:string){return this.api.getBlob(`/api/pacientes/${encodeURIComponent(id)}/foto-perfil`);}
  async decidir(id:string,revisaoId:string,aplicar:boolean,identidadeConferida:boolean){
    await this.api.post(`/api/pacientes/${encodeURIComponent(id)}/perfil-forms/${aplicar?'aplicar':'manter'}`,{revisaoId,identidadeConferida});
  }
}
