/**
 * Port da aquisição sintética via agente de captura desacoplado
 * (continuação da reconstrução do WIM VITOR — pedido explícito:
 * "conecte o agente sintético ao servidor e à interface por um contrato
 * utilizável"). Só existe no modo servidor. `modo: 'sintetico'` vem
 * sempre do próprio trabalho — a tela deve mostrar isto com destaque,
 * nunca deixar parecer uma captura real (não há adaptador real nesta
 * tarefa — ver `wim_vitor_project/agente-captura/README.md`).
 *
 * `concluir` nunca recebe `pacienteId` — o servidor usa só o que está
 * gravado no próprio trabalho, revalidado contra o núcleo de pacientes
 * na hora de salvar. Trocar de ficha durante a aquisição não redireciona
 * o resultado.
 */

export type EstadoTrabalhoCaptura =
  | 'PREPARANDO'
  | 'AGUARDANDO_DISPOSITIVO'
  | 'CAPTURANDO'
  | 'REVISAO'
  | 'CONCLUIDO'
  | 'CANCELADO'
  | 'FALHA';

export interface ImagemCandidataCaptura {
  formato: string;
  sha256: string;
  origemSintetica: boolean;
  bytesBase64: string;
}

export interface TrabalhoCaptura {
  trabalhoId: string;
  pacienteId: string;
  exameReferencia: string | null;
  dispositivoId: string;
  estado: EstadoTrabalhoCaptura;
  criadoEm: string;
  atualizadoEm: string;
  imagemCandidata: ImagemCandidataCaptura | null;
  motivoFalha: string | null;
  modo: string;
}

export interface StatusCapturaWim {
  habilitado: boolean;
  agenteOnline: boolean;
  modo: string;
}

export type ResultadoCapturaWim = { ok: true; trabalho: TrabalhoCaptura } | { ok: false; motivo: string };
export type ResultadoConcluirCaptura =
  | { ok: true; arquivoId: string }
  | { ok: false; motivo: string };

export interface GatewayCapturaWim {
  status(): Promise<StatusCapturaWim>;
  iniciar(pacienteId: string, exameReferencia?: string | null): Promise<ResultadoCapturaWim>;
  avancar(trabalhoId: string): Promise<ResultadoCapturaWim>;
  repetir(trabalhoId: string): Promise<ResultadoCapturaWim>;
  cancelar(trabalhoId: string): Promise<ResultadoCapturaWim>;
  obter(trabalhoId: string): Promise<ResultadoCapturaWim>;
  concluir(trabalhoId: string): Promise<ResultadoConcluirCaptura>;
}
