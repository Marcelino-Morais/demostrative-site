import type { Anamnese, SalvarAnamneseInput } from '../../domain/entities/anamnese.js';
import type { ArquivoPaciente } from '../../domain/entities/arquivo-paciente.js';
import type { BloqueioAgenda } from '../../domain/entities/bloqueio-agenda.js';
import type { Consulta } from '../../domain/entities/consulta.js';
import type { EvolucaoClinica } from '../../domain/entities/evolucao-clinica.js';
import type { LinkAnamnese } from '../../domain/entities/link-anamnese.js';
import type { Paciente } from '../../domain/entities/paciente.js';
import type { PlanoTratamento } from '../../domain/entities/plano-tratamento.js';
import type { CampanhaComemorativa } from '../../domain/entities/campanha-comemorativa.js';
import type { MensagemCortesia } from '../../domain/entities/mensagem-cortesia.js';
import type { ProcedimentoCatalogo } from '../../domain/entities/procedimento-catalogo.js';
import type { RegistroDental } from '../../domain/entities/registro-dental.js';
import type { Retorno } from '../../domain/entities/retorno.js';
import type { RegistroWhatsapp } from '../../../whatsapp-itens/src/domain/entities/registro-whatsapp.js';

/**
 * Ports (inversão de dependência) — a camada de aplicação depende só
 * destas interfaces, nunca de `localStorage`/`fetch`/qualquer detalhe
 * concreto. `infrastructure/storage` implementa cada uma; trocar por
 * uma API remota no futuro significa escrever uma nova implementação
 * aqui, sem tocar em nenhum caso de uso.
 */

export interface RepositorioPacientes {
  salvar(paciente: Paciente): Promise<void>;
  buscarPorId(id: string): Promise<Paciente | undefined>;
  listarTodos(): Promise<Paciente[]>;
  remover(id: string): Promise<void>;
  /**
   * Busca por dígitos de CPF/RG — SEMPRE no servidor quando há um (a
   * resposta comum de `listarTodos()` nunca traz o valor completo pra
   * comparar no navegador). Opcional: quem não tem servidor (modo 100%
   * local) já tem o valor real em memória e nem precisa disto —
   * `ListarPacientes` trata a ausência deste método como "nenhum
   * resultado adicional por documento", nunca como erro.
   */
  buscarIdsPorDocumento?(termo: string): Promise<string[]>;
}

export interface RepositorioAnamneses {
  salvar(anamnese: Anamnese): Promise<void>;
  buscarPorPacienteId(pacienteId: string): Promise<Anamnese | undefined>;
  /** Todas as anamneses de todos os pacientes — hoje só usado por exportação de backup (`application/use-cases/backup.ts`). */
  listarTodos(): Promise<Anamnese[]>;
}

/**
 * Rascunho de anamnese em digitação — nunca é o registro clínico
 * oficial (esse é `RepositorioAnamneses`). Existe só pra recuperar
 * trabalho em andamento se a página fechar/atualizar antes de "Salvar
 * anamnese" (achado de revisão — persistência segura, Etapa 2
 * hardening adicional). Uma chave por paciente, sem histórico.
 */
export interface RepositorioRascunhoAnamnese {
  obter(pacienteId: string): Promise<SalvarAnamneseInput | undefined>;
  salvar(pacienteId: string, valores: SalvarAnamneseInput): Promise<void>;
  remover(pacienteId: string): Promise<void>;
}

export interface RepositorioRegistrosDentais {
  salvar(registro: RegistroDental): Promise<void>;
  listarPorPacienteId(pacienteId: string): Promise<RegistroDental[]>;
  remover(id: string): Promise<void>;
  /** Todos os registros de todos os pacientes — hoje só usado por exportação de backup. */
  listarTodos(): Promise<RegistroDental[]>;
}

export interface RepositorioPlanosTratamento {
  salvar(plano: PlanoTratamento): Promise<void>;
  buscarPorId(id: string): Promise<PlanoTratamento | undefined>;
  listarPorPacienteId(pacienteId: string): Promise<PlanoTratamento[]>;
  /** Todos os planos de todos os pacientes — hoje só usado por exportação de backup. */
  listarTodos(): Promise<PlanoTratamento[]>;
}

export interface RepositorioEvolucoes {
  salvar(evolucao: EvolucaoClinica): Promise<void>;
  listarPorPacienteId(pacienteId: string): Promise<EvolucaoClinica[]>;
  listarTodas(): Promise<EvolucaoClinica[]>;
}

export interface RepositorioConsultas {
  salvar(consulta: Consulta): Promise<void>;
  buscarPorId(id: string): Promise<Consulta | undefined>;
  listarPorPacienteId(pacienteId: string): Promise<Consulta[]>;
  /** Todas as consultas de todos os pacientes — agenda do consultório e exportação de backup. */
  listarTodas(): Promise<Consulta[]>;
}

/**
 * Dias bloqueados na Agenda (feriado, final de semana, dia avulso —
 * pedido do usuário). Um dia não pode ter dois bloqueios (o caso de
 * uso `BloquearDias` já evita duplicar), então `buscarPorId` basta pra
 * desbloquear; a Agenda e `AgendarConsulta`/`ReagendarConsulta` usam
 * `listarTodos` e filtram pela data em memória — o volume é baixo
 * (feriados/recessos, não milhares de linhas).
 */
export interface RepositorioBloqueiosAgenda {
  salvar(bloqueio: BloqueioAgenda): Promise<void>;
  buscarPorId(id: string): Promise<BloqueioAgenda | undefined>;
  listarTodos(): Promise<BloqueioAgenda[]>;
  remover(id: string): Promise<void>;
}

/** Nunca remove de verdade — ver `ProcedimentoCatalogo.desativar`. */
export interface RepositorioProcedimentosCatalogo {
  salvar(procedimento: ProcedimentoCatalogo): Promise<void>;
  buscarPorId(id: string): Promise<ProcedimentoCatalogo | undefined>;
  listarTodos(): Promise<ProcedimentoCatalogo[]>;
}

export interface RepositorioRetornos {
  salvar(retorno: Retorno): Promise<void>;
  buscarPorId(id: string): Promise<Retorno | undefined>;
  listarTodos(): Promise<Retorno[]>;
  listarPorPaciente(pacienteId: string): Promise<Retorno[]>;
  /** Usado só pra nunca gerar um segundo retorno automático pro mesmo item de orçamento concluído. */
  buscarPorItemTratamentoOrigemId(itemTratamentoOrigemId: string): Promise<Retorno | undefined>;
}

/** Nunca remove de verdade — segue o mesmo padrão de `RepositorioProcedimentosCatalogo`. */
export interface RepositorioCampanhasComemorativas {
  salvar(campanha: CampanhaComemorativa): Promise<void>;
  buscarPorId(id: string): Promise<CampanhaComemorativa | undefined>;
  listarTodas(): Promise<CampanhaComemorativa[]>;
}

export interface RepositorioMensagensCortesia {
  salvar(mensagem: MensagemCortesia): Promise<void>;
  buscarPorId(id: string): Promise<MensagemCortesia | undefined>;
  listarTodas(): Promise<MensagemCortesia[]>;
  /** Deduplicação por ano: existe uma mensagem deste tipo/paciente/campanha/ano? */
  buscarExistente(input: {
    tipo: 'ANIVERSARIO' | 'CAMPANHA';
    pacienteId: string;
    campanhaId: string | null;
    anoReferencia: number;
  }): Promise<MensagemCortesia | undefined>;
}

export interface RepositorioRegistrosWhatsapp {
  salvar(registro: RegistroWhatsapp): Promise<void>;
  listarPorPacienteId(pacienteId: string): Promise<RegistroWhatsapp[]>;
  /** Tudo — para o guard anti-spam (histórico do paciente) e para a exportação de backup. */
  listarTodos(): Promise<RegistroWhatsapp[]>;
}

/**
 * Links de anamnese compartilháveis. HOJE em `localStorage` — só valem
 * no mesmo navegador (protótipo local). Trocar por um adaptador HTTP
 * (submissão real entre dispositivos) é reimplementar esta interface,
 * sem tocar em caso de uso nem UI.
 */
export interface RepositorioLinksAnamnese {
  salvar(link: LinkAnamnese): Promise<void>;
  buscarPorToken(token: string): Promise<LinkAnamnese | undefined>;
  /** O link mais recente de um paciente (só existe um "corrente" por vez). */
  buscarPorPacienteId(pacienteId: string): Promise<LinkAnamnese | undefined>;
  listarTodos(): Promise<LinkAnamnese[]>;
}

/**
 * Metadados dos arquivos de um paciente (nome, tipo, tamanho,
 * categoria...). Vive no `localStorage` e ENTRA no backup. Os bytes
 * ficam separados, em `RepositorioBlobsArquivo`.
 */
export interface RepositorioArquivosPaciente {
  salvar(arquivo: ArquivoPaciente): Promise<void>;
  buscarPorId(id: string): Promise<ArquivoPaciente | undefined>;
  listarPorPacienteId(pacienteId: string): Promise<ArquivoPaciente[]>;
  remover(id: string): Promise<void>;
  listarTodos(): Promise<ArquivoPaciente[]>;
}

/**
 * Bytes dos arquivos, guardados à parte (IndexedDB no navegador — mais
 * espaço que o `localStorage` e feito para blobs). NÃO entra no backup
 * `.json`. Trocar por um storage de arquivos real (S3/servidor) é um
 * novo adaptador desta interface, sem tocar em caso de uso nem UI.
 */
export interface RepositorioBlobsArquivo {
  salvar(id: string, blob: Blob): Promise<void>;
  obter(id: string): Promise<Blob | undefined>;
  /** Checagem barata de presença — sem trazer os bytes. */
  existe(id: string): Promise<boolean>;
  remover(id: string): Promise<void>;
}
