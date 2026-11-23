import { agoraIso, ErroDominio, gerarId } from '../types.js';
import { TAXA_EMERGENCIA_CENTAVOS } from '../value-objects/atendimento-emergencia.js';
import { ARCADA_SUPERIOR, ARCADA_INFERIOR, ehNumeroDenteValido, type NumeroDente } from '../value-objects/numeracao-dental.js';

export interface ItemTratamento {
  id: string;
  numeroDente: NumeroDente | null;
  numerosDentes?: NumeroDente[];
  todosOsDentes?: boolean;
  registroDentalId?: string | null;
  /** Alternativa/complemento ao dente: "arcada superior", "quadrante 3", "região anterior"... */
  regiao: string;
  trabalhoAExecutar: string;
  /** Preço UNITÁRIO — o total da linha é `valorCentavos * quantidade`. */
  valorCentavos: number;
  /** Quantas vezes o procedimento se repete nesta linha (ex.: 2 restaurações iguais). `1` no caso comum. */
  quantidade: number;
  concluido: boolean;
  observacao: string;
  /**
   * Referência ao procedimento do catálogo que originou este item —
   * `null` para um item de texto livre (sempre permitido). Só serve
   * pra preencher o formulário de novo e, ao concluir o item, decidir
   * se gera um follow-up automático (`intervaloRetornoDias` do
   * procedimento). NUNCA é a fonte de verdade do preço: `valorCentavos`
   * acima é sempre copiado e congelado no momento em que o item é
   * adicionado — editar o procedimento no catálogo depois nunca muda
   * orçamentos já criados.
   */
  procedimentoId: string | null;
}

export interface NovoItemTratamentoInput {
  numeroDente: number | null;
  numerosDentes?: number[];
  todosOsDentes?: boolean;
  registroDentalId?: string | null;
  regiao?: string;
  trabalhoAExecutar: string;
  valorCentavos: number;
  /** Padrão `1` quando ausente. */
  quantidade?: number;
  observacao?: string;
  procedimentoId?: string | null;
}

/** Editar reaproveita exatamente a mesma forma de entrada de um item novo. */
export type EditarItemTratamentoInput = NovoItemTratamentoInput;

export interface Pagamento {
  id: string;
  data: string;
  valorCentavos: number;
  /** Forma de pagamento em texto livre ("Dinheiro", "PIX", "Cartão de crédito"...). */
  metodo: string;
  confirmadoPeloPaciente: boolean;
  confirmadoPelaDentista: boolean;
  observacao: string;
  /**
   * Id do comprovante anexado (Etapa 54) — opaco, gerado pelo servidor
   * no upload; `null` quando este pagamento não tem comprovante. Nunca
   * o arquivo em si: os bytes vivem numa coleção própria de
   * comprovantes (ver `application/ports/gateway-comprovantes.ts`),
   * separada da de arquivos de paciente.
   */
  comprovanteArquivoId: string | null;
}

export interface NovoPagamentoInput {
  data: string;
  valorCentavos: number;
  metodo?: string;
  confirmadoPeloPaciente: boolean;
  confirmadoPelaDentista: boolean;
  observacao: string;
  /** Opcional — anexar um comprovante nunca é obrigatório pra registrar um pagamento. */
  comprovanteArquivoId?: string | null;
}

export type StatusPlanoTratamento = 'ATIVO' | 'CONCLUIDO' | 'CANCELADO';

export interface CondicoesDePagamento {
  descontoAVistaPercentual: number | null;
  percentualEntrada: number | null;
  parcelasCartaoSemJuros: number | null;
  observacoes: string;
}

export interface PlanoTratamentoProps {
  id: string;
  pacienteId: string;
  itens: ItemTratamento[];
  pagamentos: Pagamento[];
  condicoesDePagamento: CondicoesDePagamento;
  /**
   * Quando `true`, este orçamento inclui a taxa de atendimento de
   * emergência (R$ 150,00 — ver `value-objects/atendimento-emergencia.ts`)
   * somada ao total. Alterar isto é sempre ação explícita
   * (`definirEmergencia`) e nunca mexe nos pagamentos já lançados.
   */
  emergencia: boolean;
  taxaEmergenciaCentavos?: number;
  status: StatusPlanoTratamento;
  validoAte: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

const DIAS_VALIDADE_ORCAMENTO = 90;

function calcularValidade(criadoEm: string): string {
  const data = new Date(criadoEm);
  data.setDate(data.getDate() + DIAS_VALIDADE_ORCAMENTO);
  return data.toISOString();
}

function validarDadosDeItem(input: NovoItemTratamentoInput): void {
  if (!input.trabalhoAExecutar.trim()) {
    throw new ErroDominio('Descreva o trabalho a executar.');
  }
  if (!Number.isSafeInteger(input.valorCentavos) || input.valorCentavos < 0) {
    throw new ErroDominio('Valor não pode ser negativo.');
  }
  if (input.numeroDente !== null && !ehNumeroDenteValido(input.numeroDente)) {
    throw new ErroDominio(`Número de dente inválido: ${input.numeroDente}.`);
  }
  if (input.numerosDentes !== undefined && (!Array.isArray(input.numerosDentes) || input.numerosDentes.some(n => !ehNumeroDenteValido(n)))) {
    throw new ErroDominio('Informe dentes válidos, separados por vírgula ou ponto e vírgula.');
  }
  if (input.todosOsDentes !== undefined && typeof input.todosOsDentes !== 'boolean') throw new ErroDominio('Seleção de dentes inválida.');
  if (input.registroDentalId != null && (typeof input.registroDentalId !== 'string' || input.registroDentalId.length > 200)) throw new ErroDominio('Registro do odontograma inválido.');
  if (input.quantidade != null && (!Number.isSafeInteger(input.quantidade) || input.quantidade < 1)) {
    throw new ErroDominio('Quantidade precisa ser um número inteiro de pelo menos 1.');
  }
  if (!Number.isSafeInteger(input.valorCentavos * (input.quantidade ?? 1))) {
    throw new ErroDominio('O valor total deste trabalho excede o limite permitido.');
  }
}

/**
 * Plano de Tratamento (docx: tabela "DENTE / TRABALHO A EXECUTAR /
 * VALOR" + "Plano de Pagamento" + "Pagamentos Efetuados"). Orçamento
 * válido por 90 dias a partir da criação, como no documento original
 * ("Orçamento válido por 90 dias").
 *
 * Histórico preservado: cada paciente pode ter vários planos ao longo
 * do tempo (um por orçamento), cada um com seu próprio status. Editar
 * um item ou remover um pagamento é sempre ação explícita da dentista
 * neste plano — nunca reescreve outro plano nem apaga nada em silêncio.
 */
export class PlanoTratamento {
  private constructor(private props: PlanoTratamentoProps) {}

  static criar(pacienteId: string): PlanoTratamento {
    if (!pacienteId) throw new ErroDominio('Plano de tratamento precisa estar vinculado a um paciente.');
    const agora = agoraIso();
    return new PlanoTratamento({
      id: gerarId(),
      pacienteId,
      itens: [],
      pagamentos: [],
      condicoesDePagamento: {
        descontoAVistaPercentual: null,
        percentualEntrada: null,
        parcelasCartaoSemJuros: null,
        observacoes: '',
      },
      emergencia: false,
      taxaEmergenciaCentavos: TAXA_EMERGENCIA_CENTAVOS,
      status: 'ATIVO',
      validoAte: calcularValidade(agora),
      criadoEm: agora,
      atualizadoEm: agora,
    });
  }

  static restaurar(props: PlanoTratamentoProps): PlanoTratamento {
    // `regiao`/`observacao` (item), `metodo` (pagamento) e `emergencia` (plano)
    // foram adicionados depois de já existirem planos salvos — um snapshot
    // antigo chega sem essas chaves. `comprovanteArquivoId` (Etapa 54) é
    // a mais nova: um pagamento anterior a esta etapa nunca teve
    // comprovante, então `null` é o valor correto, não uma migração.
    return new PlanoTratamento({
      ...props,
      emergencia: props.emergencia ?? false,
      taxaEmergenciaCentavos: props.taxaEmergenciaCentavos ?? 15000,
      itens: props.itens.map((i) => ({
        ...i,
        regiao: i.regiao ?? '',
        observacao: i.observacao ?? '',
        procedimentoId: i.procedimentoId ?? null,
        quantidade: i.quantidade ?? 1,
      })),
      pagamentos: props.pagamentos.map((p) => ({
        ...p,
        metodo: p.metodo ?? '',
        comprovanteArquivoId: p.comprovanteArquivoId ?? null,
      })),
    });
  }

  adicionarItem(input: NovoItemTratamentoInput): void {
    validarDadosDeItem(input);
    this.props.itens.push({
      id: gerarId(),
      numeroDente: (input.todosOsDentes ? ARCADA_SUPERIOR[0]! : input.numerosDentes?.[0] ?? input.numeroDente) as NumeroDente | null,
      numerosDentes: input.todosOsDentes ? [...ARCADA_SUPERIOR, ...ARCADA_INFERIOR] : [...new Set(input.numerosDentes ?? (input.numeroDente === null ? [] : [input.numeroDente]))] as NumeroDente[],
      todosOsDentes: input.todosOsDentes ?? false,
      registroDentalId: input.registroDentalId ?? null,
      regiao: (input.regiao ?? '').trim(),
      trabalhoAExecutar: input.trabalhoAExecutar.trim(),
      valorCentavos: input.valorCentavos,
      quantidade: input.quantidade ?? 1,
      concluido: false,
      observacao: (input.observacao ?? '').trim(),
      procedimentoId: input.procedimentoId ?? null,
    });
    this.props.atualizadoEm = agoraIso();
  }

  /** Edita um item existente sem mexer no seu `id` nem no estado "concluído". */
  editarItem(itemId: string, input: EditarItemTratamentoInput): void {
    const item = this.props.itens.find((i) => i.id === itemId);
    if (!item) throw new ErroDominio('Item de tratamento não encontrado.');
    validarDadosDeItem(input);
    item.numeroDente = (input.todosOsDentes ? ARCADA_SUPERIOR[0]! : input.numerosDentes?.[0] ?? input.numeroDente) as NumeroDente | null;
    item.numerosDentes = input.todosOsDentes ? [...ARCADA_SUPERIOR, ...ARCADA_INFERIOR] : [...new Set(input.numerosDentes ?? (input.numeroDente === null ? [] : [input.numeroDente]))] as NumeroDente[];
    item.todosOsDentes = input.todosOsDentes ?? false;
    item.registroDentalId = input.registroDentalId ?? null;
    item.regiao = (input.regiao ?? '').trim();
    item.trabalhoAExecutar = input.trabalhoAExecutar.trim();
    item.valorCentavos = input.valorCentavos;
    item.quantidade = input.quantidade ?? 1;
    item.observacao = (input.observacao ?? '').trim();
    item.procedimentoId = input.procedimentoId ?? null;
    this.props.atualizadoEm = agoraIso();
  }

  marcarItemConcluido(itemId: string, concluido: boolean): void {
    const item = this.props.itens.find((i) => i.id === itemId);
    if (!item) throw new ErroDominio('Item de tratamento não encontrado.');
    item.concluido = concluido;
    this.props.atualizadoEm = agoraIso();
  }

  removerItem(itemId: string): void {
    const antes = this.props.itens.length;
    this.props.itens = this.props.itens.filter((i) => i.id !== itemId);
    if (this.props.itens.length === antes) {
      throw new ErroDominio('Item de tratamento não encontrado.');
    }
    this.props.atualizadoEm = agoraIso();
  }

  registrarPagamento(input: NovoPagamentoInput): void {
    if (!Number.isSafeInteger(input.valorCentavos) || input.valorCentavos <= 0) {
      throw new ErroDominio('Valor do pagamento deve ser maior que zero.');
    }
    if (!input.data) {
      throw new ErroDominio('Data do pagamento é obrigatória.');
    }
    this.props.pagamentos.push({
      id: gerarId(),
      data: input.data,
      valorCentavos: input.valorCentavos,
      metodo: (input.metodo ?? '').trim(),
      confirmadoPeloPaciente: input.confirmadoPeloPaciente,
      confirmadoPelaDentista: input.confirmadoPelaDentista,
      observacao: input.observacao.trim(),
      comprovanteArquivoId: input.comprovanteArquivoId ?? null,
    });
    this.props.atualizadoEm = agoraIso();
  }

  /** Id do comprovante do pagamento, ou `null` — usado antes de remover, pra também limpar o arquivo. */
  comprovanteDoPagamento(pagamentoId: string): string | null {
    return this.props.pagamentos.find((p) => p.id === pagamentoId)?.comprovanteArquivoId ?? null;
  }

  /**
   * Vincula o comprovante a um pagamento JÁ registrado (Etapa 54) — o
   * upload do arquivo só pode acontecer DEPOIS que o pagamento existe
   * (o id do pagamento é gerado por `registrarPagamento`, não escolhido
   * de fora), então este é o segundo passo do fluxo de "registrar
   * pagamento com comprovante" na tela. Sobrescreve um comprovante
   * anterior deste MESMO pagamento, se houver (a tela decide se avisa).
   */
  anexarComprovante(pagamentoId: string, arquivoId: string): void {
    const pagamento = this.props.pagamentos.find((p) => p.id === pagamentoId);
    if (!pagamento) throw new ErroDominio('Pagamento não encontrado.');
    pagamento.comprovanteArquivoId = arquivoId;
    this.props.atualizadoEm = agoraIso();
  }

  /** Remove um pagamento lançado por engano — ação explícita, não um acerto silencioso. */
  removerPagamento(pagamentoId: string): void {
    const antes = this.props.pagamentos.length;
    this.props.pagamentos = this.props.pagamentos.filter((p) => p.id !== pagamentoId);
    if (this.props.pagamentos.length === antes) {
      throw new ErroDominio('Pagamento não encontrado.');
    }
    this.props.atualizadoEm = agoraIso();
  }

  definirCondicoesDePagamento(condicoes: CondicoesDePagamento): void {
    for (const percentual of [condicoes.descontoAVistaPercentual, condicoes.percentualEntrada]) {
      if (percentual !== null && (!Number.isFinite(percentual) || percentual < 0 || percentual > 100)) {
        throw new ErroDominio('Informe um percentual entre 0 e 100.');
      }
    }
    if (condicoes.parcelasCartaoSemJuros !== null && (!Number.isSafeInteger(condicoes.parcelasCartaoSemJuros) || condicoes.parcelasCartaoSemJuros < 1)) {
      throw new ErroDominio('Informe uma quantidade inteira de parcelas, maior que zero.');
    }
    this.props.condicoesDePagamento = { ...condicoes };
    this.props.atualizadoEm = agoraIso();
  }

  /**
   * Marca/desmarca este orçamento como atendimento de emergência.
   * Só mexe no cálculo do total (a taxa entra/sai) — nunca altera
   * item nem pagamento já lançado. Recalcular o saldo depois disso é
   * consequência esperada e explícita desta ação.
   */
  definirEmergencia(valor: boolean): void {
    this.props.emergencia = valor;
    this.props.atualizadoEm = agoraIso();
  }

  definirStatus(status: StatusPlanoTratamento): void {
    this.props.status = status;
    this.props.atualizadoEm = agoraIso();
  }

  get id(): string {
    return this.props.id;
  }

  get pacienteId(): string {
    return this.props.pacienteId;
  }

  toSnapshot(): Readonly<PlanoTratamentoProps> {
    return { ...this.props, itens: [...this.props.itens], pagamentos: [...this.props.pagamentos] };
  }
}

export interface ResumoFinanceiroPlano {
  /** Soma dos trabalhos a executar — o valor "normal" da consulta/tratamento. */
  valorItensCentavos: number;
  /** R$ 150,00 quando o orçamento é de emergência; 0 caso contrário. */
  taxaEmergenciaCentavos: number;
  /** `valorItensCentavos + taxaEmergenciaCentavos` — o total planejado. */
  valorTotalCentavos: number;
  valorPagoCentavos: number;
  saldoDevedorCentavos: number;
}

/**
 * Soma de itens (+ taxa de emergência, se for o caso) vs. soma de
 * pagamentos — pura função de domínio, testável sem tocar UI/
 * armazenamento (nenhum item de tratamento "concluído" muda o valor
 * devido: concluir um trabalho não é o mesmo que ele estar pago, os
 * dois são controlados separadamente, como no documento original —
 * "Trabalho a executar" e "Pagamentos Efetuados" são tabelas
 * distintas). A taxa de emergência é a regra de negócio de
 * `value-objects/atendimento-emergencia.ts` aplicada aqui, num lugar
 * só.
 */
export function calcularResumoFinanceiro(plano: PlanoTratamentoProps): ResumoFinanceiroPlano {
  const valorItensCentavos = plano.itens.reduce((soma, item) => soma + item.valorCentavos * (item.quantidade ?? 1), 0);
  const taxaEmergenciaCentavos = plano.emergencia ? (plano.taxaEmergenciaCentavos ?? 15000) : 0;
  const valorTotalCentavos = valorItensCentavos + taxaEmergenciaCentavos;
  const valorPagoCentavos = plano.pagamentos.reduce((soma, pagamento) => soma + pagamento.valorCentavos, 0);
  return {
    valorItensCentavos,
    taxaEmergenciaCentavos,
    valorTotalCentavos,
    valorPagoCentavos,
    saldoDevedorCentavos: valorTotalCentavos - valorPagoCentavos,
  };
}

export interface PlanoDePagamentoCalculado {
  totalCentavos: number;
  /** À vista com desconto — `null` quando não há desconto definido. */
  descontoAVistaCentavos: number | null;
  totalComDescontoAVistaCentavos: number | null;
  /** Entrada — `null` quando não há % de entrada definido. */
  entradaCentavos: number | null;
  saldoAposEntradaCentavos: number | null;
  parcelas: number | null;
  /** Valor aproximado de cada parcela (arredondado pra cima). */
  valorParcelaCentavos: number | null;
}

/**
 * Converte as condições de pagamento (percentuais) em valores concretos
 * de real pro orçamento — desconto à vista, entrada e valor de cada
 * parcela. Pura: recebe o total já calculado e as condições, devolve os
 * números. A UI só formata; nunca faz esta conta.
 */
export function calcularPlanoDePagamento(
  totalCentavos: number,
  condicoes: CondicoesDePagamento,
): PlanoDePagamentoCalculado {
  const pctDesconto = condicoes.descontoAVistaPercentual;
  const descontoAVistaCentavos =
    pctDesconto && pctDesconto > 0 ? Math.round((totalCentavos * pctDesconto) / 100) : null;
  const totalComDescontoAVistaCentavos =
    descontoAVistaCentavos !== null ? totalCentavos - descontoAVistaCentavos : null;

  const pctEntrada = condicoes.percentualEntrada;
  const entradaCentavos = pctEntrada && pctEntrada > 0 ? Math.round((totalCentavos * pctEntrada) / 100) : null;
  const saldoAposEntradaCentavos = entradaCentavos !== null ? totalCentavos - entradaCentavos : null;

  const parcelas =
    condicoes.parcelasCartaoSemJuros && condicoes.parcelasCartaoSemJuros > 0
      ? condicoes.parcelasCartaoSemJuros
      : null;
  const baseParcelamento = saldoAposEntradaCentavos ?? totalCentavos;
  const valorParcelaCentavos = parcelas ? Math.ceil(baseParcelamento / parcelas) : null;

  return {
    totalCentavos,
    descontoAVistaCentavos,
    totalComDescontoAVistaCentavos,
    entradaCentavos,
    saldoAposEntradaCentavos,
    parcelas,
    valorParcelaCentavos,
  };
}
