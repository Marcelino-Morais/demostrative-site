import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SolicitacaoAgendamento } from '../../application/ports/porta-solicitacoes-agendamento.js';
import { ErroApi } from '../../application/ports/api-client.js';
import { useContainer } from './container-provider.js';

/** Mesmo intervalo de `SincronizacaoProvider` — já provado nesta base de código. */
const INTERVALO_MS = 5_000;

export interface SolicitacoesPendentesContextValue {
  /** `null` enquanto a primeira busca não terminou. */
  solicitacoes: SolicitacaoAgendamento[] | null;
  /** Só as `PENDENTE` — é o número que vira contador na navegação. */
  pendentes: SolicitacaoAgendamento[];
  carregando: boolean;
  erro: string | null;
  /** Força uma nova busca agora (ex.: depois de aprovar/recusar). */
  recarregar: () => void;
}

const SolicitacoesPendentesContext = createContext<SolicitacoesPendentesContextValue | undefined>(undefined);

/**
 * Fonte única de verdade, pra árvore inteira, das solicitações de
 * agendamento do Google Forms pendentes de revisão — o contador na
 * navegação (`AppShell`) e a lista na tela de Agenda leem do MESMO
 * lugar, pra nunca fazerem duas buscas divergentes. Re-busca a cada
 * 5s enquanto o núcleo está no servidor (sem isso, não existe
 * solicitação nenhuma pra revisar) — nunca depende da aba estar em
 * primeiro plano; `online`/`focus` disparam uma busca imediata extra.
 */
export function SolicitacoesPendentesProvider({ children }: { children: ReactNode }) {
  const container = useContainer();
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAgendamento[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emVoo = useRef(false);

  const buscar = useCallback(async () => {
    if (emVoo.current || !container.sincronizacaoNucleo) return;
    emVoo.current = true;
    setCarregando(true);
    try {
      const lista = await container.solicitacaoAgendamento.listar.executar();
      setSolicitacoes(lista);
      setErro(null);
    } catch (erroCapturado) {
      // Sessão expirada/bloqueada (401): nunca mantém dado de pendência
      // (nome de paciente) visível depois que a autenticação cai.
      if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) setSolicitacoes(null);
      setErro('Não foi possível verificar solicitações de agendamento pendentes agora.');
    } finally {
      emVoo.current = false;
      setCarregando(false);
    }
  }, [container]);

  useEffect(() => {
    if (!container.sincronizacaoNucleo) return;
    void buscar();
    const timer = setInterval(() => void buscar(), INTERVALO_MS);
    const aoAcordar = (): void => void buscar();
    window.addEventListener('online', aoAcordar);
    window.addEventListener('focus', aoAcordar);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', aoAcordar);
      window.removeEventListener('focus', aoAcordar);
    };
  }, [buscar, container.sincronizacaoNucleo]);

  const pendentes = useMemo(() => (solicitacoes ?? []).filter((s) => s.status === 'PENDENTE'), [solicitacoes]);

  const value = useMemo<SolicitacoesPendentesContextValue>(
    () => ({ solicitacoes, pendentes, carregando, erro, recarregar: () => void buscar() }),
    [solicitacoes, pendentes, carregando, erro, buscar],
  );

  return <SolicitacoesPendentesContext.Provider value={value}>{children}</SolicitacoesPendentesContext.Provider>;
}

export function useSolicitacoesPendentes(): SolicitacoesPendentesContextValue {
  const ctx = useContext(SolicitacoesPendentesContext);
  if (!ctx) throw new Error('useSolicitacoesPendentes() precisa estar dentro de <SolicitacoesPendentesProvider>.');
  return ctx;
}
