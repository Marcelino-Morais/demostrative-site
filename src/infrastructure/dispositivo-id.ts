const CHAVE_LOCAL_STORAGE = 'pf_dispositivo_id';

/**
 * Identificador ANÔNIMO e ESTÁVEL deste navegador — nunca uma
 * identidade de pessoa (este sistema não tem conta individual, só a
 * senha única da clínica). Existe só pra coordenar, no servidor, o
 * reconhecimento de solicitações de agendamento POR DISPOSITIVO (ver
 * `server/solicitacoes-vistas-store.mjs`): fechar a janela numa máquina
 * não pode silenciar outra. Gerado uma vez por navegador, persiste em
 * `localStorage` (nunca em `sessionStorage` — precisa sobreviver a
 * fechar/abrir o navegador, já que o objetivo é "este computador",
 * não "esta aba").
 */
export function obterDispositivoId(): string {
  try {
    const existente = window.localStorage.getItem(CHAVE_LOCAL_STORAGE);
    if (existente) return existente;
    const novo = crypto.randomUUID();
    window.localStorage.setItem(CHAVE_LOCAL_STORAGE, novo);
    return novo;
  } catch {
    // Sem localStorage (modo privado estrito, storage bloqueado) — um id
    // novo a cada chamada ainda funciona pro reconhecimento (só não
    // persiste entre recargas), nunca quebra a tela por causa disso.
    return crypto.randomUUID();
  }
}
