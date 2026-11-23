import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Calendar as CalendarIcon, Cloud, Columns2, HardDrive, ImageOff, ScanLine } from 'lucide-react';
import type { ArquivoNaLista } from '../../../application/use-cases/arquivos-paciente.js';
import { Alert } from '../../components/ui/alert.js';
import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { EmptyState } from '../../components/ui/empty-state.js';
import { Spinner } from '../../components/ui/spinner.js';
import { formatarDataIso } from '../../lib/formatadores.js';
import type { FichaClinicaContexto } from '../../pages/ficha-clinica-page.js';
import { useContainer } from '../../providers/container-provider.js';
import { PainelLixeira } from '../arquivos/painel-lixeira.js';
import { PainelImportarWim } from '../wim-import/painel-importar-wim.js';
import { ComparadorRadiografias } from './comparador-radiografias.js';
import { PainelCapturaWim } from './painel-captura-wim.js';
import { VisualizadorRadiografia } from './visualizador-radiografia.js';

/**
 * Aba "Exames" do paciente — área dedicada de radiografias/exames
 * (pedido explícito: nunca misturada com os documentos genéricos da aba
 * Arquivos). Reusa o MESMO armazenamento/metadado de `ArquivoPaciente`
 * (categoria `RADIOGRAFIA`) — nenhum modelo de dado novo. A importação
 * do WIM (já existente, Fases 1-3) mora aqui agora, porque esta é a
 * "entrada normal" pedida — a aba Arquivos continua existindo e
 * funcionando exatamente como antes, para documentos/fotos/outros.
 *
 * Organiza por DATA (campo já existente e sempre comprovado); nunca por
 * "região/dente" — essa informação não é reconstruível com segurança só
 * a partir do nome do arquivo do WIM (ver `PARITY_MATRIX.md`).
 */
export function AbaExames() {
  const { paciente } = useOutletContext<FichaClinicaContexto>();
  const container = useContainer();
  const remoto = container.sincronizacaoArquivos;

  const [servidorOnline, setServidorOnline] = useState<boolean | null>(remoto ? null : true);
  const [lista, setLista] = useState<ArquivoNaLista[] | null>(null);
  const [chave, setChave] = useState(0);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [itemAberto, setItemAberto] = useState<ArquivoNaLista | null>(null);
  const [comparando, setComparando] = useState(false);
  const urlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    let cancelado = false;
    async function carregar(): Promise<void> {
      if (remoto) {
        const online = await container.arquivosRemoto.verificarServidor.executar().catch(() => false);
        if (cancelado) return;
        setServidorOnline(online);
        if (!online) {
          setLista(null);
          return;
        }
      }
      const l = remoto
        ? await container.arquivosRemoto.listar.executar(paciente.id)
        : await container.arquivos.listarDoPaciente.executar(paciente.id);
      if (!cancelado) setLista(l.filter((item) => item.props.categoria === 'RADIOGRAFIA'));
    }
    void carregar();
    return () => {
      cancelado = true;
    };
  }, [container, paciente.id, remoto, chave]);

  // Busca os bytes de cada radiografia (para a miniatura E o visualizador — mesmo blob, sem round-trip duplo).
  useEffect(() => {
    if (!lista) return;
    let cancelado = false;
    async function buscarTodos(): Promise<void> {
      for (const item of lista!) {
        if (!item.disponivelLocalmente || urlsRef.current[item.props.id]) continue;
        const blob = remoto
          ? await container.arquivosRemoto.baixar.executar(item.props.id).catch(() => null)
          : (await container.arquivos.obterConteudo.executar(item.props.id).catch(() => null))?.blob ?? null;
        if (cancelado || !blob) continue;
        const url = URL.createObjectURL(blob);
        urlsRef.current = { ...urlsRef.current, [item.props.id]: url };
        setUrls((atual) => ({ ...atual, [item.props.id]: url }));
      }
    }
    void buscarTodos();
    return () => {
      cancelado = true;
    };
  }, [lista, remoto, container]);

  // Revoga as URLs de objeto só quando a aba é desmontada de verdade (troca de paciente), nunca a cada recarga.
  useEffect(() => {
    return () => {
      Object.values(urlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [paciente.id]);

  const recarregar = useCallback(() => setChave((k) => k + 1), []);

  // Defesa extra (item explícito desta rodada): nunca abre um item cujo
  // `pacienteId` não bata com a ficha atual — mesmo que `lista` já venha
  // escopada pelo servidor (`GET /api/pacientes/:id/arquivos`), este é
  // o único ponto de entrada do visualizador, então confere de novo.
  function abrirComSeguranca(item: ArquivoNaLista): void {
    if (item.props.pacienteId !== paciente.id) return;
    setItemAberto(item);
  }

  const servidorFora = remoto && servidorOnline === false;

  const grupos = new Map<string, ArquivoNaLista[]>();
  for (const item of lista ?? []) {
    const chaveData = item.props.data || 'sem-data';
    grupos.set(chaveData, [...(grupos.get(chaveData) ?? []), item]);
  }
  const datasOrdenadas = [...grupos.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <ScanLine className="h-4 w-4" aria-hidden="true" /> Exames e radiografias
        </h2>
        {remoto && (
          <Badge tone={servidorOnline ? 'success' : 'neutral'}>
            {servidorOnline ? (
              <>
                <Cloud className="mr-1 h-3 w-3" aria-hidden="true" /> Amostra temporária
              </>
            ) : (
              <>
                <HardDrive className="mr-1 h-3 w-3" aria-hidden="true" /> Servidor fora do ar
              </>
            )}
          </Badge>
        )}
        {lista && lista.length >= 2 && (
          <Button variant="secondary" className="ml-auto text-xs" onClick={() => setComparando(true)}>
            <Columns2 className="h-3.5 w-3.5" aria-hidden="true" /> Comparar
          </Button>
        )}
      </div>

      <p className="text-xs text-neutral-500">
        Radiografias importadas do WIM VITOR/WIM Dental ou anexadas manualmente aparecem aqui, organizadas por data.
        Para outros documentos (laudos, fotos, PDFs), use a aba <strong>Arquivos</strong>.
      </p>

      {servidorFora && (
        <Alert tone="warning" title="Servidor de arquivos fora do ar">
          Rode <code>npm run server</code> (ou <code>npm run clinica</code>) e recarregue a página.
        </Alert>
      )}

      {!servidorFora && (
        <>
          {remoto && <PainelImportarWim pacienteId={paciente.id} pacienteNome={paciente.nomeCompleto} aoImportar={recarregar} />}
          {remoto && <PainelCapturaWim pacienteId={paciente.id} aoConcluir={recarregar} />}
          {remoto && <PainelLixeira pacienteId={paciente.id} categoriaFiltro="RADIOGRAFIA" aoRestaurar={recarregar} />}

          {lista === null && (
            <div className="flex justify-center py-8">
              <Spinner label="Carregando exames…" />
            </div>
          )}

          {lista && lista.length === 0 && (
            <EmptyState
              title="Nenhuma radiografia anexada ainda"
              description='Importe do WIM acima, ou anexe manualmente na aba "Arquivos" com a categoria "Radiografia".'
            />
          )}

          {lista && datasOrdenadas.length > 0 && (
            <div className="flex flex-col gap-4">
              {datasOrdenadas.map((data) => (
                <Card key={data} className="flex flex-col gap-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                    <CalendarIcon className="h-4 w-4" aria-hidden="true" />
                    {data === 'sem-data' ? 'Sem data informada' : formatarDataIso(data)}
                    <span className="text-xs font-normal text-neutral-400">
                      ({grupos.get(data)!.length} {grupos.get(data)!.length === 1 ? 'imagem' : 'imagens'})
                    </span>
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {grupos.get(data)!.map((item) => (
                      <button
                        key={item.props.id}
                        type="button"
                        onClick={() => abrirComSeguranca(item)}
                        className="group flex flex-col gap-1 rounded-lg border border-neutral-200 p-1.5 text-left transition-colors hover:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                      >
                        <div className="flex aspect-square items-center justify-center overflow-hidden rounded bg-neutral-100">
                          {urls[item.props.id] ? (
                            <img src={urls[item.props.id]} alt={item.props.nome} className="h-full w-full object-contain" />
                          ) : (
                            <ImageOff className="h-6 w-6 text-neutral-400" aria-hidden="true" />
                          )}
                        </div>
                        <span className="truncate text-xs text-neutral-600">{item.props.descricao || item.props.nome}</span>
                      </button>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {itemAberto && (
        <VisualizadorRadiografia
          aberto
          titulo={`${paciente.nomeCompleto} — ${itemAberto.props.descricao || itemAberto.props.nome}`}
          subtitulo={`${formatarDataIso(itemAberto.props.data)}${itemAberto.props.origem ? ` · ${itemAberto.props.origem}` : ''}`}
          src={urls[itemAberto.props.id] ?? ''}
          arquivoId={itemAberto.props.id}
          notaInicial={itemAberto.props.descricao}
          onFechar={() => setItemAberto(null)}
          onNotaSalva={(descricao) => {
            setItemAberto((atual) => (atual ? { ...atual, props: { ...atual.props, descricao } } : atual));
            recarregar();
          }}
        />
      )}

      {comparando && lista && (
        <ComparadorRadiografias aberto onFechar={() => setComparando(false)} opcoes={lista} urls={urls} />
      )}
    </div>
  );
}
