import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { criarContainer, type Container } from '../../infrastructure/bootstrap/container.js';

// Reexportado pra qualquer componente que precise do TIPO (ex.: passar o
// container como prop) nunca precisar importar `infrastructure/bootstrap`
// diretamente — só type, apagado em tempo de compilação, mas mantém a
// mesma disciplina de "só através do provider" também no nível de tipos.
export type { Container };

// Exportado (só o contexto, não um hook de atalho) para que um teste de
// renderização jsdom possa injetar um container FALSO sem precisar da
// `criarContainer()` real (que monta gateways HTTP de verdade) — ver
// `visualizador-radiografia.test.tsx`.
export const ContainerContext = createContext<Container | undefined>(undefined);

/**
 * Único ponto de contato entre a árvore de componentes React e a
 * camada de aplicação/infraestrutura — a apresentação nunca importa
 * `infrastructure/*` diretamente (só através deste provider), o que
 * mantém a inversão de dependência de ponta a ponta e torna qualquer
 * página testável com um container fake (ver `criarContainerDeTeste`
 * nos testes de aplicação, quando aplicável).
 */
export function ContainerProvider({ children }: { children: ReactNode }) {
  const container = useMemo(() => criarContainer(), []);
  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>;
}

export function useContainer(): Container {
  const ctx = useContext(ContainerContext);
  if (!ctx) throw new Error('useContainer() precisa estar dentro de <ContainerProvider>.');
  return ctx;
}
