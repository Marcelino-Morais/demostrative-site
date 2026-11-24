import type { BackupAgendado, SaudeArmazenamento, SaudeBackend, SondaBackend } from '../../application/ports/sonda-backend.js';

const TOKEN_DEV = 'dev-anamnese-token';

/**
 * Adaptador HTTP do `SondaBackend` (Etapa 20) — `GET {baseUrl}/health`,
 * sem token (rota aberta). Qualquer falha (rede, timeout, resposta não
 * OK, corpo estranho) vira `null` — "servidor fora do ar", nunca uma
 * exceção que suba pra tela. Um timeout curto evita a tela travar
 * esperando um servidor que não vai responder.
 */
function lerArmazenamento(bruto: unknown): SaudeArmazenamento | undefined {
  if (!bruto || typeof bruto !== 'object') return undefined;
  const a = bruto as Record<string, unknown>;
  if (typeof a.dados !== 'boolean' || typeof a.arquivos !== 'boolean' || typeof a.backups !== 'boolean') {
    return undefined;
  }
  return { dados: a.dados, arquivos: a.arquivos, backups: a.backups };
}

function lerBackup(bruto: unknown): SaudeBackend['backup'] {
  if (!bruto || typeof bruto !== 'object') return undefined;
  const b = bruto as Record<string, unknown>;
  const ultimoBruto = b.ultimo;
  const ultimo =
    ultimoBruto && typeof ultimoBruto === 'object'
      ? {
          nome: typeof (ultimoBruto as Record<string, unknown>).nome === 'string' ? String((ultimoBruto as Record<string, unknown>).nome) : '',
          criadoEm:
            typeof (ultimoBruto as Record<string, unknown>).criadoEm === 'string'
              ? String((ultimoBruto as Record<string, unknown>).criadoEm)
              : '',
        }
      : null;
  const agendadoBruto = b.agendado;
  let agendado: BackupAgendado = null;
  if (agendadoBruto && typeof agendadoBruto === 'object') {
    const a = agendadoBruto as Record<string, unknown>;
    if (a.configurado === false) {
      agendado = { configurado: false };
    } else if (a.configurado === true) {
      agendado = {
        configurado: true,
        estado: typeof a.estado === 'string' ? a.estado : 'Unknown',
        proximaExecucao: typeof a.proximaExecucao === 'string' ? a.proximaExecucao : null,
        ultimaExecucao: typeof a.ultimaExecucao === 'string' ? a.ultimaExecucao : null,
        ultimoResultado: typeof a.ultimoResultado === 'number' ? a.ultimoResultado : null,
      };
    }
  }
  return {
    total: typeof b.total === 'number' ? b.total : 0,
    ultimo: ultimo && ultimo.nome && ultimo.criadoEm ? ultimo : null,
    agendado,
  };
}

export class HttpSondaBackend implements SondaBackend {
  private readonly base: string;
  private readonly token: string;

  constructor(baseUrl: string, token = TOKEN_DEV) {
    this.base = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  async verificar(): Promise<SaudeBackend | null> {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), 4000);
    try {
      const r = await fetch(`${this.base}/health`, { method: 'GET', signal: controle.signal });
      if (!r.ok) return null;
      const corpo = (await r.json()) as Partial<SaudeBackend> & {
        ok?: boolean;
        app?: { servindoBuild?: unknown };
      };
      if (!corpo || corpo.ok === false) return null;
      return {
        servico: typeof corpo.servico === 'string' ? corpo.servico : 'desconhecido',
        fatias: Array.isArray(corpo.fatias) ? corpo.fatias.filter((f): f is string => typeof f === 'string') : [],
        versao: typeof corpo.versao === 'number' ? corpo.versao : 0,
        armazenamento: lerArmazenamento(corpo.armazenamento),
        app: typeof corpo.app?.servindoBuild === 'boolean' ? { servindoBuild: corpo.app.servindoBuild } : undefined,
        backup: lerBackup(corpo.backup),
        portaHttp: typeof corpo.portaHttp === 'number' && Number.isInteger(corpo.portaHttp) && corpo.portaHttp > 0 && corpo.portaHttp <= 65535 ? corpo.portaHttp : undefined,
        enderecoLan: typeof corpo.enderecoLan === 'string' ? corpo.enderecoLan : null,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async verificarTarefaBackup(): Promise<BackupAgendado> {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), 8000);
    try {
      const r = await fetch(`${this.base}/api/backup/tarefa`, {
        method: 'GET',
        headers: { authorization: `Bearer ${this.token}` },
        credentials: 'include',
        signal: controle.signal,
      });
      if (!r.ok) return null;
      return lerBackup({ total: 0, ultimo: null, agendado: await r.json() })?.agendado ?? null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
