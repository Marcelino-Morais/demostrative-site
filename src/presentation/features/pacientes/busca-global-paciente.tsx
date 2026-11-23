import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useContainer } from '../../providers/container-provider.js';
import { useExisteEdicaoPendente } from '../../providers/edicao-pendente-provider.js';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog.js';
import { Input } from '../../components/ui/input.js';
import { Button } from '../../components/ui/button.js';
export function BuscaGlobalPaciente(){
 const container=useContainer();const navegar=useNavigate();const editando=useExisteEdicaoPendente();const [aberto,setAberto]=useState(false),[termo,setTermo]=useState(''),[resultados,setResultados]=useState<{id:string;nome:string}[]>([]),[erro,setErro]=useState(false),[buscando,setBuscando]=useState(false);
 const mudar=(v:boolean)=>{setAberto(v);if(!v){setTermo('');setResultados([]);setErro(false);}};
 useEffect(()=>{if(!aberto||termo.trim().length<2){setResultados([]);setBuscando(false);setErro(false);return;}let cancelado=false;setBuscando(true);setErro(false);setResultados([]);const t=setTimeout(()=>{void container.pacientes.listar.executar(false,termo.trim()).then(lista=>{if(!cancelado)setResultados(lista.slice(0,12).map(p=>({id:p.id,nome:p.nomeCompleto})));}).catch(()=>{if(!cancelado)setErro(true);}).finally(()=>{if(!cancelado)setBuscando(false);});},250);return()=>{cancelado=true;clearTimeout(t);};},[container,aberto,termo]);
 return <><button data-tour="busca-global" type="button" title="Buscar paciente" aria-label="Buscar paciente" onClick={()=>mudar(true)} className="inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-xl border border-neutral-300 px-3 text-sm hover:bg-neutral-100"><Search className="h-4 w-4" aria-hidden="true"/><span className="hidden lg:inline">Buscar paciente</span></button>
 <Dialog open={aberto} onOpenChange={mudar}><DialogContent><DialogTitle className="text-lg font-semibold">Encontre a ficha do paciente</DialogTitle><DialogDescription className="mt-2 text-sm">Busque pelo nome ou contato. A busca por documento também respeita o mascaramento da ficha.</DialogDescription><label className="mt-4 block text-sm">Nome, telefone, e-mail, CPF ou RG<Input autoComplete="off" value={termo} onChange={e=>setTermo(e.target.value)} placeholder="Digite pelo menos 2 caracteres"/></label>
 {editando&&<p role="status" className="mt-3 text-sm text-warning-700">Salve ou cancele as alterações da página antes de trocar de paciente.</p>}
 <div className="mt-4" aria-live="polite">{buscando?<p className="text-sm">Buscando…</p>:erro?<p role="alert" className="text-sm text-danger-700">Não foi possível buscar. Confira a conexão e tente novamente.</p>:termo.trim().length>=2&&resultados.length===0?<p className="text-sm">Nenhum paciente ativo encontrado.</p>:<ul className="max-h-72 space-y-2 overflow-y-auto">{resultados.map(p=><li key={p.id}><Button variant="secondary" className="w-full justify-between text-left" disabled={editando} onClick={()=>{if(editando)return;mudar(false);navegar(`/pacientes/${p.id}/dados`);}}>{p.nome}<span className="ml-2 text-xs">Abrir ficha</span></Button></li>)}</ul>}</div><Button variant="secondary" className="mt-4" onClick={()=>mudar(false)}>Fechar busca</Button></DialogContent></Dialog></>;
}
