import { ErroApi } from '../../application/ports/api-client.js';

import type { StatusGoogleCalendar } from '../../application/ports/porta-google-calendar.js';
import type { StatusFeriadosGoogle } from '../../application/ports/porta-google-calendar.js';
import type { LocalidadesClinica, MalhaLocalidades, UnidadeFederacao } from '../../application/ports/porta-google-calendar.js';

export class HttpGoogleCalendar {
  constructor(private readonly base: string, private readonly token: string) {}
  async obterUfs(): Promise<UnidadeFederacao[]> {
    return this.obterDadosRegiao<UnidadeFederacao[]>('localidades');
  }
  async obterLocalidades(uf: string): Promise<LocalidadesClinica> {
    return this.obterDadosRegiao<LocalidadesClinica>('localidades', uf);
  }
  async obterMalha(uf: string): Promise<MalhaLocalidades> {
    return this.obterDadosRegiao<MalhaLocalidades>('malhas', uf);
  }
  private async obterDadosRegiao<T>(tipo: string, uf?: string): Promise<T> {
    if (uf !== undefined && !/^[A-Z]{2}$/.test(uf)) throw new Error('Estado inválido.');
    const r = await fetch(`${this.base.replace(/\/$/, '')}/api/google-calendar/${tipo}${uf ? `/${uf}` : ''}`, {
      headers: { Authorization: `Bearer ${this.token}` }, credentials: 'include', signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new ErroApi('Não foi possível carregar as cidades ou o mapa. Escolha manualmente ou tente novamente.', r.status);
    return r.json() as Promise<T>;
  }
  async definirRegiaoFeriados(municipioId: string, uf: string): Promise<void> {
    const r = await fetch(`${this.base.replace(/\/$/, '')}/api/google-calendar/feriados/regiao`, {
      method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ municipioId, uf }), signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new ErroApi('Não foi possível salvar a cidade. A região anterior foi mantida.', r.status);
  }
  async obterFeriados(): Promise<StatusFeriadosGoogle> {
    const r = await fetch(`${this.base.replace(/\/$/, '')}/api/google-calendar/feriados`, {
      headers: { Authorization: `Bearer ${this.token}` }, credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new ErroApi('Não foi possível consultar os feriados.', r.status);
    return r.json() as Promise<StatusFeriadosGoogle>;
  }
  async ignorarFeriado(id: string, ignorado: boolean): Promise<void> {
    const r = await fetch(`${this.base.replace(/\/$/, '')}/api/google-calendar/feriados/ignorar`, {
      method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ id, ignorado }), signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new ErroApi('Não foi possível salvar. Confira a lista antes de tentar novamente.', r.status);
  }
  async resolverConflito(id: string, token: string, escolha: 'manter-google' | 'usar-sistema'): Promise<void> {
    const resposta = await fetch(`${this.base.replace(/\/$/, '')}/api/google-calendar/resolver-conflito`, {
      method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ id, token, escolha }), signal: AbortSignal.timeout(20000),
    });
    if (!resposta.ok) throw new ErroApi(resposta.status === 409
      ? 'A situação mudou ou outra revisão está em andamento. Feche esta janela e confira a lista atualizada.'
      : 'Não foi possível concluir a revisão. Aguarde e confira a sincronização antes de tentar novamente.', resposta.status);
  }
  async obterStatus(): Promise<StatusGoogleCalendar> {
    const resposta = await fetch(`${this.base.replace(/\/$/, '')}/api/google-calendar/status`, {
      headers: { Authorization: `Bearer ${this.token}` }, credentials: 'include', cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!resposta.ok) throw new ErroApi('Não foi possível verificar o Google Agenda.', resposta.status);
    return resposta.json() as Promise<StatusGoogleCalendar>;
  }
}
