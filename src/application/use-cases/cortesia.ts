import {
  CampanhaComemorativa,
  type EditarCampanhaComemorativaInput,
  type NovaCampanhaComemorativaInput,
} from '../../domain/entities/campanha-comemorativa.js';
import { MensagemCortesia, type MensagemCortesiaProps } from '../../domain/entities/mensagem-cortesia.js';
import type { PacienteProps } from '../../domain/entities/paciente.js';
import { proximoAniversario } from '../../domain/value-objects/aniversario.js';
import { ErroDominio } from '../../domain/types.js';
import {
  mascararNumeroWhatsapp,
  normalizarNumeroWhatsapp,
  numeroWhatsappValido,
} from '../../../whatsapp-itens/src/domain/value-objects/whatsapp.js';
import type { PortaSupressaoCortesiaWhatsapp } from '../../../whatsapp-itens/src/application/ports/porta-supressao-cortesia-whatsapp.js';
import type {
  RepositorioCampanhasComemorativas,
  RepositorioMensagensCortesia,
  RepositorioPacientes,
} from '../ports/repositorios.js';

/**
 * Consulta a supressão por PARAR (persistida no servidor — ver
 * `PortaSupressaoCortesiaWhatsapp`) para os celulares de `pacientes`, e
 * devolve só os que NUNCA foram elegíveis a recusa por esse canal
 * (nunca filtra por paciente/consentimento — isso é responsabilidade de
 * quem chama). Número compartilhado nunca tem o consentimento de UM
 * paciente alterado por suposição: a supressão vale para QUALQUER
 * paciente com aquele mesmo celular.
 */
async function filtrarSuprimidosPorNumero(
  pacientes: PacienteProps[],
  supressao: PortaSupressaoCortesiaWhatsapp,
): Promise<PacienteProps[]> {
  const numeros = pacientes.map((p) => p.celular).filter((c): c is string => Boolean(c));
  if (numeros.length === 0) return pacientes;
  const suprimidos = await supressao.verificarSuprimidos(numeros);
  if (suprimidos.size === 0) return pacientes;
  return pacientes.filter((p) => !p.celular || !suprimidos.has(p.celular));
}

// ---- Campanhas comemorativas (CRUD) ----

export class CriarCampanhaComemorativa {
  constructor(private readonly campanhas: RepositorioCampanhasComemorativas) {}
  async executar(input: NovaCampanhaComemorativaInput): Promise<CampanhaComemorativa> {
    const campanha = CampanhaComemorativa.criar(input);
    await this.campanhas.salvar(campanha);
    return campanha;
  }
}

async function carregarCampanhaOuFalhar(repo: RepositorioCampanhasComemorativas, id: string): Promise<CampanhaComemorativa> {
  const campanha = await repo.buscarPorId(id);
  if (!campanha) throw new ErroDominio('Campanha não encontrada.');
  return campanha;
}

export class EditarCampanhaComemorativa {
  constructor(private readonly campanhas: RepositorioCampanhasComemorativas) {}
  async executar(id: string, input: EditarCampanhaComemorativaInput): Promise<CampanhaComemorativa> {
    const campanha = await carregarCampanhaOuFalhar(this.campanhas, id);
    campanha.editar(input);
    await this.campanhas.salvar(campanha);
    return campanha;
  }
}

export class AtivarCampanhaComemorativa {
  constructor(private readonly campanhas: RepositorioCampanhasComemorativas) {}
  async executar(id: string): Promise<void> {
    const campanha = await carregarCampanhaOuFalhar(this.campanhas, id);
    campanha.ativar();
    await this.campanhas.salvar(campanha);
  }
}

export class DesativarCampanhaComemorativa {
  constructor(private readonly campanhas: RepositorioCampanhasComemorativas) {}
  async executar(id: string): Promise<void> {
    const campanha = await carregarCampanhaOuFalhar(this.campanhas, id);
    campanha.desativar();
    await this.campanhas.salvar(campanha);
  }
}

export class ListarCampanhasComemorativas {
  constructor(private readonly campanhas: RepositorioCampanhasComemorativas) {}
  async executar(): Promise<CampanhaComemorativa[]> {
    const todas = await this.campanhas.listarTodas();
    return todas.sort((a, b) => a.toSnapshot().titulo.localeCompare(b.toSnapshot().titulo, 'pt-BR'));
  }
}

// ---- Fila de mensagens de cortesia (preparo/revisão manual — nunca envia) ----

export class MarcarMensagemCortesiaRevisada {
  constructor(private readonly mensagens: RepositorioMensagensCortesia) {}
  async executar(id: string): Promise<void> {
    const mensagem = await this.mensagens.buscarPorId(id);
    if (!mensagem) throw new ErroDominio('Mensagem não encontrada.');
    mensagem.marcarRevisadaManualmente();
    await this.mensagens.salvar(mensagem);
  }
}

export class DispensarMensagemCortesia {
  constructor(private readonly mensagens: RepositorioMensagensCortesia) {}
  async executar(id: string): Promise<void> {
    const mensagem = await this.mensagens.buscarPorId(id);
    if (!mensagem) throw new ErroDominio('Mensagem não encontrada.');
    mensagem.dispensar();
    await this.mensagens.salvar(mensagem);
  }
}

/** Paciente ELEGÍVEL pra cortesia: não arquivado, com número de WhatsApp válido. Nunca inclui arquivado nem sem número válido, em nenhuma lista desta tela (pedido explícito). */
function pacienteElegivel(p: PacienteProps): boolean {
  return p.arquivadoEm === null && numeroWhatsappValido(p.celular);
}

export interface ResultadoPreparoCortesia {
  criadas: number;
  jaExistentes: number;
}

/**
 * Gera as mensagens de cortesia do dia (aniversário de quem faz
 * aniversário hoje + campanhas ativas cuja data comemorativa é hoje) —
 * idempotente por ano (nunca duplica rodando de novo no mesmo dia).
 * Nunca envia nada — só cria o registro `PREPARADA` pra revisão manual.
 * Não arquivado e com número de WhatsApp válido SEMPRE, mas o
 * CONSENTIMENTO é verificado em campos SEPARADOS por propósito
 * (achado de revisão: um único campo genérico "AUTORIZADO" deixava
 * autorizar aniversário também liberar campanha, e vice-versa) —
 * aniversário exige `consentimentoCortesia.AUTORIZADO`; campanha exige
 * `consentimentoCampanhas.AUTORIZADO`, nunca o mesmo campo pros dois.
 */
export class PrepararMensagensCortesiaDoDia {
  constructor(
    private readonly pacientes: RepositorioPacientes,
    private readonly campanhas: RepositorioCampanhasComemorativas,
    private readonly mensagens: RepositorioMensagensCortesia,
    private readonly supressao: PortaSupressaoCortesiaWhatsapp,
  ) {}

  async executar(hojeIso: string, { incluirAniversarios = true }: { incluirAniversarios?: boolean } = {}): Promise<ResultadoPreparoCortesia> {
    const resultado: ResultadoPreparoCortesia = { criadas: 0, jaExistentes: 0 };
    const anoReferencia = Number(hojeIso.slice(0, 4));
    const mesDia = hojeIso.slice(5); // MM-DD

    const elegiveis = (await this.pacientes.listarTodos()).map((p) => p.toSnapshot()).filter(pacienteElegivel);
    // PARAR nunca deixa uma mensagem nova ser PREPARADA pra aquele
    // número — verificado ANTES de olhar consentimento individual,
    // nunca depois (um número suprimido nunca deveria nem chegar a essa
    // decisão por paciente).
    const semSupressao = await filtrarSuprimidosPorNumero(elegiveis, this.supressao);
    const elegiveisParaAniversario = semSupressao.filter((p) => p.consentimentoCortesia.status === 'AUTORIZADO');
    const elegiveisParaCampanha = semSupressao.filter((p) => p.consentimentoCampanhas.status === 'AUTORIZADO');

    // Aniversário
    for (const paciente of (incluirAniversarios ? elegiveisParaAniversario : [])) {
      const aniversario = proximoAniversario(paciente.dataNascimento, hojeIso);
      if (!aniversario || aniversario.diasAte !== 0) continue;
      await this.criarSeNovo(
        { tipo: 'ANIVERSARIO', pacienteId: paciente.id, campanhaId: null, anoReferencia },
        paciente,
        hojeIso,
        resultado,
      );
    }

    // Campanhas ativas de hoje
    const campanhasDeHoje = (await this.campanhas.listarTodas()).filter((c) => c.ativa && c.dataComemorativa === mesDia);
    for (const campanha of campanhasDeHoje) {
      for (const paciente of elegiveisParaCampanha) {
        await this.criarSeNovo(
          { tipo: 'CAMPANHA', pacienteId: paciente.id, campanhaId: campanha.id, anoReferencia },
          paciente,
          hojeIso,
          resultado,
        );
      }
    }

    return resultado;
  }

  private async criarSeNovo(
    chave: { tipo: 'ANIVERSARIO' | 'CAMPANHA'; pacienteId: string; campanhaId: string | null; anoReferencia: number },
    paciente: PacienteProps,
    hojeIso: string,
    resultado: ResultadoPreparoCortesia,
  ): Promise<void> {
    const existente = await this.mensagens.buscarExistente(chave);
    if (existente) {
      resultado.jaExistentes += 1;
      return;
    }
    const mensagem = MensagemCortesia.criar({
      tipo: chave.tipo,
      pacienteId: chave.pacienteId,
      campanhaId: chave.campanhaId,
      anoReferencia: chave.anoReferencia,
      dataAgendada: hojeIso,
      numeroMascarado: mascararNumeroWhatsapp(normalizarNumeroWhatsapp(paciente.celular)),
    });
    await this.mensagens.salvar(mensagem);
    resultado.criadas += 1;
  }
}

// ---- Resumo agrupado pra tela de aniversários/cortesia ----

export interface PacienteResumoAniversario {
  pacienteId: string;
  nomeCompleto: string;
  idadeQueVaiCompletar: number;
}

export interface PacienteResumoPendencia {
  pacienteId: string;
  nomeCompleto: string;
}

/**
 * Mensagem preparada + se ainda é segura para o envio MANUAL que a
 * equipe for fazer (nunca o status que valia no momento em que foi
 * preparada — sempre RECOMPUTADO contra o paciente agora). `false`
 * quando o paciente arquivou, perdeu o número válido, OU — achado de
 * revisão — revogou/nunca teve o consentimento certo para aquele TIPO
 * (`consentimentoCortesia` para aniversário, `consentimentoCampanhas`
 * para campanha) depois de preparada. "PARAR"/revogação não têm nada
 * automático para interromper aqui (o sistema nunca envia estas
 * mensagens por conta própria — ver `MensagemCortesia`), então isto é
 * o que impede a equipe de confirmar manualmente um envio que já não é
 * mais autorizado.
 */
export interface MensagemCortesiaParaRevisao extends MensagemCortesiaProps {
  nomePaciente?: string;
  aindaElegivelParaEnvio: boolean;
}

export interface ResumoCortesiaDaClinicaResultado {
  aniversarioHoje: PacienteResumoAniversario[];
  aniversarioProximos7Dias: PacienteResumoAniversario[];
  /** Dias 8–30 — faixa dos 30 dias que NÃO já apareceu em "próximos 7 dias" (evita listar o mesmo paciente duas vezes). */
  aniversarioProximos30Dias: PacienteResumoAniversario[];
  semDataNascimento: PacienteResumoPendencia[];
  semConsentimento: PacienteResumoPendencia[];
  mensagensDoAno: MensagemCortesiaParaRevisao[];
}

/**
 * Agrega o estado da tela de aniversários/cortesia. Nunca inclui
 * paciente arquivado ou sem número de WhatsApp válido em NENHUM grupo
 * (pedido explícito) — nem mesmo em "sem consentimento"/"sem data de
 * nascimento", já que enviar qualquer coisa a eles seria impossível de
 * qualquer forma.
 */
export class ResumoCortesiaDaClinica {
  constructor(
    private readonly pacientes: RepositorioPacientes,
    private readonly mensagens: RepositorioMensagensCortesia,
    private readonly supressao: PortaSupressaoCortesiaWhatsapp,
  ) {}

  async executar(hojeIso: string): Promise<ResumoCortesiaDaClinicaResultado> {
    const anoReferencia = Number(hojeIso.slice(0, 4));
    const elegiveis = (await this.pacientes.listarTodos()).map((p) => p.toSnapshot()).filter(pacienteElegivel);
    // Verificado AGORA (nunca o que valia quando a mensagem foi
    // preparada) — alcança itens JÁ preparados antes de um PARAR
    // recente, sem precisar atribuir a supressão a um paciente
    // específico (é por NÚMERO).
    const numerosSuprimidos = await this.supressao.verificarSuprimidos(
      elegiveis.map((p) => p.celular).filter((c): c is string => Boolean(c)),
    );

    const resultado: ResumoCortesiaDaClinicaResultado = {
      aniversarioHoje: [],
      aniversarioProximos7Dias: [],
      aniversarioProximos30Dias: [],
      semDataNascimento: [],
      semConsentimento: [],
      mensagensDoAno: [],
    };

    for (const paciente of elegiveis) {
      if (paciente.consentimentoCortesia.status !== 'AUTORIZADO') {
        resultado.semConsentimento.push({ pacienteId: paciente.id, nomeCompleto: paciente.nomeCompleto });
      }
      if (!paciente.dataNascimento) {
        resultado.semDataNascimento.push({ pacienteId: paciente.id, nomeCompleto: paciente.nomeCompleto });
        continue;
      }
      const aniversario = proximoAniversario(paciente.dataNascimento, hojeIso);
      if (!aniversario) continue;
      const item = { pacienteId: paciente.id, nomeCompleto: paciente.nomeCompleto, idadeQueVaiCompletar: aniversario.idadeQueVaiCompletar };
      if (aniversario.diasAte === 0) resultado.aniversarioHoje.push(item);
      else if (aniversario.diasAte <= 7) resultado.aniversarioProximos7Dias.push(item);
      else if (aniversario.diasAte <= 30) resultado.aniversarioProximos30Dias.push(item);
    }

    const pacientesElegiveisPorId = new Map(elegiveis.map((p) => [p.id, p]));
    resultado.mensagensDoAno = (await this.mensagens.listarTodas())
      .map((m) => m.toSnapshot())
      .filter((m) => m.anoReferencia === anoReferencia)
      .map((m) => {
        const paciente = pacientesElegiveisPorId.get(m.pacienteId);
        const consentimentoAtual = paciente && (m.tipo === 'ANIVERSARIO' ? paciente.consentimentoCortesia : paciente.consentimentoCampanhas);
        const numeroSuprimido = Boolean(paciente?.celular && numerosSuprimidos.has(paciente.celular));
        return { ...m, nomePaciente: paciente?.nomeCompleto ?? '', aindaElegivelParaEnvio: consentimentoAtual?.status === 'AUTORIZADO' && !numeroSuprimido };
      });

    return resultado;
  }
}
