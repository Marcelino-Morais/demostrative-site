import { useEffect, useState } from 'react';
import { useContainer } from '../providers/container-provider.js';

/**
 * Endereço editável da clínica (Etapa 54) — carregado uma vez por
 * componente que precisa dele (Painel, cabeçalhos impressos). Sem
 * cache compartilhado de propósito: mesmo estilo simples já usado no
 * resto do app (`WhatsappAutomaticoPage`, `GoogleFormsEmailPage`), sem
 * dependência nova de gerenciamento de estado. `null` enquanto carrega
 * OU quando está vazio — os dois casos renderizam "nada", que é o
 * comportamento certo (nunca mostra endereço inventado).
 */
export function useEnderecoClinica(): string | null {
  const container = useContainer();
  const [endereco, setEndereco] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    container.configuracaoClinica.obter
      .executar()
      .then((config) => {
        if (!cancelado) setEndereco(config.endereco || null);
      })
      .catch(() => {
        if (!cancelado) setEndereco(null);
      });
    return () => {
      cancelado = true;
    };
  }, [container]);

  return endereco;
}
