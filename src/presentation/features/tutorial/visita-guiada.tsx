import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '../../components/ui/button.js';
import { useExisteEdicaoPendente } from '../../providers/edicao-pendente-provider.js';
import { MODULOS_TUTORIAL, urlEtapaTutorial } from './conteudo-tutorial.js';
import { lerProgressoTutorial, salvarProgressoTutorial, registrarTutorialApresentado, pausarTutorialNestaPagina } from './progresso-tutorial.js';

type Retangulo = { x: number; y: number; width: number; height: number };
const normalizar = (texto: string) => texto.replace(/\s+/g, ' ').replace(/\*$/, '').trim();
export function encontrarAlvoTutorial(alvo: string): HTMLElement | null {
 const visivel = (e: Element): e is HTMLElement => e instanceof HTMLElement && !e.closest('[data-visita-guiada]') && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
 if (alvo.startsWith('css:')) return [...document.querySelectorAll(alvo.slice(4))].find(visivel) ?? null;
 if (alvo.startsWith('campo:')) {
  const label = [...document.querySelectorAll('label')].find(l => normalizar(l.textContent ?? '') === alvo.slice(6));
  const campo = label?.htmlFor ? document.getElementById(label.htmlFor) : label?.querySelector('input,select,textarea');
  return campo && visivel(campo) ? campo : null;
 }
 return [...document.querySelectorAll('h1,h2,h3,button,a,summary')].find(e => visivel(e) && normalizar(e.textContent ?? '') === alvo.slice(6)) as HTMLElement ?? null;
}

export function VisitaGuiada() {
 const local = useLocation(); const navegar = useNavigate(); const editando = useExisteEdicaoPendente();
 const params = new URLSearchParams(local.search);
 const modulo = MODULOS_TUTORIAL.find(m => m.id === params.get('guia'));
 const passo = Number(params.get('passo') ?? 0);
 const etapa = Number.isInteger(passo) && passo >= 0 ? modulo?.etapas[passo] : undefined;
 const paciente = params.get('paciente') ?? '';
 const [rect, setRect] = useState<Retangulo | null>(null);
 const [ausente, setAusente] = useState(false);
 const [tela, setTela] = useState({ width: window.innerWidth, height: window.innerHeight });
 const rotaCorreta = etapa?.rota.replace(':pacienteId', encodeURIComponent(paciente));
 const ativo = Boolean(etapa && modulo && (!modulo.paciente || paciente) && rotaCorreta === local.pathname);
 useEffect(() => { if (ativo && modulo) registrarTutorialApresentado(modulo.id); }, [ativo, modulo]);
 useEffect(() => {
  setRect(null); setAusente(false);
  if (!ativo || !etapa || editando) return;
  let anterior: HTMLElement | null = null;
  const inicio = Date.now();
  const medir = () => {
   const principal = encontrarAlvoTutorial(etapa.alvo);
   const alvo = principal ?? (etapa.alternativo ? encontrarAlvoTutorial(etapa.alternativo) : null);
   setAusente(!principal && Date.now() - inicio > 1000);
   if (alvo && anterior !== alvo) { alvo.scrollIntoView({ block: 'center', inline: 'nearest' }); anterior = alvo; }
   const r = alvo?.getBoundingClientRect();
   const novo = r ? { x: Math.max(4, r.left - 5), y: Math.max(4, r.top - 5), width: Math.min(r.width + 10, innerWidth - 8), height: Math.min(r.height + 10, innerHeight - 8) } : null;
   setRect(atual => JSON.stringify(atual) === JSON.stringify(novo) ? atual : novo);
   setTela(atual => atual.width === innerWidth && atual.height === innerHeight ? atual : { width: innerWidth, height: innerHeight });
  };
  medir(); const timer = setInterval(medir, 300);
  window.addEventListener('resize', medir); window.addEventListener('scroll', medir, true);
  return () => { clearInterval(timer); window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true); };
 }, [ativo, etapa, local.pathname, editando]);
 if (!ativo || !modulo || !etapa) return null;
 const sair = () => { pausarTutorialNestaPagina(local.pathname); navegar(local.pathname, { replace: true }); };
 const ultimo = passo === modulo.etapas.length - 1;
 function proximo() {
  if (editando || !modulo) return;
  if (!ultimo) { navegar(urlEtapaTutorial(modulo.id, passo + 1, paciente)); return; }
  const atual = lerProgressoTutorial();
  salvarProgressoTutorial({ ...atual, apresentado: true, concluidos: [...new Set([...atual.concluidos, modulo.id])] });
  pausarTutorialNestaPagina(local.pathname);
  const parametros = new URLSearchParams(local.search);
  for (const chave of ['guia','passo','paciente']) parametros.delete(chave);
  const destinoAtual = local.pathname + (parametros.size ? `?${parametros}` : '');
  navegar(modulo.continuarCadastro ? '/pacientes/novo?continuarGuia=primeiro-atendimento' : destinoAtual, { replace: true });
 }
 // Deixa a área destacada no lado oposto ao cartão sempre que houver espaço.
 const cartaoEmCima = rect && rect.y > tela.height / 2;
 return <Dialog.Root open onOpenChange={aberto => { if (!aberto) sair(); }}>
  <Dialog.Portal>
   <Dialog.Overlay className="no-print fixed inset-0 z-40" style={{ background: 'transparent' }} />
   <svg className="no-print pointer-events-none fixed inset-0 z-40 h-full w-full" aria-hidden="true" viewBox={`0 0 ${tela.width} ${tela.height}`}>
    <defs><mask id="mascara-visita"><rect width="100%" height="100%" fill="white" />{rect && !editando && <rect {...rect} rx="10" fill="black" />}</mask></defs>
    <rect width="100%" height="100%" fill="rgba(0,0,0,0.65)" mask="url(#mascara-visita)" />
    {rect && !editando && <rect {...rect} rx="10" fill="none" stroke="#35dfca" strokeWidth="3" />}
   </svg>
   <Dialog.Content data-visita-guiada className={`no-print fixed z-50 max-h-[48dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto rounded-2xl border border-brand-300 bg-surface p-5 shadow-xl focus:outline-none ${cartaoEmCima ? 'top-3' : 'bottom-3'} right-3`} onPointerDownOutside={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
    <p className="mb-2 text-xs font-semibold text-brand-700">Visita guiada · {modulo.nome} · {passo + 1}/{modulo.etapas.length}</p>
    <Dialog.Title className="text-lg font-semibold">{etapa.titulo}</Dialog.Title>
    <Dialog.Description className="mt-3 text-sm leading-relaxed">{editando ? 'Há alterações não salvas nesta tela. A visita foi pausada. Use Pular para sair, salve ou cancele sua edição e depois reinicie o guia nas configurações.' : etapa.texto}</Dialog.Description>
    {!editando && ausente && <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">{etapa.ausente ?? 'Este controle não está disponível nesta tela agora. A visita não cria registros para mostrá-lo; você pode continuar ou voltar depois.'}</p>}
    <p className="mt-3 text-xs text-neutral-500">A visita apenas mostra os controles. Não preenche nem salva dados.</p>
    <div className="mt-4 flex flex-wrap items-center gap-2">
     <Button variant="secondary" disabled={passo === 0 || editando} onClick={() => navegar(urlEtapaTutorial(modulo.id, passo - 1, paciente))}>Voltar</Button>
     <Button disabled={editando} onClick={proximo}>{ultimo ? modulo.continuarCadastro ? 'Preencher cadastro e continuar' : 'Concluir' : 'Próximo'}</Button>
     <Button variant="secondary" onClick={sair}>Pular</Button>
    </div>
   </Dialog.Content>
  </Dialog.Portal>
 </Dialog.Root>;
}
