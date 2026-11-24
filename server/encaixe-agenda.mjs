import { FUNCIONAMENTO_PADRAO, funcionamentoValido, pausaPosConsultaValida } from './funcionamento-agenda.mjs';
const minuto = horario => Number(horario.slice(0, 2)) * 60 + Number(horario.slice(3));
const inicio = consulta => Date.parse(consulta.data + 'T00:00:00Z') / 60000 + minuto(consulta.horario);

/** Encaixa apenas a consulta recebida, preservando as reservas existentes. */
export function encontrarProximoHorario(consulta, consultas, configuracao) {
  const pausa = configuracao?.pausaPosConsultaMinutos === undefined ? 10 : configuracao.pausaPosConsultaMinutos;
  if (!pausaPosConsultaValida(pausa)) return null;
  const dia = Date.parse(consulta.data + 'T00:00:00Z') / 60000;
  const funcionamento = configuracao?.funcionamento ?? FUNCIONAMENTO_PADRAO;
  if (!funcionamentoValido(funcionamento)) return null;
  let cursor = Math.max(inicio(consulta), dia + minuto(funcionamento.inicio));
  const duracao = consulta.duracaoMinutos;
  if (!Number.isFinite(cursor) || !Number.isFinite(duracao) || duracao <= 0) return null;
  const ocupados = consultas.filter(c => c.id !== consulta.id && c.status !== 'CANCELADA')
    .map(c => ({ inicio: inicio(c) - pausa, fim: inicio(c) + c.duracaoMinutos + pausa }));
  const descanso = configuracao?.descanso ?? { ativo: true, inicio: '12:00', fim: '13:30' };
  if (descanso.ativo) ocupados.push({ inicio: dia + minuto(descanso.inicio), fim: dia + minuto(descanso.fim) });
  ocupados.sort((a, b) => a.inicio - b.inicio);
  for (const intervalo of ocupados) {
    if (cursor + duracao <= intervalo.inicio) break;
    if (cursor < intervalo.fim && cursor + duracao > intervalo.inicio) cursor = intervalo.fim;
  }
  if (cursor + duracao > dia + minuto(funcionamento.fim)) return null;
  const total = cursor - dia;
  return { data: consulta.data, horario: `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` };
}
