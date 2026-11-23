import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
import type { ArquivoNaLista } from '../../../application/use-cases/arquivos-paciente.js';
import type { CategoriaArquivo } from '../../../domain/entities/arquivo-paciente.js';
import { ErroApi } from '../../../application/ports/api-client.js';
import { Alert } from '../../components/ui/alert.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { formatarDataIso } from '../../lib/formatadores.js';
import { useContainer } from '../../providers/container-provider.js';

/**
 * Lixeira e recuperação (continuação da reconstrução do WIM VITOR —
 * item explícito desta rodada). Exclusão normal (botão "Remover"/"Mover
 * para lixeira" nas abas Exames/Arquivos) nunca apaga nada de verdade;
 * este painel é o único lugar que (a) restaura um item de volta à
 * listagem normal, ou (b) apaga de verdade, permanentemente — ação
 * irreversível, sempre com confirmação explícita.
 *
 * Investigado o comportamento do ORIGINAL (`RecycleForm`/`XRAY_RECYCLE`,
 * ver `PARITY_MATRIX.md`): ele é mais cru que isto — "restaurar" lá é só
 * exportar uma cópia da imagem original pra um lugar escolhido pelo
 * usuário (nunca volta pro registro clínico) e QUALQUER exclusão destrói
 * as anotações sem lixeira própria pra elas. Esta lixeira é uma melhoria
 * deliberada: restaura de volta à ficha de verdade, e as anotações
 * sobrevivem à exclusão normal (só se perdem na exclusão PERMANENTE).
 *
 * Fechada por padrão — só aparece quando há algo para mostrar, pra não
 * poluir a tela no dia a dia.
 */
export function PainelLixeira({
  pacienteId,
  categoriaFiltro,
  aoRestaurar,
}: {
  pacienteId: string;
  categoriaFiltro?: CategoriaArquivo;
  aoRestaurar: () => void;
}) {
  const container = useContainer();
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<ArquivoNaLista[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [emAcao, setEmAcao] = useState<string | null>(null);
  const [confirmandoPermanente, setConfirmandoPermanente] = useState<string | null>(null);
  const [chave, setChave] = useState(0);

  const carregar = useCallback(async () => {
    try {
      const todos = await container.arquivosRemoto.listarLixeira.executar(pacienteId);
      setLista(categoriaFiltro ? todos.filter((i) => i.props.categoria === categoriaFiltro) : todos);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível carregar a lixeira.');
    }
  }, [container, pacienteId, categoriaFiltro]);

  useEffect(() => {
    void carregar();
  }, [carregar, chave]);

  const recarregar = useCallback(() => setChave((k) => k + 1), []);

  async function restaurar(id: string): Promise<void> {
    setEmAcao(id);
    setErro(null);
    try {
      await container.arquivosRemoto.restaurar.executar(id);
      recarregar();
      aoRestaurar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível restaurar este arquivo.');
    } finally {
      setEmAcao(null);
    }
  }

  async function excluirPermanente(id: string): Promise<void> {
    setEmAcao(id);
    setErro(null);
    setConfirmandoPermanente(null);
    try {
      await container.arquivosRemoto.removerPermanente.executar(id);
      recarregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível excluir este arquivo permanentemente.');
    } finally {
      setEmAcao(null);
    }
  }

  const total = lista?.length ?? 0;
  if (total === 0 && !aberto) return null; // nada na lixeira — não poluir a tela

  return (
    <Card className="flex flex-col gap-2 border-dashed">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="flex items-center gap-2 text-left text-sm font-semibold text-neutral-700"
      >
        {aberto ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
        Lixeira {total > 0 ? `(${total})` : ''}
      </button>
      {aberto && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-neutral-500">
            Itens removidos ficam aqui até serem restaurados ou excluídos permanentemente (ação que não pode ser
            desfeita).
          </p>
          {erro && <Alert tone="danger">{erro}</Alert>}
          {lista === null && <p className="text-xs text-neutral-400">Carregando…</p>}
          {lista && lista.length === 0 && <p className="text-xs text-neutral-400">A lixeira está vazia.</p>}
          {lista &&
            lista.map((item) => (
              <div key={item.props.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 p-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-neutral-800">{item.props.descricao || item.props.nome}</p>
                  <p className="text-xs text-neutral-500">
                    {formatarDataIso(item.props.data)} · excluído em {formatarDataIso((item.props.excluidoEm ?? '').slice(0, 10))}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    variant="secondary"
                    className="text-xs"
                    loading={emAcao === item.props.id}
                    onClick={() => void restaurar(item.props.id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Restaurar
                  </Button>
                  {confirmandoPermanente === item.props.id ? (
                    <>
                      <span className="text-xs text-danger-600">Excluir para sempre?</span>
                      <Button variant="danger" className="text-xs" loading={emAcao === item.props.id} onClick={() => void excluirPermanente(item.props.id)}>
                        Confirmar
                      </Button>
                      <Button variant="secondary" className="text-xs" onClick={() => setConfirmandoPermanente(null)}>
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <Button variant="danger" className="text-xs" onClick={() => setConfirmandoPermanente(item.props.id)}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Excluir permanentemente
                    </Button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </Card>
  );
}
