import { dataCalendarioValida } from './data-cadastral.mjs';
import { mascararCpf, mascararRg } from './pacientes-mascara.mjs';

export const CAMPOS_CORRECAO = ['nomeCompleto','dataNascimento','estadoCivil','endereco','email','celular','indicadoPor','cpf','rg'];
export const estadoOperacaoVazio = () => ({id:'operacao',versao:0,espera:[],materiais:[],movimentos:[],correcoes:[],relatos:[]});
const falhar=(mensagem,status=422)=>{throw Object.assign(new Error(mensagem),{status,codigo:'operacao-invalida'});};
const texto=(v,max=300)=>typeof v==='string'?v.trim().slice(0,max):'';
const idValido=v=>typeof v==='string'&&!['__proto__','constructor','prototype'].includes(v)&&/^[a-zA-Z0-9_-]{1,64}$/.test(v);
const inteiro=(n,min=0)=>Number.isSafeInteger(n)&&n>=min&&n<=1000000;
const mascararAlteracao=(campo,v)=>campo==='cpf'?mascararCpf(v):campo==='rg'?mascararRg(v):v??null;
export const saldoMaterial=(estado,id)=>estado.movimentos.filter(m=>m.materialId===id).reduce((s,m)=>s+(m.tipo==='ENTRADA'?m.quantidade:-m.quantidade),0);
function cpfValido(v){if(!/^\d{11}$/.test(v)||/^(\d)\1+$/.test(v))return false;for(let t=9;t<11;t++){let soma=0;for(let i=0;i<t;i++)soma+=Number(v[i])*(t+1-i);let d=(soma*10)%11;if(d===10)d=0;if(d!==Number(v[t]))return false;}return true;}

export function validarEstadoOperacao(e){
 const ok=e?.id==='operacao'&&inteiro(e.versao)&&['espera','materiais','movimentos','correcoes','relatos'].every(k=>Array.isArray(e[k])&&e[k].length<=10000&&e[k].every(r=>r&&idValido(r.id)))&&JSON.stringify(e).length<=4000000;
 if(!ok)return {ok:false,erros:['estado-operacao-invalido']};
 const materiais=new Set(e.materiais.map(m=>m.id));
 const consistentes=['espera','materiais','movimentos','correcoes','relatos'].every(k=>new Set(e[k].map(r=>r.id)).size===e[k].length)&&e.materiais.every(m=>texto(m.nome,120)&&texto(m.unidade,30)&&inteiro(m.minimo)&&(!m.validade||dataCalendarioValida(m.validade)))&&e.movimentos.every(m=>materiais.has(m.materialId)&&['ENTRADA','SAIDA'].includes(m.tipo)&&inteiro(m.quantidade,1))&&e.materiais.every(m=>saldoMaterial(e,m.id)>=0)&&e.espera.every(p=>idValido(p.pacienteId)&&inteiro(p.versao,1)&&texto(p.preferencia)&&['AGUARDANDO','CONTATADO','RESOLVIDO','CANCELADO'].includes(p.status))&&e.correcoes.every(c=>idValido(c.pacienteId)&&texto(c.motivo)&&c.antes&&c.depois&&[c.antes,c.depois].every(v=>typeof v==='object'&&!Array.isArray(v)&&Object.entries(v).every(([k,t])=>CAMPOS_CORRECAO.includes(k)&&(t===null||typeof t==='string'&&t.length<=600)))&&['cpf','rg'].every(k=>[c.antes[k],c.depois[k]].every(v=>!v||typeof v==='string'&&(v.includes('*')||v==='Não informado'))))&&e.relatos.every(r=>typeof r.descricao==='string'&&r.descricao.length<=2000&&typeof r.pagina==='string'&&r.pagina.startsWith('/')&&!/[?#]/.test(r.pagina));
 return {ok:Boolean(consistentes),erros:consistentes?[]:['estado-operacao-inconsistente']};
}
export function consultarOperacao(dados,recurso,pacienteId){
 const e=dados['operacao-clinica']?.operacao??estadoOperacaoVazio();
 const publico=r=>Object.fromEntries(Object.entries(r).filter(([k])=>!['operacaoOriginal','assinatura'].includes(k)));
 if(recurso==='espera')return e.espera.map(p=>({...publico(p),nomePaciente:dados.pacientes?.[p.pacienteId]?.nomeCompleto??'Paciente removido',pacienteDisponivel:Boolean(dados.pacientes?.[p.pacienteId]&&!dados.pacientes[p.pacienteId].arquivadoEm)}));
 if(recurso==='materiais')return {materiais:e.materiais.map(m=>({...publico(m),quantidade:saldoMaterial(e,m.id)})),movimentos:e.movimentos.map(publico)};
 if(recurso==='correcoes')return e.correcoes.filter(c=>c.pacienteId===pacienteId).map(publico);
 if(recurso==='relatos')return e.relatos.map(publico);
 falhar('Área não encontrada.',404);
}
/** Puro: chamado dentro da transação do núcleo e reutilizado na demonstração em memória. */
export function aplicarOperacao(dados,acao,b,agora,assinatura){
 dados['operacao-clinica']??={};const e=dados['operacao-clinica'].operacao??=estadoOperacaoVazio();
 if(!b||typeof b!=='object'||!idValido(b.id))falhar('Identificador da ação inválido. Reabra o formulário.');
 if(typeof assinatura!=='string'||!/^[a-f0-9]{64}$/.test(assinatura))falhar('Não foi possível conferir esta ação. Tente novamente.');
 const paciente=id=>{const p=dados.pacientes?.[id];if(!idValido(id)||!Object.hasOwn(dados.pacientes??{},id)||!p||p.arquivadoEm)falhar('Escolha um paciente ativo.',409);return p;};
 const anterior=[...e.espera,...e.materiais,...e.movimentos,...e.correcoes,...e.relatos].find(r=>r.id===b.id);
 if(anterior&&['espera','material','movimento','correcao','relato'].includes(acao)){
  if(anterior.assinatura!==assinatura)falhar('Esta ação já foi registrada com outros dados. Atualize a tela antes de continuar.',409);
  return {ok:true,repetida:true,id:anterior.id};
 }
 const carimbo={id:b.id,criadoEm:agora,atualizadoEm:agora,assinatura};
 if(acao==='espera'){
  paciente(b.pacienteId);if(e.espera.some(p=>p.pacienteId===b.pacienteId&&['AGUARDANDO','CONTATADO'].includes(p.status)))falhar('Esta pessoa já está na lista de espera.',409);
  const preferencia=texto(b.preferencia);if(!preferencia)falhar('Informe os dias ou horários em que a pessoa pode vir.');
  e.espera.push({...carimbo,pacienteId:b.pacienteId,preferencia,observacao:texto(b.observacao),status:'AGUARDANDO',versao:1});
 }else if(acao==='espera-status'){
  const p=e.espera.find(p=>p.id===b.esperaId);if(!p||p.versao!==b.versao)falhar('A lista mudou. Atualize antes de decidir.',409);
  if(!['AGUARDANDO','CONTATADO','RESOLVIDO','CANCELADO'].includes(b.status))falhar('Escolha uma situação válida.');
  if(['AGUARDANDO','CONTATADO'].includes(b.status))paciente(p.pacienteId);
  if(['RESOLVIDO','CANCELADO'].includes(p.status))falhar('Este item já foi encerrado. Cadastre um novo pedido, se necessário.',409);
  p.status=b.status;p.versao++;p.atualizadoEm=agora;
 }else if(acao==='material'){
  const nome=texto(b.nome,120),unidade=texto(b.unidade,30),lote=texto(b.lote,60);if(!nome||!unidade||!inteiro(b.minimo)||!inteiro(b.quantidade)||b.validade&&!dataCalendarioValida(b.validade))falhar('Confira nome, unidade, quantidades e validade do material.');
  if(e.materiais.some(m=>!m.arquivado&&m.nome.toLocaleLowerCase()===nome.toLocaleLowerCase()&&m.lote===lote))falhar('Este material e lote já existem. Registre uma entrada no item existente.',409);
  e.materiais.push({...carimbo,nome,unidade,lote,validade:b.validade||null,minimo:b.minimo,arquivado:false});
  if(b.quantidade)e.movimentos.push({id:b.id+'-inicial',materialId:b.id,tipo:'ENTRADA',quantidade:b.quantidade,motivo:'Saldo inicial informado pela clínica',criadoEm:agora});
 }else if(acao==='movimento'){
  const m=e.materiais.find(m=>m.id===b.materialId&&!m.arquivado);if(!m)falhar('Material indisponível.',409);
  if(!['ENTRADA','SAIDA'].includes(b.tipo)||!inteiro(b.quantidade,1)||!texto(b.motivo))falhar('Informe entrada ou saída, quantidade inteira positiva e motivo.');
  if(b.tipo==='SAIDA'&&saldoMaterial(e,m.id)<b.quantidade)falhar('A saída é maior que a quantidade disponível. Confira o estoque.',409);
  e.movimentos.push({...carimbo,materialId:m.id,tipo:b.tipo,quantidade:b.quantidade,motivo:texto(b.motivo)});
 }else if(acao==='material-arquivar'){
  const m=e.materiais.find(m=>m.id===b.materialId);if(!m)falhar('Material não encontrado.',404);if(saldoMaterial(e,m.id)!==0)falhar('Registre a saída ou o descarte do saldo antes de arquivar.',409);m.arquivado=true;m.atualizadoEm=agora;
 }else if(acao==='correcao'){
  const p=paciente(b.pacienteId);if(e.correcoes.some(c=>c.id===b.id))return {ok:true,repetida:true,id:b.id};
  if(p.atualizadoEm!==b.atualizadoEm)falhar('O cadastro mudou. Reabra a correção para conferir os dados atuais.',409);
  if(b.identidadeConferida!==true||texto(b.motivo).length<8)falhar('Confirme a identidade e explique o motivo da correção.');
  if(!b.campos||typeof b.campos!=='object'||Array.isArray(b.campos)||Object.keys(b.campos).some(k=>!CAMPOS_CORRECAO.includes(k)))falhar('A correção contém campos não permitidos.');
  const antes={},depois={},novo={...p};
  for(const [k,v] of Object.entries(b.campos)){
   if(v!==null&&typeof v!=='string')falhar('Há um valor inválido na correção.');const valor=typeof v==='string'?v.trim():null;
   if(valor&&valor.length>(k==='endereco'?600:200))falhar('Um dos campos excede o tamanho permitido.');
   if(k==='nomeCompleto'&&!valor)falhar('O nome completo é obrigatório.');
   if(k==='dataNascimento'&&valor&&(!dataCalendarioValida(valor)||valor>agora.slice(0,10)))falhar('Data de nascimento inválida.');
   if(k==='email'&&valor&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor))falhar('Confira o e-mail.');
   if(k==='celular'&&valor&&!/^\d{10,13}$/.test(valor.replace(/\D/g,'')))falhar('Confira o celular com DDD.');
   if(k==='cpf'&&(!valor||!cpfValido(valor.replace(/\D/g,''))))falhar('Informe um CPF válido. Para manter o atual, deixe o campo novo vazio.');
   if(k==='rg'&&(!valor||valor.includes('*')||!/^[\dA-Za-z.\- /]{3,30}$/.test(valor)))falhar('Confira o novo RG.');
   if(['cpf','rg'].includes(k)){
    const normalizar=s=>String(s??'').replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
    if(Object.values(dados.pacientes??{}).some(outro=>outro.id!==p.id&&normalizar(outro[k])===normalizar(valor)))falhar('Este documento já pertence a outro cadastro. Confira a identidade; os pacientes não foram unidos.',409);
   }
   const n=k==='cpf'?valor.replace(/\D/g,'').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4'):valor||null;if((p[k]??null)===n)continue;antes[k]=mascararAlteracao(k,p[k]);depois[k]=mascararAlteracao(k,n);novo[k]=n;
  }
  if(!Object.keys(depois).length)falhar('Não há alteração para registrar.');
  if(String(novo.celular??'').replace(/\D/g,'')!==String(p.celular??'').replace(/\D/g,''))for(const k of ['consentimentoWhatsapp','consentimentoCortesia','consentimentoCampanhas'])novo[k]={status:'NAO_AUTORIZADO',concedidoEm:null,decididoEm:agora,origem:'CLINICA',observacao:'Contato corrigido; confirmar autorização para o novo número.'};
  novo.atualizadoEm=new Date(Math.max(Date.parse(agora), (Date.parse(p.atualizadoEm)||0)+1)).toISOString();dados.pacientes[p.id]=novo;
  e.correcoes.push({id:b.id,assinatura,pacienteId:p.id,criadoEm:agora,motivo:texto(b.motivo),antes,depois,responsavel:'Equipe da clínica',identidadeConferida:true});
 }else if(acao==='relato'){
  if(b.revisado!==true||!texto(b.descricao,2000)||!texto(b.pagina,120).startsWith('/')||b.pagina.includes('?')||b.pagina.includes('#'))falhar('Descreva o problema, revise o endereço e confirme a revisão da prévia.');
  const pagina=texto(b.pagina,120).replace(/\/pacientes\/(?!novo(?:\/|$))[^/]+/,'/pacientes/:pacienteId').replace(/\/orcamento\/[^/]+/,'/orcamento/:planoId').replace(/^\/(anamnese|agendar)\/[^/]+/,'/$1/:token');
  e.relatos.push({...carimbo,descricao:texto(b.descricao,2000),pagina,versaoAplicativo:texto(b.versaoAplicativo,60),status:'REGISTRADO'});
 }else falhar('Ação não encontrada.',404);
 e.versao++;e.atualizadoEm=agora;
 if(!validarEstadoOperacao(e).ok)falhar('Não foi possível validar o registro. Nenhuma alteração foi salva.');
 return {ok:true,id:b.id};
}
