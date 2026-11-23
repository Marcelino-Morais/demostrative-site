/**
 * Semente inicial do catálogo de procedimentos — extraída da planilha
 * fornecida pela clínica (`PROCEDIMENTOS.xlsx`, lida uma única vez
 * nesta etapa; o arquivo em si nunca foi commitado nem modificado).
 * Nomes/categorias tiveram só capitalização, espaçamento e acentuação
 * corrigidos — o significado de negócio (o quê, o preço) é preservado
 * exatamente como veio da planilha.
 *
 * Cada `idSeed` é fixo e determinístico (nunca um UUID aleatório) —
 * é o que torna a semente idempotente: rodar de novo só cria o que
 * ainda não existe por este id; nunca sobrescreve preço editado pela
 * clínica depois, e nunca duplica.
 *
 * Categorias são uma classificação nossa, não vinha na planilha —
 * a clínica pode reclassificar qualquer procedimento depois pela tela
 * de gestão do catálogo, sem perder nada.
 *
 * `extracao-infantil` é o único item com faixa de preço, exatamente como
 * a planilha registrou ("150- 250") — nenhum valor fixo foi inventado;
 * a clínica escolhe o valor final dentro da faixa a cada orçamento.
 */

export interface ItemSementeCatalogo {
  idSeed: string;
  nome: string;
  categoria: string;
  precoCentavos: number | null;
  precoMinimoCentavos: number | null;
  precoMaximoCentavos: number | null;
}

function fixo(idSeed: string, nome: string, categoria: string, precoCentavos: number): ItemSementeCatalogo {
  return { idSeed, nome, categoria, precoCentavos, precoMinimoCentavos: null, precoMaximoCentavos: null };
}

function faixa(
  idSeed: string,
  nome: string,
  categoria: string,
  precoMinimoCentavos: number,
  precoMaximoCentavos: number,
): ItemSementeCatalogo {
  return { idSeed, nome, categoria, precoCentavos: null, precoMinimoCentavos, precoMaximoCentavos };
}

export const PROCEDIMENTOS_CATALOGO_SEMENTE: ItemSementeCatalogo[] = [
  fixo('seed-consulta', 'Consulta', 'Consulta', 12_000),

  fixo('seed-canal-incisivo', 'Canal — incisivo', 'Endodontia', 70_000),
  fixo('seed-canal-pre-molar', 'Canal — pré-molar', 'Endodontia', 95_000),
  fixo('seed-canal-molar', 'Canal — molares', 'Endodontia', 120_000),
  fixo('seed-retratamento-incisivo', 'Retratamento de canal — incisivo', 'Endodontia', 90_000),
  fixo('seed-retratamento-pre-molar', 'Retratamento de canal — pré-molar', 'Endodontia', 120_000),
  fixo('seed-retratamento-molar', 'Retratamento de canal — molar', 'Endodontia', 190_000),

  fixo('seed-restauracao-3-faces', 'Restauração — 3 faces', 'Dentística', 45_000),
  fixo('seed-restauracao-2-faces', 'Restauração — 2 faces', 'Dentística', 35_000),
  fixo('seed-restauracao-1-face', 'Restauração — 1 face (V, I)', 'Dentística', 20_000),
  fixo('seed-facetas', 'Facetas', 'Dentística', 60_000),

  fixo('seed-placa-acrilico', 'Placa de acrílico (relaxamento)', 'Prótese', 120_000),
  fixo('seed-coroa-provisoria', 'Coroa provisória', 'Prótese', 50_000),
  fixo('seed-coroa-metalo-ceramica', 'Coroa metalo-cerâmica (CMC)', 'Prótese', 185_000),
  fixo('seed-coroa-emax', 'Coroa Emax', 'Prótese', 185_000),
  fixo('seed-coroa-zirconia', 'Coroa zircônia', 'Prótese', 200_000),
  fixo('seed-coroa-metal', 'Coroa metal', 'Prótese', 90_000),
  fixo('seed-coroa-provisoria-implante', 'Coroa provisória sobre implante', 'Prótese', 60_000),
  fixo('seed-nucleo-metalico', 'Núcleo metálico fundido (NMF)', 'Prótese', 45_000),
  fixo('seed-pino-fibra-vidro', 'Pino de fibra de vidro (PFV)', 'Prótese', 35_000),
  fixo('seed-cimentacao-coroa', 'Cimentação de coroa ou provisório', 'Prótese', 18_000),
  fixo('seed-ppr-definitiva', 'Prótese parcial removível — definitiva (PPR)', 'Prótese', 200_000),
  fixo('seed-ppr-provisoria', 'Prótese parcial removível — provisória (PPR)', 'Prótese', 100_000),
  fixo('seed-pt-definitiva', 'Prótese total — definitiva (PT)', 'Prótese', 200_000),
  fixo('seed-pt-provisoria', 'Prótese total — provisória (PT)', 'Prótese', 100_000),

  fixo('seed-limpeza-raspagem', 'Limpeza + raspagem + profilaxia com flúor', 'Periodontia', 35_000),
  fixo('seed-limpeza-infantil', 'Limpeza infantil', 'Periodontia', 15_000),
  fixo('seed-tratamento-periodontal', 'Tratamento periodontal', 'Periodontia', 120_000),
  fixo('seed-aumento-coroa', 'Aumento de coroa', 'Periodontia', 28_000),

  fixo('seed-tampar-implante', 'Tampar implante', 'Implantodontia', 15_000),

  fixo('seed-extracao-comum', 'Extração comum', 'Cirurgia', 30_000),
  fixo('seed-extracao-siso-inferior', 'Extração de siso — dente inferior', 'Cirurgia', 50_000),
  fixo('seed-extracao-siso-superior', 'Extração de siso — dente superior', 'Cirurgia', 40_000),
  faixa('seed-extracao-infantil', 'Extração infantil', 'Cirurgia', 15_000, 25_000),

  fixo('seed-clareamento-caseiro', 'Clareamento caseiro', 'Estética', 110_000),
  fixo('seed-clareamento-consultorio-sessao', 'Clareamento no consultório (por sessão)', 'Estética', 50_000),
  fixo('seed-clareamento-consultorio-5-sessoes', 'Clareamento no consultório (pacote de 5 sessões)', 'Estética', 200_000),
  fixo('seed-bisnaga-com-limpeza', 'Bisnaga de produto clareador (com limpeza)', 'Estética', 8_000),
  fixo('seed-bisnaga-avulsa', 'Bisnaga de produto clareador (avulsa)', 'Estética', 15_000),
];
