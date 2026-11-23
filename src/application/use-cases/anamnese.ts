import { Anamnese, type SalvarAnamneseInput } from '../../domain/entities/anamnese.js';
import type { RepositorioAnamneses, RepositorioRascunhoAnamnese } from '../ports/repositorios.js';

export class SalvarAnamnese {
  constructor(
    private readonly anamneses: RepositorioAnamneses,
    private readonly rascunhos: RepositorioRascunhoAnamnese,
  ) {}

  async executar(input: SalvarAnamneseInput): Promise<Anamnese> {
    const existente = await this.anamneses.buscarPorPacienteId(input.pacienteId);
    const anamnese = Anamnese.salvar(input, existente?.toSnapshot());
    await this.anamneses.salvar(anamnese);
    // Achado de revisão (persistência segura — Etapa 2, hardening
    // adicional): um rascunho autosalvo que sobrevivesse a um "Salvar"
    // bem-sucedido ficaria "preso" e seria oferecido de novo na próxima
    // visita, mesmo já tendo virado o registro oficial. Descartado aqui,
    // no caso de uso — assim nenhuma tela pode esquecer desse passo.
    await this.rascunhos.remover(input.pacienteId);
    return anamnese;
  }
}

export class ObterAnamnese {
  constructor(private readonly anamneses: RepositorioAnamneses) {}

  async executar(pacienteId: string): Promise<Anamnese | undefined> {
    return this.anamneses.buscarPorPacienteId(pacienteId);
  }
}

/**
 * Casos de uso do rascunho de anamnese (nunca o registro oficial) —
 * suportam o autosave da tela (`aba-anamnese.tsx`): recuperar trabalho
 * em andamento ao reabrir a aba, gravar a cada pausa de digitação, e
 * descartar quando o usuário desfizer manualmente as mudanças.
 */
export class ObterRascunhoAnamnese {
  constructor(private readonly rascunhos: RepositorioRascunhoAnamnese) {}

  async executar(pacienteId: string): Promise<SalvarAnamneseInput | undefined> {
    return this.rascunhos.obter(pacienteId);
  }
}

export class SalvarRascunhoAnamnese {
  constructor(private readonly rascunhos: RepositorioRascunhoAnamnese) {}

  async executar(pacienteId: string, valores: SalvarAnamneseInput): Promise<void> {
    await this.rascunhos.salvar(pacienteId, valores);
  }
}

export class DescartarRascunhoAnamnese {
  constructor(private readonly rascunhos: RepositorioRascunhoAnamnese) {}

  async executar(pacienteId: string): Promise<void> {
    await this.rascunhos.remover(pacienteId);
  }
}
