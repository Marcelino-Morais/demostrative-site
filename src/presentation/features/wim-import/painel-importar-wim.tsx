import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RadioTower, RefreshCw, ScanLine, X } from 'lucide-react';
import type { GrupoAquisicaoWim } from '../../../application/use-cases/wim-import.js';
import type { WimCandidato, WimImportStatus } from '../../../application/ports/gateway-wim-import.js';
import { ErroApi } from '../../../application/ports/api-client.js';
import { Alert, type AlertTone } from '../../components/ui/alert.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { EmptyState } from '../../components/ui/empty-state.js';
import { Spinner } from '../../components/ui/spinner.js';
import { formatarDataHoraIso } from '../../lib/formatadores.js';
import { useContainer } from '../../providers/container-provider.js';

/**
 * Painel "Importar radiografia do WIM" (Etapa 61, Fase 3) — dentro da aba
 * Arquivos do paciente já aberto. NUNCA associa paciente sozinho: o
 * candidato só é anexado depois de o usuário abrir esta tela, ver o preview
 * e clicar explicitamente em "Confirmar importação". `wimPatientId`/
 * `wimExamId` do candidato aparecem só como metadado cinza, nunca usados
 * para pré-selecionar nada.
 */

const JANELA_MINUTOS_PADRAO = 120;

interface Props {
  pacienteId: string;
  pacienteNome: string;
  /** Chamado depois de uma importação bem-sucedida, para a lista de arquivos recarregar. */
  aoImportar: () => void;
}

/**
 * Os 4 estados pedidos: desligado / pasta indisponível / parado / erro —
 * nunca um painel de diagnóstico grande, só o suficiente pra explicar por
 * que nenhuma radiografia recente está aparecendo. `null` = tudo certo
 * (conectado e monitorando), não mostra nada.
 */
function estadoWatcherWim(status: WimImportStatus): { tom: AlertTone; texto: string } | null {
  if (!status.habilitado) {
    return { tom: 'brand', texto: 'A importação automática do WIM ainda não está ativada nesta instalação.' };
  }
  if (status.configuracaoInvalida) {
    return { tom: 'danger', texto: 'A pasta do WIM está configurada incorretamente. Avise o suporte técnico.' };
  }
  if (!status.pastaDisponivel) {
    return { tom: 'warning', texto: 'A pasta do WIM não está acessível agora. Novas radiografias não aparecerão até ela voltar.' };
  }
  if (!status.watcherAtivo) {
    return { tom: 'warning', texto: 'O serviço de importação do WIM está parado.' };
  }
  if (status.ultimoErro) {
    return { tom: 'warning', texto: 'O WIM relatou um erro recente. Novas radiografias podem não aparecer.' };
  }
  return null;
}

export function PainelImportarWim({ pacienteId, pacienteNome, aoImportar }: Props) {
  const container = useContainer();
  const [aberto, setAberto] = useState(false);
  const [status, setStatus] = useState<WimImportStatus | null>(null);
  const [grupos, setGrupos] = useState<GrupoAquisicaoWim[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Grupo/variante em confirmação (a tela de "você tem certeza").
  const [emConfirmacao, setEmConfirmacao] = useState<WimCandidato | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [mensagemOk, setMensagemOk] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [s, g] = await Promise.all([
        container.wimImport.status.executar(),
        container.wimImport.listarCandidatos.executar(JANELA_MINUTOS_PADRAO),
      ]);
      setStatus(s);
      setGrupos(g);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível consultar o WIM agora.');
    } finally {
      setCarregando(false);
    }
  }, [container]);

  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  useEffect(() => {
    if (!emConfirmacao) {
      setPreviewUrl(null);
      return;
    }
    let cancelado = false;
    let urlCriada: string | null = null;
    void container.wimImport.obterPreview.executar(emConfirmacao.id).then((blob) => {
      if (cancelado || !blob) return;
      urlCriada = URL.createObjectURL(blob);
      setPreviewUrl(urlCriada);
    });
    return () => {
      cancelado = true;
      if (urlCriada) URL.revokeObjectURL(urlCriada);
    };
  }, [container, emConfirmacao]);

  async function confirmar(): Promise<void> {
    if (!emConfirmacao) return;
    setConfirmando(true);
    setErro(null);
    try {
      await container.wimImport.confirmarImportacao.executar(pacienteId, emConfirmacao.id);
      setMensagemOk('Radiografia importada para este paciente.');
      setEmConfirmacao(null);
      aoImportar();
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível importar esta radiografia.');
    } finally {
      setConfirmando(false);
    }
  }

  async function ignorar(candidatoId: string): Promise<void> {
    setErro(null);
    try {
      await container.wimImport.ignorar.executar(candidatoId);
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível dispensar esta radiografia.');
    }
  }

  if (!aberto) {
    return (
      <Button variant="secondary" onClick={() => setAberto(true)} className="self-start">
        <ScanLine className="h-3.5 w-3.5" aria-hidden="true" /> Importar radiografia do WIM
      </Button>
    );
  }

  const avisoWatcher = status ? estadoWatcherWim(status) : null;

  return (
    <Card className="no-print flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <RadioTower className="h-4 w-4" aria-hidden="true" /> Importar radiografia do WIM
        </h3>
        <div className="flex gap-1.5">
          <Button variant="secondary" onClick={() => void carregar()} className="text-xs" disabled={carregando}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Atualizar
          </Button>
          <Button variant="secondary" onClick={() => setAberto(false)} className="text-xs">
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Fechar
          </Button>
        </div>
      </div>

      {erro && <Alert tone="danger">{erro}</Alert>}
      {mensagemOk && <Alert tone="success">{mensagemOk}</Alert>}
      {avisoWatcher && (
        <Alert tone={avisoWatcher.tom} title="WIM">
          {avisoWatcher.tom !== 'brand' && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
          {avisoWatcher.texto}
        </Alert>
      )}

      {emConfirmacao ? (
        <div className="flex flex-col gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
          <p className="text-sm text-neutral-600">
            Paciente: <span className="font-semibold text-neutral-900">{pacienteNome}</span>
          </p>
          <p className="text-xs text-neutral-500">
            Radiografia detectada às {formatarDataHoraIso(emConfirmacao.detectadoEm)}
            {' · '}
            {emConfirmacao.papel === 'FILTERED' ? 'Filtrada' : 'Original'}
            {emConfirmacao.largura && emConfirmacao.altura ? ` · ${emConfirmacao.largura}×${emConfirmacao.altura}` : ''}
          </p>
          <div className="flex justify-center rounded-md bg-white p-2">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview da radiografia detectada no WIM" className="max-h-64 rounded" />
            ) : (
              <Spinner label="Carregando preview…" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void confirmar()} loading={confirmando} className="font-semibold">
              Confirmar importação para {pacienteNome}
            </Button>
            <Button variant="secondary" onClick={() => setEmConfirmacao(null)} disabled={confirmando}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <>
          {carregando && !grupos && (
            <div className="flex justify-center py-6">
              <Spinner label="Consultando o WIM…" />
            </div>
          )}
          {grupos && grupos.length === 0 && !avisoWatcher && (
            <EmptyState
              title="Nenhuma radiografia recente do WIM"
              description={`Nenhuma captura pronta apareceu nos últimos ${JANELA_MINUTOS_PADRAO} minutos.`}
            />
          )}
          {grupos && grupos.length > 0 && (
            <ul className="flex flex-col divide-y divide-neutral-100">
              {grupos.map((grupo) => (
                <li key={grupo.chave} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-800">
                      Detectada às {formatarDataHoraIso(grupo.padrao.detectadoEm)}
                      {grupo.padrao.largura && grupo.padrao.altura ? ` · ${grupo.padrao.largura}×${grupo.padrao.altura}` : ''}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {grupo.original && grupo.filtrada ? 'Original + filtrada disponíveis' : grupo.padrao.papel === 'FILTERED' ? 'Filtrada' : 'Original'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {grupo.original && (
                      <Button variant="secondary" className="text-xs" onClick={() => setEmConfirmacao(grupo.original)}>
                        Usar original
                      </Button>
                    )}
                    {grupo.filtrada && (
                      <Button variant="secondary" className="text-xs" onClick={() => setEmConfirmacao(grupo.filtrada)}>
                        Usar filtrada
                      </Button>
                    )}
                    {!grupo.original && !grupo.filtrada && (
                      <Button variant="secondary" className="text-xs" onClick={() => setEmConfirmacao(grupo.padrao)}>
                        Ver e importar
                      </Button>
                    )}
                    <Button variant="secondary" className="text-xs" onClick={() => void ignorar(grupo.padrao.id)}>
                      Dispensar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
