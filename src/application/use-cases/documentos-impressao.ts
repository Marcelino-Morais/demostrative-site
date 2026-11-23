import type { DocumentosImpressao, PortaDocumentosImpressao } from '../ports/porta-documentos-impressao.js';

/** Só chamado por uma ação EXPLÍCITA ("Preparar impressão") — nunca no carregamento comum de uma tela. */
export class ObterDocumentosImpressao {
  constructor(private readonly porta: PortaDocumentosImpressao) {}

  async executar(pacienteId: string): Promise<DocumentosImpressao> {
    return this.porta.obter(pacienteId);
  }
}
