import { GestaoFinanceira } from '../../application/use-cases/gestao-financeira.js';
import { OperacaoClinica } from '../../application/use-cases/operacao-clinica.js';
import { hojeIsoLocal } from '../../domain/types.js';
import type { ApiClient } from '../../application/ports/api-client.js';
import { HttpApiClient } from '../api/http-api-client.js';
import { HttpEncerramentosConsultas } from '../api/http-encerramentos-consultas.js';
import { HttpPerfilForms } from '../api/http-perfil-forms.js';
import { HttpGoogleCalendar } from '../api/http-google-calendar.js';
import { HttpCopiasLocais } from '../api/http-copias-locais.js';
import { CopiasLocaisPaciente } from '../storage/copias-locais-paciente.js';
import { HttpGatewayAnamnese } from '../api/http-gateway-anamnese.js';
import { HttpGatewayAgendamentoWhatsapp } from '../../../whatsapp-itens/src/infrastructure/api/http-gateway-agendamento-whatsapp.js';
import { HttpGatewayArquivos } from '../api/http-gateway-arquivos.js';
import { HttpGatewayWimImport } from '../api/http-gateway-wim-import.js';
import { HttpGatewayAnotacoesRadiografia } from '../api/http-gateway-anotacoes-radiografia.js';
import { HttpGatewayCapturaWim } from '../api/http-gateway-captura-wim.js';
import { HttpNucleoApi } from '../api/http-nucleo-api.js';
import { HttpSondaBackend } from '../api/http-sonda-backend.js';
import { HttpWhatsappAutomatico } from '../../../whatsapp-itens/src/infrastructure/api/http-whatsapp-automatico.js';
import { HttpWhatsappPilotoDesktop } from '../../../whatsapp-itens/src/infrastructure/api/http-whatsapp-piloto-desktop.js';
import { HttpSupressaoCortesiaWhatsapp } from '../../../whatsapp-itens/src/infrastructure/api/http-supressao-cortesia-whatsapp.js';
import { HttpRevisaoConsentimentoCortesia } from '../api/http-revisao-consentimento-cortesia.js';
import { HttpGoogleFormsEmail } from '../api/http-google-forms-email.js';
import { HttpGoogleSheetsSync } from '../api/http-google-sheets-sync.js';
import { HttpSolicitacoesAgendamento } from '../api/http-solicitacoes-agendamento.js';
import { HttpDocumentosImpressao } from '../api/http-documentos-impressao.js';
import { HttpBackupServidor } from '../api/http-backup-servidor.js';
import { HttpGatewayComprovantes } from '../api/http-gateway-comprovantes.js';
import { HttpConfiguracaoClinica } from '../api/http-configuracao-clinica.js';
import {
  AnamneseBackendRepository,
  BloqueioAgendaBackendRepository,
  ConsultaBackendRepository,
  EvolucaoBackendRepository,
  PacienteBackendRepository,
  PlanoTratamentoBackendRepository,
  CampanhaComemorativaBackendRepository,
  MensagemCortesiaBackendRepository,
  ProcedimentoCatalogoBackendRepository,
  RegistroDentalBackendRepository,
  RetornoBackendRepository,
  RegistroWhatsappBackendRepository,
} from '../api/repositorios-backend-nucleo.js';
import { CONFIGURACAO_API } from './configuracao-api.js';
import {
  RevogarLinkAtivoDoPaciente,
} from '../../application/use-cases/anamnese-remota.js';
import { ObterDiagnosticoSincronizacao, VerificarTarefaBackupAgendada } from '../../application/use-cases/sincronizacao.js';
import {
  ObterStatusFilaWhatsappAutomatica,
  ProcessarFilaWhatsappAutomaticaAgora,
} from '../../../whatsapp-itens/src/application/use-cases/whatsapp-automatico.js';
import {
  AtivarKillSwitchPiloto,
  CancelarTestePilotoSupervisionado,
  ConfirmarResultadoPilotoSupervisionado,
  DesarmarKillSwitchPiloto,
  IniciarTestePilotoSupervisionado,
  ObterEstadoSupervisionadoPiloto,
  ObterStatusPilotoDesktop,
  TestarPilotoDesktopComMeuNumero,
} from '../../../whatsapp-itens/src/application/use-cases/whatsapp-piloto-desktop.js';
import { AnalisarEmailGoogleForms, ImportarEmailGoogleForms } from '../../application/use-cases/google-forms-email.js';
import {
  ObterReconciliacaoGoogleSheets,
  ObterStatusSincronizacaoGoogleSheets,
  RecuperarRespostasGoogleSheets,
  SincronizarGoogleSheetsAgora,
} from '../../application/use-cases/google-sheets-sync.js';
import {
  AprovarSolicitacaoAgendamento,
  DefinirProcedimentoSolicitacaoAgendamento,
  ListarSolicitacoesAgendamento,
  MarcarSolicitacoesVistas,
  RecusarSolicitacaoAgendamento,
} from '../../application/use-cases/solicitacao-agendamento.js';
import { ObterDocumentosImpressao } from '../../application/use-cases/documentos-impressao.js';
import { ExportarBackupServidor, RestaurarBackupServidor } from '../../application/use-cases/backup-servidor.js';
import {
  BaixarComprovantePagamento,
  EnviarComprovantePagamento,
  ObterMetaComprovante,
  RemoverComprovantePagamento,
  VerificarServidorComprovantes,
} from '../../application/use-cases/comprovantes-pagamento.js';
import { ObterConfiguracaoClinica, SalvarConfiguracaoClinica } from '../../application/use-cases/configuracao-clinica.js';
import {
  MigrarNucleoParaBackend,
  PlanejarMigracaoNucleo,
} from '../../application/use-cases/migracao-nucleo.js';
import {
  AtualizarDescricaoArquivoRemoto,
  BaixarArquivoRemoto,
  BaixarDicomRemoto,
  EnviarArquivoRemoto,
  ListarArquivosRemotos,
  ListarLixeiraArquivosRemotos,
  RemoverArquivoPermanenteRemoto,
  RemoverArquivoRemoto,
  RestaurarArquivoRemoto,
  VerificarServidorArquivos,
} from '../../application/use-cases/arquivos-remoto.js';
import {
  ConfirmarImportacaoWim,
  IgnorarCandidatoWim,
  ListarCandidatosWimImport,
  ObterPreviewCandidatoWim,
  ObterStatusWimImport,
} from '../../application/use-cases/wim-import.js';
import { ObterAnotacoes, SalvarAnotacoes } from '../../application/use-cases/anotacoes-radiografia.js';
import {
  AvancarCapturaWim,
  CancelarCapturaWim,
  ConcluirCapturaWim,
  IniciarCapturaWim,
  ObterStatusCapturaWim,
  ObterTrabalhoCapturaWim,
  RepetirCapturaWim,
} from '../../application/use-cases/captura-wim.js';
import {
  ArquivoPacienteRemotoRepository,
  BlobArquivoRemotoRepository,
  LinkAnamneseRemotoRepository,
} from '../api/repositorios-remotos.js';
import {
  IndexedDbBlobArquivoRepository,
  LocalStorageAnamneseRepository,
  LocalStorageArquivoPacienteRepository,
  LocalStorageBloqueioAgendaRepository,
  LocalStorageConsultaRepository,
  LocalStorageEvolucaoRepository,
  LocalStorageLinkAnamneseRepository,
  LocalStoragePacienteRepository,
  LocalStoragePlanoTratamentoRepository,
  LocalStorageCampanhaComemorativaRepository,
  LocalStorageMensagemCortesiaRepository,
  LocalStorageProcedimentoCatalogoRepository,
  LocalStorageRascunhoAnamneseRepository,
  LocalStorageRegistroDentalRepository,
  LocalStorageRegistroWhatsappRepository,
  LocalStorageRetornoRepository,
} from '../storage/repositorios-local-storage.js';
import { LocalStorageConfiguracaoClinicaRepository } from '../storage/local-storage-configuracao-clinica.js';
import {
  DescartarRascunhoAnamnese,
  ObterAnamnese,
  ObterRascunhoAnamnese,
  SalvarAnamnese,
  SalvarRascunhoAnamnese,
} from '../../application/use-cases/anamnese.js';
import {
  AdicionarArquivoPaciente,
  ListarArquivosDoPaciente,
  ObterConteudoArquivo,
  RemoverArquivoPaciente,
} from '../../application/use-cases/arquivos-paciente.js';
import { ExportarDados, ImportarDados } from '../../application/use-cases/backup.js';
import { MontarDocumentosDoPaciente } from '../../application/use-cases/documentos-paciente.js';
import {
  PrepararMensagemWhatsappLinkAgendamento,
  RevogarLinkAgendamentoAtivoDoPaciente,
} from '../../../whatsapp-itens/src/application/use-cases/agendamento-whatsapp.js';
import {
  DefinirConsentimentoWhatsapp,
  ListarHistoricoWhatsappDoPaciente,
  PrepararMensagemWhatsappDeConsulta,
  PrepararMensagemWhatsappDeContato,
  PrepararMensagemWhatsappLembretePagamento,
  PrepararMensagemWhatsappLinkAnamnese,
  RegistrarAberturaWhatsapp,
} from '../../../whatsapp-itens/src/application/use-cases/whatsapp.js';
import { CONFIGURACAO_CLINICA } from './configuracao-clinica.js';
import {
  AgendarConsulta,
  CancelarConsulta,
  ConfirmarConsulta,
  ListarAgendaDoIntervalo,
  ListarConsultasDoPaciente,
  ListarProximasConsultas,
  MarcarConsultaRealizada,
  MarcarFaltaConsulta,
  ReagendarConsulta,
  ResumoConsultasFuturasDoPaciente,
} from '../../application/use-cases/consulta.js';
import { BloquearDias, DesbloquearDia, ListarBloqueiosAgenda } from '../../application/use-cases/bloqueio-agenda.js';
import {
  AtivarProcedimentoCatalogo,
  CriarProcedimentoCatalogo,
  DesativarProcedimentoCatalogo,
  EditarProcedimentoCatalogo,
  ListarProcedimentosCatalogo,
  ObterProcedimentoCatalogo,
} from '../../application/use-cases/catalogo-procedimentos.js';
import {
  AdiarRetorno,
  CriarRetornoManual,
  DispensarRetorno,
  ListarRetornosDoPaciente,
  ListarRetornosOperacional,
  MarcarRetornoAgendado,
  MarcarRetornoConcluido,
} from '../../application/use-cases/retornos.js';
import {
  AtivarCampanhaComemorativa,
  CriarCampanhaComemorativa,
  DesativarCampanhaComemorativa,
  DispensarMensagemCortesia,
  EditarCampanhaComemorativa,
  ListarCampanhasComemorativas,
  MarcarMensagemCortesiaRevisada,
  PrepararMensagensCortesiaDoDia,
  ResumoCortesiaDaClinica,
} from '../../application/use-cases/cortesia.js';
import {
  ConfirmarAssinaturaEvolucao,
  ListarEvolucoesDoPaciente,
  ListarEvolucoesRecentes,
  RegistrarEvolucao,
} from '../../application/use-cases/evolucao.js';
import { ObterResumoDaFicha } from '../../application/use-cases/ficha-clinica.js';
import {
  ListarHistoricoDoOdontograma,
  ObterEstadoDoOdontograma,
  RegistrarProcedimentoDental,
  RemoverRegistroDental,
} from '../../application/use-cases/odontograma.js';
import { ObterResumoDoPainel } from '../../application/use-cases/painel.js';
import {
  ListarPacientesComProntidao,
  ResumoPendenciasDaClinica,
} from '../../application/use-cases/prontidao.js';
import {
  GerarRelatorioClinico,
  GerarRelatorioConsultas,
  GerarRelatorioFinanceiro,
} from '../../application/use-cases/relatorios.js';
import {
  AplicarRevisaoConsentimentoCortesia,
  ArquivarPaciente,
  AtualizarPaciente,
  CriarPaciente,
  DefinirConsentimentoCortesia,
  ListarPacientes,
  ListarPacientesRecentes,
  ManterConsentimentoCortesiaAtual,
  ObterPaciente,
  ReativarPaciente,
  RemoverPaciente,
} from '../../application/use-cases/pacientes.js';
import {
  AdicionarItemTratamento,
  AnexarComprovantePagamento,
  CriarPlanoTratamento,
  DefinirCondicoesDePagamento,
  DefinirEmergenciaPlano,
  DefinirStatusPlanoTratamento,
  EditarItemTratamento,
  ListarPlanosDoPaciente,
  MarcarItemTratamentoConcluido,
  ObterPlanoTratamento,
  RegistrarPagamento,
  RemoverItemTratamento,
  RemoverPagamento,
} from '../../application/use-cases/plano-tratamento.js';

/**
 * Composition root — o ÚNICO lugar do projeto que decide QUAIS
 * implementações concretas de repositório são usadas. A camada de
 * apresentação nunca importa `infrastructure/storage` diretamente, só
 * consome os casos de uso já montados aqui via `RepositoriesProvider`
 * (presentation/providers). Trocar localStorage por uma API HTTP no
 * futuro é editar só este arquivo.
 */
/** Identidade repassada aos casos de uso de WhatsApp — só nome, nada sensível. */
const IDENTIDADE_CLINICA = {
  nomeClinica: CONFIGURACAO_CLINICA.nomeClinica,
  nomeProfissional: CONFIGURACAO_CLINICA.nomeProfissional,
};

export interface OpcoesContainer {
  /**
   * Quando presente, as coleções que **já têm adaptador remoto**
   * (`pacientes`, `links-anamnese`, `arquivos` + bytes) passam a usar a
   * API de `docs/backend.spec.md` no lugar do localStorage. As demais
   * seguem locais até ganharem seu `*RemotoRepository` (mesmo molde).
   * Ausente = tudo local (comportamento atual, padrão).
   */
  apiClient?: ApiClient;
}

/**
 * Atalho para o dia em que o servidor existir: `main.tsx` passa a
 * chamar `criarContainerRemoto(import.meta.env.VITE_API_BASE_URL)` —
 * mais nada muda na apresentação.
 */
export function criarContainerRemoto(apiBaseUrl: string): Container {
  return criarContainer({ apiClient: new HttpApiClient(apiBaseUrl) });
}

export function criarContainer(opcoes: OpcoesContainer = {}) {
  const api = opcoes.apiClient;

  const linksAnamneseRepo = api
    ? new LinkAnamneseRemotoRepository(api)
    : new LocalStorageLinkAnamneseRepository();
  const arquivosPacienteRepo = api
    ? new ArquivoPacienteRemotoRepository(api)
    : new LocalStorageArquivoPacienteRepository();
  const blobsArquivoRepo = api ? new BlobArquivoRemotoRepository(api) : new IndexedDbBlobArquivoRepository();

  const gatewayAnamnese = new HttpGatewayAnamnese(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  const gatewayAgendamentoWhatsapp = new HttpGatewayAgendamentoWhatsapp('', CONFIGURACAO_API.token);
  const gatewayArquivos = new HttpGatewayArquivos(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  // Etapa 61 — mesma base/token do gateway de arquivos; a importação do
  // WIM só existe quando o modo servidor está ligado (mesma flag abaixo,
  // `CONFIGURACAO_API.arquivos`), porque depende do MESMO armazenamento
  // de arquivos do servidor, não de um armazenamento próprio.
  const gatewayWimImport = new HttpGatewayWimImport(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  // Continuação da reconstrução do WIM VITOR — anotações e aquisição
  // sintética, mesma base/token e mesma dependência do modo servidor.
  const gatewayAnotacoesRadiografia = new HttpGatewayAnotacoesRadiografia(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  const gatewayCapturaWim = new HttpGatewayCapturaWim(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  const sondaBackend = new HttpSondaBackend(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  const whatsappAutomaticoApi = new HttpWhatsappAutomatico(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  const supressaoCortesiaWhatsappApi = new HttpSupressaoCortesiaWhatsapp(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  const revisaoConsentimentoCortesiaApi = new HttpRevisaoConsentimentoCortesia(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  const whatsappPilotoDesktopApi = new HttpWhatsappPilotoDesktop(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  const googleFormsEmailApi = new HttpGoogleFormsEmail(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  const googleSheetsSyncApi = new HttpGoogleSheetsSync(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  const solicitacoesAgendamentoApi = new HttpSolicitacoesAgendamento(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  const documentosImpressaoApi = new HttpDocumentosImpressao(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  const backupServidorApi = new HttpBackupServidor(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  const gatewayComprovantes = new HttpGatewayComprovantes(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  const nucleoApi = new HttpNucleoApi(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token);
  const rascunhosAnamneseRepo = new LocalStorageRascunhoAnamneseRepository();

  /**
   * NÚCLEO clínico. Quando `CONFIGURACAO_API.nucleo` (`VITE_API=on` ou
   * `VITE_API_PACIENTES=on`), o servidor de `server/` é a FONTE ÚNICA de
   * verdade de pacientes e agenda (Etapa 21) e também de planos de
   * tratamento, pagamentos, odontograma, evolução, histórico de WhatsApp
   * e o registro de anamnese (Etapa 22) — nada é mantido em paralelo no
   * `localStorage`. Senão, tudo segue local como sempre. Os repositórios
   * LOCAIS são mantidos à parte só para o caso de uso de MIGRAÇÃO (ler o
   * que ainda está no navegador e enviar).
   */
  const reposLocais = {
    pacientes: new LocalStoragePacienteRepository(),
    consultas: new LocalStorageConsultaRepository(),
    planos: new LocalStoragePlanoTratamentoRepository(),
    evolucoes: new LocalStorageEvolucaoRepository(),
    registrosDentais: new LocalStorageRegistroDentalRepository(),
    registrosWhatsapp: new LocalStorageRegistroWhatsappRepository(),
    anamneses: new LocalStorageAnamneseRepository(),
    bloqueiosAgenda: new LocalStorageBloqueioAgendaRepository(),
    procedimentosCatalogo: new LocalStorageProcedimentoCatalogoRepository(),
    retornos: new LocalStorageRetornoRepository(),
    campanhasComemorativas: new LocalStorageCampanhaComemorativaRepository(),
    mensagensCortesia: new LocalStorageMensagemCortesiaRepository(),
  };

  const usarBackend = CONFIGURACAO_API.nucleo;
  const pacientesRepo = usarBackend ? new PacienteBackendRepository(nucleoApi) : reposLocais.pacientes;
  const consultasRepo = usarBackend ? new ConsultaBackendRepository(nucleoApi) : reposLocais.consultas;
  const planosRepo = usarBackend ? new PlanoTratamentoBackendRepository(nucleoApi) : reposLocais.planos;
  const evolucoesRepo = usarBackend ? new EvolucaoBackendRepository(nucleoApi) : reposLocais.evolucoes;
  const registrosRepo = usarBackend ? new RegistroDentalBackendRepository(nucleoApi) : reposLocais.registrosDentais;
  const registrosWhatsappRepo = usarBackend
    ? new RegistroWhatsappBackendRepository(nucleoApi)
    : reposLocais.registrosWhatsapp;
  const anamnesesRepo = usarBackend ? new AnamneseBackendRepository(nucleoApi) : reposLocais.anamneses;
  const bloqueiosAgendaRepo = usarBackend
    ? new BloqueioAgendaBackendRepository(nucleoApi)
    : reposLocais.bloqueiosAgenda;
  const procedimentosCatalogoRepo = usarBackend
    ? new ProcedimentoCatalogoBackendRepository(nucleoApi)
    : reposLocais.procedimentosCatalogo;
  const retornosRepo = usarBackend ? new RetornoBackendRepository(nucleoApi) : reposLocais.retornos;
  const campanhasComemorativasRepo = usarBackend
    ? new CampanhaComemorativaBackendRepository(nucleoApi)
    : reposLocais.campanhasComemorativas;
  const mensagensCortesiaRepo = usarBackend
    ? new MensagemCortesiaBackendRepository(nucleoApi)
    : reposLocais.mensagensCortesia;
  // Semeia o catálogo a partir da planilha da clínica, uma vez por boot —
  // idempotente (nunca duplica, nunca sobrescreve preço já editado). Nunca
  // bloqueia a inicialização do app: falha de rede/servidor aqui não deve
  // impedir o resto do sistema de carregar.
  // A amostra usa somente os preços fictícios do simulador.
  // Prepara (nunca envia) as mensagens de cortesia do dia a cada boot —
  // idempotente por ano/paciente/campanha (ver `PrepararMensagensCortesiaDoDia`).
  void new PrepararMensagensCortesiaDoDia(pacientesRepo, campanhasComemorativasRepo, mensagensCortesiaRepo, supressaoCortesiaWhatsappApi)
    .executar(hojeIsoLocal())
    .catch(() => {});
  const configuracaoClinicaRepo = usarBackend
    ? new HttpConfiguracaoClinica(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token)
    : new LocalStorageConfiguracaoClinicaRepository();

  return {
    operacaoClinica: new OperacaoClinica(usarBackend ? new HttpApiClient(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token) : api ?? null),
    gestaoFinanceira: new GestaoFinanceira(usarBackend ? new HttpApiClient(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token) : null),
    perfilForms: usarBackend ? new HttpPerfilForms(new HttpApiClient(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token)) : api ? new HttpPerfilForms(api) : null,
    encerramentosConsultas: usarBackend ? new HttpEncerramentosConsultas(new HttpApiClient(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token)) : null,
    copiasLocaisPaciente: new CopiasLocaisPaciente(new HttpCopiasLocais(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token)),
    googleCalendar: new HttpGoogleCalendar(CONFIGURACAO_API.baseUrl, CONFIGURACAO_API.token),
    pacientes: {
      criar: new CriarPaciente(pacientesRepo),
      atualizar: new AtualizarPaciente(pacientesRepo),
      listar: new ListarPacientes(pacientesRepo),
      listarRecentes: new ListarPacientesRecentes(pacientesRepo),
      obter: new ObterPaciente(pacientesRepo),
      remover: new RemoverPaciente(pacientesRepo),
      arquivar: new ArquivarPaciente(pacientesRepo),
      reativar: new ReativarPaciente(pacientesRepo),
      definirConsentimentoCortesia: new DefinirConsentimentoCortesia(pacientesRepo),
      aplicarRevisaoConsentimentoCortesia: new AplicarRevisaoConsentimentoCortesia(revisaoConsentimentoCortesiaApi),
      manterConsentimentoCortesiaAtual: new ManterConsentimentoCortesiaAtual(revisaoConsentimentoCortesiaApi),
    },
    anamnese: {
      salvar: new SalvarAnamnese(anamnesesRepo, rascunhosAnamneseRepo),
      obter: new ObterAnamnese(anamnesesRepo),
      obterRascunho: new ObterRascunhoAnamnese(rascunhosAnamneseRepo),
      salvarRascunho: new SalvarRascunhoAnamnese(rascunhosAnamneseRepo),
      descartarRascunho: new DescartarRascunhoAnamnese(rascunhosAnamneseRepo),
    },
    odontograma: {
      registrarProcedimento: new RegistrarProcedimentoDental(registrosRepo),
      listarHistorico: new ListarHistoricoDoOdontograma(registrosRepo),
      obterEstado: new ObterEstadoDoOdontograma(registrosRepo),
      removerRegistro: new RemoverRegistroDental(registrosRepo),
    },
    planoTratamento: {
      criar: new CriarPlanoTratamento(planosRepo),
      listarDoPaciente: new ListarPlanosDoPaciente(planosRepo),
      obter: new ObterPlanoTratamento(planosRepo),
      adicionarItem: new AdicionarItemTratamento(planosRepo),
      editarItem: new EditarItemTratamento(planosRepo),
      marcarItemConcluido: new MarcarItemTratamentoConcluido(planosRepo, procedimentosCatalogoRepo, retornosRepo),
      removerItem: new RemoverItemTratamento(planosRepo),
      registrarPagamento: new RegistrarPagamento(planosRepo),
      removerPagamento: new RemoverPagamento(planosRepo, gatewayComprovantes),
      anexarComprovante: new AnexarComprovantePagamento(planosRepo),
      definirCondicoesDePagamento: new DefinirCondicoesDePagamento(planosRepo),
      definirEmergencia: new DefinirEmergenciaPlano(planosRepo),
      definirStatus: new DefinirStatusPlanoTratamento(planosRepo),
    },
    evolucao: {
      registrar: new RegistrarEvolucao(evolucoesRepo),
      listarDoPaciente: new ListarEvolucoesDoPaciente(evolucoesRepo),
      listarRecentes: new ListarEvolucoesRecentes(evolucoesRepo, pacientesRepo),
      confirmarAssinatura: new ConfirmarAssinaturaEvolucao(evolucoesRepo),
    },
    consulta: {
      agendar: new AgendarConsulta(consultasRepo, pacientesRepo, bloqueiosAgendaRepo, procedimentosCatalogoRepo, configuracaoClinicaRepo),
      reagendar: new ReagendarConsulta(consultasRepo, pacientesRepo, bloqueiosAgendaRepo, configuracaoClinicaRepo),
      confirmar: new ConfirmarConsulta(consultasRepo),
      marcarRealizada: new MarcarConsultaRealizada(consultasRepo),
      marcarFalta: new MarcarFaltaConsulta(consultasRepo),
      cancelar: new CancelarConsulta(consultasRepo),
      listarDoPaciente: new ListarConsultasDoPaciente(consultasRepo),
      listarProximas: new ListarProximasConsultas(consultasRepo, pacientesRepo),
      listarIntervalo: new ListarAgendaDoIntervalo(consultasRepo, pacientesRepo),
      resumoFuturasDoPaciente: new ResumoConsultasFuturasDoPaciente(consultasRepo),
    },
    /**
     * Dias bloqueados na Agenda (feriado, final de semana, dia avulso —
     * pedido do usuário). `consulta.agendar`/`consulta.reagendar` acima
     * já recebem este mesmo repositório e recusam datas bloqueadas
     * sozinhos — a tela só precisa destes 3 casos de uso pra gerenciar
     * a lista (bloquear, desbloquear, listar pra desenhar a grade).
     */
    bloqueioAgenda: {
      bloquear: new BloquearDias(bloqueiosAgendaRepo),
      desbloquear: new DesbloquearDia(bloqueiosAgendaRepo),
      listar: new ListarBloqueiosAgenda(bloqueiosAgendaRepo),
    },
    /**
     * Catálogo editável de procedimentos (preço/nome reutilizável no
     * orçamento) — semeado automaticamente a partir da planilha da
     * clínica no boot (ver `SemearCatalogoProcedimentos` acima),
     * idempotente. Nunca é a fonte de verdade de um orçamento já
     * criado: `plano-tratamento.ts` copia o preço no momento de
     * adicionar o item.
     */
    catalogoProcedimentos: {
      criar: new CriarProcedimentoCatalogo(procedimentosCatalogoRepo),
      editar: new EditarProcedimentoCatalogo(procedimentosCatalogoRepo),
      ativar: new AtivarProcedimentoCatalogo(procedimentosCatalogoRepo),
      desativar: new DesativarProcedimentoCatalogo(procedimentosCatalogoRepo),
      obter: new ObterProcedimentoCatalogo(procedimentosCatalogoRepo),
      listar: new ListarProcedimentosCatalogo(procedimentosCatalogoRepo),
    },
    /**
     * Retornos/follow-up (acompanhamento pós-procedimento) — nunca cria
     * consulta sozinho; "Agendado" é um status marcado manualmente
     * depois de agendar de verdade pela Agenda.
     */
    retorno: {
      criarManual: new CriarRetornoManual(retornosRepo),
      marcarAgendado: new MarcarRetornoAgendado(retornosRepo),
      marcarConcluido: new MarcarRetornoConcluido(retornosRepo),
      dispensar: new DispensarRetorno(retornosRepo),
      adiar: new AdiarRetorno(retornosRepo),
      listarDoPaciente: new ListarRetornosDoPaciente(retornosRepo),
      listarOperacional: new ListarRetornosOperacional(retornosRepo),
    },
    /**
     * Aniversário/cortesia (Fase de preparo/revisão manual — nunca
     * envia): campanhas comemorativas configuráveis + a fila de
     * mensagens preparadas, deduplicadas por ano.
     */
    cortesia: {
      criarCampanha: new CriarCampanhaComemorativa(campanhasComemorativasRepo),
      editarCampanha: new EditarCampanhaComemorativa(campanhasComemorativasRepo),
      ativarCampanha: new AtivarCampanhaComemorativa(campanhasComemorativasRepo),
      desativarCampanha: new DesativarCampanhaComemorativa(campanhasComemorativasRepo),
      listarCampanhas: new ListarCampanhasComemorativas(campanhasComemorativasRepo),
      prepararMensagensDoDia: new PrepararMensagensCortesiaDoDia(pacientesRepo, campanhasComemorativasRepo, mensagensCortesiaRepo, supressaoCortesiaWhatsappApi),
      resumo: new ResumoCortesiaDaClinica(pacientesRepo, mensagensCortesiaRepo, supressaoCortesiaWhatsappApi),
      marcarRevisada: new MarcarMensagemCortesiaRevisada(mensagensCortesiaRepo),
      dispensarMensagem: new DispensarMensagemCortesia(mensagensCortesiaRepo),
    },
    painel: {
      obterResumo: new ObterResumoDoPainel(pacientesRepo, planosRepo, registrosRepo, evolucoesRepo),
    },
    prontidao: {
      listarComProntidao: new ListarPacientesComProntidao(
        pacientesRepo,
        anamnesesRepo,
        registrosRepo,
        planosRepo,
        consultasRepo,
      ),
      resumoPendencias: new ResumoPendenciasDaClinica(
        pacientesRepo,
        anamnesesRepo,
        registrosRepo,
        planosRepo,
        consultasRepo,
      ),
    },
    relatorios: {
      clinico: new GerarRelatorioClinico(pacientesRepo, anamnesesRepo, registrosRepo, planosRepo, consultasRepo),
      financeiro: new GerarRelatorioFinanceiro(pacientesRepo, planosRepo),
      consultas: new GerarRelatorioConsultas(consultasRepo, pacientesRepo),
    },
    fichaClinica: {
      obterResumo: new ObterResumoDaFicha(anamnesesRepo, registrosRepo, planosRepo, evolucoesRepo, consultasRepo),
    },
    documentos: {
      montar: new MontarDocumentosDoPaciente(
        pacientesRepo,
        anamnesesRepo,
        registrosRepo,
        planosRepo,
        evolucoesRepo,
        consultasRepo,
      ),
    },
    whatsapp: {
      prepararDeConsulta: new PrepararMensagemWhatsappDeConsulta(
        consultasRepo,
        pacientesRepo,
        registrosWhatsappRepo,
        IDENTIDADE_CLINICA,
      ),
      prepararLembretePagamento: new PrepararMensagemWhatsappLembretePagamento(
        planosRepo,
        pacientesRepo,
        registrosWhatsappRepo,
        IDENTIDADE_CLINICA,
      ),
      prepararContato: new PrepararMensagemWhatsappDeContato(pacientesRepo, registrosWhatsappRepo, IDENTIDADE_CLINICA),
      prepararLinkAnamnese: new PrepararMensagemWhatsappLinkAnamnese(
        linksAnamneseRepo,
        pacientesRepo,
        registrosWhatsappRepo,
        IDENTIDADE_CLINICA,
      ),
      prepararLinkAgendamento: new PrepararMensagemWhatsappLinkAgendamento(
        gatewayAgendamentoWhatsapp,
        pacientesRepo,
        registrosWhatsappRepo,
        IDENTIDADE_CLINICA,
      ),
      revogarLinkAgendamentoAtivoDoPaciente: new RevogarLinkAgendamentoAtivoDoPaciente(gatewayAgendamentoWhatsapp),
      definirConsentimento: new DefinirConsentimentoWhatsapp(pacientesRepo),
      registrarAbertura: new RegistrarAberturaWhatsapp(registrosWhatsappRepo, IDENTIDADE_CLINICA),
      listarHistorico: new ListarHistoricoWhatsappDoPaciente(registrosWhatsappRepo),
    },
    // Mantido somente para revogar registros históricos ao arquivar um paciente.
    sincronizacaoAnamnese: CONFIGURACAO_API.habilitado,
    anamneseRemota: {revogarLinkAtivoDoPaciente: new RevogarLinkAtivoDoPaciente(gatewayAnamnese)},
    sincronizacao: {
      obterDiagnostico: new ObterDiagnosticoSincronizacao(sondaBackend, {
        baseUrl: CONFIGURACAO_API.baseUrl,
        anamnese: CONFIGURACAO_API.habilitado,
        arquivos: CONFIGURACAO_API.arquivos,
        nucleo: CONFIGURACAO_API.nucleo,
      }),
      verificarTarefaBackup: new VerificarTarefaBackupAgendada(sondaBackend),
    },
    /**
     * Núcleo clínico no servidor (Etapa 21). `sincronizacaoNucleo`
     * diz se pacientes/agenda vêm do servidor; `migracao` move o que
     * ainda está no `localStorage` deste navegador para lá (ação
     * manual, com contagem e confirmação, nunca sobrescreve).
     */
    sincronizacaoNucleo: CONFIGURACAO_API.nucleo,
    migracao: {
      planejar: new PlanejarMigracaoNucleo(reposLocais, nucleoApi),
      migrar: new MigrarNucleoParaBackend(reposLocais, nucleoApi),
    },
    /**
     * Fila automática de WhatsApp (Etapa 26) — tela de operação que lê
     * o estado da fila do servidor (confirmação/lembretes agendados
     * pelo agendamento por link) e permite processá-la na hora. Só faz
     * sentido quando o núcleo está no servidor (é lá que a fila mora);
     * a tela usa `sincronizacaoNucleo` acima para decidir se mostra.
     */
    whatsappAutomatico: {
      obterStatus: new ObterStatusFilaWhatsappAutomatica(whatsappAutomaticoApi),
      processarAgora: new ProcessarFilaWhatsappAutomaticaAgora(whatsappAutomaticoApi),
    },
    /**
     * Piloto de WhatsApp Desktop (Etapa 62), Etapa A — dry-run apenas.
     * Caminho totalmente separado do provedor genérico acima: nunca
     * envia mensagem nenhuma nesta etapa, o worker sempre para antes de
     * apertar Enter. Mesma condição de disponibilidade (depende do
     * servidor da clínica).
     */
    whatsappPilotoDesktop: {
      obterStatus: new ObterStatusPilotoDesktop(whatsappPilotoDesktopApi),
      testarComMeuNumero: new TestarPilotoDesktopComMeuNumero(whatsappPilotoDesktopApi),
      // Etapa B — autoteste supervisionado (um envio real, só para o
      // dono, sob confirmação explícita e checkbox marcada na UI).
      obterEstadoSupervisionado: new ObterEstadoSupervisionadoPiloto(whatsappPilotoDesktopApi),
      iniciarTesteSupervisionado: new IniciarTestePilotoSupervisionado(whatsappPilotoDesktopApi),
      cancelarTesteSupervisionado: new CancelarTestePilotoSupervisionado(whatsappPilotoDesktopApi),
      confirmarResultadoSupervisionado: new ConfirmarResultadoPilotoSupervisionado(whatsappPilotoDesktopApi),
      ativarKillSwitch: new AtivarKillSwitchPiloto(whatsappPilotoDesktopApi),
      desarmarKillSwitch: new DesarmarKillSwitchPiloto(whatsappPilotoDesktopApi),
    },
    /**
     * Importação de Google Forms por e-mail (Etapa 53) — caminho
     * alternativo ao webhook direto enquanto o servidor não tem
     * endereço alcançável da internet. Só faz sentido quando o núcleo
     * está no servidor (é lá que paciente/anamnese/consulta são
     * gravados); a tela usa `sincronizacaoNucleo` acima pra decidir se
     * mostra, mesmo padrão do WhatsApp automático.
     */
    googleFormsEmail: {
      analisar: new AnalisarEmailGoogleForms(googleFormsEmailApi),
      importar: new ImportarEmailGoogleForms(googleFormsEmailApi),
    },
    /**
     * Status/operação da sincronização automática do Google Forms por
     * planilha (Etapa 58) — mesmo padrão do WhatsApp automático: a
     * tela usa `obterStatus` pra mostrar a situação e `sincronizarAgora`
     * pro botão "Sincronizar agora".
     */
    googleSheetsSync: {
      obterStatus: new ObterStatusSincronizacaoGoogleSheets(googleSheetsSyncApi),
      sincronizarAgora: new SincronizarGoogleSheetsAgora(googleSheetsSyncApi),
      obterReconciliacao: new ObterReconciliacaoGoogleSheets(googleSheetsSyncApi),
      recuperarRespostas: new RecuperarRespostasGoogleSheets(googleSheetsSyncApi),
    },
    /**
     * Solicitações de agendamento do Google Forms — nunca ocupam a
     * agenda por conta própria; a tela de Agenda usa `listar` pra
     * mostrar a pendência e `aprovar`/`recusar` pra decidir, sempre com
     * revalidação de conflito/dia bloqueado no servidor na aprovação.
     */
    solicitacaoAgendamento: {
      listar: new ListarSolicitacoesAgendamento(solicitacoesAgendamentoApi),
      aprovar: new AprovarSolicitacaoAgendamento(solicitacoesAgendamentoApi),
      recusar: new RecusarSolicitacaoAgendamento(solicitacoesAgendamentoApi),
      marcarVistas: new MarcarSolicitacoesVistas(solicitacoesAgendamentoApi),
      definirProcedimento: new DefinirProcedimentoSolicitacaoAgendamento(solicitacoesAgendamentoApi),
    },
    documentosImpressao: {
      obter: new ObterDocumentosImpressao(documentosImpressaoApi),
    },
    /**
     * Comprovantes de pagamento (Etapa 54) — só existe em modo servidor
     * (sem versão 100% local, ver `gateway-comprovantes.ts`). A tela usa
     * `verificarServidor` (ou `sincronizacaoNucleo`) pra decidir se
     * mostra o controle de anexar; registrar pagamento sem comprovante
     * sempre funciona, com ou sem servidor.
     */
    comprovantes: {
      verificarServidor: new VerificarServidorComprovantes(gatewayComprovantes),
      enviar: new EnviarComprovantePagamento(gatewayComprovantes),
      obterMeta: new ObterMetaComprovante(gatewayComprovantes),
      baixar: new BaixarComprovantePagamento(gatewayComprovantes),
      remover: new RemoverComprovantePagamento(gatewayComprovantes),
    },
    /**
     * Configurações editáveis da clínica (Etapa 54) — hoje só o
     * endereço. Segue a mesma dualidade local/servidor de
     * pacientes/planos (`usarBackend`), nunca a de arquivos — é um
     * registro único, não uma coleção com bytes.
     */
    configuracaoClinica: {
      obter: new ObterConfiguracaoClinica(configuracaoClinicaRepo),
      salvar: new SalvarConfiguracaoClinica(configuracaoClinicaRepo),
    },
    arquivos: {
      adicionar: new AdicionarArquivoPaciente(arquivosPacienteRepo, blobsArquivoRepo, pacientesRepo),
      listarDoPaciente: new ListarArquivosDoPaciente(arquivosPacienteRepo, blobsArquivoRepo),
      obterConteudo: new ObterConteudoArquivo(arquivosPacienteRepo, blobsArquivoRepo),
      remover: new RemoverArquivoPaciente(arquivosPacienteRepo, blobsArquivoRepo),
    },
    /**
     * Slice de ARQUIVOS COMPARTILHADOS (Etapa 19) — só ativo quando
     * `CONFIGURACAO_API.arquivos` (`VITE_API_ARQUIVOS=on`). Metadados e
     * bytes vivem no servidor de `server/` (sistema de arquivos), não no
     * navegador. A aba "Documentos e imagens" escolhe entre `arquivos`
     * (local) e `arquivosRemoto` (servidor) por `sincronizacaoArquivos`.
     */
    sincronizacaoArquivos: CONFIGURACAO_API.arquivos,
    arquivosRemoto: {
      verificarServidor: new VerificarServidorArquivos(gatewayArquivos),
      listar: new ListarArquivosRemotos(gatewayArquivos),
      enviar: new EnviarArquivoRemoto(gatewayArquivos, pacientesRepo),
      baixar: new BaixarArquivoRemoto(gatewayArquivos),
      remover: new RemoverArquivoRemoto(gatewayArquivos),
      atualizarDescricao: new AtualizarDescricaoArquivoRemoto(gatewayArquivos),
      listarLixeira: new ListarLixeiraArquivosRemotos(gatewayArquivos),
      restaurar: new RestaurarArquivoRemoto(gatewayArquivos),
      removerPermanente: new RemoverArquivoPermanenteRemoto(gatewayArquivos),
      baixarDicom: new BaixarDicomRemoto(gatewayArquivos),
    },
    /**
     * Anotações persistentes de radiografia (continuação do WIM VITOR) —
     * só existem no modo servidor, mesma dependência de `arquivosRemoto`.
     */
    anotacoesRadiografia: {
      obter: new ObterAnotacoes(gatewayAnotacoesRadiografia),
      salvar: new SalvarAnotacoes(gatewayAnotacoesRadiografia),
    },
    /**
     * Aquisição sintética via agente de captura desacoplado (continuação
     * do WIM VITOR). Também só existe no modo servidor — o agente grava
     * no MESMO armazenamento de arquivos do servidor via `captura-wim.mjs`.
     */
    capturaWim: {
      status: new ObterStatusCapturaWim(gatewayCapturaWim),
      iniciar: new IniciarCapturaWim(gatewayCapturaWim, pacientesRepo),
      avancar: new AvancarCapturaWim(gatewayCapturaWim),
      repetir: new RepetirCapturaWim(gatewayCapturaWim),
      cancelar: new CancelarCapturaWim(gatewayCapturaWim),
      obterTrabalho: new ObterTrabalhoCapturaWim(gatewayCapturaWim),
      concluir: new ConcluirCapturaWim(gatewayCapturaWim),
    },
    /**
     * Importação de radiografias do WIM Dental (Etapa 61) — só faz
     * sentido junto do modo servidor (`sincronizacaoArquivos`), porque a
     * confirmação grava no MESMO armazenamento de arquivos do servidor.
     * Nunca associa paciente sozinha — só expõe candidatos/preview; a
     * confirmação exige sempre o `pacienteId` já aberto na tela.
     */
    wimImport: {
      status: new ObterStatusWimImport(gatewayWimImport),
      listarCandidatos: new ListarCandidatosWimImport(gatewayWimImport),
      obterPreview: new ObterPreviewCandidatoWim(gatewayWimImport),
      confirmarImportacao: new ConfirmarImportacaoWim(gatewayWimImport),
      ignorar: new IgnorarCandidatoWim(gatewayWimImport),
    },
    backup: {
      exportar: new ExportarDados(
        pacientesRepo,
        anamnesesRepo,
        registrosRepo,
        planosRepo,
        evolucoesRepo,
        consultasRepo,
        registrosWhatsappRepo,
        linksAnamneseRepo,
        arquivosPacienteRepo,
        bloqueiosAgendaRepo,
        procedimentosCatalogoRepo,
        retornosRepo,
        campanhasComemorativasRepo,
        mensagensCortesiaRepo,
      ),
      importar: new ImportarDados(
        pacientesRepo,
        anamnesesRepo,
        registrosRepo,
        planosRepo,
        evolucoesRepo,
        consultasRepo,
        registrosWhatsappRepo,
        linksAnamneseRepo,
        arquivosPacienteRepo,
        bloqueiosAgendaRepo,
        procedimentosCatalogoRepo,
        retornosRepo,
        campanhasComemorativasRepo,
        mensagensCortesiaRepo,
      ),
    },
    /**
     * Backup montado e cifrado no SERVIDOR (nunca uma coleção completa
     * em claro no navegador) — só existe em modo com servidor. A tela
     * usa isto para o caminho padrão (criptografado); o modo 100% local
     * e o caminho avançado "sem criptografia" continuam usando
     * `backup` acima, que já é seguro nesses dois casos.
     */
    backupServidor: {
      exportar: new ExportarBackupServidor(backupServidorApi),
      restaurar: new RestaurarBackupServidor(backupServidorApi),
    },
  };
}

export type Container = ReturnType<typeof criarContainer>;
