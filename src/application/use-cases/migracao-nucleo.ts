import type {
  ColecaoNucleo,
  ContagemNucleo,
  GatewayNucleo,
  ResultadoMigracaoNucleo,
} from '../ports/gateway-nucleo.js';
import { contagemNucleoVazia } from '../ports/gateway-nucleo.js';
import type {
  RepositorioAnamneses,
  RepositorioBloqueiosAgenda,
  RepositorioCampanhasComemorativas,
  RepositorioConsultas,
  RepositorioEvolucoes,
  RepositorioMensagensCortesia,
  RepositorioPacientes,
  RepositorioPlanosTratamento,
  RepositorioProcedimentosCatalogo,
  RepositorioRegistrosDentais,
  RepositorioRegistrosWhatsapp,
  RepositorioRetornos,
} from '../ports/repositorios.js';

/**
 * Migração manual do NÚCLEO clínico do `localStorage` deste navegador
 * para o servidor da clínica (Etapas 21–22). Ação deliberada da
 * dentista, com contagens antes e confirmação — a tela nunca decide a
 * semântica, só mostra números e chama estes casos de uso.
 *
 * `PlanejarMigracaoNucleo` lê as contagens locais de TODAS as coleções
 * e (se o servidor responde) as do servidor. `MigrarNucleoParaBackend`
 * envia todos os registros locais; o servidor grava só os ids que ainda
 * não existem lá — **nunca sobrescreve** — então repetir é seguro (a 2ª
 * vez grava 0).
 */

export interface ReposLocaisNucleo {
  pacientes: RepositorioPacientes;
  consultas: RepositorioConsultas;
  planos: RepositorioPlanosTratamento;
  evolucoes: RepositorioEvolucoes;
  registrosDentais: RepositorioRegistrosDentais;
  registrosWhatsapp: RepositorioRegistrosWhatsapp;
  anamneses: RepositorioAnamneses;
  bloqueiosAgenda: RepositorioBloqueiosAgenda;
  procedimentosCatalogo: RepositorioProcedimentosCatalogo;
  retornos: RepositorioRetornos;
  campanhasComemorativas: RepositorioCampanhasComemorativas;
  mensagensCortesia: RepositorioMensagensCortesia;
}

async function lerColecoesLocais(
  repos: ReposLocaisNucleo,
): Promise<Record<ColecaoNucleo, { id: string; toSnapshot(): unknown }[]>> {
  const [
    pacientes,
    consultas,
    planos,
    evolucoes,
    registrosDentais,
    registrosWhatsapp,
    anamneses,
    bloqueiosAgenda,
    procedimentosCatalogo,
    retornos,
    campanhasComemorativas,
    mensagensCortesia,
  ] = await Promise.all([
    repos.pacientes.listarTodos(),
    repos.consultas.listarTodas(),
    repos.planos.listarTodos(),
    repos.evolucoes.listarTodas(),
    repos.registrosDentais.listarTodos(),
    repos.registrosWhatsapp.listarTodos(),
    repos.anamneses.listarTodos(),
    repos.bloqueiosAgenda.listarTodos(),
    repos.procedimentosCatalogo.listarTodos(),
    repos.retornos.listarTodos(),
    repos.campanhasComemorativas.listarTodas(),
    repos.mensagensCortesia.listarTodas(),
  ]);
  return {
    pacientes,
    consultas,
    planos,
    evolucoes,
    'registros-dentais': registrosDentais,
    'registros-whatsapp': registrosWhatsapp,
    anamneses,
    'bloqueios-agenda': bloqueiosAgenda,
    'procedimentos-catalogo': procedimentosCatalogo,
    retornos,
    'campanhas-comemorativas': campanhasComemorativas,
    'mensagens-cortesia': mensagensCortesia,
  };
}

export interface PlanoMigracaoNucleo {
  local: ContagemNucleo;
  servidor: ContagemNucleo | null;
  servidorDisponivel: boolean;
  /** `true` quando há qualquer coleção local com registros a enviar. */
  temLocalParaMigrar: boolean;
}

export class PlanejarMigracaoNucleo {
  constructor(
    private readonly repos: ReposLocaisNucleo,
    private readonly gateway: GatewayNucleo,
  ) {}

  async executar(): Promise<PlanoMigracaoNucleo> {
    const [colecoes, disponivel] = await Promise.all([
      lerColecoesLocais(this.repos),
      this.gateway.disponivel(),
    ]);

    const local = contagemNucleoVazia();
    let temLocalParaMigrar = false;
    for (const chave of Object.keys(local) as ColecaoNucleo[]) {
      local[chave] = colecoes[chave].length;
      if (colecoes[chave].length > 0) temLocalParaMigrar = true;
    }

    let servidor: ContagemNucleo | null = null;
    if (disponivel) servidor = await this.gateway.contar().catch(() => null);

    return { local, servidor, servidorDisponivel: disponivel, temLocalParaMigrar };
  }
}

export class MigrarNucleoParaBackend {
  constructor(
    private readonly repos: ReposLocaisNucleo,
    private readonly gateway: GatewayNucleo,
  ) {}

  async executar(): Promise<ResultadoMigracaoNucleo> {
    const colecoes = await lerColecoesLocais(this.repos);
    const corpo: Partial<Record<ColecaoNucleo, unknown[]>> = {};
    for (const chave of Object.keys(colecoes) as ColecaoNucleo[]) {
      corpo[chave] = colecoes[chave].map((entidade) => entidade.toSnapshot());
    }
    return this.gateway.migrar(corpo);
  }
}
