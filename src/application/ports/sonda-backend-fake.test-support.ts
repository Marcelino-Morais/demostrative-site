/**
 * `SondaBackend` falso para os testes do diagnóstico de sincronização.
 * `online = true/false` decide se `verificar()` devolve uma saúde ou
 * `null`. Nunca importado pela apresentação.
 */
import type { BackupAgendado, SaudeBackend, SondaBackend } from './sonda-backend.js';

export class FakeSondaBackend implements SondaBackend {
  online = true;
  saude: SaudeBackend = { servico: 'clinica-slices', fatias: ['anamnese', 'arquivos'], versao: 1 };
  tarefaBackup: BackupAgendado = { configurado: false };
  /** Quantas vezes `verificar()` foi chamada — para testes que checam "não sonda em modo local". */
  chamadas = 0;
  chamadasTarefaBackup = 0;

  async verificar(): Promise<SaudeBackend | null> {
    this.chamadas += 1;
    return this.online ? this.saude : null;
  }

  async verificarTarefaBackup(): Promise<BackupAgendado> {
    this.chamadasTarefaBackup += 1;
    return this.tarefaBackup;
  }
}
