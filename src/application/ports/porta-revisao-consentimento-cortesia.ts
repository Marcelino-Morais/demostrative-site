/**
 * Ações EXPLÍCITAS da equipe sobre uma pendência de revisão de
 * consentimento de aniversário (`Paciente.consentimentoCortesiaRevisao`
 * — gerada pela sincronização do Google Forms, ver `server/index.mjs`,
 * `processarGoogleFormsFichaInicial`). NUNCA pelo PUT genérico de
 * pacientes: o SERVIDOR recalcula tudo a partir da pendência JÁ
 * PERSISTIDA (nunca confia em `consentimentoCortesia`/
 * `consentimentoCortesiaRevisao` que este lado possa enviar) — fecha a
 * lacuna de um cliente com bug conseguir fingir uma decisão — e serializa
 * decisões concorrentes sobre a MESMA pendência (duas abas decidindo ao
 * mesmo tempo nunca produzem um resultado deturpado).
 */
export interface PortaRevisaoConsentimentoCortesia {
  /** `POST /api/pacientes/:id/consentimento-cortesia-revisao/aplicar`. */
  aplicar(pacienteId: string): Promise<void>;
  /** `POST /api/pacientes/:id/consentimento-cortesia-revisao/manter` — nunca altera o consentimento, só a pendência. */
  manter(pacienteId: string): Promise<void>;
}
