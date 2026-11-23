import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DiagnosticoSincronizacao } from '../../application/use-cases/sincronizacao.js';
import { useContainer } from './container-provider.js';

/** De quanto em quanto tempo re-sondar o servidor quando alguma fatia está ligada. */
const INTERVALO_MS = 5_000;

export interface SincronizacaoContextValue {
  /** `null` enquanto a primeira verificação não terminou. */
  diagnostico: DiagnosticoSincronizacao | null;
  /** `true` enquanto uma verificação está em andamento. */
  verificando: boolean;
  /** Força uma nova verificação agora (ex.: botão "Verificar agora"). */
  revalidar: () => void;
}

const SincronizacaoContext = createContext<SincronizacaoContextValue | undefined>(undefined);

/**
 * Fonte única de verdade, para toda a árvore React, do estado de
 * sincronização com o servidor das fatias compartilhadas (Etapa 20).
 * Só chama o caso de uso `container.sincronizacao.obterDiagnostico` —
 * a apresentação nunca fala `fetch` nem lê `CONFIGURACAO_API`
 * diretamente. Re-sonda periodicamente quando alguma fatia está
 * ligada; em modo 100% local faz só uma verificação (não há o que
 * mudar sem recarregar a página).
 */
export function SincronizacaoProvider({ children }: { children: ReactNode }) {
  const container = useContainer();
  const [diagnostico, setDiagnostico] = useState<DiagnosticoSincronizacao | null>(null);
  const [verificando, setVerificando] = useState(false);
  const emVoo = useRef(false);

  const verificar = useCallback(async () => {
    if (emVoo.current) return;
    emVoo.current = true;
    setVerificando(true);
    try {
      const d = await container.sincronizacao.obterDiagnostico.executar();
      setDiagnostico(d);
      return d;
    } finally {
      emVoo.current = false;
      setVerificando(false);
    }
  }, [container]);

  useEffect(() => {
    let cancelado = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    void verificar().then((d) => {
      if (cancelado || !d?.algumHabilitado) return;
      timer = setInterval(() => void verificar(), INTERVALO_MS);
    });

    // Reverificar quando a aba volta ao foco / a rede volta — offline → conectado sem esperar o intervalo.
    const aoAcordar = (): void => void verificar();
    window.addEventListener('online', aoAcordar);
    window.addEventListener('focus', aoAcordar);

    return () => {
      cancelado = true;
      if (timer) clearInterval(timer);
      window.removeEventListener('online', aoAcordar);
      window.removeEventListener('focus', aoAcordar);
    };
  }, [verificar]);

  const value = useMemo<SincronizacaoContextValue>(
    () => ({ diagnostico, verificando, revalidar: () => void verificar() }),
    [diagnostico, verificando, verificar],
  );

  return <SincronizacaoContext.Provider value={value}>{children}</SincronizacaoContext.Provider>;
}

export function useSincronizacao(): SincronizacaoContextValue {
  const ctx = useContext(SincronizacaoContext);
  if (!ctx) throw new Error('useSincronizacao() precisa estar dentro de <SincronizacaoProvider>.');
  return ctx;
}
