import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useContainer } from '../../providers/container-provider.js';
import { useSincronizacao } from '../../providers/sincronizacao-provider.js';
import { useLeituraPeriodica } from '../../lib/use-leitura-periodica.js';
import { avaliarIntegracoes } from './avaliar-integracoes.js';

function MonitorIntegracoes(){
 const container=useContainer();const {diagnostico}=useSincronizacao();
 const ler=useCallback(async()=>{const [forms,calendar,whatsapp]=await Promise.allSettled([container.googleSheetsSync.obterStatus.executar(),container.googleCalendar.obterStatus(),container.whatsappAutomatico.obterStatus.executar()]);return avaliarIntegracoes(forms,calendar,whatsapp);},[container]);
 const leitura=useLeituraPeriodica(ler);
 if(diagnostico?.modo==='offline'||diagnostico?.modo==='degradado')return null; // a faixa de conexão já explica a falha principal
 const avisos=leitura.dados;
 if(!avisos?.length&&!leitura.erro)return null;
 return <details data-tour="avisos-integracoes" className="no-print m-4 rounded-xl border border-warning-200 bg-warning-50 p-4 text-warning-900 dark:border-warning-800 dark:bg-warning-900/20 dark:text-warning-200">
  <summary className="cursor-pointer text-sm font-semibold"><AlertTriangle className="mr-2 inline h-4 w-4" aria-hidden="true"/>{leitura.erro?'Não foi possível atualizar os avisos de integração':`${avisos?.length??0} integração(ões) precisa(m) de atenção`} · Ver orientações</summary>
  {leitura.erro&&<p className="mt-3 text-sm">Os avisos anteriores podem estar desatualizados. Confira a conexão.</p>}
  <ul className="mt-3 grid gap-3 md:grid-cols-3">{avisos?.map(a=><li key={a.id}><p className="text-sm font-semibold">{a.titulo}</p><p className="mt-1 text-xs leading-relaxed">{a.orientacao}</p><Link className="mt-2 inline-block text-sm font-medium underline" to={a.destino}>Conferir {a.id==='forms'?'formulários':a.id==='calendar'?'Google Agenda':'mensagens'}</Link></li>)}</ul>
  <p className="mt-3 text-xs">{leitura.atualizadoEm?`Última verificação: ${leitura.atualizadoEm.toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})}. `:''}Enviada não significa entregue ao paciente.</p>
 </details>;
}
export function AvisosIntegracoes(){const container=useContainer();if(!container.sincronizacaoNucleo||import.meta.env.VITE_DEMONSTRACAO==='on')return null;return <MonitorIntegracoes/>;}
