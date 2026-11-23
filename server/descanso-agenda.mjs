export const DESCANSO_PADRAO = { ativo: true, inicio: '12:00', fim: '13:30' };
const minutos = horario => Number(horario.slice(0, 2)) * 60 + Number(horario.slice(3));

export function descansoValido(valor) {
  return valor && typeof valor.ativo === 'boolean'
    && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor.inicio)
    && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor.fim)
    && valor.inicio < valor.fim;
}

export function consultaInvadeDescanso(consulta, configuracao) {
  const descanso = configuracao?.descanso ?? DESCANSO_PADRAO;
  if (!descanso.ativo) return false;
  const inicio = minutos(consulta.horario), fim = inicio + consulta.duracaoMinutos;
  // Verifica também uma consulta longa que atravessa a meia-noite.
  for (let dia = 0; dia <= Math.min(1, Math.floor(fim / 1440)); dia++) {
    if (inicio < dia * 1440 + minutos(descanso.fim) && fim > dia * 1440 + minutos(descanso.inicio)) return true;
  }
  return false;
}
