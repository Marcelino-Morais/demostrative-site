const dataValida = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
export const validarLancamentoFinanceiro = row => {
 let ok=false;
 try {ok=Boolean(row && typeof row.id==='string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(row.id) && !['constructor','prototype','__proto__'].includes(row.id) && dataValida(row.data) && Number.isSafeInteger(row.valorCentavos) && row.valorCentavos>0 && typeof row.descricao==='string' && row.descricao.length>0 && row.descricao.length<=300 && (row.dataAlocacao===undefined||dataValida(row.dataAlocacao)) && (row.versao===undefined||(Number.isSafeInteger(row.versao)&&row.versao>=0)) && (row.historicoEdicoes===undefined||(Array.isArray(row.historicoEdicoes)&&row.historicoEdicoes.every(h=>h&&Number.isFinite(Date.parse(h.em))&&typeof h.motivo==='string'&&h.motivo.length>=5&&[h.antes,h.depois].every(v=>v&&dataValida(v.data)&&typeof v.descricao==='string'&&v.descricao.length>0&&Number.isSafeInteger(v.valorCentavos)&&v.valorCentavos>0)))) && (!row.planoId || typeof row.pacienteId==='string'));}catch{ /* data inválida */ }
 return {ok,erros:ok?[]:['lancamento-invalido']};
};
export function parcelasComSaldo(parcelas, planos) {
 const resultado=[];
 for(const plano of planos){
  const agendadas=parcelas.filter(p=>p.planoId===plano.id&&!p.canceladoEm).sort((a,b)=>(a.criadoEm??'').localeCompare(b.criadoEm??''));
  const idsAnteriores=new Set(agendadas.find(p=>Array.isArray(p.pagamentosAnterioresIds))?.pagamentosAnterioresIds??[]);
  const entrada=(plano.pagamentos??[]).filter(p=>idsAnteriores.has(p.id)).reduce((s,p)=>s+p.valorCentavos,0);
  let pago=(plano.pagamentos??[]).filter(p=>!idsAnteriores.has(p.id)).reduce((s,p)=>s+p.valorCentavos,0);
  let restante=Math.max(0,(plano.itens??[]).reduce((s,i)=>s+i.valorCentavos*(i.quantidade??1),0)+(plano.emergencia?(plano.taxaEmergenciaCentavos??15000):0)-entrada);
  const itens=parcelas.filter(p=>p.planoId===plano.id&&!p.canceladoEm).sort((a,b)=>(a.dataAlocacao??a.data).localeCompare(b.dataAlocacao??b.data)||a.id.localeCompare(b.id));
  for(const parcela of itens){const devido=Math.min(parcela.valorCentavos,Math.max(0,restante));restante-=devido;const abatido=Math.min(pago,devido);pago-=abatido;resultado.push({...parcela,saldoCentavos:plano.status==='CANCELADO'||parcela.canceladoEm?0:devido-abatido});}
 }
 return resultado;
}

export function valorDaParcelaEditavel(parcela,planos,parcelas){
 const plano=planos.find(p=>p.id===parcela.planoId);if(!plano||plano.status==='CANCELADO')return false;
 const ids=new Set(parcelas.find(p=>p.planoId===plano.id&&!p.canceladoEm&&Array.isArray(p.pagamentosAnterioresIds))?.pagamentosAnterioresIds??[]);
 return !(plano.pagamentos??[]).some(p=>!ids.has(p.id)&&p.valorCentavos>0);
}
export function editarLancamentoFinanceiro(dados,colecao,id,corpo,em){
 const falha=(erro,mensagem,status=409)=>({erro,mensagem,status});
 if(!['despesas','parcelas'].includes(colecao)||!corpo||typeof corpo!=='object'||Object.keys(corpo).some(k=>!['data','descricao','valorCentavos','motivo','versao'].includes(k)))return falha('edicao-invalida','Confira os campos da edição.',422);
 const atual=Object.hasOwn(dados[colecao]??{},id)?dados[colecao][id]:null;if(!atual)return falha('lancamento-nao-encontrado','Lançamento não encontrado.',404);
 if(atual.canceladoEm)return falha('lancamento-estornado','Um lançamento estornado não pode ser editado.');
 if(corpo.versao!==(atual.versao??0))return falha('lancamento-alterado','Este lançamento mudou. Atualize a página antes de editar.');
 const motivo=typeof corpo.motivo==='string'?corpo.motivo.trim():'';if(motivo.length<5||motivo.length>300)return falha('motivo-obrigatorio','Informe o motivo da correção, com pelo menos 5 caracteres.',422);
 const alterado={...atual,data:corpo.data,descricao:typeof corpo.descricao==='string'?corpo.descricao.trim():'',valorCentavos:corpo.valorCentavos};
 if(!validarLancamentoFinanceiro(alterado).ok)return falha('lancamento-invalido','Informe data válida, descrição e valor positivo.',422);
 if(colecao==='parcelas'){
  const planos=Object.values(dados.planos??{}),parcelas=Object.values(dados.parcelas??{}),plano=planos.find(p=>p.id===atual.planoId);
  if(!plano||plano.status==='CANCELADO'||plano.pacienteId!==atual.pacienteId)return falha('plano-indisponivel','Confira o plano de tratamento desta parcela.');
  if(alterado.valorCentavos!==atual.valorCentavos){
   if(!valorDaParcelaEditavel(atual,planos,parcelas))return falha('parcela-com-pagamentos','Este plano já tem pagamentos após o parcelamento. Você pode corrigir data e descrição; para mudar valores, confira os pagamentos com a equipe.');
   const ativas=parcelas.filter(p=>p.planoId===plano.id&&!p.canceladoEm);const anteriores=new Set(ativas.find(p=>Array.isArray(p.pagamentosAnterioresIds))?.pagamentosAnterioresIds??[]);
   const entrada=(plano.pagamentos??[]).filter(p=>anteriores.has(p.id)).reduce((s,p)=>s+p.valorCentavos,0);
   const total=(plano.itens??[]).reduce((s,i)=>s+i.valorCentavos*(i.quantidade??1),0)+(plano.emergencia?(plano.taxaEmergenciaCentavos??15000):0);
   if(ativas.filter(p=>p.id!==id).reduce((s,p)=>s+p.valorCentavos,0)+alterado.valorCentavos>total-entrada)return falha('parcelas-excedem-plano','A soma das parcelas não pode ultrapassar o valor disponível do tratamento.');
  }
  // Mudar o vencimento não redistribui recebimentos que já foram registrados.
  alterado.dataAlocacao=atual.dataAlocacao??atual.data;
 }
 const campos=r=>({data:r.data,descricao:r.descricao,valorCentavos:r.valorCentavos});
 alterado.versao=(atual.versao??0)+1;alterado.atualizadoEm=em;
 alterado.historicoEdicoes=[...(atual.historicoEdicoes??[]),{em,motivo,antes:campos(atual),depois:campos(alterado)}];
 dados[colecao][id]=alterado;return {ok:true};
}
