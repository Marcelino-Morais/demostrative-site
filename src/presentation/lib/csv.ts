/**
 * Geração de CSV no navegador, sem nenhuma dependência — para exportar
 * as tabelas dos relatórios (Etapa 15). Campos separados por `;` (o
 * separador que o Excel em português abre direto), com aspas só quando
 * o valor precisa, e um BOM UTF-8 no download para os acentos saírem
 * certos. Nunca inclui dado clínico: quem monta as linhas decide o
 * conteúdo, e os relatórios só passam agregados/dados operacionais.
 */
export type CelulaCsv = string | number;

/** BOM UTF-8 (U+FEFF) — faz o Excel abrir os acentos corretamente. */
const BOM_UTF8 = String.fromCharCode(0xfeff);

export function montarCsv(linhas: CelulaCsv[][], separador = ';'): string {
  const escapar = (valor: CelulaCsv): string => {
    const texto = typeof valor === 'number' ? String(valor) : valor;
    if (texto.includes('"') || texto.includes(separador) || texto.includes('\n') || texto.includes('\r')) {
      return `"${texto.replace(/"/g, '""')}"`;
    }
    return texto;
  };
  return linhas.map((linha) => linha.map(escapar).join(separador)).join('\r\n');
}

/**
 * Dispara o download de um texto como arquivo — mesmo mecanismo do
 * backup (`configuracoes-page.tsx`): Blob + object URL + clique num
 * `<a download>` temporário, nada sai da máquina.
 */
export function baixarTexto(nomeArquivo: string, conteudo: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([BOM_UTF8, conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
