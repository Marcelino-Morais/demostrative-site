/**
 * Helpers de data pra agenda — sempre operando sobre strings
 * `YYYY-MM-DD` via UTC, nunca sobre `new Date('YYYY-MM-DD')` lido com
 * getters locais (esse é o bug de fuso que os testes já pegaram uma
 * vez em `calcularIdade`). Todo cálculo aqui é determinístico e
 * independente do fuso da máquina.
 */

function partes(dataIso: string): [number, number, number] {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return [ano!, mes!, dia!];
}

/** Soma (ou subtrai, com `n` negativo) dias a uma data `YYYY-MM-DD`. */
export function adicionarDias(dataIso: string, n: number): string {
  const [ano, mes, dia] = partes(dataIso);
  const d = new Date(Date.UTC(ano, mes - 1, dia + n));
  return d.toISOString().slice(0, 10);
}

/** Dia da semana em UTC: 0 = domingo … 6 = sábado. */
export function diaDaSemana(dataIso: string): number {
  const [ano, mes, dia] = partes(dataIso);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

/**
 * Domingo da semana que contém `dataIso` — semana dom→sáb, calendário
 * de papel/agenda padrão no Brasil (correção do usuário, Etapa 49:
 * esta função chegou a usar segunda→domingo por engano; a própria
 * referência visual do Praxis/teste2 já documentava "semana pt-BR
 * começa no domingo").
 */
export function inicioDaSemana(dataIso: string): string {
  return adicionarDias(dataIso, -diaDaSemana(dataIso));
}

/** As 7 datas `YYYY-MM-DD` da semana (domingo a sábado) que contém `dataIso`. */
export function diasDaSemana(dataIso: string): string[] {
  const inicio = inicioDaSemana(dataIso);
  return Array.from({ length: 7 }, (_, i) => adicionarDias(inicio, i));
}

/**
 * Início da grade de 6 semanas (42 dias) da visão de mês — o domingo
 * da semana que contém o dia 1 do mês de `dataIso`. Sempre 42 dias
 * porque uma grade de tamanho fixo é mais simples de desenhar (sem
 * "pular linha" mês a mês) e cobre qualquer mês, mesmo os que
 * começam no sábado e têm 31 dias.
 */
export function inicioDaGradeDoMes(dataIso: string): string {
  return inicioDaSemana(inicioDoMes(dataIso));
}

/**
 * Soma (ou subtrai) meses a uma data `YYYY-MM-DD`, atravessando ano
 * quando preciso. Quando o dia não existe no mês de destino (ex.: 31
 * de janeiro + 1 mês), usa o último dia desse mês em vez de estourar
 * pro mês seguinte (31/01 + 1 mês → 28/02, nunca 03/03).
 */
export function adicionarMeses(dataIso: string, n: number): string {
  const [ano, mes, dia] = partes(dataIso);
  const indiceMesAlvo = mes - 1 + n;
  const ultimoDiaDoMesAlvo = new Date(Date.UTC(ano, indiceMesAlvo + 1, 0)).getUTCDate();
  const d = new Date(Date.UTC(ano, indiceMesAlvo, Math.min(dia, ultimoDiaDoMesAlvo)));
  return d.toISOString().slice(0, 10);
}

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** "seg" / "sáb" — rótulo curto do dia da semana. */
export function rotuloDiaCurto(dataIso: string): string {
  return DIAS_CURTOS[diaDaSemana(dataIso)]!;
}

/** "Quarta-feira, 10 de setembro de 2026" — cabeçalho de day view. */
export function rotuloDataExtensa(dataIso: string): string {
  const [ano, mes, dia] = partes(dataIso);
  const nomeDia = DIAS_LONGOS[diaDaSemana(dataIso)]!;
  const nomeDiaCapitalizado = nomeDia.charAt(0).toUpperCase() + nomeDia.slice(1);
  return `${nomeDiaCapitalizado}, ${dia} de ${MESES[mes - 1]} de ${ano}`;
}

/** "10/09" — dia e mês, pros cabeçalhos compactos da week view. */
export function rotuloDiaMes(dataIso: string): string {
  const [, mes, dia] = partes(dataIso);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

/** "Dezembro de 2026" — cabeçalho da month view. */
export function rotuloMesAno(dataIso: string): string {
  const [ano, mes] = partes(dataIso);
  const nomeMes = MESES[mes - 1]!;
  return `${nomeMes.charAt(0).toUpperCase()}${nomeMes.slice(1)} de ${ano}`;
}

/** Hoje em `YYYY-MM-DD`, no fuso local da máquina (o "hoje" que a usuária vê no relógio). */
export function hojeIso(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
}

/** Primeiro dia (`YYYY-MM-01`) do mês que contém `dataIso`. */
export function inicioDoMes(dataIso: string): string {
  const [ano, mes] = partes(dataIso);
  return `${ano}-${String(mes).padStart(2, '0')}-01`;
}

/** Último dia do mês que contém `dataIso` (dia 0 do mês seguinte, via UTC). */
export function fimDoMes(dataIso: string): string {
  const [ano, mes] = partes(dataIso);
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
}

/**
 * `"HH:mm"` → minutos desde meia-noite (ex.: `"14:30"` → 870). Usada
 * pela grade horária da Agenda (Etapa 49) pra posicionar cada consulta
 * verticalmente pelo horário/duração. Mesma ideia de `horarioParaMinutos`
 * em `domain/entities/consulta.ts` (que resolve conflito de horário) —
 * duplicada de propósito aqui como utilitário de apresentação, pra não
 * exportar um detalhe interno do domínio só pra servir um cálculo de
 * layout (mesmo raciocínio de `server/rede.mjs` vs. `scripts/dev-lib.mjs`
 * na Etapa 45).
 */
export function minutosDesdeMeiaNoite(horario: string): number {
  const [hora, minuto] = horario.split(':').map(Number);
  return (hora || 0) * 60 + (minuto || 0);
}
