/**
 * Identidade fixa da clínica — sistema de profissional único (pedido do
 * usuário: "focado em um profissional/clínica, não um SaaS amplo").
 * Só nome e CRO (informação profissional, de exibição pública por
 * norma do conselho) — nunca CPF ou outro dado pessoal sensível
 * hardcoded no código-fonte.
 */
export const CONFIGURACAO_CLINICA = {
  nomeProfissional: 'Dra. Fernanda Morais Mendes',
  registroProfissional: 'CRO-MG 43.239',
  nomeClinica: 'Consultório Dra. Fernanda Morais Mendes',
  emailProfissional: 'nanda.dent@gmail.com',
  cidade: 'Uberlândia',
} as const;
