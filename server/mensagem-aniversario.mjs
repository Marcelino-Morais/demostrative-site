export function mensagemAniversario(nome) {
  const primeiroNome = nome.trim().split(/\s+/u)[0] || 'paciente';
  return `Feliz aniversário, ${primeiroNome}! 🎂🎉\n\nHoje é um dia especial, e eu não poderia deixar essa data passar sem lhe desejar muitas felicidades!\n\nQue seu novo ciclo seja repleto de saúde, paz, amor, alegrias e momentos inesquecíveis. Que nunca faltem motivos para sorrir e que cada novo dia traga novas conquistas e realizações!\n\nÉ uma alegria ter você como meu paciente. Agradeço pela confiança e pelo carinho de sempre!\n\nReceba meu abraço e os mais sinceros votos de um aniversário maravilhoso! 🥰\n\nCom carinho, Dra. Fernanda Morais Mendes!`;
}
