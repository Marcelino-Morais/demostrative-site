import { useState } from 'react';
import type { AtendimentoParaEncerrar, DecisaoEncerramento } from '../../../application/ports/porta-encerramentos-consultas.js';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog.js';
import { Input, Select } from '../../components/ui/input.js';
import { Button } from '../../components/ui/button.js';
import { Alert } from '../../components/ui/alert.js';
import { centavosParaReaisTexto, formatarDataIso } from '../../lib/formatadores.js';
import { mensagemDeErro } from '../../lib/erros.js';

export function DialogEncerrarAtendimento({item,onFechar,onDecidir}:{item:AtendimentoParaEncerrar;onFechar:()=>void;onDecidir:(d:DecisaoEncerramento)=>Promise<void>}){
  const c=item.consulta;
  const [status,setStatus]=useState<DecisaoEncerramento['status']>('REALIZADA');
  const [modo,setModo]=useState<'NOVO'|'EXISTENTE'>('NOVO');
  const [planoId,setPlanoId]=useState('');
  const [valor,setValor]=useState(c.orcamento?.valorCentavos != null ? (c.orcamento.valorCentavos/100).toFixed(2).replace('.',',') : '');
  const [erro,setErro]=useState<string|null>(null),[ocupado,setOcupado]=useState(false);
  const centavos=/^\d+(?:[,.]\d{1,2})?$/.test(valor.trim()) ? Math.round(Number(valor.replace(',','.'))*100) : null;
  async function salvar(){
    if(status==='REALIZADA'&&modo==='NOVO'&&(centavos==null||!Number.isSafeInteger(centavos)||centavos>100000000)){setErro('Informe o valor do procedimento. Use 0 para atendimento sem cobrança.');return;}
    if(status==='REALIZADA'&&modo==='EXISTENTE'&&!planoId){setErro('Escolha o plano que já inclui este atendimento.');return;}
    setOcupado(true);setErro(null);
    try{await onDecidir({status,modoFinanceiro:modo,valorCentavos:centavos,planoId,atualizadoEm:c.atualizadoEm});}
    catch(e){setErro(mensagemDeErro(e,'Não foi possível encerrar. Recarregue para conferir se a consulta foi alterada.'));}
    finally{setOcupado(false);}
  }
  return <Dialog open onOpenChange={aberta=>{if(!aberta&&!ocupado)onFechar();}}><DialogContent>
    <DialogTitle className="text-lg font-semibold">Conferir atendimento</DialogTitle>
    <DialogDescription className="mt-2 text-sm">{item.nomePaciente} · {formatarDataIso(c.data)} às {c.horario}. O horário terminar não confirma que houve atendimento.</DialogDescription>
    <div className="mt-4 flex flex-col gap-4">
      {item.financeiroIndisponivel&&<Alert tone="danger">O plano vinculado não foi encontrado. Confira o prontuário ou restaure a cópia de segurança. Outra cobrança não será criada automaticamente.</Alert>}
      {c.status==='REALIZADA'?<p className="text-sm">Esta consulta já foi marcada como realizada. Falta conferir o registro financeiro.</p>:<label className="text-sm">O que aconteceu?<Select aria-label="Resultado do atendimento" value={status} onChange={e=>setStatus(e.target.value as typeof status)}><option value="REALIZADA">Atendimento realizado</option><option value="FALTOU">Paciente faltou</option><option value="CANCELADA">Atendimento cancelado</option></Select></label>}
      {status==='REALIZADA'&&<>
        <label className="text-sm">Registro financeiro<Select aria-label="Registro financeiro" value={modo} onChange={e=>setModo(e.target.value as typeof modo)}><option value="NOVO">Registrar valor deste atendimento</option>{item.planos.length>0&&<option value="EXISTENTE">Já está incluído em um plano</option>}</Select></label>
        {modo==='NOVO'?<>
          <p className="text-sm text-neutral-500">{c.orcamento?.descricao || c.motivo || 'Procedimento a conferir'}</p>
          <label className="text-sm">Valor do procedimento (R$)<Input aria-label="Valor do procedimento (R$)" inputMode="decimal" value={valor} onChange={e=>setValor(e.target.value)} placeholder="Informe o valor; 0 se não houver cobrança"/></label>
          {c.ehEmergencia&&<p className="text-sm">Taxa de emergência: acrescida uma única vez, conforme o valor deste atendimento.</p>}
          {centavos!=null&&<p className="font-medium">Valor a registrar: {centavosParaReaisTexto(centavos+(c.ehEmergencia?(c.taxaEmergenciaCentavos??15000):0))}</p>}
          <Alert>O valor entra em Planejado e Em aberto. Recebido só muda quando você registrar o pagamento no plano de tratamento.</Alert>
        </>:<label className="text-sm">Plano que já inclui o atendimento<Select aria-label="Plano existente" value={planoId} onChange={e=>setPlanoId(e.target.value)}><option value="">Selecione o plano</option>{item.planos.map(p=><option key={p.id} value={p.id}>{p.descricao}</option>)}</Select><span className="text-xs text-neutral-500">Não cria outro valor nem altera pagamentos desse plano.</span></label>}
      </>}
      {erro&&<Alert tone="danger">{erro}</Alert>}
      <div className="flex flex-wrap gap-2"><Button loading={ocupado} disabled={ocupado||item.financeiroIndisponivel} onClick={()=>void salvar()}>{status==='REALIZADA'?'Confirmar realização e financeiro':'Confirmar resultado'}</Button><Button variant="secondary" disabled={ocupado} onClick={onFechar}>Voltar</Button></div>
    </div>
  </DialogContent></Dialog>;
}
