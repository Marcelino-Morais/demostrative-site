/**
 * Configurações da clínica que o PRÓPRIO consultório pode editar
 * (diferente de `CONFIGURACAO_CLINICA`, que é identidade fixa embutida
 * no código — nome/CRO da profissional, por norma do conselho). Hoje
 * só o endereço, porque a clínica pode mudar de lugar; pensado pra
 * crescer sem precisar de uma tela de "organização" grande — só mais
 * um campo aqui se um dia fizer sentido.
 */
export interface ConfiguracaoClinicaEditavel {
  /** Endereço completo, texto livre (rua, número, bairro, cidade...); vazio = não configurado ainda. */
  endereco: string;
  /** Intervalo mínimo entre atendimentos; 0 desativa. */
  pausaPosConsultaMinutos?: number;
  funcionamento?: { inicio: string; fim: string };
  descanso?: { ativo: boolean; inicio: string; fim: string };
}

export interface PortaConfiguracaoClinica {
  obter(): Promise<ConfiguracaoClinicaEditavel>;
  /** Salva o valor inteiro (não é PATCH) — string vazia limpa o endereço de propósito. */
  salvar(config: ConfiguracaoClinicaEditavel): Promise<ConfiguracaoClinicaEditavel>;
}
