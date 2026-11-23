import { ErroApi } from '../../application/ports/api-client.js';
import type { PortaBackupServidor, ResultadoRestauracaoServidor } from '../../application/ports/porta-backup-servidor.js';
import type { EnvelopeBackupCriptografado } from '../crypto/backup-criptografia.js';

const MENSAGEM_POR_CODIGO: Record<string, string> = {
  'senha-curta': 'Use uma senha de pelo menos 8 caracteres.',
  'backup-formato': 'Este arquivo não tem a estrutura de um backup deste sistema. Nenhum dado foi alterado.',
  'backup-versao-futura': 'Este backup foi gerado por uma versão mais nova do sistema. Nenhum dado foi alterado.',
  'backup-parametros-abusivos': 'Este arquivo pede um processamento fora do intervalo aceito. Nenhum dado foi alterado.',
  'backup-senha-incorreta-ou-corrompido': 'Senha incorreta, ou o arquivo está corrompido/incompleto. Nenhum dado foi alterado.',
  'backup-app-diferente': 'Este arquivo não é um backup deste sistema. Nenhum dado foi alterado.',
  'backup-ausente': 'Nenhum backup foi enviado.',
  'backup-colecoes-divergentes': 'O backup contém coleções contraditórias. Confira a cópia antes de restaurar.',
  'backup-colecao-invalida': 'Uma coleção do backup está em formato inválido.',
};

export class HttpBackupServidor implements PortaBackupServidor {
  private readonly base: string;
  private readonly token: string;

  constructor(baseUrl: string, tokenApi: string) {
    this.base = baseUrl.replace(/\/$/, '');
    this.token = tokenApi;
  }

  private async chamar(caminho: string, corpo: unknown): Promise<Response> {
    try {
      return await fetch(`${this.base}${caminho}`, {
        method: 'POST',
        credentials: 'include',
        headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
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
    throw new ErroApi((codigo && MENSAGEM_POR_CODIGO[codigo]) || `Erro ${r.status} do servidor da clínica.`, r.status, codigo);
  }

  async exportar(senha: string): Promise<EnvelopeBackupCriptografado> {
    const r = await this.chamar('/api/backup/exportar', { senha });
    if (!r.ok) return this.falhar(r);
    return (await r.json()) as EnvelopeBackupCriptografado;
  }

  async restaurar(
    input: { envelopeCriptografado: EnvelopeBackupCriptografado; senha: string } | { dados: unknown },
  ): Promise<ResultadoRestauracaoServidor> {
    const r = await this.chamar('/api/nucleo/restaurar', input);
    if (!r.ok) return this.falhar(r);
    return (await r.json()) as ResultadoRestauracaoServidor;
  }
}
