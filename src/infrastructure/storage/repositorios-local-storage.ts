import { Anamnese, type AnamneseProps, type SalvarAnamneseInput } from '../../domain/entities/anamnese.js';
import { ArquivoPaciente, type ArquivoPacienteProps } from '../../domain/entities/arquivo-paciente.js';
import { BloqueioAgenda, type BloqueioAgendaProps } from '../../domain/entities/bloqueio-agenda.js';
import { CampanhaComemorativa, type CampanhaComemorativaProps } from '../../domain/entities/campanha-comemorativa.js';
import { Consulta, type ConsultaProps } from '../../domain/entities/consulta.js';
import { MensagemCortesia, type MensagemCortesiaProps } from '../../domain/entities/mensagem-cortesia.js';
import { EvolucaoClinica, type EvolucaoClinicaProps } from '../../domain/entities/evolucao-clinica.js';
import { LinkAnamnese, type LinkAnamneseProps } from '../../domain/entities/link-anamnese.js';
import { Paciente, type PacienteProps } from '../../domain/entities/paciente.js';
import { PlanoTratamento, type PlanoTratamentoProps } from '../../domain/entities/plano-tratamento.js';
import { ProcedimentoCatalogo, type ProcedimentoCatalogoProps } from '../../domain/entities/procedimento-catalogo.js';
import { RegistroDental, type RegistroDentalProps } from '../../domain/entities/registro-dental.js';
import { Retorno, type RetornoProps } from '../../domain/entities/retorno.js';
import { RegistroWhatsapp, type RegistroWhatsappProps } from '../../../whatsapp-itens/src/domain/entities/registro-whatsapp.js';
import type {
  RepositorioAnamneses,
  RepositorioArquivosPaciente,
  RepositorioBlobsArquivo,
  RepositorioBloqueiosAgenda,
  RepositorioCampanhasComemorativas,
  RepositorioConsultas,
  RepositorioEvolucoes,
  RepositorioLinksAnamnese,
  RepositorioMensagensCortesia,
  RepositorioPacientes,
  RepositorioPlanosTratamento,
  RepositorioProcedimentosCatalogo,
  RepositorioRascunhoAnamnese,
  RepositorioRegistrosDentais,
  RepositorioRegistrosWhatsapp,
  RepositorioRetornos,
} from '../../application/ports/repositorios.js';
import { LocalStorageCollection } from './local-storage-collection.js';

const PREFIXO_CHAVE = 'projfernanda';

export class LocalStoragePacienteRepository implements RepositorioPacientes {
  private readonly colecao = new LocalStorageCollection<PacienteProps>(`${PREFIXO_CHAVE}:pacientes`);

  async salvar(paciente: Paciente): Promise<void> {
    await this.colecao.salvar(paciente.toSnapshot() as PacienteProps);
  }

  async buscarPorId(id: string): Promise<Paciente | undefined> {
    const props = await this.colecao.buscarPorId(id);
    return props ? Paciente.restaurar(props) : undefined;
  }

  async listarTodos(): Promise<Paciente[]> {
    const todos = await this.colecao.listarTodos();
    return todos.map((props) => Paciente.restaurar(props));
  }

  async remover(id: string): Promise<void> {
    await this.colecao.remover(id);
  }
}

export class LocalStorageAnamneseRepository implements RepositorioAnamneses {
  private readonly colecao = new LocalStorageCollection<AnamneseProps>(`${PREFIXO_CHAVE}:anamneses`);

  async salvar(anamnese: Anamnese): Promise<void> {
    await this.colecao.salvar(anamnese.toSnapshot() as AnamneseProps);
  }

  async buscarPorPacienteId(pacienteId: string): Promise<Anamnese | undefined> {
    const todas = await this.colecao.filtrar((a) => a.pacienteId === pacienteId);
    const props = todas[0];
    return props ? Anamnese.restaurar(props) : undefined;
  }

  async listarTodos(): Promise<Anamnese[]> {
    const todas = await this.colecao.listarTodos();
    return todas.map((props) => Anamnese.restaurar(props));
  }
}

/**
 * Rascunho de anamnese em digitação (nunca o registro oficial) — uma
 * chave simples por paciente, sem passar pelo padrão de coleção
 * (`LocalStorageCollection`) porque não é uma lista, é um valor único
 * que se sobrescreve. Falha de leitura/escrita (armazenamento cheio,
 * indisponível, JSON corrompido) nunca lança erro — autosave é
 * "melhor esforço", nunca deve travar a digitação de quem está usando
 * o formulário.
 */
export class LocalStorageRascunhoAnamneseRepository implements RepositorioRascunhoAnamnese {
  private chave(pacienteId: string): string {
    return `${PREFIXO_CHAVE}:rascunho-anamnese:${pacienteId}`;
  }

  async obter(pacienteId: string): Promise<SalvarAnamneseInput | undefined> {
    if (typeof window === 'undefined' || !window.localStorage) return undefined;
    try {
      const bruto = window.localStorage.getItem(this.chave(pacienteId));
      if (!bruto) return undefined;
      return JSON.parse(bruto) as SalvarAnamneseInput;
    } catch {
      return undefined;
    }
  }

  async salvar(pacienteId: string, valores: SalvarAnamneseInput): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(this.chave(pacienteId), JSON.stringify(valores));
    } catch {
      // Armazenamento cheio/indisponível — ver comentário da classe.
    }
  }

  async remover(pacienteId: string): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem(this.chave(pacienteId));
    } catch {
      // Ignorado de propósito — remover um rascunho nunca deve travar o fluxo de salvar.
    }
  }
}

export class LocalStorageRegistroDentalRepository implements RepositorioRegistrosDentais {
  private readonly colecao = new LocalStorageCollection<RegistroDentalProps>(`${PREFIXO_CHAVE}:registros-dentais`);

  async salvar(registro: RegistroDental): Promise<void> {
    await this.colecao.salvar(registro.toSnapshot() as RegistroDentalProps);
  }

  async listarPorPacienteId(pacienteId: string): Promise<RegistroDental[]> {
    const lista = await this.colecao.filtrar((r) => r.pacienteId === pacienteId);
    return lista.map((props) => RegistroDental.restaurar(props));
  }

  async remover(id: string): Promise<void> {
    await this.colecao.remover(id);
  }

  async listarTodos(): Promise<RegistroDental[]> {
    const todos = await this.colecao.listarTodos();
    return todos.map((props) => RegistroDental.restaurar(props));
  }
}

export class LocalStoragePlanoTratamentoRepository implements RepositorioPlanosTratamento {
  private readonly colecao = new LocalStorageCollection<PlanoTratamentoProps>(`${PREFIXO_CHAVE}:planos-tratamento`);

  async salvar(plano: PlanoTratamento): Promise<void> {
    await this.colecao.salvar(plano.toSnapshot() as PlanoTratamentoProps);
  }

  async buscarPorId(id: string): Promise<PlanoTratamento | undefined> {
    const props = await this.colecao.buscarPorId(id);
    return props ? PlanoTratamento.restaurar(props) : undefined;
  }

  async listarPorPacienteId(pacienteId: string): Promise<PlanoTratamento[]> {
    const lista = await this.colecao.filtrar((p) => p.pacienteId === pacienteId);
    return lista.map((props) => PlanoTratamento.restaurar(props));
  }

  async listarTodos(): Promise<PlanoTratamento[]> {
    const todos = await this.colecao.listarTodos();
    return todos.map((props) => PlanoTratamento.restaurar(props));
  }
}

export class LocalStorageEvolucaoRepository implements RepositorioEvolucoes {
  private readonly colecao = new LocalStorageCollection<EvolucaoClinicaProps>(`${PREFIXO_CHAVE}:evolucoes`);

  async salvar(evolucao: EvolucaoClinica): Promise<void> {
    await this.colecao.salvar(evolucao.toSnapshot() as EvolucaoClinicaProps);
  }

  async listarPorPacienteId(pacienteId: string): Promise<EvolucaoClinica[]> {
    const lista = await this.colecao.filtrar((e) => e.pacienteId === pacienteId);
    return lista.map((props) => EvolucaoClinica.restaurar(props));
  }

  async listarTodas(): Promise<EvolucaoClinica[]> {
    const lista = await this.colecao.listarTodos();
    return lista.map((props) => EvolucaoClinica.restaurar(props));
  }
}

export class LocalStorageConsultaRepository implements RepositorioConsultas {
  private readonly colecao = new LocalStorageCollection<ConsultaProps>(`${PREFIXO_CHAVE}:consultas`);

  async salvar(consulta: Consulta): Promise<void> {
    await this.colecao.salvar(consulta.toSnapshot() as ConsultaProps);
  }

  async buscarPorId(id: string): Promise<Consulta | undefined> {
    const props = await this.colecao.buscarPorId(id);
    return props ? Consulta.restaurar(props) : undefined;
  }

  async listarPorPacienteId(pacienteId: string): Promise<Consulta[]> {
    const lista = await this.colecao.filtrar((c) => c.pacienteId === pacienteId);
    return lista.map((props) => Consulta.restaurar(props));
  }

  async listarTodas(): Promise<Consulta[]> {
    const lista = await this.colecao.listarTodos();
    return lista.map((props) => Consulta.restaurar(props));
  }
}

export class LocalStorageBloqueioAgendaRepository implements RepositorioBloqueiosAgenda {
  private readonly colecao = new LocalStorageCollection<BloqueioAgendaProps>(`${PREFIXO_CHAVE}:bloqueios-agenda`);

  async salvar(bloqueio: BloqueioAgenda): Promise<void> {
    await this.colecao.salvar(bloqueio.toSnapshot() as BloqueioAgendaProps);
  }

  async buscarPorId(id: string): Promise<BloqueioAgenda | undefined> {
    const props = await this.colecao.buscarPorId(id);
    return props ? BloqueioAgenda.restaurar(props) : undefined;
  }

  async listarTodos(): Promise<BloqueioAgenda[]> {
    const todos = await this.colecao.listarTodos();
    return todos.map((props) => BloqueioAgenda.restaurar(props));
  }

  async remover(id: string): Promise<void> {
    await this.colecao.remover(id);
  }
}

export class LocalStorageProcedimentoCatalogoRepository implements RepositorioProcedimentosCatalogo {
  private readonly colecao = new LocalStorageCollection<ProcedimentoCatalogoProps>(`${PREFIXO_CHAVE}:procedimentos-catalogo`);

  async salvar(procedimento: ProcedimentoCatalogo): Promise<void> {
    await this.colecao.salvar(procedimento.toSnapshot() as ProcedimentoCatalogoProps);
  }

  async buscarPorId(id: string): Promise<ProcedimentoCatalogo | undefined> {
    const props = await this.colecao.buscarPorId(id);
    return props ? ProcedimentoCatalogo.restaurar(props) : undefined;
  }

  async listarTodos(): Promise<ProcedimentoCatalogo[]> {
    const todos = await this.colecao.listarTodos();
    return todos.map((props) => ProcedimentoCatalogo.restaurar(props));
  }
}

export class LocalStorageRetornoRepository implements RepositorioRetornos {
  private readonly colecao = new LocalStorageCollection<RetornoProps>(`${PREFIXO_CHAVE}:retornos`);

  async salvar(retorno: Retorno): Promise<void> {
    await this.colecao.salvar(retorno.toSnapshot() as RetornoProps);
  }

  async buscarPorId(id: string): Promise<Retorno | undefined> {
    const props = await this.colecao.buscarPorId(id);
    return props ? Retorno.restaurar(props) : undefined;
  }

  async listarTodos(): Promise<Retorno[]> {
    const todos = await this.colecao.listarTodos();
    return todos.map((props) => Retorno.restaurar(props));
  }

  async listarPorPaciente(pacienteId: string): Promise<Retorno[]> {
    const todos = await this.listarTodos();
    return todos.filter((r) => r.pacienteId === pacienteId);
  }

  async buscarPorItemTratamentoOrigemId(itemTratamentoOrigemId: string): Promise<Retorno | undefined> {
    const todos = await this.listarTodos();
    return todos.find((r) => r.itemTratamentoOrigemId === itemTratamentoOrigemId);
  }
}

export class LocalStorageCampanhaComemorativaRepository implements RepositorioCampanhasComemorativas {
  private readonly colecao = new LocalStorageCollection<CampanhaComemorativaProps>(`${PREFIXO_CHAVE}:campanhas-comemorativas`);

  async salvar(campanha: CampanhaComemorativa): Promise<void> {
    await this.colecao.salvar(campanha.toSnapshot() as CampanhaComemorativaProps);
  }

  async buscarPorId(id: string): Promise<CampanhaComemorativa | undefined> {
    const props = await this.colecao.buscarPorId(id);
    return props ? CampanhaComemorativa.restaurar(props) : undefined;
  }

  async listarTodas(): Promise<CampanhaComemorativa[]> {
    const todas = await this.colecao.listarTodos();
    return todas.map((props) => CampanhaComemorativa.restaurar(props));
  }
}

export class LocalStorageMensagemCortesiaRepository implements RepositorioMensagensCortesia {
  private readonly colecao = new LocalStorageCollection<MensagemCortesiaProps>(`${PREFIXO_CHAVE}:mensagens-cortesia`);

  async salvar(mensagem: MensagemCortesia): Promise<void> {
    await this.colecao.salvar(mensagem.toSnapshot() as MensagemCortesiaProps);
  }

  async buscarPorId(id: string): Promise<MensagemCortesia | undefined> {
    const props = await this.colecao.buscarPorId(id);
    return props ? MensagemCortesia.restaurar(props) : undefined;
  }

  async listarTodas(): Promise<MensagemCortesia[]> {
    const todas = await this.colecao.listarTodos();
    return todas.map((props) => MensagemCortesia.restaurar(props));
  }

  async buscarExistente(input: {
    tipo: 'ANIVERSARIO' | 'CAMPANHA';
    pacienteId: string;
    campanhaId: string | null;
    anoReferencia: number;
  }): Promise<MensagemCortesia | undefined> {
    const todas = await this.listarTodas();
    return todas.find(
      (m) =>
        m.tipo === input.tipo &&
        m.pacienteId === input.pacienteId &&
        m.campanhaId === input.campanhaId &&
        m.anoReferencia === input.anoReferencia,
    );
  }
}

export class LocalStorageRegistroWhatsappRepository implements RepositorioRegistrosWhatsapp {
  private readonly colecao = new LocalStorageCollection<RegistroWhatsappProps>(`${PREFIXO_CHAVE}:registros-whatsapp`);

  async salvar(registro: RegistroWhatsapp): Promise<void> {
    await this.colecao.salvar(registro.toSnapshot() as RegistroWhatsappProps);
  }

  async listarPorPacienteId(pacienteId: string): Promise<RegistroWhatsapp[]> {
    const lista = await this.colecao.filtrar((r) => r.pacienteId === pacienteId);
    return lista.map((props) => RegistroWhatsapp.restaurar(props));
  }

  async listarTodos(): Promise<RegistroWhatsapp[]> {
    const lista = await this.colecao.listarTodos();
    return lista.map((props) => RegistroWhatsapp.restaurar(props));
  }
}

export class LocalStorageArquivoPacienteRepository implements RepositorioArquivosPaciente {
  private readonly colecao = new LocalStorageCollection<ArquivoPacienteProps>(`${PREFIXO_CHAVE}:arquivos-paciente`);

  async salvar(arquivo: ArquivoPaciente): Promise<void> {
    await this.colecao.salvar(arquivo.toSnapshot() as ArquivoPacienteProps);
  }

  async buscarPorId(id: string): Promise<ArquivoPaciente | undefined> {
    const props = await this.colecao.buscarPorId(id);
    return props ? ArquivoPaciente.restaurar(props) : undefined;
  }

  async listarPorPacienteId(pacienteId: string): Promise<ArquivoPaciente[]> {
    const lista = await this.colecao.filtrar((a) => a.pacienteId === pacienteId);
    return lista.map((props) => ArquivoPaciente.restaurar(props));
  }

  async remover(id: string): Promise<void> {
    await this.colecao.remover(id);
  }

  async listarTodos(): Promise<ArquivoPaciente[]> {
    const lista = await this.colecao.listarTodos();
    return lista.map((props) => ArquivoPaciente.restaurar(props));
  }
}

/**
 * Bytes dos arquivos no IndexedDB deste navegador — mais espaço que o
 * `localStorage` (que é ~5 MB e compartilhado) e feito para blobs.
 * Continua sendo armazenamento LOCAL: só existe neste dispositivo, não
 * vai no backup `.json`, e some se os dados do site forem limpos.
 * Fora do navegador (testes em Node) vira no-op silencioso.
 */
export class IndexedDbBlobArquivoRepository implements RepositorioBlobsArquivo {
  private readonly nomeBanco = `${PREFIXO_CHAVE}-arquivos`;
  private readonly store = 'blobs';
  private bancoPromessa: Promise<IDBDatabase> | null = null;

  private abrir(): Promise<IDBDatabase> {
    if (this.bancoPromessa) return this.bancoPromessa;
    this.bancoPromessa = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB indisponível'));
        return;
      }
      const req = indexedDB.open(this.nomeBanco, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(this.store)) req.result.createObjectStore(this.store);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Falha ao abrir IndexedDB'));
    });
    return this.bancoPromessa;
  }

  private async operar<T>(
    modo: 'readonly' | 'readwrite',
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T | undefined> {
    let banco: IDBDatabase;
    try {
      banco = await this.abrir();
    } catch {
      return undefined; // ambiente sem IndexedDB — degradação silenciosa
    }
    return new Promise<T | undefined>((resolve, reject) => {
      const tx = banco.transaction(this.store, modo);
      const req = fn(tx.objectStore(this.store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Falha na operação de IndexedDB'));
    });
  }

  async salvar(id: string, blob: Blob): Promise<void> {
    await this.operar('readwrite', (store) => store.put(blob, id));
  }

  async obter(id: string): Promise<Blob | undefined> {
    const resultado = await this.operar<Blob>('readonly', (store) => store.get(id));
    return resultado instanceof Blob ? resultado : undefined;
  }

  async existe(id: string): Promise<boolean> {
    const total = await this.operar<number>('readonly', (store) => store.count(id));
    return (total ?? 0) > 0;
  }

  async remover(id: string): Promise<void> {
    await this.operar('readwrite', (store) => store.delete(id));
  }
}

export class LocalStorageLinkAnamneseRepository implements RepositorioLinksAnamnese {
  private readonly colecao = new LocalStorageCollection<LinkAnamneseProps>(`${PREFIXO_CHAVE}:links-anamnese`);

  async salvar(link: LinkAnamnese): Promise<void> {
    await this.colecao.salvar(link.toSnapshot() as LinkAnamneseProps);
  }

  async buscarPorToken(token: string): Promise<LinkAnamnese | undefined> {
    const [props] = await this.colecao.filtrar((l) => l.token === token);
    return props ? LinkAnamnese.restaurar(props) : undefined;
  }

  async buscarPorPacienteId(pacienteId: string): Promise<LinkAnamnese | undefined> {
    const lista = await this.colecao.filtrar((l) => l.pacienteId === pacienteId);
    const maisRecente = [...lista].sort(
      (a, b) => b.criadoEm.localeCompare(a.criadoEm) || b.id.localeCompare(a.id),
    )[0];
    return maisRecente ? LinkAnamnese.restaurar(maisRecente) : undefined;
  }

  async listarTodos(): Promise<LinkAnamnese[]> {
    const lista = await this.colecao.listarTodos();
    return lista.map((props) => LinkAnamnese.restaurar(props));
  }
}
