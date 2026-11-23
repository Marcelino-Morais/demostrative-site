export async function comTravaColecao<T>(chave: string, executar: () => T | Promise<T>, obrigatoria = false): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) return await navigator.locks.request(`pf-storage:${chave}`, executar);
  if (obrigatoria) return Promise.reject(new Error('Este navegador não oferece a trava necessária para limpar com segurança. Nenhum dado foi removido.'));
  return Promise.resolve().then(executar);
}
