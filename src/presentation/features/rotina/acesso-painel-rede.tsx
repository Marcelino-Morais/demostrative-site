import { useRef,useState } from 'react';
import { Copy,ExternalLink,MonitorSmartphone } from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button,buttonClassName } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { useSincronizacao } from '../../providers/sincronizacao-provider.js';
import { linkPainelNaRede } from './link-painel-rede.js';
export function AcessoPainelNaRede(){
 const {diagnostico}=useSincronizacao();const [aviso,setAviso]=useState('');const campo=useRef<HTMLInputElement>(null);
 const link=linkPainelNaRede(window.location.origin,diagnostico?.saude?.enderecoLan,diagnostico?.saude?.portaHttp);
 async function copiar(){if(!link)return;try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(link);setAviso('Link copiado.');}catch{campo.current?.focus();campo.current?.select();setAviso('O navegador não permitiu copiar automaticamente. O endereço está selecionado: copie e envie para o outro dispositivo.');}}
 return <Card data-tour="acesso-painel-rede" className="flex flex-col gap-3"><div className="flex items-center gap-2"><MonitorSmartphone className="h-5 w-5 text-brand-700 dark:text-brand-300" aria-hidden="true"/><h2 className="font-semibold">Abrir o painel em outro dispositivo</h2></div><p className="text-sm text-neutral-600">Conecte o celular, tablet ou computador à mesma rede da clínica. Abra este endereço e entre com a senha da clínica. O computador principal precisa continuar ligado e com o servidor funcionando.</p>{link?<><div className="flex flex-col gap-2 sm:flex-row"><Input ref={campo} readOnly value={link} onFocus={e=>e.currentTarget.select()} aria-label="Endereço do painel na rede" className="min-w-0 text-sm"/><Button variant="secondary" onClick={()=>void copiar()} className="shrink-0"><Copy className="h-4 w-4" aria-hidden="true"/> Copiar link do painel</Button><a href={link} target="_blank" rel="noreferrer" className={buttonClassName('secondary','shrink-0')}><ExternalLink className="h-4 w-4" aria-hidden="true"/> Abrir painel</a></div><p className="text-xs text-neutral-500">Acesso da equipe. Não envie aos pacientes nem publique este endereço. Ele pode mudar se a rede mudar; confira aqui novamente.</p></>:<p className="text-sm text-neutral-500">O endereço da rede ainda não está disponível. Confira a conexão e se o servidor está ligado. Um endereço localhost não funciona em outro aparelho.</p>}{aviso&&<p role="status" className="text-sm text-neutral-600">{aviso}</p>}</Card>;
}
