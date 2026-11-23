import { useCallback, useEffect, useRef, useState } from 'react';
import type { PerfilForms } from '../../../application/ports/porta-perfil-forms.js';
import { useContainer } from '../../providers/container-provider.js';
import { Alert } from '../../components/ui/alert.js';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { mensagemDeErro } from '../../lib/erros.js';

const ROTULOS:Record<string,string>={nomeCompleto:'Nome completo',dataNascimento:'Data de nascimento',estadoCivil:'Estado civil',endereco:'Endereço',email:'E-mail',celular:'Celular'};
export function PerfilDoForms({pacienteId,aoAtualizar}:{pacienteId:string;aoAtualizar:()=>void}){
  const api=useContainer().perfilForms;
  const [perfil,setPerfil]=useState<PerfilForms|null>(null);
  const [foto,setFoto]=useState<string|null>(null);
  const [conferiu,setConferiu]=useState(false),[processando,setProcessando]=useState(false),[erro,setErro]=useState<string|null>(null);
  const url=useRef<string|null>(null),chaveFoto=useRef(''),geracao=useRef(0);
  const carregar=useCallback(async()=>{
    if(!api)return;
    const g=geracao.current;
    try{
      const p=await api.obter(pacienteId);if(!p||g!==geracao.current)return;setPerfil(p);
      const chave=p.foto.disponivel?`${pacienteId}:${p.foto.atualizadaEm}`:'';
      if(chave!==chaveFoto.current){
        const blob=chave?await api.foto(pacienteId):null;
        if(g!==geracao.current)return;
        if(url.current)URL.revokeObjectURL(url.current);
        url.current=blob?URL.createObjectURL(blob):null;chaveFoto.current=chave;setFoto(url.current);
      }
    }catch(e){if(g===geracao.current)setErro(mensagemDeErro(e,'Não foi possível carregar a foto e as atualizações.'));}
  },[api,pacienteId]);
  useEffect(()=>{const g=++geracao.current;void carregar();const timer=setInterval(()=>void carregar(),20000);return()=>{geracao.current=g+1;clearInterval(timer);if(url.current)URL.revokeObjectURL(url.current);url.current=null;chaveFoto.current='';};},[carregar]);
  useEffect(()=>setConferiu(false),[perfil?.revisao?.id]);
  async function decidir(aplicar:boolean){
    if(!api||!perfil?.revisao)return;setProcessando(true);setErro(null);
    try{await api.decidir(pacienteId,perfil.revisao.id,aplicar,conferiu);await carregar();aoAtualizar();}
    catch(e){setErro(mensagemDeErro(e,'Não foi possível concluir a revisão. Tente novamente.'));}finally{setProcessando(false);}
  }
  if(!api)return null;
  return <Card className="flex flex-col gap-4">
    <div className="flex items-center gap-4">
      {foto?<img src={foto} alt="Foto de identificação do paciente" className="h-24 w-24 shrink-0 rounded-full border border-neutral-200 object-cover"/>:<div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-center text-xs text-neutral-500">Sem foto</div>}
      <div><h2 className="font-semibold">Foto e atualização do cadastro</h2><p className="text-sm text-neutral-500">Foto opcional enviada pelo Google Forms. Dados novos de quem já tem cadastro passam por conferência da clínica.</p></div>
    </div>
    {perfil?.foto.status==='AGUARDANDO'&&<p className="text-sm text-neutral-500">Foto aguardando importação.</p>}
    {perfil?.foto.erro&&<Alert tone="warning" title="Foto ainda não importada">O cadastro está salvo. A foto será tentada novamente; confira o acesso à pasta do Google e se a imagem é JPEG, PNG ou WebP. Código: {perfil.foto.erro}</Alert>}
    {erro&&<Alert tone="danger">{erro}</Alert>}
    {perfil?.revisao&&<Alert tone="warning" title="Atualização de cadastro recebida pelo Forms">
      <div className="flex flex-col gap-3">
        <p>Confira a identidade do paciente e os dados enviados antes de aplicar. CPF e RG permanecem protegidos.</p>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">{Object.entries(perfil.revisao.candidato).map(([campo,valor])=><div key={campo}><dt className="text-xs font-medium">{ROTULOS[campo]??campo}</dt><dd className="break-words text-sm">{valor}</dd></div>)}</dl>
        {perfil.revisao.temFoto&&<p className="text-sm">Também foi enviada uma nova foto para a ficha.</p>}
        {'celular' in perfil.revisao.candidato&&<p className="text-sm">Ao trocar o celular, as autorizações de mensagens devem ser confirmadas para o novo número.</p>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={conferiu} onChange={e=>setConferiu(e.target.checked)}/>Conferi a identidade do paciente e as informações desta solicitação.</label>
        <div className="flex flex-wrap gap-2"><Button disabled={!conferiu||processando} loading={processando} onClick={()=>void decidir(true)}>Aplicar atualização</Button><Button variant="secondary" disabled={processando} onClick={()=>void decidir(false)}>Manter cadastro atual</Button></div>
      </div>
    </Alert>}
  </Card>;
}
