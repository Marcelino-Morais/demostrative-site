/**
 * Criptografia do backup manual (exportação/restauração) — AES-256-GCM
 * com chave derivada da senha por PBKDF2-SHA256. Só orquestra a Web
 * Crypto API (`crypto.subtle`), disponível em todo navegador moderno e
 * em Node 20+ (os testes rodam contra a API real, sem mock) — nenhuma
 * primitiva criptográfica própria.
 *
 * Formato do envelope é versionado e nunca carrega nome de paciente,
 * contagem clínica ou qualquer outro metadado sensível fora do bloco
 * cifrado — só o necessário para decifrar (algoritmos, parâmetros do
 * KDF, salt, nonce).
 */

export const FORMATO_BACKUP_CRIPTOGRAFADO = 'projfernanda-backup-criptografado';
export const VERSAO_CRIPTOGRAFIA = 1;
/** Extensão que identifica o arquivo como backup criptografado — nunca `.json` (não é legível como um). */
export const EXTENSAO_BACKUP_CRIPTOGRAFADO = '.pfbackup';

const ALGORITMO_CIFRA = 'AES-GCM';
const TAMANHO_CHAVE_BITS = 256;
const ALGORITMO_KDF = 'PBKDF2';
const HASH_KDF = 'SHA-256';
const TAMANHO_SALT_BYTES = 16;
const TAMANHO_NONCE_BYTES = 12;

/** Referência OWASP (2023+) para PBKDF2-HMAC-SHA256. SubtleCrypto é nativo — isto é rápido mesmo no navegador. */
export const ITERACOES_PBKDF2_PADRAO = 600_000;
/** Limites de aceitação na IMPORTAÇÃO — nunca confiar nos parâmetros de um arquivo alheio/adulterado. */
export const ITERACOES_PBKDF2_MINIMO = 100_000;
export const ITERACOES_PBKDF2_MAXIMO = 3_000_000;
/** Tamanho máximo de arquivo aceito na importação — generoso para um prontuário, mas finito. */
export const TAMANHO_MAXIMO_ARQUIVO_BYTES = 200 * 1024 * 1024;

export interface EnvelopeBackupCriptografado {
  formato: typeof FORMATO_BACKUP_CRIPTOGRAFADO;
  versao: number;
  kdf: { algoritmo: string; hash: string; iteracoes: number; saltBase64: string };
  cifra: { algoritmo: string; nonceBase64: string };
  conteudoBase64: string;
}

function paraBase64(bytes: Uint8Array): string {
  const TAMANHO_BLOCO = 0x8000;
  let binario = '';
  for (let i = 0; i < bytes.length; i += TAMANHO_BLOCO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + TAMANHO_BLOCO));
  }
  return btoa(binario);
}

function deBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function derivarChave(senha: string, salt: Uint8Array<ArrayBuffer>, iteracoes: number): Promise<CryptoKey> {
  const chaveBase = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), ALGORITMO_KDF, false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: ALGORITMO_KDF, salt, iterations: iteracoes, hash: HASH_KDF },
    chaveBase,
    { name: ALGORITMO_CIFRA, length: TAMANHO_CHAVE_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Cifra `textoClaro` com `senha`. Salt e nonce são gerados aleatoriamente a cada chamada — nunca reaproveitados. */
export async function criptografarBackup(
  textoClaro: string,
  senha: string,
  opcoes?: { iteracoes?: number },
): Promise<EnvelopeBackupCriptografado> {
  const iteracoes = opcoes?.iteracoes ?? ITERACOES_PBKDF2_PADRAO;
  const salt = crypto.getRandomValues(new Uint8Array(TAMANHO_SALT_BYTES));
  const nonce = crypto.getRandomValues(new Uint8Array(TAMANHO_NONCE_BYTES));
  const chave = await derivarChave(senha, salt, iteracoes);
  const cifrado = await crypto.subtle.encrypt(
    { name: ALGORITMO_CIFRA, iv: nonce },
    chave,
    new TextEncoder().encode(textoClaro),
  );
  return {
    formato: FORMATO_BACKUP_CRIPTOGRAFADO,
    versao: VERSAO_CRIPTOGRAFIA,
    kdf: { algoritmo: ALGORITMO_KDF, hash: HASH_KDF, iteracoes, saltBase64: paraBase64(salt) },
    cifra: { algoritmo: ALGORITMO_CIFRA, nonceBase64: paraBase64(nonce) },
    conteudoBase64: paraBase64(new Uint8Array(cifrado)),
  };
}

export type MotivoRejeicaoDescriptografia =
  | 'formato'
  | 'versao-futura'
  | 'parametros-abusivos'
  | 'senha-incorreta-ou-corrompido';

export interface DescriptografiaOk {
  ok: true;
  textoClaro: string;
}
export interface DescriptografiaFalha {
  ok: false;
  motivo: MotivoRejeicaoDescriptografia;
  mensagem: string;
}
export type ResultadoDescriptografia = DescriptografiaOk | DescriptografiaFalha;

const MENSAGEM_REJEICAO: Record<MotivoRejeicaoDescriptografia, string> = {
  formato: 'Este arquivo não tem a estrutura de um backup criptografado deste sistema. Nenhum dado foi alterado.',
  'versao-futura':
    'Este backup criptografado foi gerado por uma versão mais nova do sistema. Atualize o aplicativo antes de restaurá-lo. Nenhum dado foi alterado.',
  'parametros-abusivos':
    'Este arquivo pede um processamento fora do intervalo aceito pelo sistema — pode estar corrompido ou ter sido montado por outra ferramenta. Nenhum dado foi alterado.',
  'senha-incorreta-ou-corrompido':
    'Senha incorreta, ou o arquivo está corrompido/incompleto. Nenhum dado foi alterado.',
};

/** Reconhece, pela FORMA, se um JSON arbitrário parece ser um envelope criptografado deste sistema (sem decifrar nada). */
export function pareceEnvelopeCriptografado(valor: unknown): valor is EnvelopeBackupCriptografado {
  return Boolean(valor) && typeof valor === 'object' && (valor as Record<string, unknown>).formato === FORMATO_BACKUP_CRIPTOGRAFADO;
}

/**
 * Decifra um envelope já lido do arquivo escolhido pelo usuário. Recusa
 * ANTES de tentar decifrar quando a forma é inválida, a versão é
 * futura, ou os parâmetros do KDF estão fora da faixa aceita (nunca
 * processa um número de iterações arbitrário vindo de um arquivo
 * alheio). Senha errada e arquivo adulterado/truncado produzem a MESMA
 * mensagem de propósito — GCM já não distingue os dois internamente, e
 * diferenciar daria pista a quem está tentando adivinhar a senha.
 */
export async function descriptografarBackup(envelopeBruto: unknown, senha: string): Promise<ResultadoDescriptografia> {
  const rejeitar = (motivo: MotivoRejeicaoDescriptografia): DescriptografiaFalha => ({
    ok: false,
    motivo,
    mensagem: MENSAGEM_REJEICAO[motivo],
  });

  if (!pareceEnvelopeCriptografado(envelopeBruto)) return rejeitar('formato');
  const envelope = envelopeBruto;

  if (typeof envelope.versao !== 'number') return rejeitar('formato');
  if (envelope.versao > VERSAO_CRIPTOGRAFIA) return rejeitar('versao-futura');

  if (
    !envelope.kdf ||
    typeof envelope.kdf !== 'object' ||
    !envelope.cifra ||
    typeof envelope.cifra !== 'object' ||
    typeof envelope.conteudoBase64 !== 'string'
  ) {
    return rejeitar('formato');
  }
  if (envelope.kdf.algoritmo !== ALGORITMO_KDF || envelope.kdf.hash !== HASH_KDF || envelope.cifra.algoritmo !== ALGORITMO_CIFRA) {
    return rejeitar('formato');
  }

  const iteracoes = envelope.kdf.iteracoes;
  if (typeof iteracoes !== 'number' || !Number.isFinite(iteracoes)) return rejeitar('formato');
  if (iteracoes < ITERACOES_PBKDF2_MINIMO || iteracoes > ITERACOES_PBKDF2_MAXIMO) return rejeitar('parametros-abusivos');

  let salt: Uint8Array<ArrayBuffer>;
  let nonce: Uint8Array<ArrayBuffer>;
  let cifrado: Uint8Array<ArrayBuffer>;
  try {
    salt = deBase64(envelope.kdf.saltBase64);
    nonce = deBase64(envelope.cifra.nonceBase64);
    cifrado = deBase64(envelope.conteudoBase64);
  } catch {
    return rejeitar('formato');
  }
  if (salt.length === 0 || nonce.length !== TAMANHO_NONCE_BYTES || cifrado.length === 0) return rejeitar('formato');

  try {
    const chave = await derivarChave(senha, salt, iteracoes);
    const textoClaroBuf = await crypto.subtle.decrypt({ name: ALGORITMO_CIFRA, iv: nonce }, chave, cifrado);
    return { ok: true, textoClaro: new TextDecoder().decode(textoClaroBuf) };
  } catch {
    return rejeitar('senha-incorreta-ou-corrompido');
  }
}
