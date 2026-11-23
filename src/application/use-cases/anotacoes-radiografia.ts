import type {
  Anotacao,
  GatewayAnotacoesRadiografia,
  RegistroAnotacoes,
  ResultadoSalvarAnotacoes,
} from '../ports/gateway-anotacoes-radiografia.js';

/**
 * Casos de uso das anotações de radiografia (continuação do WIM VITOR).
 * Finos de propósito — a tela é quem mantém a pilha de desfazer/refazer
 * (ver `visualizador-radiografia.tsx`); isto só fala com o gateway.
 */
export class ObterAnotacoes {
  constructor(private readonly gateway: GatewayAnotacoesRadiografia) {}
  executar(arquivoId: string): Promise<RegistroAnotacoes> {
    return this.gateway.obter(arquivoId);
  }
}

export class SalvarAnotacoes {
  constructor(private readonly gateway: GatewayAnotacoesRadiografia) {}
  executar(arquivoId: string, versaoEsperada: number, itens: Anotacao[]): Promise<ResultadoSalvarAnotacoes> {
    return this.gateway.salvar(arquivoId, versaoEsperada, itens);
  }
}
