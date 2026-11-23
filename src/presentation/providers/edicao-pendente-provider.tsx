import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface EdicaoPendenteContextValue {
  /** Chama sempre que o estado "sujo" de UM formulário mudar — nunca sabe de outros. */
  registrar: (id: string, pendente: boolean) => void;
  /** `true` quando QUALQUER formulário registrado está com alteração não salva agora. */
  existeEdicaoPendente: boolean;
}

const EdicaoPendenteContext = createContext<EdicaoPendenteContextValue | undefined>(undefined);

/**
 * Registro COMPARTILHADO de "alteração não salva" — existe só pra dar à
 * janela automática de solicitações (ver
 * `janela-novas-solicitacoes.tsx`) um jeito real de saber se é seguro
 * interromper, sem reimplementar o "sujo" que cada formulário já
 * calcula pra si (`aba-evolucao.tsx`, `aba-anamnese.tsx`,
 * `dente-detalhe-drawer.tsx`, `plano-tratamento-detalhe.tsx`,
 * `agenda-page.tsx`, etc. — ver `useRegistrarEdicaoPendente` abaixo).
 * Cada formulário só avisa a SI MESMO: perder o foco de um campo não
 * limpa nada aqui — só o próprio formulário, quando ele mesmo decide
 * que não está mais sujo (salvou, limpou, cancelou).
 */
export function EdicaoPendenteProvider({ children }: { children: ReactNode }) {
  const [pendentes, setPendentes] = useState<ReadonlySet<string>>(new Set());

  const registrar = useCallback((id: string, pendente: boolean) => {
    setPendentes((atual) => {
      const jaPendente = atual.has(id);
      if (pendente === jaPendente) return atual;
      const proximo = new Set(atual);
      if (pendente) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }, []);

  const value = useMemo<EdicaoPendenteContextValue>(
    () => ({ registrar, existeEdicaoPendente: pendentes.size > 0 }),
    [registrar, pendentes],
  );

  return <EdicaoPendenteContext.Provider value={value}>{children}</EdicaoPendenteContext.Provider>;
}

function useEdicaoPendenteContext(): EdicaoPendenteContextValue {
  const ctx = useContext(EdicaoPendenteContext);
  if (!ctx) throw new Error('useRegistrarEdicaoPendente()/useExisteEdicaoPendente() precisam estar dentro de <EdicaoPendenteProvider>.');
  return ctx;
}

/**
 * Um formulário chama isto com seu próprio booleano "sujo" (o mesmo já
 * usado no `beforeunload` dele) — id estável por instância do
 * componente (`useId()` do React, gerado uma vez). Desregistra sozinho
 * ao desmontar, mesmo que ainda estivesse sujo (o formulário sumiu da
 * tela — não faz sentido continuar "bloqueando" por ele).
 */
export function useRegistrarEdicaoPendente(id: string, estaSujo: boolean): void {
  const { registrar } = useEdicaoPendenteContext();
  useEffect(() => {
    registrar(id, estaSujo);
  }, [id, estaSujo, registrar]);
  // Desregistra ao desmontar, mesmo que ainda estivesse sujo — o
  // formulário sumiu da tela, não faz sentido continuar "bloqueando" por ele.
  useEffect(() => () => registrar(id, false), [id, registrar]);
}

export function useExisteEdicaoPendente(): boolean {
  return useEdicaoPendenteContext().existeEdicaoPendente;
}
