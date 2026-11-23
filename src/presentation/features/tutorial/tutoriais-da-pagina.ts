import { MODULOS_TUTORIAL, type ModuloTutorial } from './conteudo-tutorial.js';
export function tutoriaisDaPagina(pathname: string): { pacienteId: string; guias: ModuloTutorial[] } {
 let pacienteId = ''; let ids: string[] = [];
 const ficha = /^\/pacientes\/([^/]+)(?:\/([^/]+))?\/?$/.exec(pathname);
 if (pathname === '/pacientes/novo') ids = ['primeiro-paciente','pacientes'];
 else if (ficha && ficha[1] !== 'novo') {
  try { pacienteId = decodeURIComponent(ficha[1]!); } catch { pacienteId = ''; }
  ids = ({ atendimento:['atendimento','odontograma','evolucao','financeiro'], dados:['primeiro-atendimento','pacientes','correcao-cadastral'], anamnese:['anamnese','primeiro-atendimento'], odontograma:['odontograma','financeiro','adiantamento','primeiro-atendimento'], 'plano-tratamento':['odontograma','financeiro','adiantamento'], consultas:['agenda','pedido-forms'], evolucao:['evolucao','primeiro-atendimento'], documentos:['documentos'], exames:['exames'], arquivos:['exames'], orcamento:['documentos','financeiro'] } as Record<string,string[]>)[ficha[2] ?? 'dados'] ?? ['primeiro-atendimento'];
 } else ids = ({ '/':['inicio','fechar-dia','busca-global'], '/pacientes':['pacientes','primeiro-paciente'], '/lista-espera':['lista-espera'], '/materiais':['materiais'], '/mensagens':['mensagens'], '/ajuda':['relatar-problema'], '/agenda':['agenda','pedido-forms','funcionamento','evolucao'], '/relatorios':['relatorios','fechar-dia'], '/retornos':['aniversarios'], '/aniversarios':['aniversarios','whatsapp'], '/configuracoes':['backup','funcionamento','whatsapp','lista-espera','materiais','mensagens','relatar-problema'], '/configuracoes/tutorial':['inicio'], '/configuracoes/whatsapp-automatico':['whatsapp','pedido-forms'], '/configuracoes/catalogo-procedimentos':['odontograma','backup'], '/configuracoes/google-forms-email':['pedido-forms','pacientes'] } as Record<string,string[]>)[pathname] ?? ['inicio'];
 return { pacienteId, guias: ids.map(id=>MODULOS_TUTORIAL.find(m=>m.id===id)).filter((m): m is ModuloTutorial => Boolean(m) && (!m!.paciente || Boolean(pacienteId))) };
}
