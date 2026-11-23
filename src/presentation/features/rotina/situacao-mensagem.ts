import type { MensagemWhatsappAutomatica } from '../../../../whatsapp-itens/src/application/ports/porta-whatsapp-automatico.js';
export type GrupoMensagem='PROGRAMADA'|'PENDENTE'|'ENVIADA'|'ENTREGUE'|'FALHA'|'BLOQUEADA';
export function situacaoMensagem(m:MensagemWhatsappAutomatica,agora=Date.now()):{grupo:GrupoMensagem;rotulo:string}{
 if(m.statusEntregaProvedor==='failed')return {grupo:'FALHA',rotulo:'Falha de entrega informada pelo provedor'};
 if(m.statusEntregaProvedor==='read')return {grupo:'ENTREGUE',rotulo:'Leitura confirmada pelo provedor'};
 if(m.statusEntregaProvedor==='delivered')return {grupo:'ENTREGUE',rotulo:'Entrega confirmada pelo provedor'};
 if(m.status==='BLOQUEADA')return {grupo:'BLOQUEADA',rotulo:'Envio bloqueado — confira o motivo na fila'};
 if(m.status==='FALHA')return {grupo:'FALHA',rotulo:m.proximaTentativaEm?'Falha de envio — nova tentativa programada':'Falha de envio — precisa de conferência'};
 if(m.status==='ENVIADA'||m.statusEntregaProvedor==='sent')return {grupo:'ENVIADA',rotulo:'Enviada — entrega ainda não confirmada'};
 if(m.status==='AGUARDANDO_PROVEDOR')return {grupo:'PENDENTE',rotulo:'Aguardando confirmação do envio pelo provedor'};
 if(!Number.isFinite(Date.parse(m.agendadaPara)))return {grupo:'PENDENTE',rotulo:'Horário de envio não informado — confira a fila'};
 return Date.parse(m.agendadaPara)>agora?{grupo:'PROGRAMADA',rotulo:'Programada para envio'}:{grupo:'PENDENTE',rotulo:'Pendente — o horário previsto já passou'};
}
