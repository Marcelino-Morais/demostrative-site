import type { EnvelopeBackupCriptografado } from '../../infrastructure/crypto/backup-criptografia.js';
import type { PortaBackupServidor, ResultadoRestauracaoServidor } from '../ports/porta-backup-servidor.js';

/** Backup montado e cifrado no SERVIDOR — ver `porta-backup-servidor.ts`. Só em modo com servidor. */
export class ExportarBackupServidor {
  constructor(private readonly porta: PortaBackupServidor) {}

  async executar(senha: string): Promise<EnvelopeBackupCriptografado> {
    return this.porta.exportar(senha);
  }
}

export class RestaurarBackupServidor {
  constructor(private readonly porta: PortaBackupServidor) {}

  async executar(
    input: { envelopeCriptografado: EnvelopeBackupCriptografado; senha: string } | { dados: unknown },
  ): Promise<ResultadoRestauracaoServidor> {
    return this.porta.restaurar(input);
  }
}
