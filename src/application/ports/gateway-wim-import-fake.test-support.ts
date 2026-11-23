/**
 * `GatewayWimImport` falso para os testes dos casos de uso da importação
 * do WIM (Etapa 61). Guarda candidatos em memória; reproduz as mesmas
 * regras de recusa do servidor real (não-PRONTO, já importado para outro
 * paciente) o suficiente para os casos de uso serem testados sem HTTP.
 * Nunca importado pela apresentação.
 */
import { ErroApi } from './api-client.js';
import type { GatewayWimImport, WimCandidato, WimImportStatus } from './gateway-wim-import.js';

export class FakeGatewayWimImport implements GatewayWimImport {
  candidatos = new Map<string, WimCandidato>();
  importados = new Map<string, { pacienteId: string; arquivoId: string }>();
  previews = new Map<string, Blob>();
  statusAtual: WimImportStatus = {
    habilitado: true,
    pastaDisponivel: true,
    watcherAtivo: true,
    configuracaoInvalida: null,
    ultimoErro: null,
    totalCandidatos: 0,
    prontosCount: 0,
  };

  async status(): Promise<WimImportStatus> {
    return this.statusAtual;
  }

  async listarRecentes(): Promise<WimCandidato[]> {
    return [...this.candidatos.values()].filter((c) => c.status === 'PRONTO');
  }

  async obterPreview(candidatoId: string): Promise<Blob | null> {
    return this.previews.get(candidatoId) ?? null;
  }

  async confirmarImportacao(pacienteId: string, candidatoId: string): Promise<{ arquivoId: string }> {
    const candidato = this.candidatos.get(candidatoId);
    if (!candidato) throw new ErroApi('não encontrado', 404, 'nao-encontrado');
    const jaImportado = this.importados.get(candidatoId);
    if (jaImportado) {
      if (jaImportado.pacienteId === pacienteId) return { arquivoId: jaImportado.arquivoId };
      throw new ErroApi('já importado para outro paciente', 409, 'JA_IMPORTADO_OUTRO_PACIENTE');
    }
    if (candidato.status !== 'PRONTO') throw new ErroApi('não pronto', 409, 'NAO_PRONTO');
    const arquivoId = `arquivo-${candidatoId}`;
    this.importados.set(candidatoId, { pacienteId, arquivoId });
    this.candidatos.set(candidatoId, { ...candidato, status: 'IMPORTADO' });
    return { arquivoId };
  }

  async ignorar(candidatoId: string): Promise<void> {
    const candidato = this.candidatos.get(candidatoId);
    if (!candidato) throw new ErroApi('não encontrado', 404, 'nao-encontrado');
    if (candidato.status !== 'PRONTO') throw new ErroApi('não pronto', 409, 'NAO_PRONTO');
    this.candidatos.set(candidatoId, { ...candidato, status: 'IGNORADO_PELO_USUARIO' });
  }
}

export function candidatoWimFake(over: Partial<WimCandidato> = {}): WimCandidato {
  return {
    id: over.id ?? `cand-${Math.random().toString(36).slice(2)}`,
    wimPatientId: 7,
    wimExamId: 501,
    arquivo: '11_original.png',
    papel: 'ORIGINAL',
    chaveAquisicao: null,
    detectadoEm: '2026-09-19T10:00:00.000Z',
    estavelEm: '2026-09-19T10:00:02.000Z',
    escritoEm: '2026-09-19T10:00:01.000Z',
    tamanhoBytes: 12345,
    hash: 'a'.repeat(64),
    formato: 'PNG',
    largura: 1300,
    altura: 1800,
    status: 'PRONTO',
    ...over,
  };
}
