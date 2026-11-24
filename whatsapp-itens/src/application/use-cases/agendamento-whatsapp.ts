import { LINK_FORMS_AGENDAMENTO } from '../../../../src/domain/value-objects/link-forms-agendamento.js';
import { ErroDominio } from '../../../../src/domain/types.js';
import {
  avaliarDisponibilidadeWhatsapp,
  montarMensagemLinkAgendamentoWhatsapp,
  montarUrlWhatsapp,
  normalizarNumeroWhatsapp,
  type DisponibilidadeWhatsapp,
  type IdentidadeClinica,
} from '../../domain/value-objects/whatsapp.js';
import type {
  GatewayAgendamentoWhatsapp,
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
    _gateway: GatewayAgendamentoWhatsapp,
    private readonly pacientes: RepositorioPacientes,
    private readonly registros: RepositorioRegistrosWhatsapp,
    private readonly clinica: IdentidadeClinica,
  ) {}

  async executar(
    pacienteId: string,
    _origem: string,
    _enderecoLan: string | null,
  ): Promise<MensagemLinkAgendamentoPreparada> {
    const paciente = await this.pacientes.buscarPorId(pacienteId);
    if (!paciente) throw new ErroDominio('Paciente não encontrado.');
    const p = paciente.toSnapshot();
    const disponibilidade = avaliarDisponibilidadeWhatsapp(p.celular, p.consentimentoWhatsapp.status);
    const numeroNormalizado = normalizarNumeroWhatsapp(p.celular);
    const texto = montarMensagemLinkAgendamentoWhatsapp({
      nomeCompletoPaciente: p.nomeCompleto,
      clinica: this.clinica,
      url: LINK_FORMS_AGENDAMENTO,
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

export class RevogarLinkAgendamentoAtivoDoPaciente {
  constructor(private readonly gateway: GatewayAgendamentoWhatsapp) {}

  async executar(pacienteId: string): Promise<{ revogado: boolean }> {
    const atual = await this.gateway.obterLinkDoPaciente(pacienteId);
    if (!atual || atual.statusEfetivo !== 'ATIVO') return { revogado: false };
    await this.gateway.revogarLink(atual.props.id);
    return { revogado: true };
  }
}
