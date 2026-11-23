/**
 * Mascaramento de CPF/RG para exibição — cópia MÍNIMA e independente do
 * servidor (`server/pacientes-mascara.mjs`, mesmo princípio de
 * `nucleo-regras.mjs` vs. domínio: nunca compartilha código entre os
 * dois runtimes, só a regra). Em modo com servidor, o valor que chega
 * aqui já vem mascarado de lá — esta função nunca é chamada de novo em
 * cima disso (ver `useExibirDocumento`/telas que leem `paciente.cpf`).
 * Usada só no modo 100% local (sem backend), onde o valor em memória
 * ainda é o real.
 *
 * Regra: nunca revela mais que os 2 últimos caracteres alfanuméricos
 * REAIS, e só revela algo quando há mais de 2 — um valor com 1 ou 2
 * caracteres fica 100% mascarado. Separadores (ponto, traço, barra,
 * espaço) são preservados na posição.
 */

const NAO_INFORMADO = 'Não informado';

function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function mascaraGenerica(valor: string): string {
  const caracteres = [...valor];
  const indicesAlfanumericos: number[] = [];
  caracteres.forEach((c, i) => {
    if (/[a-zA-Z0-9]/.test(c)) indicesAlfanumericos.push(i);
  });
  const quantosRevelar = indicesAlfanumericos.length > 2 ? 2 : 0;
  const indicesRevelados = new Set(indicesAlfanumericos.slice(indicesAlfanumericos.length - quantosRevelar));
  return caracteres.map((c, i) => (/[a-zA-Z0-9]/.test(c) && !indicesRevelados.has(i) ? '*' : c)).join('');
}

export function mascararCpf(valor: string | null | undefined): string {
  if (!valor || !valor.trim()) return NAO_INFORMADO;
  const digitos = somenteDigitos(valor);
  if (digitos.length === 11) return `***.***.***-${digitos.slice(-2)}`;
  return mascaraGenerica(valor);
}

export function mascararRg(valor: string | null | undefined): string {
  if (!valor || !valor.trim()) return NAO_INFORMADO;
  return mascaraGenerica(valor);
}
