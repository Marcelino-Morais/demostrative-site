/**
 * `GatewayArquivos` falso para os testes dos casos de uso do slice
 * remoto de arquivos (Etapa 19). Guarda metadados + bytes em memória e
 * valida com a MESMA entidade de domínio (`ArquivoPaciente.registrar`)
 * que o modo local usa — assim a semântica de tipo/tamanho/campos bate
 * com o servidor de verdade. Nunca importado pela apresentação.
 */
import {
  ArquivoPaciente,
  compararArquivoMaisRecente,
  type ArquivoPacienteProps,
  type NovoArquivoPacienteInput,
} from '../../domain/entities/arquivo-paciente.js';
import type { GatewayArquivos } from './gateway-arquivos.js';

export class FakeGatewayArquivos implements GatewayArquivos {
  online = true;
  private itens = new Map<string, { props: ArquivoPacienteProps; blob: Blob }>();

  async disponivel(): Promise<boolean> {
    return this.online;
  }

  async listar(pacienteId: string): Promise<ArquivoPacienteProps[]> {
    return [...this.itens.values()]
      .map((i) => i.props)
      .filter((p) => p.pacienteId === pacienteId && !p.excluidoEm)
      .sort(compararArquivoMaisRecente);
  }

  async enviar(input: NovoArquivoPacienteInput, conteudo: Blob): Promise<ArquivoPacienteProps> {
    // Espelha o servidor: valida os metadados e usa o tamanho real dos bytes.
    const props = ArquivoPaciente.registrar({
      ...input,
      tamanhoBytes: conteudo.size || input.tamanhoBytes,
    }).toSnapshot() as ArquivoPacienteProps;
    this.itens.set(props.id, { props, blob: conteudo });
    return props;
  }

  async baixar(id: string): Promise<Blob | null> {
    return this.itens.get(id)?.blob ?? null;
  }

  /** Espelha o servidor (continuação do WIM VITOR): exclusão LÓGICA — nunca apaga bytes/metadado. */
  async remover(id: string): Promise<void> {
    const item = this.itens.get(id);
    if (!item || item.props.excluidoEm) return;
    item.props = { ...item.props, excluidoEm: new Date().toISOString() };
  }

  async atualizarDescricao(id: string, descricao: string): Promise<ArquivoPacienteProps> {
    const item = this.itens.get(id);
    if (!item) throw new Error('nao-encontrado');
    item.props = { ...item.props, descricao };
    return item.props;
  }

  async listarLixeira(pacienteId: string): Promise<ArquivoPacienteProps[]> {
    return [...this.itens.values()]
      .map((i) => i.props)
      .filter((p) => p.pacienteId === pacienteId && Boolean(p.excluidoEm))
      .sort((a, b) => (b.excluidoEm ?? '').localeCompare(a.excluidoEm ?? ''));
  }

  async restaurar(id: string): Promise<ArquivoPacienteProps> {
    const item = this.itens.get(id);
    if (!item) throw new Error('nao-encontrado');
    const resto = { ...item.props };
    delete resto.excluidoEm;
    item.props = resto;
    return item.props;
  }

  async removerPermanente(id: string): Promise<void> {
    this.itens.delete(id);
  }

  async baixarDicom(id: string): Promise<Blob | null> {
    // Fake simplificado: devolve um blob qualquer só pra provar que o caminho feliz é chamado — a conversão PNG->DICOM real é testada no servidor (dicom-exportacao.test.mjs).
    return this.itens.has(id) ? new Blob(['dicom-fake'], { type: 'application/dicom' }) : null;
  }
}
