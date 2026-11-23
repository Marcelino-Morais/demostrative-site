import type { BackupAgendado, SaudeBackend, SondaBackend } from '../ports/sonda-backend.js';

/**
 * Diagnóstico de sincronização (Etapas 20–23). Junta a CONFIGURAÇÃO
 * (quais fatias estão ligadas, qual a base do servidor) com a
 * SONDAGEM ao vivo (`/health`) e devolve um modelo pronto para a tela
 * — a apresentação não decide nada disso, só desenha.
 *
 * `modo`:
 *  - `local`      — nenhuma fatia ligada; nem sonda o servidor;
 *  - `conectado`  — alguma fatia ligada, o servidor respondeu e
 *                   consegue gravar nas pastas de dados;
 *  - `degradado`  — o servidor respondeu, mas `armazenamento.dados` ou
 *                   `.arquivos` veio `false` (Etapa 23): ele está no ar
 *                   mas talvez não consiga SALVAR nada — sinal de disco
 *                   cheio, permissão de pasta, ou pasta de dados movida;
 *  - `offline`    — alguma fatia ligada mas o servidor não respondeu
 *                   (é aqui que o registro clínico e os arquivos NÃO
 *                   funcionam entre dispositivos, e a tela avisa).
 */
export type ModoSincronizacao = 'local' | 'conectado' | 'degradado' | 'offline';

export interface ConfiguracaoSincronizacao {
  baseUrl: string;
  anamnese: boolean;
  arquivos: boolean;
  nucleo: boolean;
}

export interface DiagnosticoSincronizacao {
  modo: ModoSincronizacao;
  baseUrl: string;
  anamneseHabilitada: boolean;
  arquivosHabilitados: boolean;
  /** Pacientes e agenda vindo do servidor (Etapa 21). */
  nucleoHabilitado: boolean;
  algumHabilitado: boolean;
  /** Resultado da sondagem: `null` quando não sondou (modo local) ou não alcançou. */
  saude: SaudeBackend | null;
  alcancavel: boolean;
  verificadoEm: string;
}

function calcularModo(saude: SaudeBackend | null): 'conectado' | 'degradado' | 'offline' {
  if (!saude) return 'offline';
  const armazenamento = saude.armazenamento;
  if (armazenamento && (!armazenamento.dados || !armazenamento.arquivos)) return 'degradado';
  return 'conectado';
}

export class ObterDiagnosticoSincronizacao {
  constructor(
    private readonly sonda: SondaBackend,
    private readonly config: ConfiguracaoSincronizacao,
  ) {}

  async executar(): Promise<DiagnosticoSincronizacao> {
    const algumHabilitado = this.config.anamnese || this.config.arquivos || this.config.nucleo;
    const base = {
      baseUrl: this.config.baseUrl,
      anamneseHabilitada: this.config.anamnese,
      arquivosHabilitados: this.config.arquivos,
      nucleoHabilitado: this.config.nucleo,
      algumHabilitado,
      verificadoEm: new Date().toISOString(),
    };

    if (!algumHabilitado) {
      return { ...base, modo: 'local', saude: null, alcancavel: false };
    }

    const saude = await this.sonda.verificar();
    return {
      ...base,
      modo: calcularModo(saude),
      saude,
      alcancavel: saude !== null,
    };
  }
}

export class VerificarTarefaBackupAgendada {
  constructor(private readonly sonda: SondaBackend) {}

  async executar(): Promise<BackupAgendado> {
    return this.sonda.verificarTarefaBackup();
  }
}
