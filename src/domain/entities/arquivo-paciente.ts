import { agoraIso, ErroDominio, gerarId } from '../types.js';

/**
 * Arquivo (imagem/documento) anexado a um paciente (Etapa 16). Esta
 * entidade guarda só os METADADOS — nome, tipo, tamanho, categoria,
 * descrição, data, origem. Os BYTES do arquivo vivem separados (no
 * IndexedDB deste navegador, via `RepositorioBlobsArquivo`), nunca aqui
 * e nunca no backup `.json`.
 *
 * LIMITAÇÃO honesta: como o resto do app, isto é armazenamento local.
 * Os bytes só existem neste navegador/dispositivo; limpar os dados do
 * site ou trocar de aparelho os perde. O backup preserva a LISTA
 * (metadados), não o conteúdo — a UI avisa quando um arquivo não está
 * disponível no dispositivo atual.
 */
export type CategoriaArquivo = 'RADIOGRAFIA' | 'FOTO_CLINICA' | 'FOTO_PERFIL' | 'DOCUMENTO' | 'EXAME' | 'OUTRO';

export const CATEGORIA_ARQUIVO_LABEL: Record<CategoriaArquivo, string> = {
  RADIOGRAFIA: 'Radiografia',
  FOTO_CLINICA: 'Foto clínica',
  FOTO_PERFIL: 'Foto de identificação',
  DOCUMENTO: 'Documento',
  EXAME: 'Exame / laudo',
  OUTRO: 'Outro',
};

export const CATEGORIAS_ARQUIVO: readonly CategoriaArquivo[] = [
  'RADIOGRAFIA',
  'FOTO_CLINICA',
  'FOTO_PERFIL',
  'DOCUMENTO',
  'EXAME',
  'OUTRO',
];

/** Limite por arquivo — o armazenamento do navegador é pequeno e compartilhado. */
export const TAMANHO_MAXIMO_ARQUIVO_BYTES = 10 * 1024 * 1024;

export const TIPOS_MIME_ACEITOS: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
];

export function ehTipoArquivoAceito(tipoMime: string): boolean {
  return TIPOS_MIME_ACEITOS.includes(tipoMime.trim().toLowerCase());
}

export function ehImagem(tipoMime: string): boolean {
  return tipoMime.trim().toLowerCase().startsWith('image/');
}

export interface ArquivoPacienteProps {
  id: string;
  pacienteId: string;
  /** Nome original do arquivo enviado. */
  nome: string;
  tipoMime: string;
  tamanhoBytes: number;
  categoria: CategoriaArquivo;
  descricao: string;
  /** `YYYY-MM-DD` — data clínica/de referência do arquivo (não a de upload). */
  data: string;
  /** De onde veio (ex.: "enviado pela paciente", "digitalizado na recepção"). */
  origem: string;
  criadoEm: string;
  /**
   * ISO, presente só quando o arquivo está na lixeira (continuação da
   * reconstrução do WIM VITOR — exclusão lógica, nunca remove bytes nem
   * metadado). Ausente/`undefined` é o caso normal ("ativo").
   */
  excluidoEm?: string;
}

export interface NovoArquivoPacienteInput {
  pacienteId: string;
  nome: string;
  tipoMime: string;
  tamanhoBytes: number;
  categoria: CategoriaArquivo;
  descricao?: string;
  data: string;
  origem?: string;
}

export class ArquivoPaciente {
  private constructor(private props: ArquivoPacienteProps) {}

  static registrar(input: NovoArquivoPacienteInput): ArquivoPaciente {
    if (!input.pacienteId) throw new ErroDominio('Arquivo precisa estar vinculado a um paciente.');
    if (!input.nome.trim()) throw new ErroDominio('O arquivo precisa de um nome.');
    if (!ehTipoArquivoAceito(input.tipoMime)) {
      throw new ErroDominio('Tipo de arquivo não aceito. Envie uma imagem (JPG, PNG, WEBP) ou um PDF.');
    }
    if (!Number.isFinite(input.tamanhoBytes) || input.tamanhoBytes <= 0) {
      throw new ErroDominio('Arquivo vazio ou inválido.');
    }
    if (input.tamanhoBytes > TAMANHO_MAXIMO_ARQUIVO_BYTES) {
      throw new ErroDominio('Arquivo muito grande (máximo 10 MB). Reduza a imagem antes de anexar.');
    }
    if (!CATEGORIAS_ARQUIVO.includes(input.categoria)) {
      throw new ErroDominio('Categoria de arquivo inválida.');
    }
    if (!input.data) throw new ErroDominio('Informe a data do arquivo.');

    return new ArquivoPaciente({
      id: gerarId(),
      pacienteId: input.pacienteId,
      nome: input.nome.trim(),
      tipoMime: input.tipoMime.trim().toLowerCase(),
      tamanhoBytes: Math.round(input.tamanhoBytes),
      categoria: input.categoria,
      descricao: (input.descricao ?? '').trim(),
      data: input.data,
      origem: (input.origem ?? '').trim(),
      criadoEm: agoraIso(),
    });
  }

  static restaurar(props: ArquivoPacienteProps): ArquivoPaciente {
    return new ArquivoPaciente({
      ...props,
      descricao: props.descricao ?? '',
      origem: props.origem ?? '',
    });
  }

  get id(): string {
    return this.props.id;
  }

  get pacienteId(): string {
    return this.props.pacienteId;
  }

  toSnapshot(): Readonly<ArquivoPacienteProps> {
    return { ...this.props };
  }
}

/** Ordena por data (desc) e, no empate, pelo momento de anexo (desc). */
export function compararArquivoMaisRecente(a: ArquivoPacienteProps, b: ArquivoPacienteProps): number {
  return b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm);
}
