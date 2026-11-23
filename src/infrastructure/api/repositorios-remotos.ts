import { ArquivoPaciente, type ArquivoPacienteProps } from '../../domain/entities/arquivo-paciente.js';
import { LinkAnamnese, type LinkAnamneseProps } from '../../domain/entities/link-anamnese.js';
import { Paciente, type PacienteProps } from '../../domain/entities/paciente.js';
import type { ApiClient } from '../../application/ports/api-client.js';
import type {
  RepositorioArquivosPaciente,
  RepositorioBlobsArquivo,
  RepositorioLinksAnamnese,
  RepositorioPacientes,
} from '../../application/ports/repositorios.js';

/**
 * Adaptadores REMOTOS de repositório (Etapa 17) — implementam os
 * **mesmos ports** de `application/ports/repositorios.ts` contra a API
 * de `docs/backend.spec.md`, através do port `ApiClient`. São o molde:
 * os repositórios restantes (anamnese, odontograma, consultas, planos,
 * evoluções, WhatsApp) seguem exatamente este formato quando o servidor
 * existir.
 *
 * Não são usados por padrão — o app continua local. `criarContainerRemoto`
 * (composition root) é quem os liga.
 */

export class PacienteRemotoRepository implements RepositorioPacientes {
  constructor(private readonly api: ApiClient) {}

  async salvar(paciente: Paciente): Promise<void> {
    const props = paciente.toSnapshot() as PacienteProps;
    await this.api.put(`/pacientes/${props.id}`, props);
  }

  async buscarPorId(id: string): Promise<Paciente | undefined> {
    const props = await this.api.get<PacienteProps>(`/pacientes/${id}`);
    return props ? Paciente.restaurar(props) : undefined;
  }

  async listarTodos(): Promise<Paciente[]> {
    const props = (await this.api.get<PacienteProps[]>('/pacientes')) ?? [];
    return props.map((p) => Paciente.restaurar(p));
  }

  async remover(id: string): Promise<void> {
    await this.api.delete(`/pacientes/${id}`);
  }
}

export class LinkAnamneseRemotoRepository implements RepositorioLinksAnamnese {
  constructor(private readonly api: ApiClient) {}

  async salvar(link: LinkAnamnese): Promise<void> {
    const props = link.toSnapshot() as LinkAnamneseProps;
    await this.api.put(`/links-anamnese/${props.id}`, props);
  }

  async buscarPorToken(token: string): Promise<LinkAnamnese | undefined> {
    const props = await this.api.get<LinkAnamneseProps>(
      `/links-anamnese/por-token/${encodeURIComponent(token)}`,
    );
    return props ? LinkAnamnese.restaurar(props) : undefined;
  }

  async buscarPorPacienteId(pacienteId: string): Promise<LinkAnamnese | undefined> {
    const props = await this.api.get<LinkAnamneseProps>(`/pacientes/${pacienteId}/link-anamnese`);
    return props ? LinkAnamnese.restaurar(props) : undefined;
  }

  async listarTodos(): Promise<LinkAnamnese[]> {
    const props = (await this.api.get<LinkAnamneseProps[]>('/links-anamnese')) ?? [];
    return props.map((l) => LinkAnamnese.restaurar(l));
  }
}

export class ArquivoPacienteRemotoRepository implements RepositorioArquivosPaciente {
  constructor(private readonly api: ApiClient) {}

  async salvar(arquivo: ArquivoPaciente): Promise<void> {
    const props = arquivo.toSnapshot() as ArquivoPacienteProps;
    await this.api.put(`/arquivos/${props.id}`, props);
  }

  async buscarPorId(id: string): Promise<ArquivoPaciente | undefined> {
    const props = await this.api.get<ArquivoPacienteProps>(`/arquivos/${id}`);
    return props ? ArquivoPaciente.restaurar(props) : undefined;
  }

  async listarPorPacienteId(pacienteId: string): Promise<ArquivoPaciente[]> {
    const props = (await this.api.get<ArquivoPacienteProps[]>(`/pacientes/${pacienteId}/arquivos`)) ?? [];
    return props.map((a) => ArquivoPaciente.restaurar(a));
  }

  async remover(id: string): Promise<void> {
    await this.api.delete(`/arquivos/${id}`);
  }

  async listarTodos(): Promise<ArquivoPaciente[]> {
    const props = (await this.api.get<ArquivoPacienteProps[]>('/arquivos')) ?? [];
    return props.map((a) => ArquivoPaciente.restaurar(a));
  }
}

export class BlobArquivoRemotoRepository implements RepositorioBlobsArquivo {
  constructor(private readonly api: ApiClient) {}

  async salvar(id: string, blob: Blob): Promise<void> {
    await this.api.postForm(`/arquivos/${id}/conteudo`, blob, 'arquivo', {});
  }

  async obter(id: string): Promise<Blob | undefined> {
    return this.api.getBlob(`/arquivos/${id}/conteudo`);
  }

  async existe(id: string): Promise<boolean> {
    return this.api.existe(`/arquivos/${id}/conteudo`);
  }

  async remover(id: string): Promise<void> {
    await this.api.delete(`/arquivos/${id}/conteudo`);
  }
}
