import {
  ArquivoPaciente,
  compararArquivoMaisRecente,
  type ArquivoPacienteProps,
  type NovoArquivoPacienteInput,
} from '../../domain/entities/arquivo-paciente.js';
import { ErroDominio } from '../../domain/types.js';
import type {
  RepositorioArquivosPaciente,
  RepositorioBlobsArquivo,
  RepositorioPacientes,
} from '../ports/repositorios.js';

/**
 * Casos de uso de arquivos por paciente (Etapa 16). A validação de
 * tipo/tamanho/campos mora na entidade `ArquivoPaciente`, nunca num
 * componente. Metadados e bytes são gravados em repositórios
 * separados: os metadados entram no backup, os bytes NÃO (ficam só
 * neste navegador). Nada de conteúdo de arquivo é logado.
 */

export class AdicionarArquivoPaciente {
  constructor(
    private readonly arquivos: RepositorioArquivosPaciente,
    private readonly blobs: RepositorioBlobsArquivo,
    private readonly pacientes: RepositorioPacientes,
  ) {}

  async executar(input: NovoArquivoPacienteInput, conteudo: Blob): Promise<ArquivoPacienteProps> {
    const paciente = await this.pacientes.buscarPorId(input.pacienteId);
    if (!paciente) throw new ErroDominio('Paciente não encontrado.');

    // `registrar` valida tudo e lança ANTES de qualquer escrita.
    const arquivo = ArquivoPaciente.registrar(input);
    await this.blobs.salvar(arquivo.id, conteudo);
    await this.arquivos.salvar(arquivo);
    return arquivo.toSnapshot();
  }
}

export interface ArquivoNaLista {
  props: ArquivoPacienteProps;
  /** `false` quando só o metadado existe aqui (ex.: lista restaurada de um backup em outro dispositivo). */
  disponivelLocalmente: boolean;
}

export class ListarArquivosDoPaciente {
  constructor(
    private readonly arquivos: RepositorioArquivosPaciente,
    private readonly blobs: RepositorioBlobsArquivo,
  ) {}

  async executar(pacienteId: string): Promise<ArquivoNaLista[]> {
    const lista = (await this.arquivos.listarPorPacienteId(pacienteId))
      .map((a) => a.toSnapshot())
      .sort(compararArquivoMaisRecente);
    return Promise.all(
      lista.map(async (props) => ({ props, disponivelLocalmente: await this.blobs.existe(props.id) })),
    );
  }
}

export interface ConteudoArquivo {
  props: ArquivoPacienteProps;
  /** Bytes do arquivo, ou `null` quando não estão neste dispositivo (só a lista veio de um backup). */
  blob: Blob | null;
}

export class ObterConteudoArquivo {
  constructor(
    private readonly arquivos: RepositorioArquivosPaciente,
    private readonly blobs: RepositorioBlobsArquivo,
  ) {}

  async executar(id: string): Promise<ConteudoArquivo> {
    const arquivo = await this.arquivos.buscarPorId(id);
    if (!arquivo) throw new ErroDominio('Arquivo não encontrado.');
    const blob = (await this.blobs.obter(id)) ?? null;
    return { props: arquivo.toSnapshot(), blob };
  }
}

export class RemoverArquivoPaciente {
  constructor(
    private readonly arquivos: RepositorioArquivosPaciente,
    private readonly blobs: RepositorioBlobsArquivo,
  ) {}

  async executar(id: string): Promise<void> {
    await this.blobs.remover(id);
    await this.arquivos.remover(id);
  }
}
