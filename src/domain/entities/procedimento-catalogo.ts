import { agoraIso, ErroDominio, gerarId } from '../types.js';

/**
 * Catálogo editável de procedimentos odontológicos — item reutilizável
 * de preço/nome que um orçamento (Plano de Tratamento) pode referenciar
 * em vez de digitar tudo à mão toda vez. Nunca é a fonte de verdade do
 * valor de um orçamento já criado: `ItemTratamento.procedimentoId`
 * (ver `plano-tratamento.ts`) guarda só a referência para preencher o
 * formulário; o preço efetivo de cada item é sempre copiado e congelado
 * no próprio item no momento em que é adicionado — editar um
 * procedimento do catálogo depois nunca muda orçamentos já criados.
 */

export interface ProcedimentoCatalogoProps {
  id: string;
  nome: string;
  categoria: string;
  /** Preço fixo, em centavos. `null` quando o procedimento usa faixa (`precoMinimoCentavos`/`precoMaximoCentavos`) em vez de preço fixo. */
  precoCentavos: number | null;
  /** Faixa de preço (ex.: extração infantil) — os dois sempre juntos, nunca um só. `null`/`null` quando o procedimento usa preço fixo. */
  precoMinimoCentavos: number | null;
  precoMaximoCentavos: number | null;
  ativo: boolean;
  /** Intervalo padrão de retorno/revisão, em dias, para gerar um follow-up automático ao concluir um item deste procedimento. `null` = sem retorno automático. */
  intervaloRetornoDias: number | null;
  /** Nota interna da clínica — nunca aparece em orçamento impresso. */
  observacaoInterna: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface NovoProcedimentoCatalogoInput {
  nome: string;
  categoria: string;
  precoCentavos?: number | null;
  precoMinimoCentavos?: number | null;
  precoMaximoCentavos?: number | null;
  intervaloRetornoDias?: number | null;
  observacaoInterna?: string;
}

export type EditarProcedimentoCatalogoInput = NovoProcedimentoCatalogoInput;

function validarPreco(input: {
  precoCentavos?: number | null;
  precoMinimoCentavos?: number | null;
  precoMaximoCentavos?: number | null;
}): void {
  const temFixo = input.precoCentavos != null;
  const temFaixa = input.precoMinimoCentavos != null || input.precoMaximoCentavos != null;
  if (temFixo && temFaixa) {
    throw new ErroDominio('Um procedimento não pode ter preço fixo e faixa de preço ao mesmo tempo.');
  }
  if (temFaixa) {
    if (input.precoMinimoCentavos == null || input.precoMaximoCentavos == null) {
      throw new ErroDominio('Faixa de preço precisa de valor mínimo e máximo.');
    }
    if (input.precoMinimoCentavos < 0 || input.precoMaximoCentavos < 0) {
      throw new ErroDominio('Preço não pode ser negativo.');
    }
    if (input.precoMinimoCentavos > input.precoMaximoCentavos) {
      throw new ErroDominio('O preço mínimo não pode ser maior que o máximo.');
    }
  }
  if (temFixo && input.precoCentavos! < 0) {
    throw new ErroDominio('Preço não pode ser negativo.');
  }
}

export class ProcedimentoCatalogo {
  private constructor(private props: ProcedimentoCatalogoProps) {}

  /**
   * `idEstavel` permite que a semente inicial (ver `procedimentos-catalogo-semente.ts`)
   * use um id determinístico (`seed-canal-incisivo`, etc.) em vez de um
   * UUID aleatório — é o que torna reexecutar a semente idempotente
   * (reconhece "este procedimento já existe" pelo id, nunca pelo nome).
   */
  static criar(input: NovoProcedimentoCatalogoInput, idEstavel?: string): ProcedimentoCatalogo {
    const nome = input.nome.trim();
    if (!nome) throw new ErroDominio('Nome do procedimento é obrigatório.');
    const categoria = input.categoria.trim();
    if (!categoria) throw new ErroDominio('Categoria do procedimento é obrigatória.');
    validarPreco(input);
    if (input.intervaloRetornoDias != null && input.intervaloRetornoDias < 1) {
      throw new ErroDominio('Intervalo de retorno precisa ser de pelo menos 1 dia.');
    }

    const agora = agoraIso();
    return new ProcedimentoCatalogo({
      id: idEstavel ?? gerarId(),
      nome,
      categoria,
      precoCentavos: input.precoCentavos ?? null,
      precoMinimoCentavos: input.precoMinimoCentavos ?? null,
      precoMaximoCentavos: input.precoMaximoCentavos ?? null,
      ativo: true,
      intervaloRetornoDias: input.intervaloRetornoDias ?? null,
      observacaoInterna: (input.observacaoInterna ?? '').trim(),
      criadoEm: agora,
      atualizadoEm: agora,
    });
  }

  static restaurar(props: ProcedimentoCatalogoProps): ProcedimentoCatalogo {
    return new ProcedimentoCatalogo({
      ...props,
      precoMinimoCentavos: props.precoMinimoCentavos ?? null,
      precoMaximoCentavos: props.precoMaximoCentavos ?? null,
      intervaloRetornoDias: props.intervaloRetornoDias ?? null,
      observacaoInterna: props.observacaoInterna ?? '',
    });
  }

  editar(input: EditarProcedimentoCatalogoInput): void {
    const nome = input.nome.trim();
    if (!nome) throw new ErroDominio('Nome do procedimento é obrigatório.');
    const categoria = input.categoria.trim();
    if (!categoria) throw new ErroDominio('Categoria do procedimento é obrigatória.');
    validarPreco(input);
    if (input.intervaloRetornoDias != null && input.intervaloRetornoDias < 1) {
      throw new ErroDominio('Intervalo de retorno precisa ser de pelo menos 1 dia.');
    }
    this.props.nome = nome;
    this.props.categoria = categoria;
    this.props.precoCentavos = input.precoCentavos ?? null;
    this.props.precoMinimoCentavos = input.precoMinimoCentavos ?? null;
    this.props.precoMaximoCentavos = input.precoMaximoCentavos ?? null;
    this.props.intervaloRetornoDias = input.intervaloRetornoDias ?? null;
    this.props.observacaoInterna = (input.observacaoInterna ?? '').trim();
    this.props.atualizadoEm = agoraIso();
  }

  /**
   * Nunca remove de verdade — um procedimento pode já estar referenciado
   * por orçamentos antigos (`ItemTratamento.procedimentoId`), e apagar
   * quebraria a navegação "ver procedimento" a partir de um item
   * histórico. Desativar só tira da lista de busca do orçamento.
   */
  ativar(): void {
    this.props.ativo = true;
    this.props.atualizadoEm = agoraIso();
  }

  desativar(): void {
    this.props.ativo = false;
    this.props.atualizadoEm = agoraIso();
  }

  get id(): string {
    return this.props.id;
  }

  get nome(): string {
    return this.props.nome;
  }

  get ativo(): boolean {
    return this.props.ativo;
  }

  get precoFaixa(): boolean {
    return this.props.precoMinimoCentavos != null && this.props.precoMaximoCentavos != null;
  }

  get intervaloRetornoDias(): number | null {
    return this.props.intervaloRetornoDias;
  }

  toSnapshot(): Readonly<ProcedimentoCatalogoProps> {
    return { ...this.props };
  }
}
