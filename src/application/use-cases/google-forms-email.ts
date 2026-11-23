import type {
  PortaGoogleFormsEmail,
  PreVisualizacaoImportacaoEmail,
  ResultadoImportacaoEmail,
} from '../ports/porta-google-forms-email.js';

/**
 * Casos de uso da tela "Google Forms por e-mail" (Etapa 53) — só
 * delegam para a porta, mesmo molde do resto do projeto (ex.:
 * `whatsapp-automatico.ts`). Toda a regra fica no servidor.
 */
export class AnalisarEmailGoogleForms {
  constructor(private readonly porta: PortaGoogleFormsEmail) {}

  async executar(textoEmail: string): Promise<PreVisualizacaoImportacaoEmail> {
    return this.porta.analisar(textoEmail);
  }
}

export class ImportarEmailGoogleForms {
  constructor(private readonly porta: PortaGoogleFormsEmail) {}

  async executar(textoEmail: string): Promise<ResultadoImportacaoEmail> {
    return this.porta.importar(textoEmail);
  }
}
