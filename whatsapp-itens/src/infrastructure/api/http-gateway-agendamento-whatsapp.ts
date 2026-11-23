import { ErroApi } from '../../../../src/application/ports/api-client.js';
import type {
  ConfirmarAgendamentoPublicoInput,
  GatewayAgendamentoWhatsapp,
  LinkAgendamentoRemoto,
  LinkAgendamentoRemotoProps,
  ResultadoAberturaAgendamento,
  ResultadoConfirmacaoAgendamento,
} from '../../application/ports/gateway-agendamento-whatsapp.js';

type OpcoesFetch = NonNullable<Parameters<typeof fetch>[1]>;

export class HttpGatewayAgendamentoWhatsapp implements GatewayAgendamentoWhatsapp {
  private readonly base: string;
  private readonly token: string;

  constructor(baseUrl: string, tokenApi: string) {
    this.base = baseUrl.replace(/\/$/, '');
    this.token = tokenApi;
  }

  private async chamar(caminho: string, init: OpcoesFetch, comAuth: boolean): Promise<Response> {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    if (comAuth) headers.authorization = `Bearer ${this.token}`;
    try {
      return await fetch(`${this.base}${caminho}`, {
        credentials: comAuth ? 'same-origin' : 'omit',
        ...init,
        headers,
      });
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
      codigo === 'conflito-horario'
        ? 'Este horário acabou de ficar indisponível. Escolha outro.'
        : `Erro ${r.status} do servidor da clínica.`;
    throw new ErroApi(msg, r.status, codigo);
  }

  async gerarLink(pacienteId: string): Promise<LinkAgendamentoRemotoProps> {
    const r = await this.chamar(
      '/api/links-agendamento',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pacienteId }),
      },
      true,
    );
    if (!r.ok) return this.falhar(r);
    return (await r.json()) as LinkAgendamentoRemotoProps;
  }

  async abrirPublico(token: string): Promise<ResultadoAberturaAgendamento> {
    const r = await this.chamar(`/publico/agendamento/${encodeURIComponent(token)}`, { method: 'GET' }, false);
    if (!r.ok) return this.falhar(r);
    return (await r.json()) as ResultadoAberturaAgendamento;
  }

  async confirmarPublico(
    token: string,
    input: ConfirmarAgendamentoPublicoInput,
  ): Promise<ResultadoConfirmacaoAgendamento> {
    const r = await this.chamar(
      `/publico/agendamento/${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
      false,
    );
    if (!r.ok) return this.falhar(r);
    return (await r.json()) as ResultadoConfirmacaoAgendamento;
  }

  async obterLinkDoPaciente(pacienteId: string): Promise<LinkAgendamentoRemoto | null> {
    const r = await this.chamar(
      `/api/pacientes/${encodeURIComponent(pacienteId)}/link-agendamento`,
      { method: 'GET' },
      true,
    );
    if (r.status === 404) return null;
    if (!r.ok) return this.falhar(r);
    return ((await r.json()) as LinkAgendamentoRemoto | null) ?? null;
  }

  async revogarLink(linkId: string): Promise<void> {
    const r = await this.chamar(
      `/api/links-agendamento/${encodeURIComponent(linkId)}/revogar`,
      { method: 'POST' },
      true,
    );
    if (!r.ok && r.status !== 404) await this.falhar(r);
  }
}
