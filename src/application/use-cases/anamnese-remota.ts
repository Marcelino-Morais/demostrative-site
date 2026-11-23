import { Anamnese, type SalvarAnamneseInput } from '../../domain/entities/anamnese.js';
import type { LinkAnamneseProps } from '../../domain/entities/link-anamnese.js';
import type {
  GatewayAnamnese,
  LinkAnamneseRemoto,
  ResultadoAberturaRemota,
} from '../ports/gateway-anamnese.js';
import type { RepositorioAnamneses } from '../ports/repositorios.js';

/**
 * Casos de uso do slice de anamnese COMPARTILHADA (Etapa 18). Toda a
 * regra de token/submissão mora no domínio e no servidor; a tela só
 * chama estes casos de uso. São finos de propósito — o valor é manter
 * React fora do transporte e do formato.
 */

export class VerificarServidorAnamnese {
  constructor(private readonly gateway: GatewayAnamnese) {}
  executar(): Promise<boolean> {
    return this.gateway.disponivel();
  }
}

export class GerarLinkAnamneseRemoto {
  constructor(private readonly gateway: GatewayAnamnese) {}
  executar(pacienteId: string, primeiroNome: string): Promise<LinkAnamneseProps> {
    return this.gateway.gerarLink(pacienteId, primeiroNome);
  }
}

export class ObterLinkAnamneseRemoto {
  constructor(private readonly gateway: GatewayAnamnese) {}
  executar(pacienteId: string): Promise<LinkAnamneseRemoto | null> {
    return this.gateway.obterLinkDoPaciente(pacienteId);
  }
}

export class RevogarLinkAnamneseRemoto {
  constructor(private readonly gateway: GatewayAnamnese) {}
  executar(linkId: string): Promise<void> {
    return this.gateway.revogarLink(linkId);
  }
}

/**
 * Consistência de dados (Etapa 20): ao ARQUIVAR um paciente, um link de
 * anamnese ainda ATIVO no servidor não deveria seguir aceitando
 * respostas de um ex-paciente. Este caso de uso revoga o link corrente
 * se — e só se — ele estiver ATIVO. Best-effort: se o servidor estiver
 * fora do ar, não lança (a tela decide se avisa); reativar o paciente e
 * gerar um link novo continua possível.
 */
export class RevogarLinkAtivoDoPaciente {
  constructor(private readonly gateway: GatewayAnamnese) {}

  async executar(pacienteId: string): Promise<{ revogado: boolean }> {
    const atual = await this.gateway.obterLinkDoPaciente(pacienteId);
    if (!atual || atual.statusEfetivo !== 'ATIVO') return { revogado: false };
    await this.gateway.revogarLink(atual.props.id);
    return { revogado: true };
  }
}

export class AbrirAnamnesePublica {
  constructor(private readonly gateway: GatewayAnamnese) {}
  executar(token: string): Promise<ResultadoAberturaRemota> {
    return this.gateway.abrirPublica(token);
  }
}

export class SubmeterAnamnesePublica {
  constructor(private readonly gateway: GatewayAnamnese) {}
  executar(token: string, valores: SalvarAnamneseInput): Promise<void> {
    return this.gateway.submeterPublica(token, valores);
  }
}

export interface RespostaRecebida {
  /** Quando o paciente enviou pelo link. */
  recebidaEm: string;
}

export class ConsultarRespostaRecebida {
  constructor(private readonly gateway: GatewayAnamnese) {}
  async executar(pacienteId: string): Promise<RespostaRecebida | null> {
    const sub = await this.gateway.obterAnamneseSubmetida(pacienteId);
    return sub ? { recebidaEm: sub.atualizadoEm } : null;
  }
}

/**
 * Ponte (priority 4): traz as respostas que o paciente enviou pelo link
 * (no servidor) para o registro LOCAL de anamnese do paciente — que é
 * onde o resto do app (resumo, documentos, prontidão) lê. Ação
 * explícita da dentista, não sincronização automática. O `pacienteId`
 * do registro vale sempre o parâmetro, nunca um campo vindo do servidor.
 */
export class ImportarAnamneseRecebida {
  constructor(
    private readonly gateway: GatewayAnamnese,
    private readonly anamneses: RepositorioAnamneses,
  ) {}

  async executar(pacienteId: string): Promise<{ importadaEm: string } | null> {
    const sub = await this.gateway.obterAnamneseSubmetida(pacienteId);
    if (!sub) return null;
    const existente = await this.anamneses.buscarPorPacienteId(pacienteId);
    const anamnese = Anamnese.salvar({ ...sub.dados, pacienteId }, existente?.toSnapshot());
    await this.anamneses.salvar(anamnese);
    return { importadaEm: sub.atualizadoEm };
  }
}
