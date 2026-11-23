import { ErroDominio } from '../../../../src/domain/types.js';
import {
  avaliarDisponibilidadeWhatsapp,
  montarLinhaDeLinkParaPaciente,
  montarMensagemLinkAgendamentoWhatsapp,
  montarUrlWhatsapp,
  normalizarNumeroWhatsapp,
  type DisponibilidadeWhatsapp,
  type IdentidadeClinica,
} from '../../domain/value-objects/whatsapp.js';
import type {
  ConfirmarAgendamentoPublicoInput,
  GatewayAgendamentoWhatsapp,
  ResultadoAberturaAgendamento,
  ResultadoConfirmacaoAgendamento,
} from '../ports/gateway-agendamento-whatsapp.js';
import type { RepositorioPacientes, RepositorioRegistrosWhatsapp } from '../../../../src/application/ports/repositorios.js';
import { agoraIso } from '../../../../src/domain/types.js';
import { houveAcaoWhatsappRecente, type TipoAcaoWhatsapp } from '../../domain/entities/registro-whatsapp.js';

export interface MensagemLinkAgendamentoPreparada {
  texto: string;
  url: string | null;
  disponibilidade: DisponibilidadeWhatsapp;
  houveEnvioRecente: boolean;
  tipo: TipoAcaoWhatsapp;
  numeroNormalizado: string | null;
}

export class PrepararMensagemWhatsappLinkAgendamento {
  constructor(
    private readonly gateway: GatewayAgendamentoWhatsapp,
    private readonly pacientes: RepositorioPacientes,
    private readonly registros: RepositorioRegistrosWhatsapp,
    private readonly clinica: IdentidadeClinica,
  ) {}

  async executar(
    pacienteId: string,
    origem: string,
    enderecoLan: string | null,
  ): Promise<MensagemLinkAgendamentoPreparada> {
    const paciente = await this.pacientes.buscarPorId(pacienteId);
    if (!paciente) throw new ErroDominio('Paciente não encontrado.');
    const p = paciente.toSnapshot();
    const disponibilidade = avaliarDisponibilidadeWhatsapp(p.celular, p.consentimentoWhatsapp.status);
    const numeroNormalizado = normalizarNumeroWhatsapp(p.celular);
    const link = await this.gateway.gerarLink(pacienteId);
    const linhaLink = montarLinhaDeLinkParaPaciente({
      origemAtual: origem,
      enderecoLan,
      caminho: `/agendar/${encodeURIComponent(link.token)}`,
    });
    const texto = montarMensagemLinkAgendamentoWhatsapp({
      nomeCompletoPaciente: p.nomeCompleto,
      clinica: this.clinica,
      url: linhaLink,
    });
    const historico = (await this.registros.listarPorPacienteId(pacienteId)).map((r) => r.toSnapshot());

    return {
      texto,
      url: disponibilidade.liberado ? montarUrlWhatsapp(p.celular, texto) : null,
      disponibilidade,
      houveEnvioRecente: houveAcaoWhatsappRecente(historico, pacienteId, 'LINK_AGENDAMENTO', agoraIso()),
      tipo: 'LINK_AGENDAMENTO',
      numeroNormalizado,
    };
  }
}

export class AbrirAgendamentoWhatsappPublico {
  constructor(private readonly gateway: GatewayAgendamentoWhatsapp) {}

  executar(token: string): Promise<ResultadoAberturaAgendamento> {
    return this.gateway.abrirPublico(token);
  }
}

export class ConfirmarAgendamentoWhatsappPublico {
  constructor(private readonly gateway: GatewayAgendamentoWhatsapp) {}

  executar(token: string, input: ConfirmarAgendamentoPublicoInput): Promise<ResultadoConfirmacaoAgendamento> {
    return this.gateway.confirmarPublico(token, input);
  }
}

/**
 * Consistência de dados (achado na auditoria da Etapa 27, mesma ideia
 * de `RevogarLinkAtivoDoPaciente` para anamnese, Etapa 20): ao ARQUIVAR
 * um paciente, um link de agendamento ainda ATIVO não deveria seguir
 * aceitando novas marcações de um ex-paciente. Revoga o link corrente
 * se — e só se — ele estiver ATIVO. Best-effort: se o servidor estiver
 * fora do ar, a chamada propaga o erro (a tela decide se avisa).
 */
export class RevogarLinkAgendamentoAtivoDoPaciente {
  constructor(private readonly gateway: GatewayAgendamentoWhatsapp) {}

  async executar(pacienteId: string): Promise<{ revogado: boolean }> {
    const atual = await this.gateway.obterLinkDoPaciente(pacienteId);
    if (!atual || atual.statusEfetivo !== 'ATIVO') return { revogado: false };
    await this.gateway.revogarLink(atual.props.id);
    return { revogado: true };
  }
}
