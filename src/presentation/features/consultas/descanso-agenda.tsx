import { useEffect, useId, useState } from 'react';
import { useContainer } from '../../providers/container-provider.js';
import { useRegistrarEdicaoPendente } from '../../providers/edicao-pendente-provider.js';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Field } from '../../components/ui/field.js';
import { Alert } from '../../components/ui/alert.js';

export function DescansoAgenda() {
 const container = useContainer();
 const [horario,setHorario] = useState({ ativo:true,inicio:'12:00',fim:'13:30' });
 const [funcionamento,setFuncionamento] = useState({ inicio:'09:00',fim:'17:00' });
 const [pausa,setPausa] = useState('10');
 const [inicial,setInicial] = useState('');
 const [carregado,setCarregado] = useState(false);
 const [tentativa,setTentativa] = useState(0);
 const [salvando,setSalvando] = useState(false);
 const [mensagem,setMensagem] = useState(''); const [erro,setErro] = useState('');
 const atual = JSON.stringify({ funcionamento, descanso:horario, pausaPosConsultaMinutos:pausa });
 useRegistrarEdicaoPendente(useId(),carregado && (atual !== inicial || salvando));
 useEffect(()=>{
  let ativo=true;setErro('');setCarregado(false);
  container.configuracaoClinica.obter.executar().then(config=>{
   if(!ativo)return;
   const descanso=config.descanso ?? {ativo:true,inicio:'12:00',fim:'13:30'};
   const abertura=config.funcionamento ?? {inicio:'09:00',fim:'17:00'};
   setHorario(descanso);setFuncionamento(abertura);setPausa(String(config.pausaPosConsultaMinutos??10));setInicial(JSON.stringify({funcionamento:abertura,descanso,pausaPosConsultaMinutos:String(config.pausaPosConsultaMinutos??10)}));setCarregado(true);
  }).catch(()=>{if(ativo)setErro('Não foi possível carregar os horários. Tente novamente antes de editar.');});
  return ()=>{ativo=false;};
 },[container,tentativa]);
 async function salvar(){
  setSalvando(true);setErro('');setMensagem('');
  try{
   if(!pausa.trim()||!Number.isInteger(Number(pausa))||Number(pausa)<0||Number(pausa)>180)throw new Error('Informe a pausa após consulta de 0 a 180 minutos inteiros.');
   const config=await container.configuracaoClinica.obter.executar();
   await container.configuracaoClinica.salvar.executar({...config,funcionamento,descanso:horario,pausaPosConsultaMinutos:Number(pausa)});
   setInicial(atual);setMensagem('Horários salvos. Novos agendamentos e encaixes usam esse período. Consultas existentes foram mantidas; revise as que ficarem fora dos novos horários.');
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível salvar os horários.');}
  finally{setSalvando(false);}
 }
 const desabilitado=!carregado||salvando;
 return <Card className="flex flex-col gap-4">
  <h2 id="descanso-diario" className="scroll-mt-20 text-sm font-semibold">Funcionamento e descanso</h2>
  <p className="text-sm text-neutral-600">Defina quando a clínica abre e fecha. Toda a duração do atendimento precisa caber nesse período, fora do descanso.</p>
  <fieldset disabled={desabilitado} className="flex flex-col gap-3"><legend className="mb-2 text-sm font-semibold">Horário de funcionamento</legend>
   <div className="grid gap-3 sm:grid-cols-2">
    <Field label="Abertura"><Input type="time" value={funcionamento.inicio} onChange={e=>setFuncionamento({...funcionamento,inicio:e.target.value})}/></Field>
    <Field label="Fechamento"><Input type="time" value={funcionamento.fim} onChange={e=>setFuncionamento({...funcionamento,fim:e.target.value})}/></Field>
   </div>
   <p className="text-xs text-neutral-500">Abertura e fechamento devem ser no mesmo dia. Feriados e dias bloqueados continuam sendo configurados na Agenda.</p>
  </fieldset>
  <fieldset disabled={desabilitado} className="flex flex-col gap-3 border-t border-neutral-200 pt-4"><legend className="mb-2 text-sm font-semibold">Descanso diário</legend>
   <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={horario.ativo} onChange={e=>setHorario({...horario,ativo:e.target.checked})}/>Reservar este intervalo todos os dias</label>
   <div className="grid gap-3 sm:grid-cols-2">
    <Field label="Início do descanso"><Input type="time" disabled={!horario.ativo} value={horario.inicio} onChange={e=>setHorario({...horario,inicio:e.target.value})}/></Field>
    <Field label="Fim do descanso"><Input type="time" disabled={!horario.ativo} value={horario.fim} onChange={e=>setHorario({...horario,fim:e.target.value})}/></Field>
   </div>
   <p className="text-xs text-neutral-500">O intervalo ativo deve ficar dentro do horário de funcionamento.</p>
  </fieldset>
  <fieldset disabled={desabilitado} data-tour="pausa-pos-consulta" className="flex flex-col gap-3 border-t border-neutral-200 pt-4"><legend className="mb-2 text-sm font-semibold">Pausa após cada consulta</legend>
   <Field label="Tempo entre consultas (minutos)"><Input type="number" inputMode="numeric" min="0" max="180" step="1" required value={pausa} onChange={e=>setPausa(e.target.value)} placeholder="Ex.: 10"/></Field>
   <p className="text-sm text-neutral-600">Reserve tempo para descansar e preparar o próximo atendimento. Exemplo: com 10 minutos de pausa, uma consulta que termina às 10:30 permite a próxima às 10:40.</p>
   <p className="text-xs text-neutral-500">0 desativa a pausa. O intervalo pode coincidir com o descanso diário. Consultas já marcadas não são movidas; novos agendamentos e reagendamentos respeitam a pausa.</p>
  </fieldset>
  {erro&&<Alert tone="danger">{erro}</Alert>}{mensagem&&<Alert tone="success">{mensagem}</Alert>}
  {!carregado&&erro&&<Button variant="secondary" className="self-start" onClick={()=>setTentativa(v=>v+1)}>Tentar carregar novamente</Button>}
  <Button className="self-start" disabled={!carregado} loading={salvando} onClick={()=>void salvar()}>Salvar horários</Button>
 </Card>;
}
