import { AlertTriangle, CloudOff } from 'lucide-react';
import { useSincronizacao } from '../../providers/sincronizacao-provider.js';

/**
 * Faixa global de "servidor com problema" (Etapa 21; modo "degradado"
 * na Etapa 23). Aparece no topo do conteúdo, em qualquer tela, só
 * quando o modo compartilhado está ligado e o servidor não respondeu
 * OU respondeu mas não consegue salvar dados — é o aviso claro de que o
 * registro clínico e os arquivos não carregam/salvam com segurança até
 * resolver. Some sozinha quando o servidor volta ao normal (o
 * `SincronizacaoProvider` re-sonda).
 */
export function FaixaOffline() {
  const { diagnostico, verificando, revalidar } = useSincronizacao();
  const modo = diagnostico?.modo;
  if (modo !== 'offline' && modo !== 'degradado') return null;

  return (
    <div
      role="alert"
      className="no-print flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-warning-200 bg-warning-50 px-4 py-2 text-xs text-warning-800 dark:border-warning-800 dark:bg-warning-900/40 dark:text-warning-300 sm:px-6"
    >
      {modo === 'offline' ? (
        <>
          <CloudOff className="h-4 w-4 shrink-0 animate-pulse" aria-hidden="true" />
          <span>
            <strong>Servidor da clínica fora do ar.</strong> O registro clínico (pacientes, agenda, planos,
            odontograma, evolução) e os arquivos não carregam nem salvam até reconectar.
          </span>
        </>
      ) : (
        <>
          <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" aria-hidden="true" />
          <span>
            <strong>Servidor da clínica com problema para salvar dados.</strong> Ele está no ar, mas a pasta de dados
            não está gravável — o que você fizer agora pode não estar sendo salvo. Veja o diagnóstico em Backup.
          </span>
        </>
      )}
      <button
        type="button"
        onClick={revalidar}
        disabled={verificando}
        className="ml-auto rounded border border-warning-300 px-2 py-0.5 font-medium hover:bg-warning-100 disabled:opacity-50 dark:border-warning-700 dark:hover:bg-warning-900/60"
      >
        {verificando ? 'Verificando…' : 'Verificar'}
      </button>
    </div>
  );
}
