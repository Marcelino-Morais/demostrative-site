import { Paciente } from '../domain/entities/paciente.js';
import { Consulta } from '../domain/entities/consulta.js';
import { PlanoTratamento } from '../domain/entities/plano-tratamento.js';
import { Anamnese, criarAnamneseEmBranco } from '../domain/entities/anamnese.js';
import { RegistroDental } from '../domain/entities/registro-dental.js';
import { ProcedimentoCatalogo } from '../domain/entities/procedimento-catalogo.js';
import { encontrarProximoHorario } from '../../server/encaixe-agenda.mjs';

// Dados criados exclusivamente para esta demonstração. Nunca importa dados da clínica.
export type Linha = Record<string, any>;
export const colecoes: Record<string, Linha[]> = {};
export const solicitacoes: Linha[] = [];
export const conversa: { autor: 'paciente' | 'clinica'; texto: string }[] = [];
export const hoje = () => new Date().toLocaleDateString('en-CA');
export function dia(offset = 0) { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export const configuracao: Linha = { endereco: 'Endereço ilustrativo • Uberlândia / MG', funcionamento: {inicio:'09:00',fim:'17:00'}, descanso:{ativo:true,inicio:'12:00',fim:'13:30'} };
export const financeiro: Linha = {despesas:[],parcelas:[]};
export const avisarMudanca = () => window.dispatchEvent(new Event('demo-mudanca'));
export function falar(autor: 'paciente' | 'clinica', texto: string) { conversa.push({autor,texto}); avisarMudanca(); }
export function iniciarAmostra() {
  const nomes = ['Ana Clara Oliveira', 'Bruno Henrique Lima', 'Carla Beatriz Santos'];
  for (const c of ['pacientes','consultas','planos','anamneses','registros-dentais','evolucoes','retornos','bloqueios-agenda','procedimentos-catalogo','registros-whatsapp','campanhas-comemorativas','mensagens-cortesia']) colecoes[c]=[];
  nomes.forEach((nome,i) => {
    const p = Paciente.criar({nomeCompleto:nome,dataNascimento:i===2?`${1990}-${dia().slice(5)}`:`${1988+i*5}-04-15`,estadoCivil:['Solteiro(a)','Casado(a)','Divorciado(a)'][i],email:`paciente${i+1}@example.invalid`,celular:null,endereco:'Endereço fictício — demonstração'});
    const snap={...p.toSnapshot(),id:`demo-paciente-${i+1}`}; colecoes.pacientes!.push(snap);
    const plano=PlanoTratamento.criar(snap.id);
    plano.adicionarItem({numeroDente:i===0?21:null,todosOsDentes:i!==0,trabalhoAExecutar:i===0?'Restauração em resina':'Limpeza e orientação',valorCentavos:i===0?18000:15000,quantidade:1});
    plano.definirCondicoesDePagamento({descontoAVistaPercentual:10,percentualEntrada:25,parcelasCartaoSemJuros:3,observacoes:'Condições ilustrativas. Desconto somente para pagamento integral à vista.'});
    if(i===1)plano.registrarPagamento({data:dia(-2),valorCentavos:5000,metodo:'PIX',confirmadoPelaDentista:true,confirmadoPeloPaciente:true,observacao:'Pagamento fictício de demonstração'});
    colecoes['planos']!.push({...plano.toSnapshot(),id:`demo-plano-${i+1}`});
    const a=criarAnamneseEmBranco(snap.id); a.queixaPrincipal=i===0?'Sensibilidade no dente anterior':'Avaliação de rotina'; a.alergiaMedicacao=i===0?'SIM':'NAO'; a.alergiaMedicacaoQuais=i===0?'Penicilina (exemplo fictício)':''; a.pressaoArterial=i===2?'ALTA':'NORMAL'; a.pacienteConfirmouDados=true;
    colecoes.anamneses!.push(Anamnese.salvar(a).toSnapshot());
    const consulta=Consulta.agendar({pacienteId:snap.id,data:dia(i===1?1:0),horario:['09:00','14:00','15:00'][i]!,duracaoMinutos:45,motivo:i===0?'Restauração em resina':'Avaliação de rotina'});
    consulta.confirmar(); colecoes.consultas!.push(consulta.toSnapshot());
  });
  const registro=RegistroDental.registrar({pacienteId:'demo-paciente-1',numeroDente:21,face:null,tipo:'CONDICAO_INICIAL',condicao:'CARIADO',descricao:'Restauração planejada — exemplo fictício',data:dia(-1),profissionalResponsavel:'Dra. Fernanda Morais Mendes',valorCentavos:18000});
  colecoes['registros-dentais']!.push(registro.toSnapshot());
  [['Limpeza e orientação',15000],['Restauração em resina',18000],['Avaliação no consultório',10000]].forEach(([nome,preco],i)=>{colecoes['procedimentos-catalogo']!.push(ProcedimentoCatalogo.criar({nome:String(nome),categoria:'Demonstração',precoCentavos:Number(preco)},`demo-procedimento-${i}`).toSnapshot());});
  financeiro.despesas=[{id:'demo-despesa',data:dia(),descricao:'Material odontológico (exemplo)',valorCentavos:4500}];
}
export function criarPedido(data: string, horario: string, motivoPaciente: string) {
  const existente=solicitacoes.find(s=>s.status==='PENDENTE'); if(existente)return existente;
  const s: Linha={id:crypto.randomUUID(),pacienteId:'demo-paciente-1',pacienteNome:'Ana Clara Oliveira',data,horario,motivoPaciente,ehEmergencia:false,orcamento:{procedimentoId:null,descricao:motivoPaciente,valorCentavos:18000,valorMinimoCentavos:null,valorMaximoCentavos:null,definirNoConsultorio:false},motivoPendencia:null,status:'PENDENTE',duracaoMinutos:null,consultaId:null,motivoRecusa:null,criadoEm:new Date().toISOString(),atualizadoEm:new Date().toISOString(),decididoEm:null,vistaPorEsteDispositivo:true};
  solicitacoes.push(s); falar('paciente',`Formulário enviado: ${data.split('-').reverse().join('/')} às ${horario}. ${motivoPaciente}.`); falar('clinica','Recebemos sua solicitação. A clínica vai analisar a duração e o horário. Aguarde a confirmação.'); return s;
}
export function propor(s: Linha,duracaoMinutos:number) {
  if(!Number.isInteger(duracaoMinutos)||duracaoMinutos<1)throw Error('Informe a duração em minutos.');
  const encaixe=encontrarProximoHorario({id:s.id,data:s.data,horario:s.horario,duracaoMinutos},colecoes.consultas! as any,configuracao as any);
  if(!encaixe)throw Error('Não há horário disponível nesse dia. Experimente outro dia.');
  s.duracaoMinutos=duracaoMinutos; s.propostaHorario={data:encaixe.data,horario:encaixe.horario,duracaoMinutos,aceitoEm:null,envio:'ENVIADA',expira:Date.now()+86400000};
  falar('clinica',`Podemos atender em ${encaixe.data.split('-').reverse().join('/')} às ${encaixe.horario}, por ${duracaoMinutos} minutos. Você aceita?`);
}
export function aceitar(s:Linha,aceita:boolean) {if(!s.propostaHorario)return; s.propostaHorario.aceitoEm=aceita?new Date().toISOString():null; s.propostaHorario.recusadoEm=aceita?undefined:new Date().toISOString(); falar('paciente',aceita?'Aceitar horário':'Recusar horário'); falar('clinica',aceita?'Obrigado! Falta a confirmação final da clínica.':'Tudo bem. A equipe precisará combinar outro horário com você.');}
export function confirmar(s:Linha){
  if(s.status!=='PENDENTE'||!s.propostaHorario?.aceitoEm)throw Error('Aguarde o aceite do paciente antes de confirmar.');
  const proposta=s.propostaHorario;const encaixe=encontrarProximoHorario({id:s.id,data:proposta.data,horario:proposta.horario,duracaoMinutos:proposta.duracaoMinutos},colecoes.consultas! as any,configuracao as any);
  if(!encaixe||encaixe.data!==proposta.data||encaixe.horario!==proposta.horario)throw Error('O horário ficou ocupado. Faça uma nova proposta.');
  const c=Consulta.agendar({pacienteId:s.pacienteId,data:proposta.data,horario:proposta.horario,duracaoMinutos:proposta.duracaoMinutos,motivo:s.motivoPaciente}); c.confirmar();colecoes.consultas!.push(c.toSnapshot());s.status='APROVADA';s.consultaId=c.toSnapshot().id;s.decididoEm=new Date().toISOString();falar('clinica',`Consulta confirmada em ${proposta.data.split('-').reverse().join('/')} às ${proposta.horario}. Os lembretes seriam enviados automaticamente no sistema real.`);
}
