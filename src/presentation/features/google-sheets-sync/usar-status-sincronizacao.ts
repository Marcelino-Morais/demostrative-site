import { useCallback, useEffect, useState } from 'react';
import type { StatusSincronizacaoGoogleSheets } from '../../../application/ports/porta-google-sheets-sync.js';
import { ErroApi } from '../../../application/ports/api-client.js';
import { useContainer } from '../../providers/container-provider.js';

/**
 * Hook compartilhado (Etapa 58) — usado pelo card de status em
 * Configurações E pela tela "Google Forms por e-mail" (que precisa
 * saber se a sincronização automática está ativa pra avisar que o
 * e-mail agora é só reforço). Um único lugar buscando o status evita
 * duas implementações divergindo com o tempo.
 */
export function useStatusSincronizacaoGoogleSheets() {
  const container = useContainer();
  const [status, setStatus] = useState<StatusSincronizacaoGoogleSheets | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const s = await container.googleSheetsSync.obterStatus.executar();
      setStatus(s);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível consultar o status da sincronização.');
    } finally {
      setCarregando(false);
    }
  }, [container]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { status, carregando, erro, recarregar: carregar };
}
