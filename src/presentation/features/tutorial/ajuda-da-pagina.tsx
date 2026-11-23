import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lightbulb } from 'lucide-react';
import { Button } from '../../components/ui/button.js';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog.js';
import { useExisteEdicaoPendente } from '../../providers/edicao-pendente-provider.js';
import { tutoriaisDaPagina } from './tutoriais-da-pagina.js';
import { urlEtapaTutorial } from './conteudo-tutorial.js';

export function AjudaDaPagina() {
 const [aberto,setAberto] = useState(false);
 const { pathname } = useLocation(); const navegar = useNavigate(); const editando = useExisteEdicaoPendente();
 const { pacienteId, guias } = tutoriaisDaPagina(pathname);
 return <>
  <button type="button" aria-label="Tutoriais desta página" title="Tutoriais desta página" onClick={()=>setAberto(true)} className="inline-flex min-h-9 min-w-9 items-center justify-center gap-2 rounded-md border border-neutral-300 bg-surface px-2 text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
   <Lightbulb className="h-5 w-5 text-amber-600" aria-hidden="true"/><span className="hidden xl:inline text-xs font-medium">Tutoriais</span>
  </button>
  <Dialog open={aberto} onOpenChange={setAberto}><DialogContent className="no-print">
   <DialogTitle className="text-lg font-semibold">Tutoriais desta página</DialogTitle>
   <DialogDescription className="mt-2 text-sm text-neutral-600">Escolha um guia para ver os campos e botões destacados. Você pode voltar, avançar ou pular. Nenhum dado é salvo pela visita.</DialogDescription>
   {editando && <p role="status" className="mt-3 rounded-lg bg-warning-50 p-3 text-sm">Salve ou cancele as alterações nesta tela antes de iniciar um guia.</p>}
   <div className="mt-4 flex flex-col gap-2">{guias.map(g=><Button key={g.id} variant="secondary" disabled={editando} className="justify-start text-left" onClick={()=>{setAberto(false);navegar(urlEtapaTutorial(g.id,0,pacienteId));}}>{g.nome}</Button>)}</div>
   <div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" disabled={editando} onClick={()=>{setAberto(false);navegar('/configuracoes/tutorial');}}>Ver todos os tutoriais</Button><Button variant="secondary" onClick={()=>setAberto(false)}>Fechar</Button></div>
  </DialogContent></Dialog>
 </>;
}
