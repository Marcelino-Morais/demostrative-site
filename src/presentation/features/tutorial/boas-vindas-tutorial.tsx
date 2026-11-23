import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useExisteEdicaoPendente } from '../../providers/edicao-pendente-provider.js';
import { useSolicitacoesPendentes } from '../../providers/solicitacoes-pendentes-provider.js';
import { urlEtapaTutorial } from './conteudo-tutorial.js';
import { lerProgressoTutorial, registrarTutorialApresentado, salvarProgressoTutorial, tutorialPausadoNestaPagina } from './progresso-tutorial.js';
import { escolherTutorialAutomatico } from './tutorial-automatico.js';

/** Inicia a visita, sem uma pergunta anterior, só na primeira utilização segura. */
export function BoasVindasTutorial() {
 const { pathname, search } = useLocation(); const navegar = useNavigate();
 const editando = useExisteEdicaoPendente(); const { pendentes } = useSolicitacoesPendentes();
 const usadosNaSessao = useRef(new Set<string>());
 useEffect(() => {
  if (editando) return;
  let iniciou = false;
  const verificar = () => {
   if (iniciou || document.visibilityState === 'hidden' || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
   const foco = document.activeElement;
   if (foco instanceof HTMLElement && (foco.matches('input,textarea,select') || foco.isContentEditable)) return;
   if (tutorialPausadoNestaPagina(pathname)) return;
   const proximo = escolherTutorialAutomatico(pathname, search, lerProgressoTutorial(), pendentes.length > 0);
   if (!proximo || usadosNaSessao.current.has(proximo.id)) return;
   if (proximo.pacienteId && !document.querySelector('[data-tour="alertas-clinicos"]')) return; // ficha realmente carregada
   iniciou = true; usadosNaSessao.current.add(proximo.id); registrarTutorialApresentado(proximo.id);
   if (proximo.id === 'primeiro-atendimento') salvarProgressoTutorial({ ...lerProgressoTutorial(), primeiroAtendimentoOferecido: true });
   navegar(urlEtapaTutorial(proximo.id, 0, proximo.pacienteId), { replace: true });
  };
  const inicio = setTimeout(verificar, 1200); const intervalo = setInterval(verificar, 2000);
  return () => { clearTimeout(inicio); clearInterval(intervalo); };
 }, [pathname, search, editando, pendentes.length, navegar]);
 return null;
}
