import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AtendimentoParaEncerrar, DecisaoEncerramento } from '../../application/ports/porta-encerramentos-consultas.js';
import { ErroApi } from '../../application/ports/api-client.js';
import { useContainer } from './container-provider.js';
import { useExisteEdicaoPendente } from './edicao-pendente-provider.js';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog.js';
import { Button } from '../components/ui/button.js';
import { Alert } from '../components/ui/alert.js';
import { DialogEncerrarAtendimento } from '../features/consultas/dialog-encerrar-atendimento.js';
import { formatarDataIso } from '../lib/formatadores.js';

const Contexto=createContext<{pendentes:AtendimentoParaEncerrar[];erro:string|null;abrir:(id?:string)=>Promise<void>;versao:number;verificado:boolean}|null>(null);
const chave=(i:AtendimentoParaEncerrar)=>`${i.consulta.id}:${i.consulta.atualizadoEm}`;
function vistos():string[]{try{const v:unknown=JSON.parse(localStorage.getItem('pf-encerramentos-vistos')??'[]');return Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'):[];}catch{return [];}}
export function EncerramentosConsultasProvider({children}:{children:ReactNode}){
  const api=useContainer().encerramentosConsultas;
  const edicao=useExisteEdicaoPendente();
  const [pendentes,setPendentes]=useState<AtendimentoParaEncerrar[]>([]),[erro,setErro]=useState<string|null>(null);
  const [verificado,setVerificado]=useState(false);
  const [aberta,setAberta]=useState(false),[selecionada,setSelecionada]=useState<AtendimentoParaEncerrar|null>(null),[versao,setVersao]=useState(0);
  const assinatura=useRef(''),emVoo=useRef(false),geracao=useRef(0),liberar=useRef<(()=>void)|null>(null);
  const listaRef=useRef(pendentes);listaRef.current=pendentes;
  const buscar=useCallback(async()=>{
    if(!api||emVoo.current)return;emVoo.current=true;const g=geracao.current;
    try{const lista=await api.listar();if(g!==geracao.current)return;
      setPendentes(lista);setVerificado(true);setErro(null);const s=JSON.stringify(lista);if(s!==assinatura.current){assinatura.current=s;setVersao(v=>v+1);}
    }catch(e){if(g===geracao.current){if(e instanceof ErroApi&&e.status===401){setPendentes([]);setAberta(false);setSelecionada(null);liberar.current?.();liberar.current=null;}setErro('Não foi possível verificar atendimentos aguardando conferência.');}}
    finally{if(g===geracao.current)emVoo.current=false;}
  },[api]);
  useEffect(()=>{const g=++geracao.current;void buscar();const t=setInterval(()=>void buscar(),20000);const foco=()=>void buscar();window.addEventListener('focus',foco);window.addEventListener('online',foco);return()=>{geracao.current=g+1;emVoo.current=false;clearInterval(t);window.removeEventListener('focus',foco);window.removeEventListener('online',foco);liberar.current?.();};},[buscar]);
  function fechar(){
    try{localStorage.setItem('pf-encerramentos-vistos',JSON.stringify([...new Set([...vistos(),...listaRef.current.map(chave)])].slice(-500)));}catch{/* aviso permanece no painel */}
    setAberta(false);setSelecionada(null);liberar.current?.();liberar.current=null;
  }
  useEffect(()=>{
    if(!api||aberta||selecionada)return;
    let cancelado=false,tentando=false;
    const tentar=()=>{
      if(cancelado||tentando||edicao||document.visibilityState==='hidden'||document.querySelector('[role="dialog"], [role="alertdialog"]'))return;
      if(!listaRef.current.some(i=>!vistos().includes(chave(i))))return;
      const mostrar=async()=>{
        if(cancelado||document.querySelector('[role="dialog"], [role="alertdialog"]')||!listaRef.current.some(i=>!vistos().includes(chave(i))))return;
        setAberta(true);await new Promise<void>(resolve=>{liberar.current=resolve;});
      };
      tentando=true;
      if(navigator.locks)void navigator.locks.request('pf-janela-encerramentos',{ifAvailable:true},async lock=>{if(lock)await mostrar();}).catch(()=>{if(!cancelado)void mostrar();}).finally(()=>{tentando=false;});
      else void mostrar().finally(()=>{tentando=false;});
    };
    tentar();const timer=setInterval(tentar,2000);return()=>{cancelado=true;clearInterval(timer);};
  },[api,aberta,selecionada,edicao,pendentes]);
  async function abrir(id?:string){
    if(!api)return;
    try{if(id){const i=await api.obter(id);if(i)setSelecionada(i);}else{await buscar();setAberta(true);}}
    catch{setErro('Não foi possível abrir a conferência do atendimento.');}
  }
  async function decidir(d:DecisaoEncerramento){
    if(!api||!selecionada)return;
    await api.decidir(selecionada.consulta.id,d);
    setSelecionada(null);await buscar();setVersao(v=>v+1);
    if(!aberta){liberar.current?.();liberar.current=null;}
  }
  return <Contexto.Provider value={{pendentes,erro,abrir,versao,verificado}}>{children}
    <Dialog open={aberta&&!selecionada} onOpenChange={v=>{if(!v)fechar();}}><DialogContent>
      <DialogTitle className="text-lg font-semibold">Conferir atendimentos</DialogTitle>
      <DialogDescription className="mt-2">Confirme se houve atendimento e confira o valor. Nenhuma consulta é marcada como realizada apenas pelo horário.</DialogDescription>
      <div className="mt-4 flex flex-col gap-3">{pendentes.length===0?<p>Todas as conferências foram concluídas.</p>:pendentes.map(i=><div key={i.consulta.id} className="rounded-lg border border-neutral-200 p-3"><p className="font-medium">{i.nomePaciente}</p><p className="mb-2 text-sm">{formatarDataIso(i.consulta.data)} às {i.consulta.horario} · {i.consulta.status==='REALIZADA'?'Realizada — conferir financeiro':'Resultado ainda não informado'}</p><Button variant="secondary" onClick={()=>setSelecionada(i)}>Conferir atendimento</Button></div>)}
      {erro&&<Alert tone="danger">{erro}</Alert>}<Button variant="secondary" onClick={fechar}>Ver depois</Button></div>
    </DialogContent></Dialog>
    {selecionada&&<DialogEncerrarAtendimento key={selecionada.consulta.id} item={selecionada} onFechar={()=>{setSelecionada(null);if(!aberta){liberar.current?.();liberar.current=null;}}} onDecidir={decidir}/>}
  </Contexto.Provider>;
}
export function useEncerramentosConsultas(){return useContext(Contexto);}
export function AvisoEncerramentosConsultas(){
  const ctx=useEncerramentosConsultas();if(!ctx)return null;
  if(ctx.erro)return <div className="m-4 no-print"><Alert tone="warning">{ctx.erro}</Alert></div>;
  if(!ctx.pendentes.length)return null;
  return <div className="m-4 no-print"><Alert tone="warning" title={`${ctx.pendentes.length} atendimento(s) aguardando conferência`}><p className="mb-2">Confira a realização e o valor para manter o financeiro atualizado.</p><Button variant="secondary" onClick={()=>void ctx.abrir()}>Conferir atendimentos</Button></Alert></div>;
}
