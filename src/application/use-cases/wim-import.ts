import type { GatewayWimImport, WimCandidato, WimImportStatus } from '../ports/gateway-wim-import.js';

/**
 * Casos de uso da importação de radiografias do WIM Dental (Etapa 61).
 * Finos de propósito — o servidor já validou/deduplicou/decidiu tudo; o
 * único trabalho novo aqui é agrupar `_original`/`_filtered` da MESMA
 * captura para a tela não mostrar como duas radiografias soltas.
 */

export interface GrupoAquisicaoWim {
  /** `chaveAquisicao` do servidor, ou o próprio id do candidato quando ele não tem par (avulso). */
  chave: string;
  original: WimCandidato | null;
  filtrada: WimCandidato | null;
  /** Papel desconhecido, sem par original/filtered — mostrado como item avulso. */
  avulsos: WimCandidato[];
  /** Candidato pré-selecionado no card: original sempre que existir. */
  padrao: WimCandidato;
}

/**
 * Agrupa candidatos por `chaveAquisicao` (original + filtered da mesma
 * captura viram um card só) e escolhe `original` como seleção padrão —
 * nunca `filtered` por padrão. Mais recente primeiro. Pura, sem I/O —
 * testável sem servidor.
 */
export function agruparCandidatosWim(candidatos: WimCandidato[]): GrupoAquisicaoWim[] {
  const porChave = new Map<string, WimCandidato[]>();
  const semChave: WimCandidato[] = [];

  for (const c of candidatos) {
    if (c.chaveAquisicao) {
      const lista = porChave.get(c.chaveAquisicao) ?? [];
      lista.push(c);
      porChave.set(c.chaveAquisicao, lista);
    } else {
      semChave.push(c);
    }
  }

  const grupos: GrupoAquisicaoWim[] = [];

  for (const [chave, itens] of porChave) {
    const original = itens.find((c) => c.papel === 'ORIGINAL') ?? null;
    const filtrada = itens.find((c) => c.papel === 'FILTERED') ?? null;
    const avulsos = itens.filter((c) => c !== original && c !== filtrada);
    const padrao = original ?? filtrada ?? avulsos[0];
    if (padrao) grupos.push({ chave, original, filtrada, avulsos, padrao });
  }

  for (const c of semChave) {
    grupos.push({
      chave: c.id,
      original: c.papel === 'ORIGINAL' ? c : null,
      filtrada: c.papel === 'FILTERED' ? c : null,
      avulsos: c.papel === 'ORIGINAL' || c.papel === 'FILTERED' ? [] : [c],
      padrao: c,
    });
  }

  return grupos.sort((a, b) => b.padrao.detectadoEm.localeCompare(a.padrao.detectadoEm));
}

export class ObterStatusWimImport {
  constructor(private readonly gateway: GatewayWimImport) {}
  executar(): Promise<WimImportStatus> {
    return this.gateway.status();
  }
}

export class ListarCandidatosWimImport {
  constructor(private readonly gateway: GatewayWimImport) {}
  async executar(janelaMinutos?: number): Promise<GrupoAquisicaoWim[]> {
    const candidatos = await this.gateway.listarRecentes(janelaMinutos);
    return agruparCandidatosWim(candidatos);
  }
}

export class ObterPreviewCandidatoWim {
  constructor(private readonly gateway: GatewayWimImport) {}
  executar(candidatoId: string): Promise<Blob | null> {
    return this.gateway.obterPreview(candidatoId);
  }
}

export class ConfirmarImportacaoWim {
  constructor(private readonly gateway: GatewayWimImport) {}
  /**
   * `pacienteId` vem SEMPRE do paciente já aberto na tela — nunca de
   * `wimPatientId`. Ver `wim-watched-folder-design.spec.md` "Patient
   * Association" — a associação é sempre uma ação humana explícita.
   */
  executar(pacienteId: string, candidatoId: string): Promise<{ arquivoId: string }> {
    return this.gateway.confirmarImportacao(pacienteId, candidatoId);
  }
}

export class IgnorarCandidatoWim {
  constructor(private readonly gateway: GatewayWimImport) {}
  executar(candidatoId: string): Promise<void> {
    return this.gateway.ignorar(candidatoId);
  }
}
