import { hojeIsoLocal } from '../../domain/types.js';
import { dataCalendarioValida, normalizarDataCadastral } from '../../domain/value-objects/data-cadastral.js';
import { centavosParaReaisTexto } from '../../domain/value-objects/dinheiro.js';

export { centavosParaReaisTexto };

const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formata uma data pra exibição pt-BR. Para uma string só-data
 * (`YYYY-MM-DD`, como as consultas guardam), NÃO passa por
 * `new Date('YYYY-MM-DD')` — isso é interpretado como meia-noite UTC e
 * "recua" um dia em fusos negativos (o mesmo bug que os testes já
 * pegaram em `calcularIdade`). Para um timestamp ISO completo
 * (`criadoEm` etc.) o `Date` normal está certo.
 */
export function formatarDataIso(dataIso: string | null): string {
  if (!dataIso) return '—';
  const normalizada = normalizarDataCadastral(dataIso)!;
  const soData = SO_DATA.exec(normalizada);
  if (soData) {
    if (!dataCalendarioValida(normalizada)) return '—';
    const [, ano, mes, dia] = soData;
    return new Date(Number(ano), Number(mes) - 1, Number(dia)).toLocaleDateString('pt-BR');
  }
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleDateString('pt-BR');
}

export function formatarDataHoraIso(dataIso: string | null): string {
  if (!dataIso) return '—';
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Data de hoje no formato aceito por `<input type="date">` (YYYY-MM-DD). */
export function hojeParaInputDate(): string {
  return hojeIsoLocal();
}

/** Tamanho de arquivo legível: "980 KB", "2,3 MB". */
export function formatarTamanhoArquivo(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

/**
 * Formatação automática de identificação/contato (Etapa 44) — pensada
 * para ser chamada a cada tecla digitada (`onChange`), não só ao sair
 * do campo: em todas, o primeiro passo é reduzir a dígitos (e, no caso
 * do RG, opcionalmente um `X` final), o que já resolve colar um número
 * com pontuação, espaços, ou só dígitos — o resultado final é sempre o
 * mesmo. Chamar de novo em cima do próprio resultado não muda nada
 * (idempotente), o que é o que permite religar isso no `onChange` sem
 * medo. Nenhuma delas lança erro nem exige o campo preenchido — string
 * vazia entra, string vazia sai, porque estes três campos já são
 * opcionais no cadastro (`Paciente.criar` só exige o nome).
 *
 * Importante: só formatam o que a pessoa digita/cola NESTE momento —
 * nunca são chamadas ao só abrir a ficha para edição, então um
 * cadastro antigo com CPF/celular gravado num formato diferente
 * (ou só dígitos) continua exatamente como estava até alguém mexer
 * de novo naquele campo. Isso é seguro porque toda leitura de
 * CPF/RG/celular no resto do sistema (busca de paciente, número do
 * WhatsApp) já lida com o dado podendo ou não ter pontuação — ver
 * `Paciente.pacienteCorrespondeABusca` e
 * `normalizarNumeroWhatsapp`, que sempre reduzem a dígitos antes de
 * comparar/usar.
 */

/** CPF como `000.000.000-00` assim que os 11 dígitos estão presentes; formata progressivamente antes disso. */
export function formatarCpf(valorDigitado: string): string {
  const digitos = valorDigitado.replace(/\D/g, '').slice(0, 11);
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  if (digitos.length <= 9) return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

/**
 * Celular/telefone como `(00) 0000-0000` (fixo, 10 dígitos) ou
 * `(00) 00000-0000` (celular, 11 dígitos) — formata progressivamente
 * enquanto digita; só decide entre os dois formatos quando o 11º
 * dígito aparece, então um fixo digitado por completo não vira
 * celular no meio do caminho.
 */
export function formatarTelefone(valorDigitado: string): string {
  const digitos = valorDigitado.replace(/\D/g, '').slice(0, 11);
  if (digitos.length === 0) return '';
  if (digitos.length <= 2) return `(${digitos}`;
  const ddd = digitos.slice(0, 2);
  const resto = digitos.slice(2);
  if (digitos.length <= 6) return `(${ddd}) ${resto}`;
  const tamanhoLocal1 = digitos.length > 10 ? 5 : 4; // 11 dígitos = celular (9 no número local)
  const local1 = resto.slice(0, tamanhoLocal1);
  const local2 = resto.slice(tamanhoLocal1);
  return local2 ? `(${ddd}) ${local1}-${local2}` : `(${ddd}) ${local1}`;
}

/**
 * RG só ganha pontuação quando o valor (sem pontuação, mantendo um
 * eventual `X`/`x` final de dígito verificador) bate com um dos dois
 * tamanhos mais comuns no Brasil (8 ou 9 caracteres) — vira
 * `X.XXX.XXX-X` ou `XX.XXX.XXX-X`. Fora isso, devolve o texto como a
 * pessoa digitou/colou, sem forçar um formato: RG varia de estado
 * para estado, e este helper não tenta validar, só ajudar a leitura
 * no caso mais comum.
 */
export function formatarRg(valorDigitado: string): string {
  const limpo = valorDigitado.replace(/[^0-9xX]/g, '').toUpperCase();
  if (limpo.length === 9) return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}-${limpo.slice(8)}`;
  if (limpo.length === 8) return `${limpo.slice(0, 1)}.${limpo.slice(1, 4)}.${limpo.slice(4, 7)}-${limpo.slice(7)}`;
  return valorDigitado;
}
