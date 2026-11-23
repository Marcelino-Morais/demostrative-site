import {
  type ArquivoPacienteProps,
  type NovoArquivoPacienteInput,
} from '../../domain/entities/arquivo-paciente.js';
import { ErroDominio } from '../../domain/types.js';
import { ErroApi } from '../../application/ports/api-client.js';
import type { GatewayArquivos } from '../../application/ports/gateway-arquivos.js';

/** Segundo argumento de `fetch` (evita citar o tipo global `RequestInit`). */
type OpcoesFetch = NonNullable<Parameters<typeof fetch>[1]>;

/** Códigos de validação do servidor (`server/arquivos-regras.mjs`) → texto pra dentista. */
const MOTIVO_VALIDACAO: Record<string, string> = {
  'paciente-obrigatorio': 'Arquivo precisa estar vinculado a um paciente.',
  'nome-invalido': 'Nome de arquivo inválido. Renomeie o arquivo e tente de novo.',
  'tipo-nao-aceito': 'Tipo de arquivo não aceito. Envie uma imagem (JPG, PNG, WEBP) ou um PDF.',
  'extensao-incompativel': 'A extensão do arquivo não bate com o tipo dele.',
  'arquivo-vazio': 'Arquivo vazio ou inválido.',
  'arquivo-grande': 'Arquivo muito grande (máximo 10 MB). Reduza a imagem antes de anexar.',
  'categoria-invalida': 'Categoria de arquivo inválida.',
  'data-invalida': 'Informe a data do arquivo.',
  'descricao-longa': 'A descrição está longa demais.',
  'origem-longa': 'O campo de origem está longo demais.',
};

/**
 * Adaptador HTTP do `GatewayArquivos` (Etapa 19) — fala com o servidor
 * de `server/`. Todos os endpoints levam `Authorization: Bearer <token>`.
 * O upload manda os metadados em cabeçalhos `x-arquivo-*` (URL-encoded)
 * e os bytes crus no corpo — metadados e bytes seguem separados até no
 * transporte. Falha de rede vira `ErroApi(status 0)`; recusa de
 * validação (422) vira `ErroDominio` com texto pronto pra tela. Nunca
 * loga corpo de requisição/resposta.
 */
export class HttpGatewayArquivos implements GatewayArquivos {
  private readonly base: string;
  private readonly token: string;

  constructor(baseUrl: string, tokenApi: string) {
    this.base = baseUrl.replace(/\/$/, '');
    this.token = tokenApi;
  }

  private async chamar(caminho: string, init: OpcoesFetch): Promise<Response> {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string>),
      authorization: `Bearer ${this.token}`,
    };
    try {
      return await fetch(`${this.base}${caminho}`, { ...init, headers });
    } catch {
      throw new ErroApi('Sem conexão com o servidor de arquivos da clínica.', 0);
    }
  }

  private async falhar(r: Response): Promise<never> {
    let corpo: { erro?: { codigo?: string; detalhes?: unknown } } = {};
    try {
      corpo = (await r.json()) as typeof corpo;
    } catch {
      /* corpo não-JSON */
    }
    if (r.status === 422) {
      const detalhes = Array.isArray(corpo.erro?.detalhes) ? (corpo.erro?.detalhes as string[]) : [];
      const texto = detalhes.map((d) => MOTIVO_VALIDACAO[d]).find(Boolean);
      throw new ErroDominio(texto ?? 'O servidor recusou o arquivo na validação.');
    }
    throw new ErroApi(`Erro ${r.status} do servidor de arquivos.`, r.status, corpo.erro?.codigo);
  }

  async disponivel(): Promise<boolean> {
    try {
      const r = await fetch(`${this.base}/health`, { method: 'GET' });
      return r.ok;
    } catch {
      return false;
    }
  }

  async listar(pacienteId: string): Promise<ArquivoPacienteProps[]> {
    const r = await this.chamar(
      `/api/pacientes/${encodeURIComponent(pacienteId)}/arquivos`,
      { method: 'GET' },
    );
    if (!r.ok) return this.falhar(r);
    return ((await r.json()) as ArquivoPacienteProps[] | null) ?? [];
  }

  async enviar(input: NovoArquivoPacienteInput, conteudo: Blob): Promise<ArquivoPacienteProps> {
    const headers: Record<string, string> = {
      'content-type': input.tipoMime || 'application/octet-stream',
      'x-arquivo-nome': encodeURIComponent(input.nome),
      'x-arquivo-categoria': input.categoria,
      'x-arquivo-data': input.data,
    };
    if (input.descricao) headers['x-arquivo-descricao'] = encodeURIComponent(input.descricao);
    if (input.origem) headers['x-arquivo-origem'] = encodeURIComponent(input.origem);

    const r = await this.chamar(`/api/pacientes/${encodeURIComponent(input.pacienteId)}/arquivos`, {
      method: 'POST',
      headers,
      body: conteudo,
    });
    if (!r.ok) return this.falhar(r);
    return (await r.json()) as ArquivoPacienteProps;
  }

  async baixar(id: string): Promise<Blob | null> {
    const r = await this.chamar(`/api/arquivos/${encodeURIComponent(id)}/conteudo`, { method: 'GET' });
    if (r.status === 404) return null;
    if (!r.ok) return this.falhar(r);
    return r.blob();
  }

  async remover(id: string): Promise<void> {
    const r = await this.chamar(`/api/arquivos/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok && r.status !== 404) await this.falhar(r);
  }

  async atualizarDescricao(id: string, descricao: string): Promise<ArquivoPacienteProps> {
    const r = await this.chamar(`/api/arquivos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ descricao }),
    });
    if (!r.ok) return this.falhar(r);
    return (await r.json()) as ArquivoPacienteProps;
  }

  async listarLixeira(pacienteId: string): Promise<ArquivoPacienteProps[]> {
    const r = await this.chamar(`/api/pacientes/${encodeURIComponent(pacienteId)}/arquivos/lixeira`, {
      method: 'GET',
    });
    if (!r.ok) return this.falhar(r);
    return ((await r.json()) as ArquivoPacienteProps[] | null) ?? [];
  }

  async restaurar(id: string): Promise<ArquivoPacienteProps> {
    const r = await this.chamar(`/api/arquivos/${encodeURIComponent(id)}/restaurar`, { method: 'POST' });
    if (!r.ok) return this.falhar(r);
    return (await r.json()) as ArquivoPacienteProps;
  }

  async removerPermanente(id: string): Promise<void> {
    const r = await this.chamar(`/api/arquivos/${encodeURIComponent(id)}/permanente`, { method: 'DELETE' });
    if (!r.ok && r.status !== 404) await this.falhar(r);
  }

  async baixarDicom(id: string): Promise<Blob | null> {
    const r = await this.chamar(`/api/arquivos/${encodeURIComponent(id)}/dicom`, { method: 'GET' });
    if (r.status === 404 || r.status === 409) return null;
    if (!r.ok) return this.falhar(r);
    return r.blob();
  }
}
