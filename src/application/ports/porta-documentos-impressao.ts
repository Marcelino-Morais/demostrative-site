/**
 * CPF/RG completos (NUNCA mascarados) de UM paciente — só para o fluxo
 * explícito de impressão ("Preparar impressão"), nunca no carregamento
 * comum de uma tela. Ver `server/index.mjs`,
 * `POST /api/pacientes/:id/documentos-impressao` (resposta sem cache).
 */
export interface DocumentosImpressao {
  cpf: string | null;
  rg: string | null;
}

export interface PortaDocumentosImpressao {
  obter(pacienteId: string): Promise<DocumentosImpressao>;
}
