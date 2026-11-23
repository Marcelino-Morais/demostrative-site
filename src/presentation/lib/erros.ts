import { ErroApi } from '../../application/ports/api-client.js';
import { ErroDominio } from '../../domain/types.js';

/**
 * Mensagem pronta para a tela a partir de um erro capturado. Tanto
 * `ErroDominio` (violação de regra) quanto `ErroApi` (servidor da
 * clínica fora do ar / recusou) já carregam um texto curto e amigável
 * — qualquer outra coisa cai no `fallback` genérico, sem vazar detalhe
 * técnico. Usada nos `catch` das telas que gravam pelo núcleo
 * (pacientes/consultas), que agora podem falhar por rede.
 */
export function mensagemDeErro(erro: unknown, fallback: string): string {
  if (erro instanceof ErroDominio || erro instanceof ErroApi) return erro.message;
  return fallback;
}
