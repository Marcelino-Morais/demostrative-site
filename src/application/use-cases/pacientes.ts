import {
  Paciente,
  pacienteCorrespondeABusca,
  type AtualizarPacienteInput,
  type NovoPacienteInput,
} from '../../domain/entities/paciente.js';
import { ErroDominio } from '../../domain/types.js';
import type { StatusConsentimentoCortesia } from '../../domain/value-objects/consentimento-cortesia.js';
import type { PortaRevisaoConsentimentoCortesia } from '../ports/porta-revisao-consentimento-cortesia.js';
import type { RepositorioPacientes } from '../ports/repositorios.js';

/**
 * Dados cadastrais (identidade/contato) de um paciente — nome,
 * nascimento, CPF, RG, endereço, e-mail, celular, indicado por. Uma vez
 * cadastrado, NENHUM perfil pode editar estes campos por este sistema
 * (achado explícito do pedido: esconder campo/botão na tela não basta).
 * Informações assistenciais/operacionais (consultas, planos, evolução,
 * odontograma, arquivamento, consentimento) ficam de fora de propósito
 * — continuam editáveis pelos seus próprios fluxos.
 */
export const CAMPOS_CADASTRAIS_PACIENTE = [
  'nomeCompleto',
  'dataNascimento',
  'estadoCivil',
  'cpf',
  'rg',
  'endereco',
  'email',
  'celular',
  'indicadoPor',
] as const satisfies readonly (keyof AtualizarPacienteInput)[];

export class CriarPaciente {
  constructor(private readonly pacientes: RepositorioPacientes) {}

  async executar(input: NovoPacienteInput): Promise<Paciente> {
    const paciente = Paciente.criar(input);
    await this.pacientes.salvar(paciente);
    return paciente;
  }
}

/**
 * Trava dos dados cadastrais de um paciente JÁ EXISTENTE — defesa em
 * profundidade do lado do app (o servidor tem a MESMA trava,
 * autoritativa, em `server/index.mjs`/`mesclarAtualizacaoPaciente`; esta
 * aqui também protege o modo 100% local, sem servidor). Qualquer
 * tentativa de mudar nome/nascimento/CPF/RG/contato/endereço de quem já
 * existe é recusada — "cadastro inicial" (paciente novo, `CriarPaciente`
 * acima) nunca passa por aqui.
 */
export class AtualizarPaciente {
  constructor(private readonly pacientes: RepositorioPacientes) {}

  async executar(id: string, input: AtualizarPacienteInput): Promise<Paciente> {
    const paciente = await this.pacientes.buscarPorId(id);
    if (!paciente) throw new ErroDominio('Paciente não encontrado.');
    const atual = paciente.toSnapshot();
    const divergentes = CAMPOS_CADASTRAIS_PACIENTE.filter((campo) => {
      const valor = input[campo];
      return valor !== undefined && (valor || null) !== (atual[campo] ?? null);
    });
    if (divergentes.length > 0) {
      throw new ErroDominio(
        'Dados cadastrais não podem ser editados por aqui — ainda não existe um fluxo de correção autorizado neste sistema.',
      );
    }
    paciente.atualizar(input);
    await this.pacientes.salvar(paciente);
    return paciente;
  }
}

/**
 * `incluirArquivados` pedido explícito (Etapa 5 — ciclo de vida do
 * paciente): arquivar "preserva o histórico clínico" (nunca apaga
 * nada), mas por padrão some das listagens do dia a dia — senão a
 * lista principal viraria uma mistura de casos ativos e encerrados. A
 * tela de pacientes decide se quer ver os arquivados também; ela
 * nunca filtra por conta própria.
 *
 * `termo` (Etapa 7 — usabilidade): a busca da lista de pacientes é
 * feita AQUI, não no componente React. A tela só passa o texto
 * digitado; QUAIS campos contam (nome, CPF, RG, e-mail, celular,
 * endereço, estado civil, indicação) e COMO comparar (inclusive só por
 * dígitos, pra telefone) é regra de domínio (`pacienteCorrespondeABusca`)
 * — EXCETO CPF/RG, que não dá mais pra comparar no navegador (a resposta
 * comum de `listarTodos()` nunca traz o valor completo): quando o termo
 * tem dígito, une o resultado local com `buscarIdsPorDocumento` (busca
 * de verdade no SERVIDOR, nunca compara nada em claro aqui).
 */
export class ListarPacientes {
  constructor(private readonly pacientes: RepositorioPacientes) {}

  async executar(incluirArquivados = false, termo = ''): Promise<Paciente[]> {
    const todos = await this.pacientes.listarTodos();
    const digitosTermo = termo.replace(/\D/g, '');
    const idsPorDocumento =
      digitosTermo.length >= 3 && this.pacientes.buscarIdsPorDocumento
        ? new Set(await this.pacientes.buscarIdsPorDocumento(termo.trim()))
        : null;
    const filtrados = todos.filter((p) => {
      if (!incluirArquivados && p.estaArquivado) return false;
      if (idsPorDocumento?.has(p.id)) return true;
      return pacienteCorrespondeABusca(p.toSnapshot(), termo);
    });
    return [...filtrados].sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR'));
  }
}

/**
 * Achado real de revisão SOLID (Etapa 2 — auditoria/hardening): esta
 * regra ("recente" = por `atualizadoEm`, limitado a N) morava direto em
 * `home-page.tsx`, um vazamento de lógica de negócio pra dentro de um
 * componente React. Extraído aqui — a mesma decisão que já valia pra
 * `ListarEvolucoesRecentes` (`use-cases/evolucao.ts`), agora consistente
 * também pra pacientes. Limite padrão de 4 pedido explicitamente na
 * revisão seguinte (Etapa 2 — hardening adicional); a tela (`home-page.tsx`)
 * só renderiza o que este caso de uso devolve, nunca decide o "quantos".
 */
export class ListarPacientesRecentes {
  constructor(private readonly pacientes: RepositorioPacientes) {}

  async executar(limite = 4): Promise<Paciente[]> {
    const todos = await this.pacientes.listarTodos();
    return [...todos]
      .filter((p) => !p.estaArquivado)
      .sort((a, b) => b.toSnapshot().atualizadoEm.localeCompare(a.toSnapshot().atualizadoEm))
      .slice(0, limite);
  }
}

export class ObterPaciente {
  constructor(private readonly pacientes: RepositorioPacientes) {}

  async executar(id: string): Promise<Paciente | undefined> {
    return this.pacientes.buscarPorId(id);
  }
}

export class RemoverPaciente {
  constructor(private readonly pacientes: RepositorioPacientes) {}

  async executar(id: string): Promise<void> {
    await this.pacientes.remover(id);
  }
}

async function carregarPacienteOuFalhar(pacientes: RepositorioPacientes, id: string): Promise<Paciente> {
  const paciente = await pacientes.buscarPorId(id);
  if (!paciente) throw new ErroDominio('Paciente não encontrado.');
  return paciente;
}

/** Nunca apaga nada — só marca o paciente como fora das listagens padrão. Ver `Paciente.arquivar`. */
export class ArquivarPaciente {
  constructor(private readonly pacientes: RepositorioPacientes) {}

  async executar(id: string): Promise<Paciente> {
    const paciente = await carregarPacienteOuFalhar(this.pacientes, id);
    paciente.arquivar();
    await this.pacientes.salvar(paciente);
    return paciente;
  }
}

export class ReativarPaciente {
  constructor(private readonly pacientes: RepositorioPacientes) {}

  async executar(id: string): Promise<Paciente> {
    const paciente = await carregarPacienteOuFalhar(this.pacientes, id);
    paciente.reativar();
    await this.pacientes.salvar(paciente);
    return paciente;
  }
}

/**
 * Consentimento de mensagem de cortesia (aniversário/comemorativa) —
 * SEPARADO do consentimento de WhatsApp para lembrete de consulta
 * (`whatsapp-itens`). Ver `Paciente.definirConsentimentoCortesia`.
 */
export class DefinirConsentimentoCortesia {
  constructor(private readonly pacientes: RepositorioPacientes) {}

  async executar(id: string, status: StatusConsentimentoCortesia, observacao: string): Promise<Paciente> {
    const paciente = await carregarPacienteOuFalhar(this.pacientes, id);
    paciente.definirConsentimentoCortesia(status, observacao);
    await this.pacientes.salvar(paciente);
    return paciente;
  }
}

/**
 * Ação EXPLÍCITA da equipe sobre uma pendência de revisão de
 * consentimento de aniversário (gerada pela sincronização do Google
 * Forms — ver `server/regras.mjs`, `decidirAtualizacaoConsentimentoCortesia`).
 * NUNCA passa pelo repositório genérico de pacientes: o SERVIDOR
 * recalcula tudo a partir da pendência JÁ PERSISTIDA (nunca confia
 * neste lado) e protege contra decisão concorrente — ver
 * `PortaRevisaoConsentimentoCortesia`. Nunca disparada automaticamente.
 */
export class AplicarRevisaoConsentimentoCortesia {
  constructor(private readonly porta: PortaRevisaoConsentimentoCortesia) {}

  async executar(pacienteId: string): Promise<void> {
    return this.porta.aplicar(pacienteId);
  }
}

/** Mantém o consentimento de aniversário atual e descarta o aviso — ver `PortaRevisaoConsentimentoCortesia`. */
export class ManterConsentimentoCortesiaAtual {
  constructor(private readonly porta: PortaRevisaoConsentimentoCortesia) {}

  async executar(pacienteId: string): Promise<void> {
    return this.porta.manter(pacienteId);
  }
}
