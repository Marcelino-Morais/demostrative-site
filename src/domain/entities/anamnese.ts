import { agoraIso, ErroDominio, gerarId, type SimNao } from '../types.js';

/** "Já fez uso de: ou ainda faz?" — lista de medicamentos de atenção especial do documento original. */
export interface MedicamentosEspecificos {
  penicilina: boolean;
  sulfa: boolean;
  diclofenacoSodico: boolean;
  bisfosfonato: boolean;
  anticoagulante: boolean;
  antiplaquetario: boolean;
  prolia: boolean;
}

/** Rótulos (com exemplos comerciais) dos medicamentos de atenção especial — usados no formulário e no documento impresso. */
export const MEDICAMENTO_ESPECIFICO_LABEL: Record<keyof MedicamentosEspecificos, string> = {
  penicilina: 'Penicilina (Amoxicilina, Benzetacil...)',
  sulfa: 'Sulfa (Bactrim...)',
  diclofenacoSodico: 'Diclofenaco sódico (Cataflam, Voltaren...)',
  bisfosfonato: 'Bisfosfonato (Alendronato, Trastuzumab/Herceptin...)',
  anticoagulante: 'Anticoagulante (Varfarina, Marevan...)',
  antiplaquetario: 'Antiplaquetário (Clopidogrel, AAS)',
  prolia: 'Prolia',
};

const MEDICAMENTOS_ESPECIFICOS_ROTULOS = Object.entries(MEDICAMENTO_ESPECIFICO_LABEL) as [
  keyof MedicamentosEspecificos,
  string,
][];

export type SinalBucal =
  | 'SANGRAMENTO_GENGIVAL'
  | 'GENGIVA_INCHADA'
  | 'DENTES_ABALADOS'
  | 'DOR_AO_ABRIR_OU_FECHAR_BOCA'
  | 'GOSTO_RUIM_OU_MAU_HALITO';

export const SINAL_BUCAL_LABEL: Record<SinalBucal, string> = {
  SANGRAMENTO_GENGIVAL: 'Sangramento gengival',
  GENGIVA_INCHADA: 'Gengiva inchada',
  DENTES_ABALADOS: 'Dentes abalados',
  DOR_AO_ABRIR_OU_FECHAR_BOCA: 'Dor ao abrir ou fechar a boca',
  GOSTO_RUIM_OU_MAU_HALITO: 'Gosto ruim ou mau hálito',
};

export interface HistoricoSaudeBucal {
  jaRecebeuAnestesiaOdontologica: SimNao;
  reacaoAnestesia: string;
  jaExtraiuDente: SimNao;
  sangraMuitoAoExtrairOuMachucar: SimNao;
  sinaisNotados: SinalBucal[];
  jaSofreuTraumaOuFratura: SimNao;
}

export interface HabitosNocivos {
  fumante: SimNao;
  fumantePorQuantoTempo: string;
  usaBebidaAlcoolica: SimNao;
  bebidaAlcoolicaFrequencia: string;
  usaDrogasIlicitas: SimNao;
  drogasIlicitasTipo: string;
  drogasIlicitasFrequencia: string;
  apertaDentes: boolean;
  rangeDentes: boolean;
  mordeObjetosComOsDentes: boolean;
}

export interface HigieneBucal {
  escovacoesPorDia: number | null;
  usaFioDental: SimNao;
  outroRecursoDeLimpeza: string;
}

export interface AnamneseProps {
  id: string;
  pacienteId: string;

  queixaPrincipal: string;

  alergiaMedicacao: SimNao;
  alergiaMedicacaoQuais: string;

  pressaoArterial: 'ALTA' | 'NORMAL' | null;
  pressaoArterialValor: string;

  usaMedicamento: SimNao;
  usaMedicamentoQuais: string;

  temProblemaDeSaude: SimNao;
  problemaDeSaudeQual: string;

  estaSobTratamentoMedico: SimNao;
  tratamentoMedicoMotivo: string;
  nomeMedicoQueAcompanha: string;

  possuiSindrome: SimNao;
  possuiSindromeQual: string;

  usaAntidepressivo: SimNao;
  usaAntidepressivoNome: string;

  apresentaProcessoAlergico: SimNao;
  processoAlergicoQual: string;

  medicamentosEspecificos: MedicamentosEspecificos;
  medicamentosEspeciaisNenhum?: boolean;

  jaFezRadioterapiaOuQuimioterapia: SimNao;
  radioterapiaOuQuimioterapiaHaQuantoTempo: string;

  jaFoiOperado: SimNao;
  jaFoiOperadoQualOperacao: string;

  jaTeveHemorragia: SimNao;
  fezExamesDeRotinaUltimos5Anos: SimNao;

  pesoKg: number | null;

  /** Só relevante quando a paciente é mulher — a UI decide quando mostrar, o domínio nunca obriga preenchimento. */
  estaGravida: SimNao;
  idadeGestacional: string;

  historicoSaudeBucal: HistoricoSaudeBucal;
  habitosNocivos: HabitosNocivos;
  higieneBucal: HigieneBucal;

  observacoesAdicionais: string;

  /** Confirmação digital do paciente (substitui a assinatura física do documento impresso). */
  pacienteConfirmouDados: boolean;
  localEDataAssinatura: string;

  criadoEm: string;
  atualizadoEm: string;
}

export type SalvarAnamneseInput = Omit<AnamneseProps, 'id' | 'criadoEm' | 'atualizadoEm'>;

export function criarAnamneseEmBranco(pacienteId: string): SalvarAnamneseInput {
  return {
    pacienteId,
    queixaPrincipal: '',
    alergiaMedicacao: null,
    alergiaMedicacaoQuais: '',
    pressaoArterial: null,
    pressaoArterialValor: '',
    usaMedicamento: null,
    usaMedicamentoQuais: '',
    temProblemaDeSaude: null,
    problemaDeSaudeQual: '',
    estaSobTratamentoMedico: null,
    tratamentoMedicoMotivo: '',
    nomeMedicoQueAcompanha: '',
    possuiSindrome: null,
    possuiSindromeQual: '',
    usaAntidepressivo: null,
    usaAntidepressivoNome: '',
    apresentaProcessoAlergico: null,
    processoAlergicoQual: '',
    medicamentosEspecificos: {
      penicilina: false,
      sulfa: false,
      diclofenacoSodico: false,
      bisfosfonato: false,
      anticoagulante: false,
      antiplaquetario: false,
      prolia: false,
    },
    jaFezRadioterapiaOuQuimioterapia: null,
    radioterapiaOuQuimioterapiaHaQuantoTempo: '',
    jaFoiOperado: null,
    jaFoiOperadoQualOperacao: '',
    jaTeveHemorragia: null,
    fezExamesDeRotinaUltimos5Anos: null,
    pesoKg: null,
    estaGravida: null,
    idadeGestacional: '',
    historicoSaudeBucal: {
      jaRecebeuAnestesiaOdontologica: null,
      reacaoAnestesia: '',
      jaExtraiuDente: null,
      sangraMuitoAoExtrairOuMachucar: null,
      sinaisNotados: [],
      jaSofreuTraumaOuFratura: null,
    },
    habitosNocivos: {
      fumante: null,
      fumantePorQuantoTempo: '',
      usaBebidaAlcoolica: null,
      bebidaAlcoolicaFrequencia: '',
      usaDrogasIlicitas: null,
      drogasIlicitasTipo: '',
      drogasIlicitasFrequencia: '',
      apertaDentes: false,
      rangeDentes: false,
      mordeObjetosComOsDentes: false,
    },
    higieneBucal: {
      escovacoesPorDia: null,
      usaFioDental: null,
      outroRecursoDeLimpeza: '',
    },
    observacoesAdicionais: '',
    pacienteConfirmouDados: false,
    localEDataAssinatura: '',
  };
}

/**
 * Compara dois estados de anamnese por valor (não por referência) —
 * usada pra decidir se há algo "de verdade" pra perder: dispara o
 * autosave de rascunho, o indicador "alterações não salvas" e o aviso
 * antes de sair da tela (`presentation/features/anamnese/aba-anamnese.tsx`).
 * Comparação estrutural via JSON é suficiente aqui — o formulário só
 * lida com string/number/boolean/null e listas pequenas, sem datas
 * `Date`/`Map`/`Set` que exigiriam uma comparação mais cuidadosa.
 */
export function anamneseFoiAlterada(a: SalvarAnamneseInput, b: SalvarAnamneseInput): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

export interface SecaoAnamneseResumo {
  id: string;
  titulo: string;
  totalPerguntas: number;
  respondidas: number;
  completa: boolean;
}

export interface ResumoAnamnese {
  secoes: SecaoAnamneseResumo[];
  totalPerguntas: number;
  respondidas: number;
  /** Fração preenchida, 0 a 1. */
  percentual: number;
  completa: boolean;
  /**
   * Informação de saúde que merece um olhar clínico — alergia sem
   * descrição, anticoagulante em uso, pressão alta, gestante etc. NUNCA
   * bloqueia salvar nem preencher: só chama atenção pra não passar
   * batido.
   */
  pontosDeAtencao: string[];
}

/**
 * Resumo de preenchimento da anamnese (Etapa 7 — prontidão clínica):
 * quanto de cada seção já foi respondido e quais respostas pedem
 * atenção. É REGRA de domínio — o que conta como "respondido" (Sim/Não
 * marcado, peso informado, consentimento dado) e o que é um "ponto de
 * atenção" clínico não pode morar num componente React. A tela só
 * desenha o que sai daqui.
 *
 * Conta só as perguntas de fato objetivas de cada seção (os Sim/Não e
 * campos-chave); textos livres opcionais ("observações"), a lista de
 * medicamentos de atenção especial (marcar nada é uma resposta válida
 * e indistinguível de "não respondeu") e a seção de gestação (só se
 * aplica a parte das pacientes) ficam de fora da contagem — mas
 * gestação e medicamentos ainda alimentam os pontos de atenção.
 */
export function resumoAnamnese(a: SalvarAnamneseInput): ResumoAnamnese {
  const respondida = (valor: SimNao | 'ALTA' | 'NORMAL' | number | null): boolean => valor !== null;

  const definicoes: { id: string; titulo: string; respostas: boolean[] }[] = [
    { id: 'queixa', titulo: 'Queixa principal', respostas: [a.queixaPrincipal.trim() !== ''] },
    {
      id: 'alergias',
      titulo: 'Alergias e medicação em uso',
      respostas: [respondida(a.alergiaMedicacao), respondida(a.usaMedicamento)],
    },
    {
      id: 'saude-geral',
      titulo: 'Saúde geral',
      respostas: [
        respondida(a.pressaoArterial),
        respondida(a.temProblemaDeSaude),
        respondida(a.estaSobTratamentoMedico),
        respondida(a.possuiSindrome),
        respondida(a.usaAntidepressivo),
        respondida(a.apresentaProcessoAlergico),
        a.pesoKg !== null,
      ],
    },
    {
      id: 'radio-quimio',
      titulo: 'Radioterapia / quimioterapia',
      respostas: [respondida(a.jaFezRadioterapiaOuQuimioterapia)],
    },
    {
      id: 'cirurgias',
      titulo: 'Cirurgias, hemorragia e exames de rotina',
      respostas: [
        respondida(a.jaFoiOperado),
        respondida(a.jaTeveHemorragia),
        respondida(a.fezExamesDeRotinaUltimos5Anos),
      ],
    },
    {
      id: 'saude-bucal',
      titulo: 'Histórico de saúde bucal',
      respostas: [
        respondida(a.historicoSaudeBucal.jaRecebeuAnestesiaOdontologica),
        respondida(a.historicoSaudeBucal.jaExtraiuDente),
        respondida(a.historicoSaudeBucal.sangraMuitoAoExtrairOuMachucar),
        respondida(a.historicoSaudeBucal.jaSofreuTraumaOuFratura),
      ],
    },
    {
      id: 'habitos',
      titulo: 'Hábitos nocivos',
      respostas: [
        respondida(a.habitosNocivos.fumante),
        respondida(a.habitosNocivos.usaBebidaAlcoolica),
        respondida(a.habitosNocivos.usaDrogasIlicitas),
      ],
    },
    {
      id: 'higiene',
      titulo: 'Hábitos de higiene bucal',
      respostas: [a.higieneBucal.escovacoesPorDia !== null, respondida(a.higieneBucal.usaFioDental)],
    },
    { id: 'consentimento', titulo: 'Consentimento', respostas: [a.pacienteConfirmouDados] },
  ];

  const secoes: SecaoAnamneseResumo[] = definicoes.map((def) => {
    const respondidas = def.respostas.filter(Boolean).length;
    return {
      id: def.id,
      titulo: def.titulo,
      totalPerguntas: def.respostas.length,
      respondidas,
      completa: respondidas === def.respostas.length,
    };
  });

  const totalPerguntas = secoes.reduce((soma, s) => soma + s.totalPerguntas, 0);
  const respondidas = secoes.reduce((soma, s) => soma + s.respondidas, 0);

  const pontosDeAtencao: string[] = [];
  if (a.alergiaMedicacao === 'SIM' && a.alergiaMedicacaoQuais.trim()) pontosDeAtencao.push(`Alergia a medicação relatada: ${a.alergiaMedicacaoQuais.trim()}.`);
  if (a.apresentaProcessoAlergico === 'SIM' && a.processoAlergicoQual.trim()) pontosDeAtencao.push(`Processo alérgico relatado: ${a.processoAlergicoQual.trim()}.`);
  if (a.temProblemaDeSaude === 'SIM' && a.problemaDeSaudeQual.trim()) pontosDeAtencao.push(`Problema de saúde relatado: ${a.problemaDeSaudeQual.trim()}.`);

  if (a.alergiaMedicacao === null) pontosDeAtencao.push('Alergia a medicação ainda não informada.');
  if (a.alergiaMedicacao === 'SIM' && a.alergiaMedicacaoQuais.trim() === '')
    pontosDeAtencao.push('Alergia a medicação marcada como "sim", mas sem descrição.');
  if (a.apresentaProcessoAlergico === 'SIM' && a.processoAlergicoQual.trim() === '')
    pontosDeAtencao.push('Processo alérgico marcado como "sim", mas sem descrição.');
  if (a.usaMedicamento === 'SIM' && a.usaMedicamentoQuais.trim() === '')
    pontosDeAtencao.push('Uso de medicamento marcado como "sim", mas sem qual.');
  if (a.temProblemaDeSaude === 'SIM' && a.problemaDeSaudeQual.trim() === '')
    pontosDeAtencao.push('Problema de saúde marcado como "sim", mas sem qual.');
  if (a.usaAntidepressivo === 'SIM' && a.usaAntidepressivoNome.trim() === '')
    pontosDeAtencao.push('Uso de antidepressivo marcado como "sim", mas sem o nome.');
  if (a.pressaoArterial === 'ALTA') pontosDeAtencao.push('Pressão arterial relatada como alta.');
  const med = a.medicamentosEspecificos;
  if (med.anticoagulante || med.antiplaquetario || med.bisfosfonato || med.prolia)
    pontosDeAtencao.push(
      'Usa medicamento de atenção especial (anticoagulante / antiplaquetário / bisfosfonato) — risco de sangramento ou osteonecrose.',
    );
  if (a.historicoSaudeBucal.sangraMuitoAoExtrairOuMachucar === 'SIM')
    pontosDeAtencao.push('Relato de sangramento aumentado em extrações ou machucados.');
  if (a.jaFezRadioterapiaOuQuimioterapia === 'SIM')
    pontosDeAtencao.push('Histórico de radioterapia ou quimioterapia.');
  if (a.estaGravida === 'SIM') pontosDeAtencao.push('Paciente gestante.');

  return {
    secoes,
    totalPerguntas,
    respondidas,
    percentual: totalPerguntas === 0 ? 0 : respondidas / totalPerguntas,
    completa: respondidas === totalPerguntas,
    pontosDeAtencao,
  };
}

export interface ItemAnamneseLegivel {
  rotulo: string;
  valor: string;
  /** Explicação condicional ("Quais?", "Qual o motivo?", frequência...) — só quando há conteúdo. */
  detalhe?: string;
}

export interface SecaoAnamneseLegivel {
  id: string;
  titulo: string;
  itens: ItemAnamneseLegivel[];
}

export function simNaoTexto(valor: SimNao): string {
  if (valor === 'SIM') return 'Sim';
  if (valor === 'NAO') return 'Não';
  return 'Não informado';
}

/**
 * Converte a anamnese estruturada numa lista de perguntas e respostas
 * legíveis, seção por seção — a base do documento impresso da anamnese
 * (pedido: "versão limpa da anamnese digital, preservando sim/não,
 * explicações condicionais, medicação, hábitos, higiene e observações").
 * É regra de montagem de documento (quais perguntas, como texto, quando
 * mostrar a explicação condicional) — mora no domínio, a tela só
 * desenha. Puro e testável.
 */
export function montarAnamneseParaLeitura(a: SalvarAnamneseInput): SecaoAnamneseLegivel[] {
  const detalhe = (parenteSim: boolean, texto: string): string | undefined => {
    const limpo = texto.trim();
    return parenteSim && limpo ? limpo : undefined;
  };

  const medicamentos = MEDICAMENTOS_ESPECIFICOS_ROTULOS.filter(([chave]) => a.medicamentosEspecificos[chave]).map(
    ([, rotulo]) => rotulo,
  );
  const sinais = a.historicoSaudeBucal.sinaisNotados.map((s) => SINAL_BUCAL_LABEL[s]);
  const parafuncoes = [
    a.habitosNocivos.apertaDentes && 'Aperta os dentes',
    a.habitosNocivos.rangeDentes && 'Range os dentes',
    a.habitosNocivos.mordeObjetosComOsDentes && 'Morde objetos com os dentes',
  ].filter((x): x is string => Boolean(x));

  const drogasDetalhe = [a.habitosNocivos.drogasIlicitasTipo.trim(), a.habitosNocivos.drogasIlicitasFrequencia.trim()]
    .filter(Boolean)
    .join(' — ');

  return [
    {
      id: 'queixa',
      titulo: 'Queixa principal',
      itens: [
        {
          rotulo: 'Motivo da consulta',
          valor: a.queixaPrincipal.trim() || 'Não informado',
        },
      ],
    },
    {
      id: 'alergias',
      titulo: 'Alergias e medicação em uso',
      itens: [
        {
          rotulo: 'Alergia a alguma medicação?',
          valor: simNaoTexto(a.alergiaMedicacao),
          detalhe: detalhe(a.alergiaMedicacao === 'SIM', a.alergiaMedicacaoQuais),
        },
        {
          rotulo: 'Está tomando algum medicamento?',
          valor: simNaoTexto(a.usaMedicamento),
          detalhe: detalhe(a.usaMedicamento === 'SIM', a.usaMedicamentoQuais),
        },
      ],
    },
    {
      id: 'saude-geral',
      titulo: 'Saúde geral',
      itens: [
        {
          rotulo: 'Pressão sanguínea',
          valor: a.pressaoArterial === 'ALTA' ? 'Alta' : a.pressaoArterial === 'NORMAL' ? 'Normal' : 'Não informado',
          detalhe: a.pressaoArterialValor.trim() || undefined,
        },
        {
          rotulo: 'Tem algum problema de saúde?',
          valor: simNaoTexto(a.temProblemaDeSaude),
          detalhe: detalhe(a.temProblemaDeSaude === 'SIM', a.problemaDeSaudeQual),
        },
        {
          rotulo: 'Esteve ou está sob tratamento médico?',
          valor: simNaoTexto(a.estaSobTratamentoMedico),
          detalhe: detalhe(a.estaSobTratamentoMedico === 'SIM', a.tratamentoMedicoMotivo),
        },
        {
          rotulo: 'Médico(a) que acompanha com frequência',
          valor: a.nomeMedicoQueAcompanha.trim() || 'Não informado',
        },
        {
          rotulo: 'Possui alguma síndrome?',
          valor: simNaoTexto(a.possuiSindrome),
          detalhe: detalhe(a.possuiSindrome === 'SIM', a.possuiSindromeQual),
        },
        {
          rotulo: 'Faz uso de antidepressivos?',
          valor: simNaoTexto(a.usaAntidepressivo),
          detalhe: detalhe(a.usaAntidepressivo === 'SIM', a.usaAntidepressivoNome),
        },
        {
          rotulo: 'Apresenta algum processo alérgico?',
          valor: simNaoTexto(a.apresentaProcessoAlergico),
          detalhe: detalhe(a.apresentaProcessoAlergico === 'SIM', a.processoAlergicoQual),
        },
        {
          rotulo: 'Peso',
          valor: a.pesoKg !== null ? `${a.pesoKg} kg` : 'Não informado',
        },
      ],
    },
    {
      id: 'medicamentos-especiais',
      titulo: 'Medicamentos de atenção especial (já usou ou usa)',
      itens: [
        {
          rotulo: 'Medicamentos assinalados',
          valor: medicamentos.length > 0 ? medicamentos.join('; ') : a.medicamentosEspeciaisNenhum === true ? 'Nenhum — informado pelo paciente' : 'Não informado',
        },
      ],
    },
    {
      id: 'radio-quimio',
      titulo: 'Radioterapia / quimioterapia',
      itens: [
        {
          rotulo: 'Já realizou radioterapia ou quimioterapia?',
          valor: simNaoTexto(a.jaFezRadioterapiaOuQuimioterapia),
          detalhe: detalhe(a.jaFezRadioterapiaOuQuimioterapia === 'SIM', a.radioterapiaOuQuimioterapiaHaQuantoTempo),
        },
      ],
    },
    {
      id: 'cirurgias',
      titulo: 'Cirurgias, hemorragia e exames de rotina',
      itens: [
        {
          rotulo: 'Já foi operado(a)?',
          valor: simNaoTexto(a.jaFoiOperado),
          detalhe: detalhe(a.jaFoiOperado === 'SIM', a.jaFoiOperadoQualOperacao),
        },
        { rotulo: 'Já teve hemorragia?', valor: simNaoTexto(a.jaTeveHemorragia) },
        { rotulo: 'Fez exames de rotina nos últimos 5 anos?', valor: simNaoTexto(a.fezExamesDeRotinaUltimos5Anos) },
      ],
    },
    {
      id: 'gestacao',
      titulo: 'Gestação',
      itens: [
        {
          rotulo: 'Está grávida?',
          valor: simNaoTexto(a.estaGravida),
          detalhe: detalhe(a.estaGravida === 'SIM', a.idadeGestacional),
        },
      ],
    },
    {
      id: 'saude-bucal',
      titulo: 'Histórico de saúde bucal',
      itens: [
        {
          rotulo: 'Já recebeu anestesia odontológica?',
          valor: simNaoTexto(a.historicoSaudeBucal.jaRecebeuAnestesiaOdontologica),
          detalhe: detalhe(a.historicoSaudeBucal.jaRecebeuAnestesiaOdontologica === 'SIM', a.historicoSaudeBucal.reacaoAnestesia),
        },
        { rotulo: 'Já extraiu algum dente?', valor: simNaoTexto(a.historicoSaudeBucal.jaExtraiuDente) },
        {
          rotulo: 'Costuma sangrar muito ao extrair dente ou se machucar?',
          valor: simNaoTexto(a.historicoSaudeBucal.sangraMuitoAoExtrairOuMachucar),
        },
        {
          rotulo: 'Sinais já notados',
          valor: sinais.length > 0 ? sinais.join('; ') : 'Nenhum',
        },
        {
          rotulo: 'Já sofreu trauma ou fratura nos dentes ou ossos da face?',
          valor: simNaoTexto(a.historicoSaudeBucal.jaSofreuTraumaOuFratura),
        },
      ],
    },
    {
      id: 'habitos',
      titulo: 'Hábitos nocivos',
      itens: [
        {
          rotulo: 'Foi ou é fumante?',
          valor: simNaoTexto(a.habitosNocivos.fumante),
          detalhe: detalhe(a.habitosNocivos.fumante === 'SIM', a.habitosNocivos.fumantePorQuantoTempo),
        },
        {
          rotulo: 'Faz uso de bebida alcoólica?',
          valor: simNaoTexto(a.habitosNocivos.usaBebidaAlcoolica),
          detalhe: detalhe(a.habitosNocivos.usaBebidaAlcoolica === 'SIM', a.habitosNocivos.bebidaAlcoolicaFrequencia),
        },
        {
          rotulo: 'Faz uso de drogas ilícitas?',
          valor: simNaoTexto(a.habitosNocivos.usaDrogasIlicitas),
          detalhe: a.habitosNocivos.usaDrogasIlicitas === 'SIM' && drogasDetalhe ? drogasDetalhe : undefined,
        },
        {
          rotulo: 'Parafunções',
          valor: parafuncoes.length > 0 ? parafuncoes.join('; ') : 'Nenhuma relatada',
        },
      ],
    },
    {
      id: 'higiene',
      titulo: 'Hábitos de higiene bucal',
      itens: [
        {
          rotulo: 'Escovações por dia',
          valor: a.higieneBucal.escovacoesPorDia !== null ? String(a.higieneBucal.escovacoesPorDia) : 'Não informado',
        },
        { rotulo: 'Usa fio dental?', valor: simNaoTexto(a.higieneBucal.usaFioDental) },
        {
          rotulo: 'Outro recurso de limpeza',
          valor: a.higieneBucal.outroRecursoDeLimpeza.trim() || 'Não informado',
        },
      ],
    },
    {
      id: 'observacoes',
      titulo: 'Observações adicionais',
      itens: [
        {
          rotulo: 'Mais alguma informação sobre o histórico com dentistas',
          valor: a.observacoesAdicionais.trim() || 'Nenhuma',
        },
      ],
    },
  ];
}

/**
 * Anamnese e ficha clínica (docx "Anamnese com ficha clinica") — um
 * registro por paciente, editável (a saúde do paciente muda com o
 * tempo; diferente do Plano de Tratamento, aqui não existe histórico
 * imutável a preservar, só o estado mais atual importa
 * clinicamente).
 */
export class Anamnese {
  private constructor(private props: AnamneseProps) {}

  static salvar(input: SalvarAnamneseInput, existente?: AnamneseProps): Anamnese {
    if (!input.pacienteId) {
      throw new ErroDominio('Anamnese precisa estar vinculada a um paciente.');
    }
    if (input.pesoKg !== null && input.pesoKg <= 0) {
      throw new ErroDominio('Peso deve ser maior que zero quando informado.');
    }
    if (input.medicamentosEspeciaisNenhum && Object.values(input.medicamentosEspecificos).some(Boolean)) throw new ErroDominio('Nenhum medicamento não pode ser combinado com medicamentos assinalados.');
    const agora = agoraIso();
    return new Anamnese({
      ...input,
      id: existente?.id ?? gerarId(),
      criadoEm: existente?.criadoEm ?? agora,
      atualizadoEm: agora,
    });
  }

  static restaurar(props: AnamneseProps): Anamnese {
    return new Anamnese(props);
  }

  get id(): string {
    return this.props.id;
  }

  get pacienteId(): string {
    return this.props.pacienteId;
  }

  toSnapshot(): Readonly<AnamneseProps> {
    return { ...this.props };
  }
}
