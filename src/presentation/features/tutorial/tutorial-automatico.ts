import type { ProgressoTutorial } from './progresso-tutorial.js';
export function escolherTutorialAutomatico(pathname: string, search: string, progresso: ProgressoTutorial, temSolicitacoes: boolean): { id: string; pacienteId: string } | null {
 const params = new URLSearchParams(search);
 if (params.has('guia') || params.has('continuarGuia') || pathname === '/configuracoes/tutorial') return null;
 const visto = (id: string) => progresso.concluidos.includes(id) || progresso.apresentados?.includes(id);
 const ficha = /^\/pacientes\/([^/]+)(?:\/(atendimento|dados|anamnese|odontograma|plano-tratamento|consultas|evolucao|documentos|exames|arquivos))?\/?$/.exec(pathname);
 let id = ''; let pacienteId = '';
 if (pathname === '/pacientes/novo') id = 'primeiro-paciente';
 else if (ficha && ficha[1] !== 'novo') {
  try { pacienteId = decodeURIComponent(ficha[1]!); } catch { return null; }
  if ((!ficha[2] || ficha[2] === 'dados') && !progresso.primeiroAtendimentoOferecido && !visto('primeiro-atendimento')) id = 'primeiro-atendimento';
  else id = ({atendimento:'atendimento',anamnese:'anamnese', odontograma:'odontograma', 'plano-tratamento':'odontograma', consultas:'agenda', evolucao:'evolucao', documentos:'documentos', exames:'exames', arquivos:'exames'} as Record<string,string>)[ficha[2] ?? ''] ?? '';
 } else id = ({'/':'inicio', '/pacientes':'pacientes', '/agenda':temSolicitacoes ? 'pedido-forms' : 'agenda', '/relatorios':'relatorios', '/retornos':'aniversarios', '/aniversarios':'aniversarios', '/configuracoes':'backup', '/configuracoes/whatsapp-automatico':'whatsapp'} as Record<string,string>)[pathname] ?? '';
 return id && !visto(id) ? { id, pacienteId } : null;
}
