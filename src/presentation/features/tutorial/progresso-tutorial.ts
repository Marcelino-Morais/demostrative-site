export const CHAVE_PROGRESSO_TUTORIAL = 'clinica-visita-guiada-v2';
import { MODULOS_TUTORIAL } from './conteudo-tutorial.js';
export interface ProgressoTutorial { apresentado: boolean; concluidos: string[]; apresentados?: string[]; primeiroAtendimentoOferecido?: boolean }
let memoria: ProgressoTutorial | null = null;
const idsValidos = (ids: unknown): string[] => Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === 'string' && MODULOS_TUTORIAL.some(m => m.id === id)))] : [];
export function lerProgressoTutorial(): ProgressoTutorial {
  try {
    const valor: unknown = JSON.parse(localStorage.getItem(CHAVE_PROGRESSO_TUTORIAL) ?? '{}');
    if (!valor || typeof valor !== 'object') return { apresentado: false, concluidos: [] };
    const v = valor as Partial<ProgressoTutorial>;
    return { ...(v.primeiroAtendimentoOferecido === true ? { primeiroAtendimentoOferecido: true } : {}), ...(v.apresentados ? { apresentados: idsValidos(v.apresentados) } : {}), apresentado: v.apresentado === true, concluidos: idsValidos(v.concluidos) };
  } catch { return memoria ?? { apresentado: false, concluidos: [] }; }
}
export function salvarProgressoTutorial(progresso: ProgressoTutorial): boolean {
  memoria = progresso;
  try { localStorage.setItem(CHAVE_PROGRESSO_TUTORIAL, JSON.stringify(progresso)); return true; } catch { return false; }
}
export function registrarTutorialApresentado(id: string): void {
 if (!MODULOS_TUTORIAL.some(m => m.id === id)) return;
 const atual = lerProgressoTutorial();
 if (atual.apresentados?.includes(id)) return;
 salvarProgressoTutorial({ ...atual, apresentado: true, apresentados: [...new Set([...(atual.apresentados ?? []), id])] });
}

let pausaNaMemoria = '';
export function pausarTutorialNestaPagina(pathname: string): void {
 pausaNaMemoria = pathname;
 try { sessionStorage.setItem('clinica-guia-pausa-pagina', pathname); } catch { /* só nesta sessão */ }
}
export function tutorialPausadoNestaPagina(pathname: string): boolean {
 let pausa = pausaNaMemoria;
 try { pausa = sessionStorage.getItem('clinica-guia-pausa-pagina') ?? ''; } catch { /* memória */ }
 if (pausa === pathname) return true;
 if (pausa) { pausaNaMemoria = ''; try { sessionStorage.removeItem('clinica-guia-pausa-pagina'); } catch { /* memória */ } }
 return false;
}
