import { agoraIso, ErroDominio, gerarId } from '../types.js';
import { dataCalendarioValida, normalizarDataCadastral } from '../value-objects/data-cadastral.js';
import {
  aplicarDefinicaoConsentimentoCortesia,
  consentimentoCortesiaEmBranco,
  normalizarConsentimentoCortesia,
  normalizarRevisaoConsentimentoCortesia,
  type ConsentimentoCortesia,
  type OrigemConsentimentoCortesia,
  type RevisaoConsentimentoCortesia,
  type StatusConsentimentoCortesia,
} from '../value-objects/consentimento-cortesia.js';
import {
  aplicarDefinicaoConsentimento,
  consentimentoWhatsappEmBranco,
  normalizarConsentimentoWhatsapp,
  type ConsentimentoWhatsapp,
  type StatusConsentimentoWhatsapp,
} from '../../../whatsapp-itens/src/domain/value-objects/consentimento-whatsapp.js';

export interface PacienteProps {
  id: string;
  nomeCompleto: string;
  dataNascimento: string | null;
  estadoCivil: string | null;
  cpf: string | null;
  rg: string | null;
  endereco: string | null;
  email: string | null;
  celular: string | null;
  indicadoPor: string | null;
  /**
   * Consentimento para contato por WhatsApp. Padrão `NAO_INFORMADO` —
   * nunca se assume autorização. Alterado só por `definirConsentimentoWhatsapp`,
   * nunca pelo formulário genérico de dados cadastrais.
   */
  consentimentoWhatsapp: ConsentimentoWhatsapp;
  /**
   * Consentimento para mensagem de ANIVERSÁRIO por WhatsApp — SEPARADO
   * de `consentimentoWhatsapp` (avisos de consulta) E de
   * `consentimentoCampanhas` abaixo (campanhas/outras mensagens
   * comemorativas). Autorizar aniversário NUNCA autoriza campanha, e
   * vice-versa — são campos distintos, nunca o mesmo campo lido para
   * os dois propósitos (achado de revisão: mudar só o texto de um
   * consentimento genérico não limita de verdade seu alcance). Padrão
   * `NAO_INFORMADO`. Alterado só por `definirConsentimentoCortesia`,
   * nunca pelo formulário genérico.
   */
  consentimentoCortesia: ConsentimentoCortesia;
  /**
   * Consentimento para CAMPANHAS/outras mensagens comemorativas (nunca
   * aniversário, que é só `consentimentoCortesia` acima) — mesmo
   * formato, mesmo padrão seguro `NAO_INFORMADO`, independente dos
   * outros dois consentimentos. Hoje só alterável manualmente pela
   * equipe (`definirConsentimentoCampanhas`); nenhum canal automatizado
   * (Forms, link universal) ainda coleta isto.
   */
  consentimentoCampanhas: ConsentimentoCortesia;
  /**
   * Pendência de REVISÃO HUMANA de `consentimentoCortesia` gerada pela
   * sincronização do Google Forms (ver `decidirAtualizacaoConsentimentoCortesia`
   * no servidor) — `null` quando não há nada pendente. NUNCA criada nem
   * resolvida pelo formulário genérico de dados cadastrais; só por
   * `aplicarRevisaoConsentimentoCortesia`/`manterConsentimentoCortesiaAtual`
   * (ação explícita da equipe) ou pela própria sincronização.
   */
  consentimentoCortesiaRevisao: RevisaoConsentimentoCortesia | null;
  /**
   * Quando presente, o paciente está arquivado (deixou de ser um caso
   * ativo) — mas o registro clínico inteiro (anamnese, odontograma,
   * planos, evolução) continua existindo e acessível, nunca é apagado.
   * `null` = paciente ativo. Arquivar/reativar é sempre uma ação
   * deliberada (`Paciente.arquivar`/`reativar`), nunca um campo
   * editável pelo formulário genérico de dados cadastrais — ver
   * `AtualizarPacienteInput` abaixo.
   */
  arquivadoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export type NovoPacienteInput = Partial<
  Omit<
    PacienteProps,
    | 'id'
    | 'criadoEm'
    | 'atualizadoEm'
    | 'arquivadoEm'
    | 'nomeCompleto'
    | 'consentimentoWhatsapp'
    | 'consentimentoCortesia'
    | 'consentimentoCampanhas'
    | 'consentimentoCortesiaRevisao'
  >
> & {
  nomeCompleto: string;
};

export type AtualizarPacienteInput = Partial<
  Omit<
    PacienteProps,
    | 'id'
    | 'criadoEm'
    | 'atualizadoEm'
    | 'arquivadoEm'
    | 'consentimentoWhatsapp'
    | 'consentimentoCortesia'
    | 'consentimentoCampanhas'
    | 'consentimentoCortesiaRevisao'
  >
>;

/**
 * Ficha Clínica secção "Identificação" (docx original): nome, data de
 * nascimento, estado civil, CPF, RG, endereço, e-mail, indicado por,
 * celular. Só `nomeCompleto` é obrigatório — o resto pode ser
 * completado depois, e o cadastro nunca deve travar por falta de um
 * campo secundário.
 */
export class Paciente {
  private constructor(private props: PacienteProps) {}

  static criar(input: NovoPacienteInput): Paciente {
    const nome = input.nomeCompleto.trim();
    if (!nome) {
      throw new ErroDominio('Nome completo é obrigatório.');
    }
    const agora = agoraIso();
    return new Paciente({
      id: gerarId(),
      nomeCompleto: nome,
      dataNascimento: normalizarDataCadastral(input.dataNascimento),
      estadoCivil: input.estadoCivil ?? null,
      cpf: input.cpf ?? null,
      rg: input.rg ?? null,
      endereco: input.endereco ?? null,
      email: input.email ?? null,
      celular: input.celular ?? null,
      indicadoPor: input.indicadoPor ?? null,
      consentimentoWhatsapp: consentimentoWhatsappEmBranco(),
      consentimentoCortesia: consentimentoCortesiaEmBranco(),
      consentimentoCampanhas: consentimentoCortesiaEmBranco(),
      consentimentoCortesiaRevisao: null,
      arquivadoEm: null,
      criadoEm: agora,
      atualizadoEm: agora,
    });
  }

  /** Reidratação a partir de um snapshot persistido (repositório) — nunca valida de novo, já validado na criação. */
  static restaurar(props: PacienteProps): Paciente {
    // `arquivadoEm` e `consentimentoWhatsapp` foram adicionados depois de já
    // existirem pacientes salvos — um snapshot antigo chega sem essas chaves.
    return new Paciente({
      ...props,
      dataNascimento: normalizarDataCadastral(props.dataNascimento),
      arquivadoEm: props.arquivadoEm ?? null,
      consentimentoWhatsapp: normalizarConsentimentoWhatsapp(props.consentimentoWhatsapp),
      consentimentoCortesia: normalizarConsentimentoCortesia(props.consentimentoCortesia),
      consentimentoCampanhas: normalizarConsentimentoCortesia(props.consentimentoCampanhas),
      consentimentoCortesiaRevisao: normalizarRevisaoConsentimentoCortesia(props.consentimentoCortesiaRevisao),
    });
  }

  atualizar(input: AtualizarPacienteInput): void {
    if (input.nomeCompleto !== undefined) {
      const nome = input.nomeCompleto.trim();
      if (!nome) throw new ErroDominio('Nome completo é obrigatório.');
      this.props.nomeCompleto = nome;
    }
    if (input.dataNascimento !== undefined) this.props.dataNascimento = normalizarDataCadastral(input.dataNascimento);
    if (input.estadoCivil !== undefined) this.props.estadoCivil = input.estadoCivil;
    if (input.cpf !== undefined) this.props.cpf = input.cpf;
    if (input.rg !== undefined) this.props.rg = input.rg;
    if (input.endereco !== undefined) this.props.endereco = input.endereco;
    if (input.email !== undefined) this.props.email = input.email;
    if (input.celular !== undefined) this.props.celular = input.celular;
    if (input.indicadoPor !== undefined) this.props.indicadoPor = input.indicadoPor;
    this.props.atualizadoEm = agoraIso();
  }

  /**
   * Arquivar (pedido do usuário: "preservar histórico clínico quando um
   * paciente é arquivado") nunca apaga nada — só tira o paciente das
   * listagens padrão (`ListarPacientes`, `ListarPacientesRecentes`).
   * Anamnese, odontograma, planos e evolução continuam intactos e
   * acessíveis diretamente pela URL da ficha clínica.
   */
  arquivar(): void {
    if (this.props.arquivadoEm !== null) {
      throw new ErroDominio('Paciente já está arquivado.');
    }
    this.props.arquivadoEm = agoraIso();
    this.props.atualizadoEm = agoraIso();
  }

  reativar(): void {
    if (this.props.arquivadoEm === null) {
      throw new ErroDominio('Paciente não está arquivado.');
    }
    this.props.arquivadoEm = null;
    this.props.atualizadoEm = agoraIso();
  }

  /**
   * Registra o consentimento do paciente para WhatsApp — ação
   * deliberada da dentista. A regra da data de concessão fica em
   * `aplicarDefinicaoConsentimento` (value-object), não aqui.
   */
  definirConsentimentoWhatsapp(status: StatusConsentimentoWhatsapp, observacao: string): void {
    if (status !== 'AUTORIZADO' && status !== 'NAO_AUTORIZADO' && status !== 'NAO_INFORMADO') {
      throw new ErroDominio('Status de consentimento inválido.');
    }
    this.props.consentimentoWhatsapp = aplicarDefinicaoConsentimento(
      this.props.consentimentoWhatsapp,
      status,
      observacao,
    );
    this.props.atualizadoEm = agoraIso();
  }

  /**
   * Registra o consentimento do paciente para mensagem de ANIVERSÁRIO —
   * SEPARADO de `definirConsentimentoWhatsapp` e de
   * `definirConsentimentoCampanhas` abaixo; nunca lê nem escreve os
   * outros dois campos. `origem` default `CLINICA` porque hoje só a
   * tela do paciente (ação manual da equipe) chama isto.
   */
  definirConsentimentoCortesia(
    status: StatusConsentimentoCortesia,
    observacao: string,
    origem: OrigemConsentimentoCortesia = 'CLINICA',
  ): void {
    if (status !== 'AUTORIZADO' && status !== 'NAO_AUTORIZADO' && status !== 'NAO_INFORMADO') {
      throw new ErroDominio('Status de consentimento inválido.');
    }
    this.props.consentimentoCortesia = aplicarDefinicaoConsentimentoCortesia(
      this.props.consentimentoCortesia,
      status,
      observacao,
      origem,
    );
    // Uma decisão manual nova (qualquer que seja) torna obsoleta uma
    // pendência de revisão antiga — a equipe acabou de decidir de
    // próprio punho, não há mais nada "aguardando revisão".
    this.props.consentimentoCortesiaRevisao = null;
    this.props.atualizadoEm = agoraIso();
  }

  /**
   * Registra o consentimento do paciente para CAMPANHAS/outras
   * mensagens comemorativas — nunca aniversário (isso é
   * `definirConsentimentoCortesia` acima). Mesma independência total.
   */
  definirConsentimentoCampanhas(
    status: StatusConsentimentoCortesia,
    observacao: string,
    origem: OrigemConsentimentoCortesia = 'CLINICA',
  ): void {
    if (status !== 'AUTORIZADO' && status !== 'NAO_AUTORIZADO' && status !== 'NAO_INFORMADO') {
      throw new ErroDominio('Status de consentimento inválido.');
    }
    this.props.consentimentoCampanhas = aplicarDefinicaoConsentimentoCortesia(
      this.props.consentimentoCampanhas,
      status,
      observacao,
      origem,
    );
    this.props.atualizadoEm = agoraIso();
  }

  get estaArquivado(): boolean {
    return this.props.arquivadoEm !== null;
  }

  get consentimentoWhatsapp(): Readonly<ConsentimentoWhatsapp> {
    return this.props.consentimentoWhatsapp;
  }

  get consentimentoCortesia(): Readonly<ConsentimentoCortesia> {
    return this.props.consentimentoCortesia;
  }

  get consentimentoCampanhas(): Readonly<ConsentimentoCortesia> {
    return this.props.consentimentoCampanhas;
  }

  get consentimentoCortesiaRevisao(): Readonly<RevisaoConsentimentoCortesia> | null {
    return this.props.consentimentoCortesiaRevisao;
  }

  get id(): string {
    return this.props.id;
  }

  get nomeCompleto(): string {
    return this.props.nomeCompleto;
  }

  toSnapshot(): Readonly<PacienteProps> {
    return { ...this.props };
  }
}

/**
 * Um paciente "corresponde" ao termo de busca quando ele aparece em
 * qualquer campo de identificação — nome, CPF, RG, e-mail, celular,
 * endereço, estado civil ou quem indicou. Para os campos numéricos
 * (CPF/RG/celular) a comparação também roda só com os dígitos, dos dois
 * lados: assim "064269" acha "064.269.946-18" e "34999" acha
 * "(34) 99999-0000" sem a pessoa precisar digitar a pontuação. Termo
 * vazio corresponde a todo mundo (não filtra nada). É a REGRA do que
 * conta como "corresponde" — o passo de listar fica no caso de uso
 * `ListarPacientes`, que nunca reimplementa esta comparação.
 */
export function pacienteCorrespondeABusca(paciente: PacienteProps, termo: string): boolean {
  const alvo = termo.trim().toLowerCase();
  if (!alvo) return true;

  const textoJunto = [
    paciente.nomeCompleto,
    paciente.cpf,
    paciente.rg,
    paciente.email,
    paciente.celular,
    paciente.endereco,
    paciente.estadoCivil,
    paciente.indicadoPor,
  ]
    .filter((campo): campo is string => Boolean(campo))
    .join(' ')
    .toLowerCase();
  if (textoJunto.includes(alvo)) return true;

  const digitosAlvo = alvo.replace(/\D/g, '');
  if (!digitosAlvo) return false;
  return [paciente.cpf, paciente.rg, paciente.celular].some(
    (campo) => campo !== null && campo.replace(/\D/g, '').includes(digitosAlvo),
  );
}

/**
 * Idade em anos completos a partir da data de nascimento
 * (`YYYY-MM-DD`, formato de `<input type="date">`) — `null` quando não
 * informada.
 *
 * Achado real (pego pelo próprio teste automatizado, não em produção):
 * `new Date('2000-06-16')` é interpretado como meia-noite UTC — extrair
 * mês/dia dele com `getMonth()`/`getDate()` (getters de horário LOCAL)
 * podia devolver o dia ANTERIOR pra quem estivesse num fuso horário
 * atrás de UTC (ex.: Brasil, UTC-3), deslocando o cálculo de idade em
 * até 1 ano perto do aniversário. Corrigido lendo ano/mês/dia
 * diretamente da string, sem nenhuma conversão de fuso — a mesma data
 * que a pessoa digitou no campo, sem reinterpretação nenhuma.
 */
export function calcularIdade(dataNascimentoIso: string | null, hoje: Date = new Date()): number | null {
  const dataNormalizada = normalizarDataCadastral(dataNascimentoIso);
  if (!dataNormalizada || !dataCalendarioValida(dataNormalizada)) return null;
  const partes = dataNormalizada.split('-').map(Number);
  const [anoNascimento, mesNascimento, diaNascimento] = partes;
  if (partes.length !== 3 || [anoNascimento, mesNascimento, diaNascimento].some((n) => n === undefined || Number.isNaN(n))) {
    return null;
  }
  let idade = hoje.getFullYear() - anoNascimento!;
  const mesAtual = hoje.getMonth() + 1; // getMonth() é 0-indexado; a string de nascimento não é.
  const aniversarioJaPassouEsseAno =
    mesAtual > mesNascimento! || (mesAtual === mesNascimento! && hoje.getDate() >= diaNascimento!);
  if (!aniversarioJaPassouEsseAno) idade -= 1;
  return idade >= 0 ? idade : null;
}
