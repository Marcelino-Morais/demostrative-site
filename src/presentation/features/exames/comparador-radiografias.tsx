import { useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import type { ArquivoNaLista } from '../../../application/use-cases/arquivos-paciente.js';
import { Button } from '../../components/ui/button.js';
import { Select } from '../../components/ui/input.js';
import { formatarDataIso } from '../../lib/formatadores.js';
import { aplicarZoom, cssTransform, ESTADO_VISUALIZACAO_PADRAO, type EstadoVisualizacao } from './transformacao-visualizacao.js';

/**
 * Comparação lado a lado (continuação da reconstrução do WIM VITOR —
 * equivalente simplificado ao `CompareComponent`/`btnSideBySide` do
 * original; o efeito de wipe/slider do original não foi reproduzido
 * nesta rodada, só a visão lado a lado). Exibe DATA e ORIGEM (a
 * "versão": original importado do WIM vs. anexado manualmente, etc.) de
 * cada imagem escolhida.
 *
 * As DUAS imagens só podem vir de `opcoes` — a lista de radiografias do
 * PACIENTE ATUAL já carregada pela aba (ver `aba-exames.tsx`, que busca
 * por `pacienteId` no servidor). Não existe campo de texto nem parâmetro
 * de URL para digitar/colar um id de arquivo arbitrário — a única forma
 * de uma imagem aparecer aqui é já estar nesta lista, o que, por
 * construção, nunca inclui um arquivo de outro paciente.
 */
export function ComparadorRadiografias({
  aberto,
  onFechar,
  opcoes,
  urls,
}: {
  aberto: boolean;
  onFechar: () => void;
  opcoes: ArquivoNaLista[];
  urls: Record<string, string>;
}) {
  const [idEsquerda, setIdEsquerda] = useState(opcoes[0]?.props.id ?? '');
  const [idDireita, setIdDireita] = useState(opcoes[1]?.props.id ?? opcoes[0]?.props.id ?? '');
  const [estadoEsquerda, setEstadoEsquerda] = useState<EstadoVisualizacao>(ESTADO_VISUALIZACAO_PADRAO);
  const [estadoDireita, setEstadoDireita] = useState<EstadoVisualizacao>(ESTADO_VISUALIZACAO_PADRAO);

  const esquerda = opcoes.find((o) => o.props.id === idEsquerda) ?? null;
  const direita = opcoes.find((o) => o.props.id === idDireita) ?? null;

  function painel(
    item: ArquivoNaLista | null,
    estado: EstadoVisualizacao,
    setEstado: (fn: (a: EstadoVisualizacao) => EstadoVisualizacao) => void,
    idSelecionado: string,
    aoEscolher: (id: string) => void,
    rotulo: string,
  ) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <Select value={idSelecionado} onChange={(e) => aoEscolher(e.target.value)} aria-label={`Escolher radiografia — ${rotulo}`}>
          {opcoes.map((o) => (
            <option key={o.props.id} value={o.props.id}>
              {formatarDataIso(o.props.data)} — {o.props.descricao || o.props.nome}
            </option>
          ))}
        </Select>
        {item && (
          <p className="text-xs text-neutral-400">
            {formatarDataIso(item.props.data)}
            {item.props.origem ? ` · ${item.props.origem}` : ' · origem não informada'}
          </p>
        )}
        <div className="relative flex-1 overflow-hidden rounded bg-black">
          <div className="absolute right-1 top-1 z-10 flex gap-1">
            <Button variant="secondary" className="px-1.5 py-1 text-xs" onClick={() => setEstado((a) => aplicarZoom(a, 1 / 1.25))} title={`Diminuir zoom — ${rotulo}`}>
              <ZoomOut className="h-3 w-3" aria-hidden="true" />
            </Button>
            <Button variant="secondary" className="px-1.5 py-1 text-xs" onClick={() => setEstado((a) => aplicarZoom(a, 1.25))} title={`Aumentar zoom — ${rotulo}`}>
              <ZoomIn className="h-3 w-3" aria-hidden="true" />
            </Button>
          </div>
          {item && urls[item.props.id] && (
            <img
              src={urls[item.props.id]}
              alt={`${rotulo}: ${item.props.descricao || item.props.nome}`}
              draggable={false}
              className="absolute left-1/2 top-1/2 max-h-full max-w-none select-none"
              style={{ transform: `translate(-50%, -50%) ${cssTransform(estado)}` }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <RadixDialog.Root open={aberto} onOpenChange={(novoAberto) => !novoAberto && onFechar()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
        <RadixDialog.Content className="fixed inset-2 z-50 flex flex-col overflow-hidden rounded-lg bg-neutral-900 shadow-2xl focus-visible:outline-none sm:inset-6">
          <RadixDialog.Title className="sr-only">Comparar radiografias</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">
            Comparação lado a lado de duas radiografias do mesmo paciente, com data e origem de cada uma.
          </RadixDialog.Description>
          <div className="flex items-center justify-between border-b border-neutral-700 bg-neutral-800 px-3 py-2">
            <p className="text-sm font-semibold text-white">Comparar radiografias</p>
            <RadixDialog.Close asChild>
              <Button variant="secondary" className="text-xs">
                <X className="h-3.5 w-3.5" aria-hidden="true" /> Fechar
              </Button>
            </RadixDialog.Close>
          </div>
          <div className="flex flex-1 gap-2 overflow-hidden p-2">
            {painel(esquerda, estadoEsquerda, setEstadoEsquerda, idEsquerda, setIdEsquerda, 'imagem à esquerda')}
            {painel(direita, estadoDireita, setEstadoDireita, idDireita, setIdDireita, 'imagem à direita')}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
