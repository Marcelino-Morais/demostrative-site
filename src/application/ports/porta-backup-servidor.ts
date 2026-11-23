import type { EnvelopeBackupCriptografado } from '../../infrastructure/crypto/backup-criptografia.js';

/**
 * Backup montado E cifrado INTEIRAMENTE no servidor (ver
 * `server/backup-exportacao.mjs`/`backup-criptografia.mjs`) — o
 * navegador nunca recebe a coleção completa em JSON aberto, só o
 * envelope já protegido. Só existe em modo com servidor
 * (`CONFIGURACAO_API.nucleo`); modo 100% local continua usando
 * `ExportarBackup`/`ImportarBackup` (já seguro — sem fronteira de rede
 * pra proteger).
 */
export interface ResultadoRestauracaoServidor {
  porColecao: Record<
    string,
    {
      gravados?: number;
      ignorados?: number;
      criados?: number;
      restauradosExcluidos?: number;
      aplicados?: number;
      preservadosSemAlteracao?: number;
      excluidosIntencionalmente?: number;
      conflitosIdentidade?: number;
      ignoradosPacienteNaoRestaurado?: number;
    }
  >;
  conflitosIdentidadePacientes: { idBackup: string; idExistente: string | null }[];
}

export interface PortaBackupServidor {
  /** `POST /api/backup/exportar` — devolve só o envelope já cifrado. */
  exportar(senha: string): Promise<EnvelopeBackupCriptografado>;
  /**
   * `POST /api/nucleo/restaurar` — paciente já existente NUNCA tem
   * nenhum campo alterado (ver `pacientes-restauracao.mjs`); outras
   * coleções são substituídas por id normalmente.
   */
  restaurar(input: { envelopeCriptografado: EnvelopeBackupCriptografado; senha: string } | { dados: unknown }): Promise<ResultadoRestauracaoServidor>;
}
