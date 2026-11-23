import { ErroApi } from '../../application/ports/api-client.js';
import type {
  ColecaoNucleo,
  ContagemNucleo,
  GatewayNucleo,
  ResultadoMigracaoNucleo,
} from '../../application/ports/gateway-nucleo.js';

/** Segundo argumento de `fetch` (evita citar o tipo global `RequestInit`). */
type OpcoesFetch = NonNullable<Parameters<typeof fetch>[1]>;

/**
 * Adaptador HTTP do NÚCLEO clínico (Etapas 21–22). Fornece o CRUD fino
 * que os repositórios backend (`repositorios-backend-nucleo.ts`) usam —
 * mesmos ports de `application/ports/repositorios.ts` — e implementa
 * `GatewayNucleo` (contagem + migração). Todos os endpoints levam
 * `Authorization: Bearer <token>`. Falha de rede vira `ErroApi(status 0)`
 * com mensagem amigável; nunca loga corpo de requisição/resposta.
 */
export class HttpNucleoApi implements GatewayNucleo {
  private readonly base: string;
  private readonly token: string;

  constructor(baseUrl: string, tokenApi: string) {
    this.base = baseUrl.replace(/\/$/, '');
    this.token = tokenApi;
  }

  private async chamar(caminho: string, init: OpcoesFetch = {}): Promise<Response> {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string>),
      authorization: `Bearer ${this.token}`,
    };
    try {
      return await fetch(`${this.base}${caminho}`, { ...init, headers });
    } catch {
      throw new ErroApi('Sem conexão com o servidor da clínica.', 0);
    }
  }

  private async falhar(r: Response): Promise<never> {
    let codigo: string | undefined;
    try {
      const c = (await r.json()) as { erro?: { codigo?: string } };
      codigo = c.erro?.codigo;
    } catch {
      /* corpo não-JSON */
    }
    const msg =
      codigo === 'horario-descanso'
        ? 'Este atendimento cruza o descanso diário. Confira o intervalo em Configurações.'
        : codigo === 'conflito-horario'
        ? 'Já existe uma consulta nesse horário no servidor da clínica.'
        : codigo === 'dia-bloqueado'
          ? 'Este dia está bloqueado na agenda do servidor da clínica — não é possível agendar consulta.'
          : `Erro ${r.status} do servidor da clínica.`;
    throw new ErroApi(msg, r.status, codigo);
  }

  // ---- CRUD para os repositórios backend ----

  async listar<T>(recurso: ColecaoNucleo): Promise<T[]> {
    const r = await this.chamar(`/api/${recurso}`, { method: 'GET' });
    if (!r.ok) return this.falhar(r);
    return ((await r.json()) as T[] | null) ?? [];
  }

  async obter<T>(recurso: ColecaoNucleo, id: string): Promise<T | undefined> {
    const r = await this.chamar(`/api/${recurso}/${encodeURIComponent(id)}`, { method: 'GET' });
    if (r.status === 404) return undefined;
    if (!r.ok) return this.falhar(r);
    return ((await r.json()) as T | null) ?? undefined;
  }

  /** `GET /api/pacientes/:id/<recurso>` — só para as coleções ligadas a paciente. */
  async listarPorPaciente<T>(recurso: ColecaoNucleo, pacienteId: string): Promise<T[]> {
    const r = await this.chamar(
      `/api/pacientes/${encodeURIComponent(pacienteId)}/${recurso}`,
      { method: 'GET' },
    );
    if (!r.ok) return this.falhar(r);
    return ((await r.json()) as T[] | null) ?? [];
  }

  async salvar(recurso: ColecaoNucleo, id: string, corpo: unknown): Promise<void> {
    const r = await this.chamar(`/api/${recurso}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    if (!r.ok) await this.falhar(r);
  }

  async remover(recurso: ColecaoNucleo, id: string): Promise<void> {
    const r = await this.chamar(`/api/${recurso}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok && r.status !== 404) await this.falhar(r);
  }

  /** Busca por dígitos de CPF/RG — SEMPRE POST (nunca o termo na URL/log). Devolve só ids. */
  async buscarPacientesPorDocumento(termo: string): Promise<string[]> {
    const r = await this.chamar('/api/pacientes/buscar-documento', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ termo }),
    });
    if (!r.ok) return this.falhar(r);
    const corpo = (await r.json()) as { ids?: string[] } | null;
    return corpo?.ids ?? [];
  }

  // ---- GatewayNucleo ----

  async disponivel(): Promise<boolean> {
    try {
      const r = await fetch(`${this.base}/health`, { method: 'GET' });
      return r.ok;
    } catch {
      return false;
    }
  }

  async contar(): Promise<ContagemNucleo> {
    const r = await this.chamar('/api/nucleo/contagem', { method: 'GET' });
    if (!r.ok) return this.falhar(r);
    return (await r.json()) as ContagemNucleo;
  }

  async migrar(colecoes: Partial<Record<ColecaoNucleo, unknown[]>>): Promise<ResultadoMigracaoNucleo> {
    const r = await this.chamar('/api/nucleo/migrar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(colecoes),
    });
    if (!r.ok) return this.falhar(r);
    return (await r.json()) as ResultadoMigracaoNucleo;
  }
}
