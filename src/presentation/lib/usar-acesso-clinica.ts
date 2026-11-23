import { useEffect, useState } from 'react';

export interface StatusAcessoClinica {
  configurado: boolean;
  autenticado: boolean;
}

/**
 * Status do "modo clínica" (`server/acesso.mjs` — senha local + sessão
 * por cookie, SEPARADO do token de API). `GET /acesso/status` é uma rota
 * sempre aberta (nunca exige o Bearer de `CLINICA_API_TOKEN`) — por isso
 * um `fetch` relativo direto, sem passar pelo `container`. Em modo de
 * desenvolvimento de duas portas (app e API em portas diferentes) esta
 * rota não existe no servidor do Vite — qualquer falha de rede/formato
 * é tratada como "não configurado", nunca como erro.
 */
export function useStatusAcessoClinica(): StatusAcessoClinica {
  const [status, setStatus] = useState<StatusAcessoClinica>({ configurado: false, autenticado: false });

  useEffect(() => {
    const controle = new AbortController();
    fetch('/acesso/status', { signal: controle.signal })
      .then(async (res) => {
        if (!res.ok) return null;
        const tipo = res.headers.get('content-type') ?? '';
        if (!tipo.includes('application/json')) return null;
        return (await res.json()) as Partial<StatusAcessoClinica>;
      })
      .then((resultado) => {
        setStatus({ configurado: Boolean(resultado?.configurado), autenticado: Boolean(resultado?.autenticado) });
      })
      .catch(() => {
        if (!controle.signal.aborted) setStatus({ configurado: false, autenticado: false });
      });
    return () => controle.abort();
  }, []);

  return status;
}
