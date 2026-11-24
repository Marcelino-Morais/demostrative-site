import { FUNCIONAMENTO_PADRAO, funcionamentoValido, pausaPosConsultaValida, descansoDentroDoFuncionamento } from '../../../server/funcionamento-agenda.mjs';
import type {
  ConfiguracaoClinicaEditavel,
  PortaConfiguracaoClinica,
} from '../ports/porta-configuracao-clinica.js';

/** Limite prático — cabe num cabeçalho impresso sem quebrar o layout. */
export const TAMANHO_MAXIMO_ENDERECO = 500;

/**
 * Casos de uso das configurações editáveis da clínica (endereço, por
 * ora). Só delegam para a porta, mesmo molde de `whatsapp-automatico.ts`
 * — a validação de tamanho é a única regra, e mora aqui (não na porta)
 * pra valer nos dois modos (local e servidor) sem duplicar.
 */
export class ObterConfiguracaoClinica {
  constructor(private readonly porta: PortaConfiguracaoClinica) {}

  async executar(): Promise<ConfiguracaoClinicaEditavel> {
    return this.porta.obter();
  }
}

export class SalvarConfiguracaoClinica {
  constructor(private readonly porta: PortaConfiguracaoClinica) {}

  async executar(config: ConfiguracaoClinicaEditavel): Promise<ConfiguracaoClinicaEditavel> {
    const atual = await this.porta.obter();
    config = { ...atual, ...config };
    if (config.pausaPosConsultaMinutos !== undefined && !pausaPosConsultaValida(config.pausaPosConsultaMinutos)) throw new Error('Informe uma pausa após consulta de 0 a 180 minutos inteiros.');
    const endereco = config.endereco.trim().slice(0, TAMANHO_MAXIMO_ENDERECO);
    if (config.descanso && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(config.descanso.inicio)
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(config.descanso.fim) || config.descanso.inicio >= config.descanso.fim)) {
      throw new Error('O fim do descanso deve ser depois do início.');
    }
    if (config.funcionamento && !funcionamentoValido(config.funcionamento)) throw new Error('Informe abertura e fechamento válidos, com fechamento depois da abertura, no mesmo dia.');
    if (!descansoDentroDoFuncionamento(config.descanso ?? { ativo: true, inicio: '12:00', fim: '13:30' }, config.funcionamento ?? FUNCIONAMENTO_PADRAO)) throw new Error('O descanso ativo precisa ficar dentro do horário de funcionamento. Ajuste o intervalo ou desative-o.');
    return this.porta.salvar({ endereco, ...(config.pausaPosConsultaMinutos !== undefined ? {pausaPosConsultaMinutos:config.pausaPosConsultaMinutos} : {}), ...(config.funcionamento ? { funcionamento: config.funcionamento } : {}), ...(config.descanso ? { descanso: config.descanso } : {}) });
  }
}
