import type { StatusSincronizacaoGoogleSheets } from '../../../application/ports/porta-google-sheets-sync.js';
import type { StatusGoogleCalendar } from '../../../application/ports/porta-google-calendar.js';
import type { StatusFilaWhatsappAutomatica } from '../../../../whatsapp-itens/src/application/ports/porta-whatsapp-automatico.js';
export interface AvisoIntegracao { id:string; titulo:string; orientacao:string; destino:string }
export function avaliarIntegracoes(forms:PromiseSettledResult<StatusSincronizacaoGoogleSheets>,calendar:PromiseSettledResult<StatusGoogleCalendar>,whatsapp:PromiseSettledResult<StatusFilaWhatsappAutomatica>,agora=Date.now()):AvisoIntegracao[]{
 const avisos:AvisoIntegracao[]=[];
 const add=(id:string,titulo:string,orientacao:string,destino='/configuracoes')=>avisos.push({id,titulo,orientacao,destino});
 if(forms.status==='rejected')add('forms','Não foi possível verificar os formulários','Confira a conexão e a sincronização nas configurações. Os pedidos podem estar aguardando leitura.');
 else {const s=forms.value;
  if(!s.configurado)add('forms','Formulários ainda não conectados','Confira a configuração antes de enviar os links aos pacientes.');
  else if(s.ultimoErro||Object.values(s.ultimoResultado?.porTipo??{}).some(r=>r?.erro))add('forms','A leitura dos formulários apresentou falha','Confira a sincronização nas configurações antes de cadastrar o mesmo pedido novamente.');
  else if(!s.ultimoSucessoEm)add('forms','A primeira leitura dos formulários ainda não foi confirmada','Confira a sincronização nas configurações.');
  else {const sucesso=Date.parse(s.ultimoSucessoEm);const limite=Math.max(90_000,Number.isFinite(s.intervaloMs)?s.intervaloMs*3:90_000);
   if(!Number.isFinite(sucesso)||agora-sucesso>limite)add('forms','A leitura dos formulários está atrasada','Confira se o servidor está ligado e veja a última leitura nas configurações.');
   else if((s.ultimoResultado?.pendentes??0)>0)add('forms','Há respostas do Forms aguardando revisão','Confira as respostas pendentes nas configurações. Uma leitura concluída não significa que todas foram importadas.');
  }
 }
 if(calendar.status==='rejected')add('calendar','Não foi possível verificar o Google Agenda','Abra as configurações para conferir a sincronização.');
 else if(!calendar.value.configurado)add('calendar','Google Agenda ainda não conectado','As consultas continuam no sistema. A cópia no Google depende de configurar a integração.');
 else if(calendar.value.ultimoErro||calendar.value.erroConfiguracao)add('calendar','O Google Agenda apresentou falha','Confira a conexão e as permissões nas configurações.');
 else if(calendar.value.conflitos>0)add('calendar','Há diferenças para conferir no Google Agenda','Abra as configurações e revise os conflitos antes de alterar os horários.');
 if(whatsapp.status==='rejected')add('whatsapp','Não foi possível verificar as mensagens','Abra a fila para conferir os avisos antes de contar com o envio.','/configuracoes/whatsapp-automatico');
 else if(!whatsapp.value.provedorConfigurado)add('whatsapp','Envio automático de mensagens não configurado','Confira o WhatsApp nas configurações. Nenhum envio deve ser presumido.','/configuracoes/whatsapp-automatico');
 else if((whatsapp.value.porStatus.FALHA??0)+(whatsapp.value.porStatus.BLOQUEADA??0)>0)add('whatsapp','Há mensagens com falha ou bloqueio','Confira os motivos na fila. Não reenvie manualmente sem verificar se houve entrega.','/configuracoes/whatsapp-automatico');
 return avisos;
}
