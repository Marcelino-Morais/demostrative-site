import { Anamnese, criarAnamneseEmBranco, type SalvarAnamneseInput } from '../../domain/entities/anamnese.js';
import {
  caminhoAnamnesePublica,
  LinkAnamnese,
  type LinkAnamneseProps,
  type StatusEfetivoLinkAnamnese,
} from '../../domain/entities/link-anamnese.js';
import { agoraIso, ErroDominio } from '../../domain/types.js';
import type { RepositorioAnamneses, RepositorioLinksAnamnese, RepositorioPacientes } from '../ports/repositorios.js';

/**
 * Casos de uso do link de anamnese compartilhável (Etapa 16). Toda a
 * regra — token válido? de qual paciente? ainda pode responder? —
 * mora AQUI e na entidade, nunca num componente React. A página
 * pública só chama `abrirPorToken`/`submeterPorToken` e desenha.
 *
 * PROTÓTIPO LOCAL: `RepositorioLinksAnamnese` é `localStorage`; o link
 * só resolve no mesmo navegador. Um back-end é um novo adaptador do
 * port, sem mexer aqui.
 */

function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? nomeCompleto.trim();
}

export class GerarLinkAnamnese {
  constructor(
    private readonly links: RepositorioLinksAnamnese,
    private readonly pacientes: RepositorioPacientes,
  ) {}

  /** Gera um link novo e revoga o anterior do paciente (só um token vivo por vez). */
  async executar(pacienteId: string, agora = agoraIso()): Promise<LinkAnamneseProps> {
    const paciente = await this.pacientes.buscarPorId(pacienteId);
    if (!paciente) throw new ErroDominio('Paciente não encontrado.');

    const anterior = await this.links.buscarPorPacienteId(pacienteId);
    if (anterior && anterior.toSnapshot().status === 'ATIVO') {
      anterior.revogar(agora);
      await this.links.salvar(anterior);
    }

    const link = LinkAnamnese.gerar(pacienteId, agora);
    await this.links.salvar(link);
    return link.toSnapshot();
  }
}

export interface LinkAnamneseDoPaciente {
  props: LinkAnamneseProps;
  statusEfetivo: StatusEfetivoLinkAnamnese;
  /** Caminho relativo da página pública (a UI prefixa com o `origin`). */
  caminhoPublico: string;
}

export class ObterLinkAnamneseDoPaciente {
  constructor(private readonly links: RepositorioLinksAnamnese) {}

  async executar(pacienteId: string, agora = agoraIso()): Promise<LinkAnamneseDoPaciente | null> {
    const link = await this.links.buscarPorPacienteId(pacienteId);
    if (!link) return null;
    return {
      props: link.toSnapshot(),
      statusEfetivo: link.statusEfetivo(agora),
      caminhoPublico: caminhoAnamnesePublica(link.token),
    };
  }
}

export class RevogarLinkAnamnese {
  constructor(private readonly links: RepositorioLinksAnamnese) {}

  async executar(pacienteId: string, agora = agoraIso()): Promise<void> {
    const link = await this.links.buscarPorPacienteId(pacienteId);
    if (!link) throw new ErroDominio('Este paciente não tem um link de anamnese.');
    link.revogar(agora);
    await this.links.salvar(link);
  }
}

export type MotivoRecusaAnamnesePublica = 'nao-encontrado' | 'revogado' | 'expirado' | 'ja-respondido';

export type ResultadoAberturaAnamnese =
  | {
      ok: true;
      /** Só o primeiro nome — a página pública NUNCA mostra CPF, telefone, financeiro ou outros pacientes. */
      primeiroNomePaciente: string;
      podeResponder: boolean;
      statusEfetivo: StatusEfetivoLinkAnamnese;
      /** Anamnese SEMPRE em branco — o link não expõe respostas clínicas anteriores. */
      valoresIniciais: SalvarAnamneseInput;
    }
  | { ok: false; motivo: MotivoRecusaAnamnesePublica };

export class AbrirAnamnesePorToken {
  constructor(
    private readonly links: RepositorioLinksAnamnese,
    private readonly pacientes: RepositorioPacientes,
  ) {}

  async executar(token: string, agora = agoraIso()): Promise<ResultadoAberturaAnamnese> {
    const link = await this.links.buscarPorToken(token);
    if (!link) return { ok: false, motivo: 'nao-encontrado' };

    const paciente = await this.pacientes.buscarPorId(link.pacienteId);
    if (!paciente) return { ok: false, motivo: 'nao-encontrado' };

    const statusEfetivo = link.statusEfetivo(agora);
    if (statusEfetivo === 'REVOGADO') return { ok: false, motivo: 'revogado' };
    if (statusEfetivo === 'EXPIRADO') return { ok: false, motivo: 'expirado' };

    return {
      ok: true,
      primeiroNomePaciente: primeiroNome(paciente.nomeCompleto),
      podeResponder: statusEfetivo === 'ATIVO',
      statusEfetivo,
      // `pacienteId` fica em branco de propósito — a página pública não
      // precisa (nem deve ver) o id do paciente; `submeterPorToken`
      // preenche o id certo a partir do token.
      valoresIniciais: criarAnamneseEmBranco(''),
    };
  }
}

export class SubmeterAnamnesePorToken {
  constructor(
    private readonly links: RepositorioLinksAnamnese,
    private readonly anamneses: RepositorioAnamneses,
  ) {}

  /**
   * O `pacienteId` das respostas é IGNORADO — vale o do link (o cliente
   * não escolhe de quem é a anamnese). Nada de `valores` é logado.
   */
  async executar(token: string, valores: SalvarAnamneseInput, agora = agoraIso()): Promise<void> {
    const link = await this.links.buscarPorToken(token);
    if (!link) throw new ErroDominio('Link de anamnese não encontrado.');
    if (!link.podeResponder(agora)) {
      throw new ErroDominio('Este link de anamnese não está mais disponível.');
    }

    const existente = await this.anamneses.buscarPorPacienteId(link.pacienteId);
    const anamnese = Anamnese.salvar(
      { ...valores, pacienteId: link.pacienteId },
      existente?.toSnapshot(),
    );
    await this.anamneses.salvar(anamnese);

    link.registrarResposta(agora);
    await this.links.salvar(link);
  }
}
