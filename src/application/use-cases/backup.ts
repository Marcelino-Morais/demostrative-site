import type { LancamentoFinanceiro } from './gestao-financeira.js';
import { Anamnese, type AnamneseProps } from '../../domain/entities/anamnese.js';
import { BloqueioAgenda, type BloqueioAgendaProps } from '../../domain/entities/bloqueio-agenda.js';
import { Consulta, type ConsultaProps } from '../../domain/entities/consulta.js';
import { ArquivoPaciente, type ArquivoPacienteProps } from '../../domain/entities/arquivo-paciente.js';
import { EvolucaoClinica, type EvolucaoClinicaProps } from '../../domain/entities/evolucao-clinica.js';
import { LinkAnamnese, type LinkAnamneseProps } from '../../domain/entities/link-anamnese.js';
import { Paciente, type PacienteProps } from '../../domain/entities/paciente.js';
import { PlanoTratamento, type PlanoTratamentoProps } from '../../domain/entities/plano-tratamento.js';
import { CampanhaComemorativa, type CampanhaComemorativaProps } from '../../domain/entities/campanha-comemorativa.js';
import { MensagemCortesia, type MensagemCortesiaProps } from '../../domain/entities/mensagem-cortesia.js';
import { ProcedimentoCatalogo, type ProcedimentoCatalogoProps } from '../../domain/entities/procedimento-catalogo.js';
import { RegistroDental, type RegistroDentalProps } from '../../domain/entities/registro-dental.js';
import { Retorno, type RetornoProps } from '../../domain/entities/retorno.js';
import { RegistroWhatsapp, type RegistroWhatsappProps } from '../../../whatsapp-itens/src/domain/entities/registro-whatsapp.js';
import { agoraIso, ErroDominio } from '../../domain/types.js';
import type {
  RepositorioAnamneses,
  RepositorioArquivosPaciente,
  RepositorioBloqueiosAgenda,
  RepositorioConsultas,
  RepositorioEvolucoes,
  RepositorioLinksAnamnese,
  RepositorioPacientes,
  RepositorioCampanhasComemorativas,
  RepositorioMensagensCortesia,
  RepositorioPlanosTratamento,
  RepositorioProcedimentosCatalogo,
  RepositorioRegistrosDentais,
  RepositorioRegistrosWhatsapp,
  RepositorioRetornos,
} from '../ports/repositorios.js';

/**
 * Formato de arquivo de backup (Etapa 2 — persistência segura antes de
 * uso real com pacientes). Cobre as coleções que vivem no
 * `localStorage` deste navegador (ver `infrastructure/storage/
 * repositorios-local-storage.ts`) num único JSON exportável/
 * importável — a única cópia de segurança possível nesta etapa, já
 * que não há backend/nuvem.
 *
 * Versão 2 (Etapa 5 — agenda de consultas): adicionou `consultas`.
 * `consultas` é OPCIONAL na validação independente da versão — um
 * arquivo v1 exportado antes desta funcionalidade existir nunca vai
 * ter essa chave, e continua um backup válido (só sem consultas pra
 * restaurar, o que faz sentido: elas não existiam quando foi
 * exportado). Retrocompatibilidade de verdade, não só de nome.
 *
 * Versão 3 (Etapa 10 — endurecimento de backup): adicionou metadados
 * de identificação — `app` (etiqueta de máquina), `appNome` (nome
 * legível) e `contagens` (nº de itens por coleção). Arquivos v1/v2 não
 * têm `app`; são aceitos pela estrutura (só este sistema já gerava
 * aquele formato). A partir da v3, um `app` diferente é recusado com
 * mensagem clara.
 *
 * Versão 4 (Etapa 13 — consentimento/histórico de WhatsApp): adicionou
 * a coleção `registrosWhatsapp` (histórico de links de WhatsApp
 * abertos). Como `consultas` na v2, ela é OPCIONAL na validação:
 * arquivos v1–v3 não a têm e continuam válidos. O consentimento do
 * paciente já anda dentro de `PacienteProps` — não precisa de coleção
 * própria.
 *
 * Versão 5 (Etapa 16 — link de anamnese compartilhável): adicionou a
 * coleção `linksAnamnese` (token, status, validade). OPCIONAL na
 * validação como as anteriores — arquivos v1–v4 não a têm e continuam
 * válidos. Guarda só o token e o estado do link; nenhuma resposta
 * clínica (essas ficam na coleção `anamneses`, como sempre).
 *
 * Versão 6 (Etapa 16 — arquivos por paciente): adicionou a coleção
 * `arquivosPaciente` com os METADADOS dos arquivos (nome, tipo,
 * tamanho, categoria, data, origem). OPCIONAL como as anteriores. Os
 * BYTES dos arquivos (imagens/PDFs) NÃO entram no backup `.json` —
 * ficam só no IndexedDB deste navegador; ao restaurar em outro
 * dispositivo, a lista volta mas o conteúdo precisa ser reanexado.
 *
 * Versão 7 (Etapa 51 — bloqueio de dias na Agenda): adicionou a
 * coleção `bloqueiosAgenda` (feriado/final de semana/dia avulso —
 * data, tipo, motivo). OPCIONAL como as anteriores: um backup v1–v6
 * não tem essa chave e continua válido, só sem dias bloqueados pra
 * restaurar (o que faz sentido — eles não existiam quando foi
 * exportado).
 *
 * Versão 8 (catálogo de procedimentos): adicionou a coleção
 * `procedimentosCatalogo`. OPCIONAL como as anteriores — um backup
 * v1–v7 não tem essa chave e continua válido, só sem procedimentos do
 * catálogo pra restaurar (a semeadura inicial recria os que faltarem,
 * sem sobrescrever preço já editado pela clínica).
 *
 * Versão 9 (retornos/follow-up): adicionou a coleção `retornos`.
 * OPCIONAL como as anteriores — um backup v1–v8 não tem essa chave e
 * continua válido, só sem retornos pra restaurar.
 *
 * Versão 10 (aniversário/cortesia): adicionou `campanhasComemorativas`
 * e `mensagensCortesia`. OPCIONAIS como as anteriores.
 */
export const VERSAO_FORMATO_BACKUP = 13;

/** Etiqueta de máquina que identifica um arquivo como backup DESTE sistema. */
export const APP_ID_BACKUP = 'projfernanda';
/** Nome legível gravado no arquivo, para quem abrir o .json entender de onde veio. */
export const APP_NOME_BACKUP = 'Consultório Dra. Fernanda Morais Mendes';

export interface ResumoDoBackup {
  pacientes: number;
  anamneses: number;
  registrosDentais: number;
  planosTratamento: number;
  evolucoes: number;
  consultas: number;
  registrosWhatsapp: number;
  linksAnamnese: number;
  arquivosPaciente: number;
  bloqueiosAgenda: number;
  procedimentosCatalogo: number;
  retornos: number;
  campanhasComemorativas: number;
  mensagensCortesia: number;
}

export interface DadosBackup {
  respostasAnamnese?: {id:string;pacienteId:string;dados:unknown;criadoEm:string;atualizadoEm:string}[];
  operacaoClinica?: {id:string;[chave:string]:unknown}[];
  despesas?: LancamentoFinanceiro[];
  parcelas?: LancamentoFinanceiro[];
  versao: number;
  app: string;
  appNome: string;
  exportadoEm: string;
  /** Contagem por coleção — metadado informativo; a verdade é sempre `length` das listas. */
  contagens: ResumoDoBackup;
  pacientes: PacienteProps[];
  anamneses: AnamneseProps[];
  registrosDentais: RegistroDentalProps[];
  planosTratamento: PlanoTratamentoProps[];
  evolucoes: EvolucaoClinicaProps[];
  consultas: ConsultaProps[];
  registrosWhatsapp: RegistroWhatsappProps[];
  linksAnamnese: LinkAnamneseProps[];
  /** Só metadados — os bytes dos arquivos ficam no IndexedDB, fora do backup. */
  arquivosPaciente: ArquivoPacienteProps[];
  bloqueiosAgenda: BloqueioAgendaProps[];
  procedimentosCatalogo: ProcedimentoCatalogoProps[];
  retornos: RetornoProps[];
  campanhasComemorativas: CampanhaComemorativaProps[];
  mensagensCortesia: MensagemCortesiaProps[];
}

export function resumirBackup(dados: {
  pacientes: unknown[];
  anamneses: unknown[];
  registrosDentais: unknown[];
  planosTratamento: unknown[];
  evolucoes: unknown[];
  consultas: unknown[];
  registrosWhatsapp: unknown[];
  linksAnamnese: unknown[];
  arquivosPaciente: unknown[];
  bloqueiosAgenda: unknown[];
  procedimentosCatalogo: unknown[];
  retornos: unknown[];
  campanhasComemorativas: unknown[];
  mensagensCortesia: unknown[];
}): ResumoDoBackup {
  return {
    pacientes: dados.pacientes.length,
    anamneses: dados.anamneses.length,
    registrosDentais: dados.registrosDentais.length,
    planosTratamento: dados.planosTratamento.length,
    evolucoes: dados.evolucoes.length,
    consultas: dados.consultas.length,
    registrosWhatsapp: dados.registrosWhatsapp.length,
    linksAnamnese: dados.linksAnamnese.length,
    arquivosPaciente: dados.arquivosPaciente.length,
    bloqueiosAgenda: dados.bloqueiosAgenda.length,
    procedimentosCatalogo: dados.procedimentosCatalogo.length,
    retornos: dados.retornos.length,
    campanhasComemorativas: dados.campanhasComemorativas.length,
    mensagensCortesia: dados.mensagensCortesia.length,
  };
}

export type MotivoRejeicaoBackup = 'forma' | 'app-diferente' | 'versao-futura';

export interface BackupAceito {
  ok: true;
  dados: DadosBackup;
  resumo: ResumoDoBackup;
}

export interface BackupRejeitado {
  ok: false;
  motivo: MotivoRejeicaoBackup;
  mensagem: string;
}

export type ResultadoAnaliseBackup = BackupAceito | BackupRejeitado;

const MENSAGEM_REJEICAO: Record<MotivoRejeicaoBackup, string> = {
  forma: 'Este arquivo não tem a estrutura de um backup deste sistema. Nenhum dado foi alterado.',
  'app-diferente':
    'Este backup foi gerado por outro aplicativo, não pelo sistema da Dra. Fernanda. Nenhum dado foi alterado.',
  'versao-futura':
    'Este backup foi gerado por uma versão mais nova do sistema. Atualize o aplicativo antes de restaurá-lo. Nenhum dado foi alterado.',
};

/**
 * Analisa um JSON arbitrário (já lido do arquivo escolhido pelo
 * usuário) e diz, com um motivo legível, se ele serve como backup
 * deste sistema. Função pura, sem DOM/localStorage.
 *
 * Ordem das checagens: estrutura mínima → aplicativo de origem →
 * versão → estrutura das coleções → item a item. Devolve o PRIMEIRO
 * problema encontrado, com uma mensagem pronta pra tela.
 *
 * Escopo deliberado: garante a forma (as 5 listas obrigatórias
 * existem, cada item tem `id` string, cada paciente tem
 * `nomeCompleto`) — não reexecuta cada invariante de `Entidade.criar`
 * sobre o conteúdo (isso duplicaria as regras de domínio sem ganho
 * real). Um arquivo bem-formado com um campo individual estranho ainda
 * passa — risco documentado no README.
 */
export function analisarBackup(valor: unknown): ResultadoAnaliseBackup {
  const rejeitar = (motivo: MotivoRejeicaoBackup): BackupRejeitado => ({
    ok: false,
    motivo,
    mensagem: MENSAGEM_REJEICAO[motivo],
  });

  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return rejeitar('forma');
  const obj = valor as Record<string, unknown>;

  if (typeof obj.versao !== 'number' || typeof obj.exportadoEm !== 'string') return rejeitar('forma');

  // `app` só existe a partir da v3. Quando presente, tem que bater;
  // quando ausente (arquivo v1/v2), é aceito pela forma.
  if (obj.app !== undefined && obj.app !== APP_ID_BACKUP) return rejeitar('app-diferente');

  // Versão de formato FUTURA (desconhecida por este app): recusada. Versões
  // iguais ou mais antigas continuam aceitas (retrocompatibilidade).
  if (obj.versao > VERSAO_FORMATO_BACKUP) return rejeitar('versao-futura');

  const chavesDeListas = ['pacientes', 'anamneses', 'registrosDentais', 'planosTratamento', 'evolucoes'] as const;
  for (const chave of chavesDeListas) {
    if (!Array.isArray(obj[chave])) return rejeitar('forma');
  }
  // `consultas`, `registrosWhatsapp`, `linksAnamnese`, `arquivosPaciente` e
  // `bloqueiosAgenda` são opcionais: ausentes viram lista vazia (arquivo de
  // uma versão anterior à coleção); presentes, precisam ser array.
  for (const chaveOpcional of [
    'respostasAnamnese',
    'operacaoClinica',
    'despesas',
    'parcelas',
    'consultas',
    'registrosWhatsapp',
    'linksAnamnese',
    'arquivosPaciente',
    'bloqueiosAgenda',
    'procedimentosCatalogo',
    'retornos',
    'campanhasComemorativas',
    'mensagensCortesia',
  ] as const) {
    if (obj[chaveOpcional] !== undefined && !Array.isArray(obj[chaveOpcional])) return rejeitar('forma');
  }

  const chavesParaValidarItens = [
    ...(obj.respostasAnamnese !== undefined ? (['respostasAnamnese'] as const) : []),
    ...chavesDeListas,
    ...(obj.consultas !== undefined ? (['consultas'] as const) : []),
    ...(obj.registrosWhatsapp !== undefined ? (['registrosWhatsapp'] as const) : []),
    ...(obj.linksAnamnese !== undefined ? (['linksAnamnese'] as const) : []),
    ...(obj.arquivosPaciente !== undefined ? (['arquivosPaciente'] as const) : []),
    ...(obj.bloqueiosAgenda !== undefined ? (['bloqueiosAgenda'] as const) : []),
    ...(obj.procedimentosCatalogo !== undefined ? (['procedimentosCatalogo'] as const) : []),
    ...(obj.retornos !== undefined ? (['retornos'] as const) : []),
    ...(obj.campanhasComemorativas !== undefined ? (['campanhasComemorativas'] as const) : []),
    ...(obj.mensagensCortesia !== undefined ? (['mensagensCortesia'] as const) : []),
  ];
  for (const chave of chavesParaValidarItens) {
    for (const item of obj[chave] as unknown[]) {
      if (!item || typeof item !== 'object' || typeof (item as Record<string, unknown>).id !== 'string') {
        return rejeitar('forma');
      }
    }
  }
  for (const item of obj.pacientes as unknown[]) {
    const nome = (item as Record<string, unknown>).nomeCompleto;
    if (typeof nome !== 'string' || !nome.trim()) return rejeitar('forma');
  }

  const listas = {
    respostasAnamnese: (obj.respostasAnamnese as DadosBackup['respostasAnamnese']) ?? [],
    operacaoClinica: (obj.operacaoClinica as DadosBackup['operacaoClinica']) ?? [],
    despesas: (obj.despesas as LancamentoFinanceiro[] | undefined) ?? [],
    parcelas: (obj.parcelas as LancamentoFinanceiro[] | undefined) ?? [],
    pacientes: obj.pacientes as PacienteProps[],
    anamneses: obj.anamneses as AnamneseProps[],
    registrosDentais: obj.registrosDentais as RegistroDentalProps[],
    planosTratamento: obj.planosTratamento as PlanoTratamentoProps[],
    evolucoes: obj.evolucoes as EvolucaoClinicaProps[],
    consultas: (obj.consultas as ConsultaProps[] | undefined) ?? [],
    registrosWhatsapp: (obj.registrosWhatsapp as RegistroWhatsappProps[] | undefined) ?? [],
    linksAnamnese: (obj.linksAnamnese as LinkAnamneseProps[] | undefined) ?? [],
    arquivosPaciente: (obj.arquivosPaciente as ArquivoPacienteProps[] | undefined) ?? [],
    bloqueiosAgenda: (obj.bloqueiosAgenda as BloqueioAgendaProps[] | undefined) ?? [],
    procedimentosCatalogo: (obj.procedimentosCatalogo as ProcedimentoCatalogoProps[] | undefined) ?? [],
    retornos: (obj.retornos as RetornoProps[] | undefined) ?? [],
    campanhasComemorativas: (obj.campanhasComemorativas as CampanhaComemorativaProps[] | undefined) ?? [],
    mensagensCortesia: (obj.mensagensCortesia as MensagemCortesiaProps[] | undefined) ?? [],
  };
  const resumo = resumirBackup(listas);
  const dados: DadosBackup = {
    versao: obj.versao,
    app: typeof obj.app === 'string' ? obj.app : APP_ID_BACKUP,
    appNome: typeof obj.appNome === 'string' ? obj.appNome : APP_NOME_BACKUP,
    exportadoEm: obj.exportadoEm,
    contagens: resumo,
    ...listas,
  };
  return { ok: true, dados, resumo };
}

/** @deprecated Use `analisarBackup`. Mantido só pela compatibilidade da API. */
export function validarFormatoBackup(valor: unknown): DadosBackup | null {
  const resultado = analisarBackup(valor);
  return resultado.ok ? resultado.dados : null;
}

/**
 * Reúne as 5 coleções através dos ports de repositório (nunca lê
 * `localStorage` diretamente — isso seria pular a inversão de
 * dependência já estabelecida no resto do projeto).
 */
export class ExportarDados {
  constructor(
    private readonly pacientes: RepositorioPacientes,
    private readonly anamneses: RepositorioAnamneses,
    private readonly registros: RepositorioRegistrosDentais,
    private readonly planos: RepositorioPlanosTratamento,
    private readonly evolucoes: RepositorioEvolucoes,
    private readonly consultas: RepositorioConsultas,
    private readonly registrosWhatsapp: RepositorioRegistrosWhatsapp,
    private readonly linksAnamnese: RepositorioLinksAnamnese,
    private readonly arquivosPaciente: RepositorioArquivosPaciente,
    private readonly bloqueiosAgenda: RepositorioBloqueiosAgenda,
    private readonly procedimentosCatalogo: RepositorioProcedimentosCatalogo,
    private readonly retornos: RepositorioRetornos,
    private readonly campanhasComemorativas: RepositorioCampanhasComemorativas,
    private readonly mensagensCortesia: RepositorioMensagensCortesia,
  ) {}

  async executar(): Promise<DadosBackup> {
    const [
      pacientes,
      anamneses,
      registros,
      planos,
      evolucoes,
      consultas,
      registrosWa,
      links,
      arquivos,
      bloqueios,
      procedimentos,
      retornos,
      campanhas,
      mensagensCortesia,
    ] = await Promise.all([
      this.pacientes.listarTodos(),
      this.anamneses.listarTodos(),
      this.registros.listarTodos(),
      this.planos.listarTodos(),
      this.evolucoes.listarTodas(),
      this.consultas.listarTodas(),
      this.registrosWhatsapp.listarTodos(),
      this.linksAnamnese.listarTodos(),
      this.arquivosPaciente.listarTodos(),
      this.bloqueiosAgenda.listarTodos(),
      this.procedimentosCatalogo.listarTodos(),
      this.retornos.listarTodos(),
      this.campanhasComemorativas.listarTodas(),
      this.mensagensCortesia.listarTodas(),
    ]);

    const listas = {
      pacientes: pacientes.map((p) => p.toSnapshot() as PacienteProps),
      anamneses: anamneses.map((a) => a.toSnapshot() as AnamneseProps),
      registrosDentais: registros.map((r) => r.toSnapshot() as RegistroDentalProps),
      planosTratamento: planos.map((p) => p.toSnapshot() as PlanoTratamentoProps),
      evolucoes: evolucoes.map((e) => e.toSnapshot() as EvolucaoClinicaProps),
      consultas: consultas.map((c) => c.toSnapshot() as ConsultaProps),
      registrosWhatsapp: registrosWa.map((r) => r.toSnapshot() as RegistroWhatsappProps),
      linksAnamnese: links.map((l) => l.toSnapshot() as LinkAnamneseProps),
      arquivosPaciente: arquivos.map((a) => a.toSnapshot() as ArquivoPacienteProps),
      bloqueiosAgenda: bloqueios.map((b) => b.toSnapshot() as BloqueioAgendaProps),
      procedimentosCatalogo: procedimentos.map((p) => p.toSnapshot() as ProcedimentoCatalogoProps),
      retornos: retornos.map((r) => r.toSnapshot() as RetornoProps),
      campanhasComemorativas: campanhas.map((c) => c.toSnapshot() as CampanhaComemorativaProps),
      mensagensCortesia: mensagensCortesia.map((m) => m.toSnapshot() as MensagemCortesiaProps),
    };

    return {
      versao: VERSAO_FORMATO_BACKUP,
      app: APP_ID_BACKUP,
      appNome: APP_NOME_BACKUP,
      exportadoEm: agoraIso(),
      contagens: resumirBackup(listas),
      ...listas,
    };
  }
}

/**
 * Restaura um backup já validado (`validarFormatoBackup`).
 *
 * Semântica é MESCLAGEM, nunca substituição total: cada item é
 * gravado via `salvar()`, que faz upsert por `id` (ver
 * `LocalStorageCollection.salvar`) — um registro do arquivo com o
 * mesmo id de um já existente é sobrescrito pelo conteúdo do backup;
 * qualquer paciente/registro que já exista neste dispositivo e NÃO
 * esteja no arquivo é mantido intacto, nunca apagado. É por isso que a
 * camada de apresentação deve confirmar com a dentista antes de
 * chamar isto quando já existem dados neste dispositivo — a
 * sobrescrita por id é real, mesmo não sendo uma limpeza total.
 */
export class ImportarDados {
  constructor(
    private readonly pacientes: RepositorioPacientes,
    private readonly anamneses: RepositorioAnamneses,
    private readonly registros: RepositorioRegistrosDentais,
    private readonly planos: RepositorioPlanosTratamento,
    private readonly evolucoes: RepositorioEvolucoes,
    private readonly consultas: RepositorioConsultas,
    private readonly registrosWhatsapp: RepositorioRegistrosWhatsapp,
    private readonly linksAnamnese: RepositorioLinksAnamnese,
    private readonly arquivosPaciente: RepositorioArquivosPaciente,
    private readonly bloqueiosAgenda: RepositorioBloqueiosAgenda,
    private readonly procedimentosCatalogo: RepositorioProcedimentosCatalogo,
    private readonly retornos: RepositorioRetornos,
    private readonly campanhasComemorativas: RepositorioCampanhasComemorativas,
    private readonly mensagensCortesia: RepositorioMensagensCortesia,
  ) {}

  async executar(dados: DadosBackup): Promise<void> {
    if (dados.respostasAnamnese?.length || dados.despesas?.length || dados.parcelas?.length || dados.operacaoClinica?.length) throw new ErroDominio('Este backup contém dados administrativos do servidor. Conecte o servidor para restaurar sem perder registros.');
    // "Aceita tudo ou rejeita" (pedido explícito — sem restauração pela
    // metade): reidrata TODAS as coleções em memória antes de gravar
    // qualquer coisa. Se algum item não puder virar entidade — mesmo
    // tendo passado pela análise estrutural —, a restauração falha aqui
    // sem ter escrito nada.
    const temIdString = (item: unknown): boolean =>
      Boolean(item) && typeof item === 'object' && typeof (item as Record<string, unknown>).id === 'string';

    let entidades: {
      pacientes: Paciente[];
      anamneses: Anamnese[];
      registrosDentais: RegistroDental[];
      planosTratamento: PlanoTratamento[];
      evolucoes: EvolucaoClinica[];
      consultas: Consulta[];
      registrosWhatsapp: RegistroWhatsapp[];
      linksAnamnese: LinkAnamnese[];
      arquivosPaciente: ArquivoPaciente[];
      bloqueiosAgenda: BloqueioAgenda[];
      procedimentosCatalogo: ProcedimentoCatalogo[];
      retornos: Retorno[];
      campanhasComemorativas: CampanhaComemorativa[];
      mensagensCortesia: MensagemCortesia[];
    };
    try {
      const bloqueiosAgenda = dados.bloqueiosAgenda ?? [];
      const procedimentosCatalogo = dados.procedimentosCatalogo ?? [];
      const retornosBackup = dados.retornos ?? [];
      const campanhasBackup = dados.campanhasComemorativas ?? [];
      const mensagensCortesiaBackup = dados.mensagensCortesia ?? [];
      const todas = [
        ...dados.pacientes,
        ...dados.anamneses,
        ...dados.registrosDentais,
        ...dados.planosTratamento,
        ...dados.evolucoes,
        ...dados.consultas,
        ...dados.registrosWhatsapp,
        ...dados.linksAnamnese,
        ...dados.arquivosPaciente,
        ...bloqueiosAgenda,
        ...procedimentosCatalogo,
        ...retornosBackup,
        ...campanhasBackup,
        ...mensagensCortesiaBackup,
      ];
      if (!todas.every(temIdString)) throw new Error('item sem id');
      entidades = {
        pacientes: dados.pacientes.map((p) => Paciente.restaurar(p)),
        anamneses: dados.anamneses.map((a) => Anamnese.restaurar(a)),
        registrosDentais: dados.registrosDentais.map((r) => RegistroDental.restaurar(r)),
        planosTratamento: dados.planosTratamento.map((p) => PlanoTratamento.restaurar(p)),
        evolucoes: dados.evolucoes.map((e) => EvolucaoClinica.restaurar(e)),
        consultas: dados.consultas.map((c) => Consulta.restaurar(c)),
        registrosWhatsapp: dados.registrosWhatsapp.map((r) => RegistroWhatsapp.restaurar(r)),
        linksAnamnese: dados.linksAnamnese.map((l) => LinkAnamnese.restaurar(l)),
        arquivosPaciente: dados.arquivosPaciente.map((a) => ArquivoPaciente.restaurar(a)),
        bloqueiosAgenda: bloqueiosAgenda.map((b) => BloqueioAgenda.restaurar(b)),
        procedimentosCatalogo: procedimentosCatalogo.map((p) => ProcedimentoCatalogo.restaurar(p)),
        retornos: retornosBackup.map((r) => Retorno.restaurar(r)),
        campanhasComemorativas: campanhasBackup.map((c) => CampanhaComemorativa.restaurar(c)),
        mensagensCortesia: mensagensCortesiaBackup.map((m) => MensagemCortesia.restaurar(m)),
      };
    } catch {
      throw new ErroDominio(
        'Não foi possível ler o conteúdo deste backup — o arquivo pode estar corrompido. Nenhum dado foi alterado.',
      );
    }

    for (const paciente of entidades.pacientes) await this.pacientes.salvar(paciente);
    for (const anamnese of entidades.anamneses) await this.anamneses.salvar(anamnese);
    for (const registro of entidades.registrosDentais) await this.registros.salvar(registro);
    for (const plano of entidades.planosTratamento) await this.planos.salvar(plano);
    for (const evolucao of entidades.evolucoes) await this.evolucoes.salvar(evolucao);
    for (const consulta of entidades.consultas) await this.consultas.salvar(consulta);
    for (const registroWa of entidades.registrosWhatsapp) await this.registrosWhatsapp.salvar(registroWa);
    for (const link of entidades.linksAnamnese) await this.linksAnamnese.salvar(link);
    for (const arquivo of entidades.arquivosPaciente) await this.arquivosPaciente.salvar(arquivo);
    for (const bloqueio of entidades.bloqueiosAgenda) await this.bloqueiosAgenda.salvar(bloqueio);
    for (const procedimento of entidades.procedimentosCatalogo) await this.procedimentosCatalogo.salvar(procedimento);
    for (const retorno of entidades.retornos) await this.retornos.salvar(retorno);
    for (const campanha of entidades.campanhasComemorativas) await this.campanhasComemorativas.salvar(campanha);
    for (const mensagem of entidades.mensagensCortesia) await this.mensagensCortesia.salvar(mensagem);
  }
}
