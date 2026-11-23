import { agoraIso, ErroDominio, gerarId } from '../types.js';
import { ehNumeroDenteValido, type NumeroDente } from '../value-objects/numeracao-dental.js';

export type StatusAssinaturaEvolucao = 'PENDENTE' | 'CONFIRMADO';

export interface EvolucaoClinicaProps {
  id: string;
  pacienteId: string;
  data: string;
  tratamentosRealizados: string;
  observacoes: string;
  statusAssinaturaPaciente: StatusAssinaturaEvolucao;
  /** Vínculo opcional com um dente do odontograma (pedido do usuário: "conectar com o histórico do odontograma"). */
  numeroDenteRelacionado: NumeroDente | null;
  criadoEm: string;
}

export interface RegistrarEvolucaoInput {
  pacienteId: string;
  data: string;
  tratamentosRealizados: string;
  observacoes: string;
  numeroDenteRelacionado: number | null;
}

/**
 * Evolução clínica (docx: "Tratamentos realizados" + assinatura do
 * paciente por sessão) — histórico cronológico de atendimentos,
 * imutável depois de criado (é um registro de fato ocorrido, não um
 * cadastro a ser corrigido; um lançamento errado se corrige com um
 * novo lançamento explicando a correção, nunca reescrevendo o
 * passado — mesmo princípio já usado no restante do domínio clínico).
 */
export class EvolucaoClinica {
  private constructor(private props: EvolucaoClinicaProps) {}

  static registrar(input: RegistrarEvolucaoInput): EvolucaoClinica {
    if (!input.pacienteId) {
      throw new ErroDominio('Evolução clínica precisa estar vinculada a um paciente.');
    }
    if (!input.tratamentosRealizados.trim()) {
      throw new ErroDominio('Descreva os tratamentos realizados.');
    }
    if (!input.data) {
      throw new ErroDominio('Data da evolução é obrigatória.');
    }
    if (input.numeroDenteRelacionado !== null && !ehNumeroDenteValido(input.numeroDenteRelacionado)) {
      throw new ErroDominio(`Número de dente inválido: ${input.numeroDenteRelacionado}.`);
    }
    return new EvolucaoClinica({
      id: gerarId(),
      pacienteId: input.pacienteId,
      data: input.data,
      tratamentosRealizados: input.tratamentosRealizados.trim(),
      observacoes: input.observacoes.trim(),
      statusAssinaturaPaciente: 'PENDENTE',
      numeroDenteRelacionado: input.numeroDenteRelacionado as NumeroDente | null,
      criadoEm: agoraIso(),
    });
  }

  static restaurar(props: EvolucaoClinicaProps): EvolucaoClinica {
    return new EvolucaoClinica(props);
  }

  confirmarAssinaturaPaciente(): void {
    this.props.statusAssinaturaPaciente = 'CONFIRMADO';
  }

  get id(): string {
    return this.props.id;
  }

  get pacienteId(): string {
    return this.props.pacienteId;
  }

  toSnapshot(): Readonly<EvolucaoClinicaProps> {
    return { ...this.props };
  }
}
