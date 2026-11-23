import { pacienteCorrespondeABusca, type Paciente } from '../../../domain/entities/paciente.js';

/**
 * Filtro do `SeletorPaciente` — inspirado no "Selecione um paciente" do
 * WIM Dental (`PatientSelectionForm`), onde a lista já carregada é
 * filtrada em memória a cada tecla e a tabela mostra só o que
 * corresponde. Aqui a regra de "corresponde" NÃO é reimplementada: usa
 * a mesma `pacienteCorrespondeABusca` da lista de pacientes (nome, CPF,
 * celular etc., inclusive só por dígitos). Ordem alfabética pt-BR, como
 * `ListarPacientes`. `limite` evita renderizar centenas de linhas no
 * diálogo — quem não aparece é achado refinando a busca.
 */
export function filtrarPacientesParaSelecao(
  pacientes: readonly Paciente[],
  termo: string,
  limite = 50,
): { visiveis: Paciente[]; total: number } {
  const correspondentes = pacientes
    .filter((p) => pacienteCorrespondeABusca(p.toSnapshot(), termo))
    .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR'));
  return { visiveis: correspondentes.slice(0, limite), total: correspondentes.length };
}

/** Próximo índice destacado ao navegar com ↑/↓ — para nas pontas em vez de dar a volta. */
export function moverDestaque(atual: number, direcao: 1 | -1, quantidade: number): number {
  if (quantidade === 0) return -1;
  if (atual < 0) return direcao === 1 ? 0 : quantidade - 1;
  return Math.min(quantidade - 1, Math.max(0, atual + direcao));
}
