import { EditarLancamentoFinanceiro } from './editar-lancamento-financeiro.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ResumoGestaoFinanceira,LancamentoFinanceiro } from '../../../application/use-cases/gestao-financeira.js';
import { reaisTextoParaCentavos } from '../../../domain/value-objects/dinheiro.js';
import { hojeNaClinica } from '../../../domain/value-objects/ciclo-recebimentos.js';
import { Alert } from '../../components/ui/alert.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Input, Select } from '../../components/ui/input.js';
import { Field } from '../../components/ui/field.js';
import { baixarTexto, montarCsv } from '../../lib/csv.js';
import { centavosParaReaisTexto } from '../../lib/formatadores.js';
import { useContainer } from '../../providers/container-provider.js';

const seguroCsv = (v: string) => /^[=+\-@\t\r]/u.test(v) ? "'"+v : v;
export function FechamentoFinanceiro({ pacienteId, chaveAtualizacao }: { pacienteId?: string; chaveAtualizacao?: string }) {
 const [edicao,setEdicao]=useState<{tipo:'despesas'|'parcelas';row:LancamentoFinanceiro}|null>(null);
 const container=useContainer();const chaveRegistro=useRef(crypto.randomUUID());const [dados,setDados]=useState<ResumoGestaoFinanceira|null>(null),[erro,setErro]=useState(''),[ocupado,setOcupado]=useState(false),[confirmandoEstorno,setConfirmandoEstorno]=useState('');
 const [mes,setMes]=useState(()=>{const d=new Date(hojeNaClinica()+'T12:00:00');if(d.getDate()<5)d.setMonth(d.getMonth()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;});
 const [tipo,setTipo]=useState<'despesas'|'parcelas'>(pacienteId?'parcelas':'despesas'),[data,setData]=useState(hojeNaClinica()),[descricao,setDescricao]=useState(''),[valor,setValor]=useState(''),[planoId,setPlanoId]=useState('');
 const carregar=useCallback(async()=>{try{setDados(await container.gestaoFinanceira.listar());setErro('');}catch(e){setErro(e instanceof Error?e.message:'Não foi possível carregar os lançamentos.');}},[container]);
 useEffect(()=>{void carregar();const foco=()=>void carregar();window.addEventListener('focus',foco);return()=>window.removeEventListener('focus',foco);},[carregar,chaveAtualizacao]);
 const inicio=mes+'-05';const fim=new Date(inicio+'T12:00:00');fim.setMonth(fim.getMonth()+1);fim.setDate(4);const fimIso=`${fim.getFullYear()}-${String(fim.getMonth()+1).padStart(2,'0')}-04`;
 const noPeriodo=(d:string)=>d.slice(0,10)>=inicio&&d.slice(0,10)<=fimIso;
 const receitas=(dados?.recebimentos??[]).filter(r=>noPeriodo(r.data)&&(!pacienteId||r.pacienteId===pacienteId));
 const despesas=(dados?.despesas??[]).filter(d=>!d.canceladoEm&&noPeriodo(d.data));
 const totalRecebido=receitas.reduce((s,r)=>s+r.valorCentavos,0),totalDespesa=despesas.reduce((s,r)=>s+r.valorCentavos,0);
 const planos=(dados?.planos??[]).filter(p=>p.status!=='CANCELADO'&&(!pacienteId||p.pacienteId===pacienteId));
 const parcelas=(dados?.parcelas??[]).filter(p=>!p.canceladoEm&&(!pacienteId||p.pacienteId===pacienteId));
 async function salvar(){const centavos=reaisTextoParaCentavos(valor);if(!centavos||centavos<=0||!descricao.trim()||!data){setErro('Informe data, descrição e valor positivo.');return;}const plano=planos.find(p=>p.id===planoId);if(tipo==='parcelas'&&!plano){setErro('Escolha o plano de tratamento.');return;}setOcupado(true);try{await container.gestaoFinanceira.registrar(tipo,{id:chaveRegistro.current,data,descricao,valorCentavos:centavos,...(plano?{planoId:plano.id,pacienteId:plano.pacienteId}:{})});chaveRegistro.current=crypto.randomUUID();setDescricao('');setValor('');await carregar();}catch(e){setErro(e instanceof Error?e.message:'Não foi possível registrar.');}finally{setOcupado(false);}}
 async function estornar(tipo:'despesas'|'parcelas',id:string){if(confirmandoEstorno!==id){setConfirmandoEstorno(id);return;}setOcupado(true);try{await container.gestaoFinanceira.estornar(tipo,id);setConfirmandoEstorno('');await carregar();}catch{setErro('Não foi possível estornar o lançamento.');}finally{setOcupado(false);}}
 function exportar(){const linhas:(string|number)[][]=[['Fechamento financeiro',inicio,fimIso],['Tipo','Data','Descrição / paciente','Método','Entrada R$','Saída R$'],...receitas.map(r=>['Recebimento',r.data,seguroCsv(r.nome),seguroCsv(r.metodo??''),(r.valorCentavos/100).toFixed(2).replace('.',','),'']),...despesas.map(d=>['Despesa',d.data,seguroCsv(d.descricao),'','',(d.valorCentavos/100).toFixed(2).replace('.',',')]),['Totais','','','',(totalRecebido/100).toFixed(2).replace('.',','),(totalDespesa/100).toFixed(2).replace('.',',')],['Saldo do período','','','',((totalRecebido-totalDespesa)/100).toFixed(2).replace('.',',')],['Despesas adicionais: preencha abaixo; recalcule os totais ao editar no Excel.'],...Array.from({length:15},()=>['Despesa','','','','',''])];baixarTexto(`fechamento-${mes}.csv`,montarCsv(linhas));}
 return <Card data-tour="fechamento-financeiro" className="flex flex-col gap-3"><h2 className="font-semibold">{pacienteId?'Parcelas e recebimentos deste paciente':'Fechamento mensal e despesas'}</h2>
 <p className="text-sm">Ciclo de {inicio} até {fimIso}. Recebimentos vêm dos pagamentos já registrados nos planos; cadastrar parcela não registra pagamento.</p>
 {erro&&<Alert tone="danger">{erro}<Button variant="secondary" onClick={()=>void carregar()}>Atualizar</Button></Alert>}
 <Button variant="secondary" onClick={()=>void carregar()}>Atualizar lançamentos</Button>
 <Field label="Mês de início do ciclo"><Input type="month" value={mes} onChange={e=>{if(e.target.value)setMes(e.target.value);}} /></Field>
 <p>Recebido: <strong>{centavosParaReaisTexto(totalRecebido)}</strong>{!pacienteId&&<> · Despesas: <strong>{centavosParaReaisTexto(totalDespesa)}</strong> · Saldo: <strong>{centavosParaReaisTexto(totalRecebido-totalDespesa)}</strong></>}</p>
 <Button variant="secondary" disabled={!dados} onClick={exportar}>Baixar planilha do fechamento (CSV / Excel)</Button>
 <h3 className="font-semibold">Novo lançamento</h3>
 <Select value={tipo} onChange={e=>setTipo(e.target.value as 'despesas'|'parcelas')} aria-label="Tipo de lançamento">{!pacienteId&&<option value="despesas">Despesa da clínica</option>}<option value="parcelas">Parcela a receber</option></Select>
 {tipo==='parcelas'&&<><Field label="Plano vinculado"><Select value={planoId} onChange={e=>setPlanoId(e.target.value)}><option value="">Escolha o plano</option>{planos.map(p=><option key={p.id} value={p.id}>{p.nome} — saldo do plano {centavosParaReaisTexto(p.totalCentavos-p.pagoCentavos)}</option>)}</Select></Field><p className="text-sm">Cadastre cada vencimento acordado. Entradas já registradas antes de montar o parcelamento não são descontadas de novo. Novos pagamentos abatem as parcelas mais antigas. Avisos automáticos no vencimento e sete dias depois, somente enquanto houver saldo.</p></>}
 <Field label={tipo==='parcelas'?'Vencimento':'Data da despesa'}><Input type="date" value={data} onChange={e=>setData(e.target.value)} /></Field><Field label="Descrição"><Input maxLength={300} value={descricao} onChange={e=>setDescricao(e.target.value)} /></Field><Field label="Valor (R$)"><Input inputMode="decimal" placeholder="0,00" value={valor} onChange={e=>setValor(e.target.value)} /></Field><Button loading={ocupado} disabled={!dados} onClick={()=>void salvar()}>Registrar {tipo==='parcelas'?'parcela':'despesa'}</Button>
 <EditarLancamentoFinanceiro edicao={edicao} fechar={()=>setEdicao(null)} aoSalvar={carregar}/><h3 className="font-semibold">Parcelas cadastradas</h3><ul className="flex flex-col gap-2">{parcelas.map(p=><li key={p.id}>{p.data} — {p.descricao} · Em aberto: {centavosParaReaisTexto(p.saldoCentavos??0)} {p.avisos&&<span> · Avisos: {Object.entries(p.avisos).map(([k,v])=>`${k}: ${v}`).join('; ')}</span>}<br/><Link className="text-brand-700 underline" to={`/pacientes/${p.pacienteId}/odontograma`}>Abrir plano e pagamentos</Link> <Button variant="secondary" disabled={ocupado} onClick={()=>setEdicao({tipo:'parcelas',row:p})}>Editar parcela</Button> <Button variant="secondary" disabled={ocupado} onClick={()=>void estornar('parcelas',p.id)}>{confirmandoEstorno===p.id?'Confirmar estorno da parcela':'Estornar parcela'}</Button></li>)}</ul>
 {!pacienteId&&<><h3 className="font-semibold">Despesas do período</h3><ul>{despesas.map(d=><li key={d.id}>{d.data} — {d.descricao}: {centavosParaReaisTexto(d.valorCentavos)} <Button variant="secondary" disabled={ocupado} onClick={()=>setEdicao({tipo:'despesas',row:d})}>Editar despesa</Button> <Button variant="secondary" disabled={ocupado} onClick={()=>void estornar('despesas',d.id)}>{confirmandoEstorno===d.id?'Confirmar estorno da despesa':'Estornar despesa'}</Button></li>)}</ul></>}
 </Card>;
}
