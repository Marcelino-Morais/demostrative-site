import type {
  ConfiguracaoClinicaEditavel,
  PortaConfiguracaoClinica,
} from '../../application/ports/porta-configuracao-clinica.js';

const CHAVE = 'projfernanda:configuracao-clinica';

const VAZIA: ConfiguracaoClinicaEditavel = { endereco: '' };

/**
 * Modo 100% local (sem servidor) — mesmo molde de
 * `LocalStorageRascunhoAnamneseRepository`: nunca lança por
 * armazenamento cheio/indisponível, só devolve/mantém o valor vazio.
 */
export class LocalStorageConfiguracaoClinicaRepository implements PortaConfiguracaoClinica {
  async obter(): Promise<ConfiguracaoClinicaEditavel> {
    if (typeof window === 'undefined' || !window.localStorage) return { ...VAZIA };
    try {
      const bruto = window.localStorage.getItem(CHAVE);
      if (!bruto) return { ...VAZIA };
      const lido = JSON.parse(bruto) as Partial<ConfiguracaoClinicaEditavel>;
      return { endereco: typeof lido.endereco === 'string' ? lido.endereco : '',
        ...(lido.pausaPosConsultaMinutos !== undefined ? {pausaPosConsultaMinutos:lido.pausaPosConsultaMinutos} : {}),
        ...(lido.funcionamento ? { funcionamento: lido.funcionamento } : {}),
        ...(lido.descanso ? { descanso: lido.descanso } : {}) };
    } catch {
      return { ...VAZIA };
    }
  }

  async salvar(config: ConfiguracaoClinicaEditavel): Promise<ConfiguracaoClinicaEditavel> {
    config = { ...await this.obter(), ...config };
    if (typeof window === 'undefined' || !window.localStorage) return { ...config };
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(config));
    } catch {
      // Armazenamento cheio/indisponível — a tela mostra o valor mesmo assim; só não persiste.
    }
    return { ...config };
  }
}
