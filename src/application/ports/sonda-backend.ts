/**
 * Port de sondagem do servidor das fatias compartilhadas (Etapa 20). É
 * a única coisa que o diagnóstico de sincronização usa para saber se o
 * servidor de `server/` está no ar — o domínio e as telas não falam
 * `fetch`. Bate no `/health` (aberto, sem token).
 */
export interface SaudeArmazenamento {
  /** A pasta de dados (JSON de metadados/registros) aceita gravação. */
  dados: boolean;
  /** A pasta de bytes de arquivo de paciente aceita gravação. */
  arquivos: boolean;
  /** A pasta de backups existe e está acessível (Etapa 23; `false` é normal antes do 1º backup). */
  backups: boolean;
}

export type BackupAgendado =
  | {
      configurado: false;
    }
  | {
      configurado: true;
      estado: string;
      proximaExecucao: string | null;
      ultimaExecucao: string | null;
      ultimoResultado: number | null;
    }
  | null;

export interface SaudeBackend {
  /** Etiqueta do serviço (`clinica-slices`). */
  servico: string;
  /** Fatias que este servidor cobre — hoje `['anamnese', 'arquivos', 'nucleo']`. */
  fatias: string[];
  /** Versão do contrato de `/health`. */
  versao: number;
  /**
   * Estado de gravação das pastas de dados (Etapa 23) — `undefined`
   * quando o servidor é de uma versão antiga que ainda não manda isso.
   * `dados`/`arquivos` em `false` é o sinal de "modo degradado": o
   * servidor respondeu, mas talvez não consiga salvar nada.
   */
  armazenamento?: SaudeArmazenamento;
  /** `true` quando este servidor também está servindo o build do app (modo "produção local"). */
  app?: { servindoBuild: boolean };
  /** Diagnóstico de backup estruturado do servidor (Etapa 25). */
  backup?: {
    total: number;
    ultimo: { nome: string; criadoEm: string } | null;
    agendado?: BackupAgendado;
  };
  /**
   * Endereço de rede (LAN) do computador da clínica (Etapa 45) —
   * `null` quando o servidor não achou nenhum, `undefined` quando é
   * uma versão antiga do servidor que ainda não manda esse campo.
   * Serve pra montar, nas mensagens de WhatsApp pro paciente, um link
   * que funciona no celular/tablet dela em vez de depender de qual
   * endereço o navegador da Dra. Fernanda tem aberto agora.
   */
  enderecoLan?: string | null;
  portaHttp?: number;
}

export interface SondaBackend {
  /** `SaudeBackend` quando o servidor responde `/health`; `null` quando não dá para alcançá-lo. */
  verificar(): Promise<SaudeBackend | null>;
  /** Consulta manual da tarefa agendada de backup. Pode abrir PowerShell no Windows; nunca roda em polling. */
  verificarTarefaBackup(): Promise<BackupAgendado>;
}
