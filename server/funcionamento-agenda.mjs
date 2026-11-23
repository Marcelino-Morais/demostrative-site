export const FUNCIONAMENTO_PADRAO = Object.freeze({ inicio: '09:00', fim: '17:00' });
const horaValida = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const minutos = v => Number(v.slice(0,2))*60+Number(v.slice(3));
export function funcionamentoValido(valor) {
 return Boolean(valor && horaValida(valor.inicio) && horaValida(valor.fim) && valor.inicio < valor.fim);
}
export function descansoDentroDoFuncionamento(descanso, funcionamento) {
 return !descanso?.ativo || Boolean(funcionamentoValido(funcionamento) && horaValida(descanso.inicio) && horaValida(descanso.fim) && descanso.inicio >= funcionamento.inicio && descanso.fim <= funcionamento.fim && descanso.inicio < descanso.fim);
}
export function consultaForaDoFuncionamento(consulta, configuracao) {
 const funcionamento = configuracao?.funcionamento ?? FUNCIONAMENTO_PADRAO;
 if (!funcionamentoValido(funcionamento) || !horaValida(consulta.horario) || !Number.isInteger(consulta.duracaoMinutos) || consulta.duracaoMinutos <= 0) return true;
 return minutos(consulta.horario) < minutos(funcionamento.inicio) || minutos(consulta.horario)+consulta.duracaoMinutos > minutos(funcionamento.fim);
}
