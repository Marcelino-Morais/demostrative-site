import type {
  DuplicatasPorCorrespondencia,
  StatusSincronizacaoGoogleSheets,
} from '../../../application/ports/porta-google-sheets-sync.js';
import type { AlertTone } from '../../components/ui/alert.js';

/**
 * Rótulos amigáveis (Etapa 58) — nunca expõe ID de planilha, e-mail da
 * conta de serviço, caminho de credencial, ou detalhe técnico cru.
 * Mesmo espírito de `MENSAGENS_ERRO` em `http-google-forms-email.ts`.
 */
export const ROTULO_MOTIVO_NAO_CONFIGURADO: Record<string, string> = {
  'sem-credencial': 'Ainda não foi configurada a credencial da sincronização automática.',
  'credencial-invalida': 'A credencial configurada não é um arquivo válido — confira o caminho e o conteúdo do arquivo.',
  'credencial-incompleta': 'A credencial configurada está incompleta — falta alguma informação nela.',
};

export const ROTULO_ULTIMO_ERRO: Record<string, string> = {
  'erro-busca': 'Não foi possível buscar uma das planilhas agora — pode ser falta de internet ou um problema temporário do Google.',
  'sem-coluna-carimbo': 'Uma das planilhas está sem a coluna "Carimbo de data/hora" — confira se ela não foi apagada sem querer.',
};

/** Cobre também `google-auth-http-<status>`/`sheets-http-<status>` (Etapa 57/58), sem expor o status cru sem contexto. */
export function rotuloUltimoErro(codigo: string | null): string | null {
  if (!codigo) return null;
  if (ROTULO_ULTIMO_ERRO[codigo]) return ROTULO_ULTIMO_ERRO[codigo];
  if (codigo.startsWith('google-auth-http-')) {
    return 'Não foi possível autenticar com o Google agora — confira se a credencial ainda é válida.';
  }
  if (codigo.startsWith('sheets-http-')) {
    return 'O Google recusou o acesso a uma das planilhas — confira se ela ainda está compartilhada com a conta de serviço.';
  }
  return 'Ocorreu um problema não identificado na última sincronização.';
}

export type EstadoOperacionalSincronizacao = 'nao-configurado' | 'em-andamento' | 'falhando' | 'funcionando' | 'pronto-sem-execucao' | 'revisao';

export function estadoOperacionalSincronizacao(status: StatusSincronizacaoGoogleSheets): EstadoOperacionalSincronizacao {
  if (!status.configurado) return 'nao-configurado';
  if (status.emAndamento) return 'em-andamento';
  if (status.ultimoErro) return 'falhando';
  if ((status.ultimoResultado?.pendentes ?? 0) > 0 || (status.ultimoResultado?.rejeitadas ?? 0) > 0) return 'revisao';
  if (!status.ultimaTentativaEm) return 'pronto-sem-execucao';
  return 'funcionando';
}

export const TOM_POR_ESTADO: Record<EstadoOperacionalSincronizacao, AlertTone> = {
  'nao-configurado': 'brand',
  'em-andamento': 'brand',
  falhando: 'danger',
  revisao: 'warning',
  funcionando: 'success',
  'pronto-sem-execucao': 'brand',
};

/** Total de linhas rejeitadas na última rodada, somando os 3 formulários — só pra um resumo de uma linha. */
export function totalRejeitadasUltimaRodada(status: StatusSincronizacaoGoogleSheets): number {
  return status.ultimoResultado?.rejeitadas ?? 0;
}

/** Soma os 3 tipos de correspondência (Etapa 59) — só pra um resumo de uma linha, nunca detalhe por paciente. */
export function totalDuplicatas(duplicatas: DuplicatasPorCorrespondencia | undefined): number {
  if (!duplicatas) return 0;
  return duplicatas.legado + duplicatas['conteudo-exato'] + duplicatas.normalizado;
}
