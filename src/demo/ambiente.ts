import { colecoes, configuracao, financeiro, iniciarAmostra, solicitacoes, propor, confirmar, falar, avisarMudanca, dia, type Linha } from './estado.js';
import { PlanoTratamento } from '../domain/entities/plano-tratamento.js';

/** Armazenamento efêmero: nem fichas, nem tutorial, nem preferências ficam no disco. */
class Memoria implements Storage {
  private dados = new Map<string,string>();
  get length(){return this.dados.size;}
  clear(){this.dados.clear();}
  getItem(k:string){return this.dados.get(k)??null;}
  key(i:number){return [...this.dados.keys()][i]??null;}
  removeItem(k:string){this.dados.delete(k);}
  setItem(k:string,v:string){this.dados.set(String(k),String(v));}
}
Object.defineProperty(window,'localStorage',{value:new Memoria(),configurable:true});
Object.defineProperty(window,'sessionStorage',{value:new Memoria(),configurable:true});
iniciarAmostra();
localStorage.setItem('pf-encerramentos-vistos',JSON.stringify((colecoes.consultas??[]).map(c=>`${c.id}:${c.atualizadoEm}`)));
const json=(corpo:unknown,status=200)=>new Response(JSON.stringify(corpo),{status,headers:{'content-type':'application/json'}});
const indisponivel=()=>json({erro:{codigo:'somente-demonstracao',mensagem:'Esta integração é apenas ilustrativa. Use Simular atendimento para conhecer o fluxo.'}},422);
const metadados: Linha[]=[]; const bytes=new Map<string,Blob>(); const anotacoes:Record<string,Linha>={};
// Imagens desenhadas para a amostra; não são radiografias nem material diagnóstico.
for(let i=0;i<2;i++){
 const canvas=document.createElement('canvas');canvas.width=800;canvas.height=550;const ctx=canvas.getContext('2d')!;
 ctx.fillStyle='#172323';ctx.fillRect(0,0,800,550);ctx.strokeStyle='#9cc4ba';ctx.lineWidth=5;
 for(let j=0;j<6;j++){const x=150+j*90;ctx.beginPath();ctx.moveTo(x,170);ctx.bezierCurveTo(x-36,160,x-32,255,x-12,275);ctx.lineTo(x,365-i*15);ctx.lineTo(x+12,280);ctx.bezierCurveTo(x+40,250,x+35,160,x,170);ctx.stroke();}
 ctx.fillStyle='#d1e6df';ctx.font='bold 24px sans-serif';ctx.fillText('ILUSTRAÇÃO · NÃO É UMA RADIOGRAFIA',95,65);ctx.font='18px sans-serif';ctx.fillText('Exemplo para testar zoom, marcações e comparação.',110,465);
 const b64=canvas.toDataURL('image/png').split(',')[1]!;const raw=atob(b64);const blob=new Blob([Uint8Array.from(raw,c=>c.charCodeAt(0))],{type:'image/png'});const id=`demo-exame-${i}`;
 metadados.push({id,pacienteId:'demo-paciente-1',nome:`Ilustração de demonstração ${i+1}.png`,tipoMime:'image/png',tamanhoBytes:blob.size,categoria:'RADIOGRAFIA',descricao:'Desenho ilustrativo sem uso clínico.',data:dia(-i),origem:'Amostra fictícia',criadoEm:new Date().toISOString()});bytes.set(id,blob);
}
const nome=(id:string)=>colecoes.pacientes?.find(p=>p.id===id)?.nomeCompleto??'Paciente fictício';
function resumoFinanceiro(){const planos=colecoes['planos']??[];return {...financeiro,planos:planos.map(p=>({id:p.id,pacienteId:p.pacienteId,nome:nome(p.pacienteId),status:p.status,totalCentavos:p.itens.reduce((s:number,i:Linha)=>s+i.valorCentavos*i.quantidade,0),pagoCentavos:p.pagamentos.reduce((s:number,i:Linha)=>s+i.valorCentavos,0)})),recebimentos:planos.flatMap(p=>p.pagamentos.map((r:Linha)=>({...r,planoId:p.id,pacienteId:p.pacienteId,nome:nome(p.pacienteId)})))};}
// Substitui fetch antes de carregar o aplicativo. Nenhuma API real é chamada.
window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
  const req=input instanceof Request?input:null;const url=new URL(req?req.url:String(input),location.href);const caminho=url.pathname;const metodo=init?.method??req?.method??'GET';
  let corpo:Linha={};if(typeof init?.body==='string'){try{corpo=JSON.parse(init.body);}catch{return json({erro:{mensagem:'Conteúdo inválido'}},400);}}
  if(url.origin!==location.origin)return indisponivel();
  const partes=caminho.split('/').filter(Boolean).map(decodeURIComponent);const recurso=partes[1]??'';const id=partes[2]??'';const acao=partes[3]??'';
  if(caminho==='/health')return json({ok:true,servico:'Demonstração local',versao:1,fatias:['nucleo','anamnese','arquivos'],armazenamento:{dados:true,arquivos:true,backups:true},app:{servindoBuild:true},backup:{total:0,ultimo:null},enderecoLan:null});
  if(caminho==='/acesso/status')return json({configurado:false,autenticado:true});
  if(caminho==='/api/clinica/configuracoes'){if(metodo==='PUT')Object.assign(configuracao,corpo);return json(configuracao);}
  if(caminho==='/api/nucleo/contagem')return json(Object.fromEntries(Object.entries(colecoes).map(([k,v])=>[k,v.length])));
  const paraEncerrar=(c:Linha)=>({consulta:c,nomePaciente:nome(c.pacienteId),planos:(colecoes.planos??[]).filter(p=>p.pacienteId===c.pacienteId&&p.status==='ATIVO'&&p.itens.length).map(p=>({id:p.id,descricao:p.itens.map((i:Linha)=>i.trabalhoAExecutar).join(', ')}))});
  if(recurso==='encerramentos-consultas')return json((colecoes.consultas??[]).filter(c=>!c.encerramentoFinanceiro&&['AGENDADA','CONFIRMADA','REALIZADA'].includes(c.status)&&new Date(`${c.data}T${c.horario}:00-03:00`).getTime()+c.duracaoMinutos*60000<=Date.now()).map(paraEncerrar));
  if(recurso==='consultas'&&acao==='encerramento'){
   const c=colecoes.consultas?.find(c=>c.id===id);if(!c)return json(null,404);
   if(metodo==='GET')return json(paraEncerrar(c));
   if(c.atualizadoEm!==corpo.atualizadoEm||c.encerramentoFinanceiro||!['AGENDADA','CONFIRMADA','REALIZADA'].includes(c.status))return json({erro:{mensagem:'A consulta mudou. Confira os dados novamente.'}},409);
   if(!['REALIZADA','FALTOU','CANCELADA'].includes(corpo.status))return json({erro:{mensagem:'Confira o resultado.'}},422);
   if(corpo.status==='REALIZADA'){
    let plano=colecoes.planos?.find(p=>p.id===corpo.planoId&&p.pacienteId===c.pacienteId&&p.status==='ATIVO');
    if(corpo.modoFinanceiro==='NOVO'){
     if(!Number.isSafeInteger(corpo.valorCentavos)||corpo.valorCentavos<0)return json({erro:{mensagem:'Confira o valor.'}},422);
     const p=PlanoTratamento.criar(c.pacienteId);p.adicionarItem({numeroDente:null,trabalhoAExecutar:c.motivo||'Atendimento',valorCentavos:corpo.valorCentavos});plano={...p.toSnapshot()};colecoes.planos!.push(plano);
    }
    if(!plano)return json({erro:{mensagem:'Escolha o plano deste paciente.'}},422);
    c.encerramentoFinanceiro={planoId:plano.id,modo:corpo.modoFinanceiro,conferidoEm:new Date().toISOString()};
   }
   c.status=corpo.status;c.atualizadoEm=new Date().toISOString();avisarMudanca();return json({ok:true});
  }
  if(recurso==='solicitacoes-agendamento'){
    if(id==='marcar-vistas'){solicitacoes.filter(s=>(corpo.ids??[]).includes(s.id)).forEach(s=>s.vistaPorEsteDispositivo=true);return json({ok:true});}
    if(!id)return json(solicitacoes);
    const s=solicitacoes.find(s=>s.id===id);if(!s)return json(null,404);
    try{
      if(acao==='aprovar'){if(s.status!=='PENDENTE')return json({erro:{codigo:'solicitacao-ja-decidida'}},409);if(s.propostaHorario?.aceitoEm){confirmar(s);return json({consultaId:s.consultaId});}propor(s,Number(corpo.duracaoMinutos));return json({aguardandoPaciente:true,data:s.propostaHorario.data,horario:s.propostaHorario.horario});}
      if(acao==='recusar'){s.status='RECUSADA';s.motivoRecusa=corpo.motivo??'';falar('clinica','A clínica não conseguiu atender neste horário. Entre em contato para combinar outra opção.');}
      if(acao==='definir-procedimento'){const p=colecoes['procedimentos-catalogo']?.find(p=>p.id===corpo.procedimentoId);s.motivoPendencia=null;s.orcamento={procedimentoId:p?.id??null,descricao:p?.nome??'Avaliar no consultório',valorCentavos:p?.precoCentavos??null,valorMinimoCentavos:null,valorMaximoCentavos:null,definirNoConsultorio:!p};}
      avisarMudanca();return json(s);
    }catch(e){return json({erro:{codigo:'horario-indisponivel',mensagem:e instanceof Error?e.message:'Confira os dados.'}},409);}
  }
  if(caminho==='/api/gestao-financeira')return json(resumoFinanceiro());
  if(recurso==='gestao-financeira'&&['despesas','parcelas'].includes(id)){const lista=financeiro[id] as Linha[];if(partes[4]==='estornar'){const r=lista.find(r=>r.id===acao);if(r)r.canceladoEm=new Date().toISOString();}else if(metodo==='POST')lista.push({...corpo,id:crypto.randomUUID()});return json({ok:true});}
  if(recurso==='pacientes'&&acao==='buscar-documento')return json({ids:[]});
  if(caminho==='/api/pacientes/buscar-documento')return json({ids:[]});
  if(recurso==='pacientes'&&acao==='perfil-forms')return json({foto:{disponivel:false,status:'SEM_FOTO',erro:null,atualizadaEm:null},revisao:null,importacaoFotosConfigurada:false});
  if(recurso==='pacientes'&&acao==='foto-perfil')return json(null,404);
  if(recurso==='pacientes'&&acao==='documentos-impressao')return json({cpf:null,rg:null});
  if(recurso==='pacientes'&&acao==='arquivos'){
    if(metodo==='POST'&&init?.body instanceof Blob){const h=new Headers(init.headers);const blob=init.body;if(blob.size>10*1024*1024)return indisponivel();const a={id:crypto.randomUUID(),pacienteId:id,nome:decodeURIComponent(h.get('x-arquivo-nome')??'Arquivo fictício'),tipoMime:blob.type||h.get('content-type')||'application/octet-stream',tamanhoBytes:blob.size,categoria:h.get('x-arquivo-categoria')??'OUTRO',descricao:decodeURIComponent(h.get('x-arquivo-descricao')??''),data:h.get('x-arquivo-data')??dia(),origem:'Teste temporário',criadoEm:new Date().toISOString()};metadados.push(a);bytes.set(a.id,blob);return json(a,201);}
    return json(metadados.filter(a=>a.pacienteId===id&&(partes[4]==='lixeira'?a.excluidoEm:!a.excluidoEm)));
  }
  if(recurso==='pacientes'&&acao==='arquivos-lixeira')return json(metadados.filter(a=>a.pacienteId===id&&a.excluidoEm));
  if(recurso==='pacientes'&&colecoes[acao])return json(colecoes[acao]!.filter(r=>r.pacienteId===id));
  if(colecoes[recurso]){
    const lista=colecoes[recurso]!;
    if(metodo==='GET'){const registro=lista.find(r=>recurso==='anamneses'?r.pacienteId===id:r.id===id);return id?json(registro??null,registro?200:404):json(lista);}
    if(metodo==='PUT'){const indice=lista.findIndex(r=>recurso==='anamneses'?r.pacienteId===id:r.id===id);const novo={...corpo,id:corpo.id??id};if(indice<0)lista.push(novo);else lista[indice]=novo;avisarMudanca();return json({ok:true});}
    if(metodo==='DELETE'){const indice=lista.findIndex(r=>r.id===id);if(indice>=0)lista.splice(indice,1);return json({ok:true});}
  }
  if(recurso==='arquivos'){
    if(acao==='anotacoes'){if(metodo==='PUT')anotacoes[id]={arquivoId:id,versao:(anotacoes[id]?.versao??0)+1,itens:corpo.itens,atualizadoEm:new Date().toISOString()};return json(anotacoes[id]??{arquivoId:id,versao:0,itens:[],atualizadoEm:null});}
    if(acao==='conteudo'){const b=bytes.get(id);return b?new Response(b):json(null,404);}
    if(metodo==='POST'&&init?.body instanceof FormData){const f=init.body.get('arquivo');if(!(f instanceof File))return indisponivel();const a={id:crypto.randomUUID(),pacienteId:init.body.get('pacienteId'),nomeOriginal:f.name,mimeType:f.type,tamanhoBytes:f.size,categoria:init.body.get('categoria')??'OUTRO',descricao:init.body.get('descricao')??'',criadoEm:new Date().toISOString(),excluidoEm:null};metadados.push(a);bytes.set(a.id,f);return json(a,201);}
    const a=metadados.find(a=>a.id===id);if(a){if(metodo==='DELETE'&&acao==='permanente'){metadados.splice(metadados.indexOf(a),1);bytes.delete(id);delete anotacoes[id];return json({ok:true});}if(metodo==='DELETE')a.excluidoEm=new Date().toISOString();if(acao==='restaurar')a.excluidoEm=null;if(metodo==='PATCH'||metodo==='PUT')Object.assign(a,corpo);return json(a);}
    return json([],200);
  }
  if(recurso==='whatsapp-atendimento'&&acao==='verificar')return json({numeros:[]});
  if(caminho.includes('supressao-cortesia/verificar'))return json({suprimidos:[]});
  if(caminho.includes('google-calendar/feriados'))return json({habilitado:false,fonte:'Amostra ilustrativa',atualizadoEm:null,erro:null,eventos:[],regiao:{uf:'MG',cidade:'Uberlândia',municipioId:'3170206'},coberturaRegional:{municipal:[],estadual:[]}});
  if(caminho.includes('google-calendar/localidades'))return json([]);
  if(caminho.includes('google-calendar/status'))return json({habilitado:false,configurado:false,pendentes:0,erro:null});
  if(caminho.includes('google-sheets-sync'))return json({habilitado:false,configurado:false,emExecucao:false,ultimoResultado:null,ultimaExecucao:null});
  if(caminho.includes('wim-import'))return json({habilitado:false,candidatos:[]});
  if(caminho.includes('wim-captura'))return json({habilitado:false,disponivel:false});
  if(caminho.includes('/backup/tarefa'))return json({instalada:false,habilitada:false});
  if(caminho.includes('/backup'))return indisponivel();
  if(caminho.includes('/anamnese'))return indisponivel();
  return indisponivel();
};
// Uploads, links de Forms, mapas e WhatsApp nunca saem da demonstração.
document.addEventListener('click',e=>{
 const a=(e.target as Element)?.closest?.('a');if(!a)return;const href=a.getAttribute('href');if(!href||href.startsWith('blob:')||href.startsWith('data:'))return;
 if(href.startsWith('#')&&!href.startsWith('#/')){e.preventDefault();document.getElementById(href.slice(1))?.scrollIntoView({behavior:'smooth'});return;}
 const url=new URL(href,location.href);
 if(url.origin!==location.origin){e.preventDefault();e.stopImmediatePropagation();location.hash='/simulador';return;}
 if(href.startsWith('/')&&!href.startsWith('//')){e.preventDefault();location.hash=/^\/(entrar|anamnese|agendar|acesso)/.test(url.pathname)?'/simulador':url.pathname;if(url.hash)setTimeout(()=>document.getElementById(url.hash.slice(1))?.scrollIntoView({behavior:'smooth'}),300);}
},true);
window.open=()=>{location.hash='/simulador';return null;};
// Não substitui a tela do sistema por um aviso: apenas explica integrações indisponíveis.
export const dataAmostra=dia();
