import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import {
  Circle,
  Download,
  FlipHorizontal,
  FlipVertical,
  Maximize,
  Pencil,
  Redo2,
  RotateCcw,
  RotateCw,
  Ruler,
  Square,
  Trash2,
  Type as TypeIcon,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ErroApi } from '../../../application/ports/api-client.js';
import type { Anotacao, RegistroAnotacoes, TipoAnotacao } from '../../../application/ports/gateway-anotacoes-radiografia.js';
import { Alert } from '../../components/ui/alert.js';
import { Button } from '../../components/ui/button.js';
import { useContainer } from '../../providers/container-provider.js';
import {
  aplicarZoom,
  cssTransform,
  deslocar,
  distanciaEmPixels,
  espelhar,
  ESTADO_VISUALIZACAO_PADRAO,
  girar,
  imagemParaTela,
  PASSO_ZOOM,
  telaParaImagem,
  type EstadoVisualizacao,
  type PontoImagem,
} from './transformacao-visualizacao.js';

const CORES = ['#22d3ee', '#f97316', '#22c55e', '#f43f5e', '#facc15'];

function novoId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tmp-${Math.random().toString(36).slice(2)}`;
}

interface VisualizadorRadiografiaProps {
  aberto: boolean;
  titulo: string;
  subtitulo?: string;
  src: string;
  /** Id do `ArquivoPaciente` — chave das anotações e da nota persistentes no servidor. */
  arquivoId: string;
  notaInicial: string;
  onFechar: () => void;
  /** Avisa o pai quando a nota é salva, pra atualizar a lista sem recarregar tudo. */
  onNotaSalva?: (descricao: string) => void;
}

/**
 * Visualizador/editor de radiografia — continuação da reconstrução do
 * WIM VITOR. Zoom/pan/rotação(90°)/espelho/brilho/contraste/inversão são
 * SEMPRE visualização pura, nunca gravam no arquivo original (ver
 * `PARITY_MATRIX.md`). Anotações (texto/círculo/retângulo/lápis/régua),
 * desfazer/refazer e nota são persistentes no servidor — amarradas ao
 * `arquivoId`, sobrevivem a fechar/reabrir/reiniciar.
 *
 * Desfazer/refazer é uma pilha de ESTADOS COMPLETOS da lista de
 * anotações (snapshot-based) — cobre criar/editar/excluir igualmente,
 * porque todos os três são só "a lista mudou". Cada mutação confirmada
 * é salva no servidor com concorrência otimista (`versao`): um conflito
 * (outra sessão salvou antes) nunca sobrescreve silenciosamente — vira
 * um aviso bloqueante com a opção explícita de recarregar a versão do
 * servidor (perdendo as mudanças locais não salvas, sempre com o aviso
 * dizendo isso). Falha de rede ao salvar mostra erro + "tentar de novo",
 * nunca finge que salvou.
 */
export function VisualizadorRadiografia({
  aberto,
  titulo,
  subtitulo,
  src,
  arquivoId,
  notaInicial,
  onFechar,
  onNotaSalva,
}: VisualizadorRadiografiaProps) {
  const container = useContainer();

  const [estado, setEstado] = useState<EstadoVisualizacao>(ESTADO_VISUALIZACAO_PADRAO);
  const [brilho, setBrilho] = useState(100);
  const [contraste, setContraste] = useState(100);
  const [inverter, setInverter] = useState(false);
  const [dimensaoNatural, setDimensaoNatural] = useState<{ largura: number; altura: number } | null>(null);
  const arrastoRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ---- anotações persistentes ----
  const [itens, setItens] = useState<Anotacao[]>([]);
  const [versao, setVersao] = useState(0);
  const [pilhaDesfazer, setPilhaDesfazer] = useState<Anotacao[][]>([]);
  const [pilhaRefazer, setPilhaRefazer] = useState<Anotacao[][]>([]);
  const [ferramenta, setFerramenta] = useState<'nenhuma' | TipoAnotacao>('nenhuma');
  const [cor, setCor] = useState(CORES[0]!);
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [pontosEmProgresso, setPontosEmProgresso] = useState<PontoImagem[] | null>(null);
  const [pontosRegua, setPontosRegua] = useState<PontoImagem[]>([]);
  const [edicaoTexto, setEdicaoTexto] = useState<{ ponto: PontoImagem; valor: string; idExistente: string | null } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [conflito, setConflito] = useState<RegistroAnotacoes | null>(null);
  const [exportandoDicom, setExportandoDicom] = useState(false);

  // ---- nota (equivalente a XRayForm.setNotes do original) ----
  const [nota, setNota] = useState(notaInicial);
  const [notaSalvando, setNotaSalvando] = useState(false);
  const [notaErro, setNotaErro] = useState<string | null>(null);
  const [notaOk, setNotaOk] = useState(false);

  // Reinicia tudo quando abre uma radiografia nova — nunca herda
  // zoom/régua/ferramenta da anterior — e carrega as anotações salvas.
  useEffect(() => {
    if (!aberto) return;
    setEstado(ESTADO_VISUALIZACAO_PADRAO);
    setBrilho(100);
    setContraste(100);
    setInverter(false);
    setDimensaoNatural(null);
    setFerramenta('nenhuma');
    setSelecionadaId(null);
    setPontosEmProgresso(null);
    setPontosRegua([]);
    setEdicaoTexto(null);
    setPilhaDesfazer([]);
    setPilhaRefazer([]);
    setErroSalvar(null);
    setConflito(null);
    setNota(notaInicial);
    setNotaErro(null);
    setNotaOk(false);

    let cancelado = false;
    container.anotacoesRadiografia.obter
      .executar(arquivoId)
      .then((registro) => {
        if (cancelado) return;
        setItens(registro.itens);
        setVersao(registro.versao);
      })
      .catch(() => {
        if (!cancelado) setErroSalvar('Não foi possível carregar as anotações salvas deste arquivo.');
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, src, arquivoId]);

  const restaurarVisualizacao = useCallback(() => {
    setEstado(ESTADO_VISUALIZACAO_PADRAO);
    setBrilho(100);
    setContraste(100);
    setInverter(false);
  }, []);

  async function exportarDicom(): Promise<void> {
    setExportandoDicom(true);
    try {
      const blob = await container.arquivosRemoto.baixarDicom.executar(arquivoId);
      if (!blob) {
        setErroSalvar('Exportação DICOM só está disponível para radiografias PNG em escala de cinza.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${arquivoId}.dcm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      setErroSalvar(e instanceof ErroApi ? e.message : 'Não foi possível exportar o DICOM.');
    } finally {
      setExportandoDicom(false);
    }
  }

  async function persistir(novosItens: Anotacao[]): Promise<void> {
    setSalvando(true);
    setErroSalvar(null);
    try {
      const resultado = await container.anotacoesRadiografia.salvar.executar(arquivoId, versao, novosItens);
      if (resultado.ok) {
        setVersao(resultado.registro.versao);
      } else {
        setConflito(resultado.atual);
      }
    } catch (e) {
      setErroSalvar(e instanceof ErroApi ? e.message : 'Não foi possível salvar as anotações. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  function comitar(novosItens: Anotacao[]): void {
    setPilhaDesfazer((p) => [...p, itens]);
    setPilhaRefazer([]);
    setItens(novosItens);
    void persistir(novosItens);
  }

  function desfazer(): void {
    if (pilhaDesfazer.length === 0 || salvando) return;
    const anterior = pilhaDesfazer[pilhaDesfazer.length - 1]!;
    setPilhaDesfazer((p) => p.slice(0, -1));
    setPilhaRefazer((p) => [...p, itens]);
    setItens(anterior);
    void persistir(anterior);
  }

  function refazer(): void {
    if (pilhaRefazer.length === 0 || salvando) return;
    const proximo = pilhaRefazer[pilhaRefazer.length - 1]!;
    setPilhaRefazer((p) => p.slice(0, -1));
    setPilhaDesfazer((p) => [...p, itens]);
    setItens(proximo);
    void persistir(proximo);
  }

  function excluirSelecionada(): void {
    if (!selecionadaId || salvando) return;
    const novos = itens.filter((a) => a.id !== selecionadaId);
    setSelecionadaId(null);
    comitar(novos);
  }

  function recarregarDoServidor(): void {
    if (!conflito) return;
    setItens(conflito.itens);
    setVersao(conflito.versao);
    setPilhaDesfazer([]);
    setPilhaRefazer([]);
    setSelecionadaId(null);
    setConflito(null);
  }

  function confirmarTexto(): void {
    if (!edicaoTexto) return;
    const valor = edicaoTexto.valor.trim();
    setEdicaoTexto(null);
    if (!valor) return; // texto vazio nunca cria/edita uma anotação
    if (edicaoTexto.idExistente) {
      comitar(
        itens.map((a) =>
          a.id === edicaoTexto.idExistente ? { ...a, texto: valor, atualizadoEm: new Date().toISOString() } : a,
        ),
      );
    } else {
      const agora = new Date().toISOString();
      comitar([
        ...itens,
        { id: novoId(), tipo: 'TEXTO', pontos: [edicaoTexto.ponto], texto: valor, cor, criadoEm: agora, atualizadoEm: agora },
      ]);
    }
  }

  async function salvarNota(): Promise<void> {
    setNotaSalvando(true);
    setNotaErro(null);
    setNotaOk(false);
    try {
      const atualizado = await container.arquivosRemoto.atualizarDescricao.executar(arquivoId, nota);
      setNotaOk(true);
      onNotaSalva?.(atualizado.descricao);
    } catch (e) {
      setNotaErro(e instanceof ErroApi ? e.message : 'Não foi possível salvar a nota.');
    } finally {
      setNotaSalvando(false);
    }
  }

  function posicaoRelativaAoCentro(clienteX: number, clienteY: number): { x: number; y: number } | null {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clienteX - (rect.left + rect.width / 2), y: clienteY - (rect.top + rect.height / 2) };
  }

  function paraImagem(clienteX: number, clienteY: number): PontoImagem | null {
    if (!dimensaoNatural) return null;
    const posTela = posicaoRelativaAoCentro(clienteX, clienteY);
    if (!posTela) return null;
    return telaParaImagem(posTela, estado, dimensaoNatural.largura, dimensaoNatural.altura);
  }

  function aoClicarNaImagem(e: ReactMouseEvent): void {
    if (ferramenta === 'nenhuma') {
      setSelecionadaId(null);
      return;
    }
    const ponto = paraImagem(e.clientX, e.clientY);
    if (!ponto) return;

    if (ferramenta === 'TEXTO') {
      setEdicaoTexto({ ponto, valor: '', idExistente: null });
      return;
    }
    if (ferramenta === 'REGUA') {
      const proximos = pontosRegua.length >= 2 ? [ponto] : [...pontosRegua, ponto];
      setPontosRegua(proximos);
      if (proximos.length === 2) {
        const agora = new Date().toISOString();
        comitar([...itens, { id: novoId(), tipo: 'REGUA', pontos: proximos, cor, criadoEm: agora, atualizadoEm: agora }]);
        setPontosRegua([]);
      }
    }
    // CIRCULO/RETANGULO/LAPIS usam arrasto (onPointerDown/Move/Up), não clique.
  }

  function aoIniciarArrasto(e: ReactPointerEvent): void {
    if (ferramenta === 'CIRCULO' || ferramenta === 'RETANGULO' || ferramenta === 'LAPIS') {
      const ponto = paraImagem(e.clientX, e.clientY);
      if (ponto) setPontosEmProgresso([ponto]);
      return;
    }
    if (ferramenta !== 'nenhuma') return; // TEXTO/REGUA usam clique, não arrasto
    arrastoRef.current = { x: e.clientX, y: e.clientY };
  }

  function aoMoverArrasto(e: ReactPointerEvent): void {
    if (pontosEmProgresso) {
      const ponto = paraImagem(e.clientX, e.clientY);
      if (!ponto) return;
      setPontosEmProgresso((atual) => {
        if (!atual) return atual;
        return ferramenta === 'LAPIS' ? [...atual, ponto] : [atual[0]!, ponto];
      });
      return;
    }
    if (!arrastoRef.current) return;
    const dx = e.clientX - arrastoRef.current.x;
    const dy = e.clientY - arrastoRef.current.y;
    arrastoRef.current = { x: e.clientX, y: e.clientY };
    setEstado((atual) => deslocar(atual, dx, dy));
  }

  function aoSoltarArrasto(): void {
    arrastoRef.current = null;
    if (pontosEmProgresso && pontosEmProgresso.length >= 2 && (ferramenta === 'CIRCULO' || ferramenta === 'RETANGULO' || ferramenta === 'LAPIS')) {
      const agora = new Date().toISOString();
      comitar([
        ...itens,
        { id: novoId(), tipo: ferramenta, pontos: pontosEmProgresso, cor, criadoEm: agora, atualizadoEm: agora },
      ]);
    }
    setPontosEmProgresso(null);
  }

  function aoRolar(e: ReactWheelEvent): void {
    e.preventDefault();
    setEstado((atual) => aplicarZoom(atual, e.deltaY < 0 ? PASSO_ZOOM : 1 / PASSO_ZOOM));
  }

  function aoTeclar(e: ReactKeyboardEvent): void {
    if (e.key === 'Escape') {
      if (edicaoTexto) {
        e.preventDefault();
        setEdicaoTexto(null);
        return;
      }
      if (pontosEmProgresso || pontosRegua.length > 0) {
        e.preventDefault();
        setPontosEmProgresso(null);
        setPontosRegua([]);
        return;
      }
      return; // nada em progresso — deixa o Escape fechar o visualizador (Radix)
    }
    if (edicaoTexto) return; // digitando texto — nenhum outro atalho intercepta
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      desfazer();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      refazer();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selecionadaId) {
      e.preventDefault();
      excluirSelecionada();
    }
  }

  function telaDoPonto(p: PontoImagem): { x: number; y: number } {
    const rect = containerRef.current?.getBoundingClientRect();
    const centroX = (rect?.width ?? 0) / 2;
    const centroY = (rect?.height ?? 0) / 2;
    const t = dimensaoNatural ? imagemParaTela(p, estado, dimensaoNatural.largura, dimensaoNatural.altura) : { x: 0, y: 0 };
    return { x: centroX + t.x, y: centroY + t.y };
  }

  const selecionada = itens.find((a) => a.id === selecionadaId) ?? null;

  return (
    <RadixDialog.Root open={aberto} onOpenChange={(novoAberto) => !novoAberto && onFechar()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
        <RadixDialog.Content
          className="fixed inset-2 z-50 flex flex-col overflow-hidden rounded-lg bg-neutral-900 shadow-2xl focus-visible:outline-none sm:inset-6"
          onEscapeKeyDown={(e) => {
            if (edicaoTexto || pontosEmProgresso || pontosRegua.length > 0) e.preventDefault();
          }}
          onKeyDown={aoTeclar}
        >
          <RadixDialog.Title className="sr-only">{titulo}</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">
            Visualizador e editor de radiografia com zoom, rotação, espelhamento, brilho/contraste, inversão de
            cores, anotações persistentes, desfazer/refazer, nota e régua de medição em pixels.
          </RadixDialog.Description>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-700 bg-neutral-800 px-3 py-2 no-print">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{titulo}</p>
              {subtitulo && <p className="truncate text-xs text-neutral-400">{subtitulo}</p>}
            </div>
            <div className="flex items-center gap-2">
              {salvando && <span className="text-xs text-neutral-400">Salvando…</span>}
              <RadixDialog.Close asChild>
                <Button variant="secondary" className="text-xs">
                  <X className="h-3.5 w-3.5" aria-hidden="true" /> Fechar
                </Button>
              </RadixDialog.Close>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-700 bg-neutral-800 px-3 py-2 no-print">
            <Button variant="secondary" className="text-xs" onClick={() => setEstado((a) => aplicarZoom(a, 1 / PASSO_ZOOM))} title="Diminuir zoom">
              <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <span className="w-12 text-center text-xs tabular-nums text-neutral-300">{Math.round(estado.escala * 100)}%</span>
            <Button variant="secondary" className="text-xs" onClick={() => setEstado((a) => aplicarZoom(a, PASSO_ZOOM))} title="Aumentar zoom">
              <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button variant="secondary" className="text-xs" onClick={() => setEstado((a) => girar(a, 'esquerda'))} title="Girar à esquerda">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button variant="secondary" className="text-xs" onClick={() => setEstado((a) => girar(a, 'direita'))} title="Girar à direita">
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button variant="secondary" className="text-xs" onClick={() => setEstado((a) => espelhar(a, 'horizontal'))} title="Espelhar horizontalmente">
              <FlipHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button variant="secondary" className="text-xs" onClick={() => setEstado((a) => espelhar(a, 'vertical'))} title="Espelhar verticalmente">
              <FlipVertical className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button
              variant={inverter ? 'primary' : 'secondary'}
              className="text-xs"
              onClick={() => setInverter((v) => !v)}
              title="Inverter cores (equivalente a enums.Filters.NEGATIVO/INVERT do original — só visualização)"
            >
              Inverter
            </Button>
            <Button variant="secondary" className="text-xs" onClick={restaurarVisualizacao} title="Restaurar visualização (não altera o arquivo)">
              <Maximize className="h-3.5 w-3.5" aria-hidden="true" /> Restaurar
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              loading={exportandoDicom}
              onClick={() => void exportarDicom()}
              title="Exportar DICOM — só funciona para radiografias PNG em escala de cinza"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> DICOM
            </Button>

            <label className="flex items-center gap-1.5 text-xs text-neutral-300">
              Brilho
              <input type="range" min={20} max={200} value={brilho} onChange={(e) => setBrilho(Number(e.target.value))} className="w-20" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-neutral-300">
              Contraste
              <input type="range" min={20} max={200} value={contraste} onChange={(e) => setContraste(Number(e.target.value))} className="w-20" />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-700 bg-neutral-800/60 px-3 py-2 no-print">
            {(
              [
                ['TEXTO', TypeIcon, 'Texto'],
                ['CIRCULO', Circle, 'Círculo'],
                ['RETANGULO', Square, 'Retângulo'],
                ['LAPIS', Pencil, 'Lápis'],
                ['REGUA', Ruler, 'Régua'],
              ] as const
            ).map(([tipo, Icone, texto]) => (
              <Button
                key={tipo}
                variant={ferramenta === tipo ? 'primary' : 'secondary'}
                className="text-xs"
                disabled={salvando}
                onClick={() => {
                  setFerramenta((f) => (f === tipo ? 'nenhuma' : tipo));
                  setPontosRegua([]);
                  setPontosEmProgresso(null);
                }}
                title={`Ferramenta: ${texto}`}
              >
                <Icone className="h-3.5 w-3.5" aria-hidden="true" /> {texto}
              </Button>
            ))}
            <span className="mx-1 h-5 w-px bg-neutral-700" aria-hidden="true" />
            {CORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                title={`Cor ${c}`}
                className="h-5 w-5 rounded-full border-2"
                style={{ backgroundColor: c, borderColor: cor === c ? '#fff' : 'transparent' }}
              />
            ))}
            <span className="mx-1 h-5 w-px bg-neutral-700" aria-hidden="true" />
            <Button variant="secondary" className="text-xs" disabled={pilhaDesfazer.length === 0 || salvando} onClick={desfazer} title="Desfazer (Ctrl+Z)">
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Desfazer
            </Button>
            <Button variant="secondary" className="text-xs" disabled={pilhaRefazer.length === 0 || salvando} onClick={refazer} title="Refazer (Ctrl+Y)">
              <Redo2 className="h-3.5 w-3.5" aria-hidden="true" /> Refazer
            </Button>
            <Button
              variant="danger"
              className="text-xs"
              disabled={!selecionadaId || salvando}
              onClick={excluirSelecionada}
              title="Excluir a anotação selecionada (Delete)"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Excluir selecionada
            </Button>
            {selecionada?.tipo === 'TEXTO' && (
              <Button
                variant="secondary"
                className="text-xs"
                disabled={salvando}
                onClick={() => setEdicaoTexto({ ponto: selecionada.pontos[0]!, valor: selecionada.texto ?? '', idExistente: selecionada.id })}
              >
                Editar texto
              </Button>
            )}
          </div>

          {erroSalvar && (
            <Alert tone="danger" className="no-print">
              <div className="flex items-center gap-2">
                <span>{erroSalvar}</span>
                <Button variant="secondary" className="text-xs" onClick={() => void persistir(itens)}>
                  Tentar salvar de novo
                </Button>
              </div>
            </Alert>
          )}
          {conflito && (
            <Alert tone="warning" title="Isto foi editado em outra sessão enquanto você trabalhava aqui" className="no-print">
              <div className="flex flex-col items-start gap-2">
                <span>
                  Suas mudanças locais ainda não salvas serão perdidas se você recarregar. Recarregue para ver a
                  versão mais recente antes de continuar.
                </span>
                <Button variant="secondary" className="text-xs" onClick={recarregarDoServidor}>
                  Recarregar versão do servidor
                </Button>
              </div>
            </Alert>
          )}
          {ferramenta === 'REGUA' && (
            <div className="border-b border-neutral-700 bg-brand-900/40 px-3 py-1.5 text-xs text-brand-100 no-print">
              Clique dois pontos na imagem para medir e salvar a régua.{' '}
              <strong>Medida em pixels da imagem — calibração física não confirmada, nunca convertida para milímetros.</strong>
              {pontosRegua.length === 1 && <span className="ml-2 text-brand-200">(1/2 pontos — clique o segundo ponto)</span>}
            </div>
          )}

          <div
            ref={containerRef}
            className="relative flex-1 touch-none overflow-hidden bg-black"
            onWheel={aoRolar}
            onPointerDown={aoIniciarArrasto}
            onPointerMove={aoMoverArrasto}
            onPointerUp={aoSoltarArrasto}
            onPointerLeave={aoSoltarArrasto}
            onClick={aoClicarNaImagem}
            style={{ cursor: ferramenta === 'nenhuma' ? 'grab' : 'crosshair' }}
          >
            <img
              src={src}
              alt={titulo}
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                setDimensaoNatural({ largura: img.naturalWidth, altura: img.naturalHeight });
              }}
              className="absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                transform: `translate(-50%, -50%) ${cssTransform(estado)}`,
                filter: `brightness(${brilho}%) contrast(${contraste}%)${inverter ? ' invert(100%)' : ''}`,
              }}
            />
            {dimensaoNatural && (
              <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
                {itens.map((a) => {
                  const pontosTela = a.pontos.map(telaDoPonto);
                  const selecionadaEstilo = a.id === selecionadaId;
                  const tracoCor = a.cor ?? CORES[0]!;
                  const comportamento = {
                    onClick: (e: ReactMouseEvent) => {
                      e.stopPropagation();
                      setSelecionadaId(a.id);
                    },
                    onPointerDown: (e: ReactPointerEvent) => e.stopPropagation(),
                    style: { cursor: 'pointer', pointerEvents: 'auto' as const },
                  };
                  if (a.tipo === 'TEXTO') {
                    const p = pontosTela[0]!;
                    return (
                      <g key={a.id} {...comportamento}>
                        <rect x={p.x} y={p.y - 14} width={Math.max(40, (a.texto?.length ?? 0) * 7)} height={18} fill="rgba(0,0,0,0.6)" stroke={selecionadaEstilo ? '#fff' : tracoCor} />
                        <text x={p.x + 4} y={p.y - 1} fill={tracoCor} fontSize={12}>
                          {a.texto}
                        </text>
                      </g>
                    );
                  }
                  if (a.tipo === 'REGUA') {
                    const [p0, p1] = pontosTela;
                    const dist = distanciaEmPixels(a.pontos[0]!, a.pontos[1]!);
                    const meio = { x: ((p0?.x ?? 0) + (p1?.x ?? 0)) / 2, y: ((p0?.y ?? 0) + (p1?.y ?? 0)) / 2 };
                    return (
                      <g key={a.id} {...comportamento}>
                        <line x1={p0?.x} y1={p0?.y} x2={p1?.x} y2={p1?.y} stroke={selecionadaEstilo ? '#fff' : tracoCor} strokeWidth={2} />
                        <circle cx={p0?.x} cy={p0?.y} r={4} fill={tracoCor} />
                        <circle cx={p1?.x} cy={p1?.y} r={4} fill={tracoCor} />
                        <text x={meio.x} y={meio.y - 6} fill="#fff" fontSize={11}>
                          ≈ {dist.toFixed(1)} px
                        </text>
                      </g>
                    );
                  }
                  if (a.tipo === 'CIRCULO') {
                    const [p0, p1] = pontosTela;
                    const cx = ((p0?.x ?? 0) + (p1?.x ?? 0)) / 2;
                    const cy = ((p0?.y ?? 0) + (p1?.y ?? 0)) / 2;
                    const rx = Math.abs((p1?.x ?? 0) - (p0?.x ?? 0)) / 2;
                    const ry = Math.abs((p1?.y ?? 0) - (p0?.y ?? 0)) / 2;
                    return <ellipse key={a.id} {...comportamento} cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={selecionadaEstilo ? '#fff' : tracoCor} strokeWidth={2} />;
                  }
                  if (a.tipo === 'RETANGULO') {
                    const [p0, p1] = pontosTela;
                    const x = Math.min(p0?.x ?? 0, p1?.x ?? 0);
                    const y = Math.min(p0?.y ?? 0, p1?.y ?? 0);
                    return (
                      <rect
                        key={a.id}
                        {...comportamento}
                        x={x}
                        y={y}
                        width={Math.abs((p1?.x ?? 0) - (p0?.x ?? 0))}
                        height={Math.abs((p1?.y ?? 0) - (p0?.y ?? 0))}
                        fill="none"
                        stroke={selecionadaEstilo ? '#fff' : tracoCor}
                        strokeWidth={2}
                      />
                    );
                  }
                  // LAPIS
                  return (
                    <polyline
                      key={a.id}
                      {...comportamento}
                      points={pontosTela.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke={selecionadaEstilo ? '#fff' : tracoCor}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })}

                {pontosEmProgresso && pontosEmProgresso.length >= 1 && (ferramenta === 'CIRCULO' || ferramenta === 'RETANGULO') && pontosEmProgresso[1] && (
                  <rect
                    x={Math.min(telaDoPonto(pontosEmProgresso[0]!).x, telaDoPonto(pontosEmProgresso[1]).x)}
                    y={Math.min(telaDoPonto(pontosEmProgresso[0]!).y, telaDoPonto(pontosEmProgresso[1]).y)}
                    width={Math.abs(telaDoPonto(pontosEmProgresso[1]).x - telaDoPonto(pontosEmProgresso[0]!).x)}
                    height={Math.abs(telaDoPonto(pontosEmProgresso[1]).y - telaDoPonto(pontosEmProgresso[0]!).y)}
                    fill="none"
                    stroke={cor}
                    strokeDasharray="4 3"
                  />
                )}
                {pontosEmProgresso && ferramenta === 'LAPIS' && pontosEmProgresso.length >= 2 && (
                  <polyline points={pontosEmProgresso.map((p) => { const t = telaDoPonto(p); return `${t.x},${t.y}`; }).join(' ')} fill="none" stroke={cor} strokeWidth={2} strokeDasharray="4 3" />
                )}
                {pontosRegua.length === 1 && <circle cx={telaDoPonto(pontosRegua[0]!).x} cy={telaDoPonto(pontosRegua[0]!).y} r={4} fill={cor} />}
              </svg>
            )}

            {edicaoTexto && (
              <div
                className="absolute z-10 no-print"
                style={{ left: telaDoPonto(edicaoTexto.ponto).x, top: telaDoPonto(edicaoTexto.ponto).y }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <textarea
                  autoFocus
                  rows={2}
                  value={edicaoTexto.valor}
                  onChange={(e) => setEdicaoTexto((atual) => (atual ? { ...atual, valor: e.target.value } : atual))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      confirmarTexto();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setEdicaoTexto(null);
                    }
                  }}
                  onBlur={confirmarTexto}
                  placeholder="Texto da anotação — Enter para confirmar, Esc para cancelar"
                  className="w-48 rounded border border-brand-400 bg-neutral-900 p-1 text-xs text-white"
                />
              </div>
            )}
          </div>

          <div className="border-t border-neutral-700 bg-neutral-800 px-3 py-2 no-print">
            <label className="flex flex-col gap-1 text-xs text-neutral-300">
              Nota deste exame
              <textarea
                rows={2}
                value={nota}
                onChange={(e) => {
                  setNota(e.target.value);
                  setNotaOk(false);
                }}
                className="rounded border border-neutral-600 bg-neutral-900 p-1.5 text-xs text-white"
                placeholder="Ex.: panorâmica inicial, arcada superior"
              />
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Button variant="secondary" className="text-xs" loading={notaSalvando} onClick={() => void salvarNota()} disabled={nota === notaInicial && !notaErro}>
                Salvar nota
              </Button>
              {notaOk && <span className="text-xs text-success-400">Nota salva.</span>}
              {notaErro && <span className="text-xs text-danger-400">{notaErro}</span>}
            </div>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
