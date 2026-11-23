import { LINK_FORMS_ANAMNESE } from '../../../../src/domain/value-objects/link-forms-anamnese.js';
import {
  houveAcaoWhatsappRecente,
  RegistroWhatsapp,
  type RegistroWhatsappProps,
  type TipoAcaoWhatsapp,
} from '../../domain/entities/registro-whatsapp.js';
import { agoraIso, ErroDominio } from '../../../../src/domain/types.js';
import type { StatusConsentimentoWhatsapp } from '../../domain/value-objects/consentimento-whatsapp.js';
import {
  avaliarDisponibilidadeWhatsapp,
  montarMensagemConsultaWhatsapp,
  montarMensagemContatoWhatsapp,
  montarMensagemLembretePagamentoWhatsapp,
  montarMensagemLinkAnamneseWhatsapp,
  montarUrlWhatsapp,
  normalizarNumeroWhatsapp,
  type DisponibilidadeWhatsapp,
  type IdentidadeClinica,
} from '../../domain/value-objects/whatsapp.js';
import type {
  RepositorioConsultas,
  RepositorioLinksAnamnese,
  RepositorioPacientes,
  RepositorioPlanosTratamento,
  RepositorioRegistrosWhatsapp,
} from '../../../../src/application/ports/repositorios.js';

export interface MensagemWhatsappPreparada {
  /** Texto pronto para a Dra. Fernanda conferir antes de enviar. Nunca é logado. */
  texto: string;
  /** URL `wa.me` pronta, ou `null` quando a ação não está liberada (ver `disponibilidade`). */
  url: string | null;
  /** Combinação de número válido + consentimento AUTORIZADO. */
  disponibilidade: DisponibilidadeWhatsapp;
  /** Já houve uma ação DESTE tipo para este paciente hoje (a UI pede confirmação antes de repetir). */
  houveEnvioRecente: boolean;
  /** Tipo desta ação — a UI repassa ao registrar o histórico. */
  tipo: TipoAcaoWhatsapp;
  /** Número normalizado (E.164) quando existe — a UI repassa ao registrar o histórico. */
  numeroNormalizado: string | null;
}

/** `YYYY-MM-DD` → `DD/MM/YYYY`, sem `Date`/fuso (a string já é o calendário). */
function dataBrCurta(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

async function montarPreparada(params: {
  pacienteId: string;
  celular: string | null;
  statusConsentimento: StatusConsentimentoWhatsapp;
  tipo: TipoAcaoWhatsapp;
  texto: string;
  registros: RepositorioRegistrosWhatsapp;
}): Promise<MensagemWhatsappPreparada> {
  const disponibilidade = avaliarDisponibilidadeWhatsapp(params.celular, params.statusConsentimento);
  const numeroNormalizado = normalizarNumeroWhatsapp(params.celular);
  const historico = (await params.registros.listarPorPacienteId(params.pacienteId)).map((r) => r.toSnapshot());
  return {
    texto: params.texto,
    url: disponibilidade.liberado ? montarUrlWhatsapp(params.celular, params.texto) : null,
    disponibilidade,
    houveEnvioRecente: houveAcaoWhatsappRecente(historico, params.pacienteId, params.tipo, agoraIso()),
    tipo: params.tipo,
    numeroNormalizado,
  };
}

/**
 * Casos de uso do MVP de WhatsApp (Fase 1 do `docs/whatsapp-bot.spec.md`).
 * A GERAÇÃO da mensagem e a checagem de consentimento moram aqui e no
 * domínio, nunca num componente. Nada é enviado, e o único registro é
 * "a dentista abriu o link" (`RegistrarAberturaWhatsapp`) — sem corpo
 * de mensagem.
 */
export class PrepararMensagemWhatsappDeConsulta {
  constructor(
    private readonly consultas: RepositorioConsultas,
    private readonly pacientes: RepositorioPacientes,
    private readonly registros: RepositorioRegistrosWhatsapp,
    private readonly clinica: IdentidadeClinica,
  ) {}

  async executar(consultaId: string): Promise<MensagemWhatsappPreparada> {
    const consulta = await this.consultas.buscarPorId(consultaId);
    if (!consulta) throw new ErroDominio('Consulta não encontrada.');
    const snap = consulta.toSnapshot();
    const paciente = await this.pacientes.buscarPorId(snap.pacienteId);
    if (!paciente) throw new ErroDominio('Paciente não encontrado.');
    const p = paciente.toSnapshot();

    const texto = montarMensagemConsultaWhatsapp({
      nomeCompletoPaciente: p.nomeCompleto,
      dataFormatada: dataBrCurta(snap.data),
      horario: snap.horario,
      ehEmergencia: snap.ehEmergencia,
      taxaEmergenciaCentavos: snap.taxaEmergenciaCentavos,
      clinica: this.clinica,
    });
    return montarPreparada({
      pacienteId: p.id,
      celular: p.celular,
      statusConsentimento: p.consentimentoWhatsapp.status,
      tipo: snap.ehEmergencia ? 'AVISO_EMERGENCIA' : 'CONFIRMACAO_CONSULTA',
      texto,
      registros: this.registros,
    });
  }
}

export class PrepararMensagemWhatsappLembretePagamento {
  constructor(
    private readonly planos: RepositorioPlanosTratamento,
    private readonly pacientes: RepositorioPacientes,
    private readonly registros: RepositorioRegistrosWhatsapp,
    private readonly clinica: IdentidadeClinica,
  ) {}

  async executar(planoId: string): Promise<MensagemWhatsappPreparada> {
    const plano = await this.planos.buscarPorId(planoId);
    if (!plano) throw new ErroDominio('Plano de tratamento não encontrado.');
    const paciente = await this.pacientes.buscarPorId(plano.pacienteId);
    if (!paciente) throw new ErroDominio('Paciente não encontrado.');
    const p = paciente.toSnapshot();

    const texto = montarMensagemLembretePagamentoWhatsapp({ nomeCompletoPaciente: p.nomeCompleto, clinica: this.clinica });
    return montarPreparada({
      pacienteId: p.id,
      celular: p.celular,
      statusConsentimento: p.consentimentoWhatsapp.status,
      tipo: 'LEMBRETE_PAGAMENTO',
      texto,
      registros: this.registros,
    });
  }
}

export class PrepararMensagemWhatsappDeContato {
  constructor(
    private readonly pacientes: RepositorioPacientes,
    private readonly registros: RepositorioRegistrosWhatsapp,
    private readonly clinica: IdentidadeClinica,
  ) {}

  async executar(pacienteId: string): Promise<MensagemWhatsappPreparada> {
    const paciente = await this.pacientes.buscarPorId(pacienteId);
    if (!paciente) throw new ErroDominio('Paciente não encontrado.');
    const p = paciente.toSnapshot();
    const texto = montarMensagemContatoWhatsapp({ nomeCompletoPaciente: p.nomeCompleto, clinica: this.clinica });
    return montarPreparada({
      pacienteId: p.id,
      celular: p.celular,
      statusConsentimento: p.consentimentoWhatsapp.status,
      tipo: 'CONTATO',
      texto,
      registros: this.registros,
    });
  }
}

/**
 * Convite para o paciente responder a anamnese pelo link dele.
 * `origem` (window.location.origin) e `enderecoLan` (do `/health`,
 * Etapa 45) montam a URL — preferindo a LAN quando ela é conhecida,
 * pra não mandar pro paciente um link `localhost` que só funciona no
 * computador da clínica (ver `montarLinhaDeLinkParaPaciente`). Por
 * padrão lê o link ATIVO do repositório local; no modo compartilhado
 * (Etapa 18) a tela passa o `tokenExplicito` do link que está no
 * servidor. A mensagem carrega SÓ essa URL + instrução — nenhum dado
 * clínico.
 */
export class PrepararMensagemWhatsappLinkAnamnese {
  constructor(
    private readonly links: RepositorioLinksAnamnese,
    private readonly pacientes: RepositorioPacientes,
    private readonly registros: RepositorioRegistrosWhatsapp,
    private readonly clinica: IdentidadeClinica,
  ) {}

  async executar(
    pacienteId: string,
    origem: string,
    enderecoLan: string | null,
    tokenExplicito?: string,
  ): Promise<MensagemWhatsappPreparada> {
    const paciente = await this.pacientes.buscarPorId(pacienteId);
    if (!paciente) throw new ErroDominio('Paciente não encontrado.');

    // A anamnese pública agora usa o formulário publicado da clínica.
    void origem; void enderecoLan; void tokenExplicito;
    const p = paciente.toSnapshot();
    const linhaLink = LINK_FORMS_ANAMNESE;
    const texto = montarMensagemLinkAnamneseWhatsapp({
      nomeCompletoPaciente: p.nomeCompleto,
      clinica: this.clinica,
      url: linhaLink,
    });
    return montarPreparada({
      pacienteId: p.id,
      celular: p.celular,
      statusConsentimento: p.consentimentoWhatsapp.status,
      tipo: 'LINK_ANAMNESE',
      texto,
      registros: this.registros,
    });
  }
}

export class DefinirConsentimentoWhatsapp {
  constructor(private readonly pacientes: RepositorioPacientes) {}

  async executar(pacienteId: string, status: StatusConsentimentoWhatsapp, observacao: string): Promise<void> {
    const paciente = await this.pacientes.buscarPorId(pacienteId);
    if (!paciente) throw new ErroDominio('Paciente não encontrado.');
    paciente.definirConsentimentoWhatsapp(status, observacao);
    await this.pacientes.salvar(paciente);
  }
}

/**
 * Registra que a dentista ABRIU o link de WhatsApp (não que a mensagem
 * chegou). Chamado pela UI depois do `window.open`. Guarda o mínimo,
 * com o número já mascarado dentro da entidade.
 */
export class RegistrarAberturaWhatsapp {
  constructor(
    private readonly registros: RepositorioRegistrosWhatsapp,
    private readonly clinica: IdentidadeClinica,
  ) {}

  async executar(input: { pacienteId: string; tipo: TipoAcaoWhatsapp; numeroNormalizado: string }): Promise<void> {
    const registro = RegistroWhatsapp.registrar({
      pacienteId: input.pacienteId,
      tipo: input.tipo,
      numeroNormalizado: input.numeroNormalizado,
      responsavel: this.clinica.nomeProfissional,
    });
    await this.registros.salvar(registro);
  }
}

export class ListarHistoricoWhatsappDoPaciente {
  constructor(private readonly registros: RepositorioRegistrosWhatsapp) {}

  /** Do mais recente para o mais antigo. */
  async executar(pacienteId: string): Promise<RegistroWhatsappProps[]> {
    const lista = await this.registros.listarPorPacienteId(pacienteId);
    return lista
      .map((r) => r.toSnapshot())
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }
}
