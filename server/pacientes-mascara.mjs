/**
 * Mascaramento de CPF/RG — único lugar no servidor que decide o que sai
 * "na aberto" numa resposta comum de API. Puro, sem I/O (testado
 * isoladamente em `pacientes-mascara.test.mjs`). Cópia MÍNIMA e
 * independente da versão do domínio do front
 * (`src/domain/value-objects/documento-mascarado.ts`) — mesmo princípio
 * de `nucleo-regras.mjs` vs. `src/domain/entities/*`: nunca compartilha
 * código entre os dois runtimes, só a REGRA.
 *
 * Regra: nunca revela mais que os 2 últimos caracteres alfanuméricos
 * REAIS, e só revela ALGO quando há MAIS de 2 — um valor com 1 ou 2
 * caracteres aparece 100% mascarado (nunca "quase exposto" por inteiro
 * só por ser curto/incompleto/inválido). Separadores do valor original
 * (pontos, traço, barra, espaço) são preservados na posição — forma
 * reconhecível, nunca o conteúdo.
 */

const NAO_INFORMADO = 'Não informado';

function somenteDigitos(valor) {
  return String(valor).replace(/\D/g, '');
}

/** Mascara genérica, preservando separadores — usada por RG e por CPF fora do formato padrão (11 dígitos). */
export function mascaraGenerica(valor) {
  const caracteres = [...String(valor)];
  const indicesAlfanumericos = [];
  for (let i = 0; i < caracteres.length; i++) {
    if (/[a-zA-Z0-9]/.test(caracteres[i])) indicesAlfanumericos.push(i);
  }
  const quantosRevelar = indicesAlfanumericos.length > 2 ? 2 : 0;
  const indicesRevelados = new Set(indicesAlfanumericos.slice(indicesAlfanumericos.length - quantosRevelar));
  return caracteres
    .map((c, i) => (/[a-zA-Z0-9]/.test(c) && !indicesRevelados.has(i) ? '*' : c))
    .join('');
}

/**
 * CPF válido (11 dígitos) → `***.***.***-XY`, com os 2 últimos dígitos
 * REAIS. Qualquer outra coisa (incompleto, com letras, formato
 * estranho) → mascara genérica, nunca o formato de CPF "de mentirinha"
 * (um valor inválido não deve PARECER um CPF válido mascarado).
 */
export function mascararCpf(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return NAO_INFORMADO;
  const digitos = somenteDigitos(valor);
  if (digitos.length === 11) return `***.***.***-${digitos.slice(-2)}`;
  return mascaraGenerica(valor);
}

/**
 * RG varia por formato/emissor (pode ter letra verificadora, zeros à
 * esquerda significativos) — nunca impõe uma máscara numérica fixa.
 * Sempre a mascara genérica, preservando a forma original.
 */
export function mascararRg(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return NAO_INFORMADO;
  return mascaraGenerica(valor);
}

/**
 * `true` quando `recebido` é exatamente a máscara de `valorReal` —
 * round-trip esperado de um campo só exibido (nunca editado) por quem
 * leu `valorReal` já mascarado (inclusive o caso `null` → "Não
 * informado", que é a própria máscara de um valor ausente).
 */
export function ehMascaraDe(recebido, valorReal, mascarar) {
  if (typeof recebido !== 'string') return false;
  return recebido === mascarar(valorReal);
}
