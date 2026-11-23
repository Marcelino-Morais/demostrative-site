import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Cloud, Download, FileText, HardDrive, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import type { ArquivoNaLista } from '../../../application/use-cases/arquivos-paciente.js';
import { ErroApi } from '../../../application/ports/api-client.js';
import {
  CATEGORIAS_ARQUIVO,
  CATEGORIA_ARQUIVO_LABEL,
  ehImagem,
  type CategoriaArquivo,
} from '../../../domain/entities/arquivo-paciente.js';
import { ErroDominio } from '../../../domain/types.js';
import { Alert } from '../../components/ui/alert.js';
import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { EmptyState } from '../../components/ui/empty-state.js';
import { Field } from '../../components/ui/field.js';
import { Input, Select, Textarea } from '../../components/ui/input.js';
import { Spinner } from '../../components/ui/spinner.js';
import { formatarDataIso, formatarTamanhoArquivo, hojeParaInputDate } from '../../lib/formatadores.js';
import type { FichaClinicaContexto } from '../../pages/ficha-clinica-page.js';
import { useRegistrarEdicaoPendente } from '../../providers/edicao-pendente-provider.js';
import { useContainer } from '../../providers/container-provider.js';
import { PainelLixeira } from './painel-lixeira.js';

/**
 * Aba "Documentos e imagens" do paciente (Etapa 16 + 19). Só chama
 * `container.arquivos.*` / `container.arquivosRemoto.*` e desenha. A
 * validação de tipo/tamanho e a regra de "onde ficam os bytes" moram na
 * entidade/casos de uso.
 *
 * Dois modos, escolhidos por `container.sincronizacaoArquivos`
 * (`VITE_API_ARQUIVOS=on`):
 *
 *  - **No servidor da clínica** (Etapa 19): metadados E bytes vivem no
 *    sistema de arquivos do servidor de `server/`. Abrem em qualquer
 *    aparelho. O servidor nunca devolve um caminho de disco.
 *  - **Só neste navegador** (padrão): metadados no `localStorage`, bytes
 *    no IndexedDB — protótipo local. O backup `.json` leva só a LISTA.
 *
 * Nunca se registra o conteúdo dos arquivos.
 */
export function AbaArquivos() {
  const { paciente } = useOutletContext<FichaClinicaContexto>();
  const container = useContainer();
  const remoto = container.sincronizacaoArquivos;
  const inputRef = useRef<HTMLInputElement>(null);

  const [servidorOnline, setServidorOnline] = useState<boolean | null>(remoto ? null : true);
  const [lista, setLista] = useState<ArquivoNaLista[] | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [categoria, setCategoria] = useState<CategoriaArquivo>('RADIOGRAFIA');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(hojeParaInputDate());
  const [origem, setOrigem] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagemOk, setMensagemOk] = useState<string | null>(null);
  const [avisoAbertura, setAvisoAbertura] = useState<string | null>(null);
  const [chave, setChave] = useState(0);
  // Adia o popup automático de novas solicitações enquanto há um
  // upload em preparação (arquivo escolhido ou campos preenchidos).
  useRegistrarEdicaoPendente(useId(), arquivo !== null || descricao.trim() !== '' || origem.trim() !== '');

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
      if (!cancelado) setLista(l);
    }
    void carregar();
    return () => {
      cancelado = true;
    };
  }, [container, paciente.id, remoto, chave]);

  const recarregar = useCallback(() => setChave((k) => k + 1), []);

  function limpar(): void {
    setArquivo(null);
    setDescricao('');
    setOrigem('');
    setData(hojeParaInputDate());
    if (inputRef.current) inputRef.current.value = '';
  }

  async function adicionar(): Promise<void> {
    if (!arquivo) {
      setErro('Escolha um arquivo para anexar.');
      return;
    }
    setSalvando(true);
    setErro(null);
    setMensagemOk(null);
    const entrada = {
      pacienteId: paciente.id,
      nome: arquivo.name,
      tipoMime: arquivo.type || 'application/octet-stream',
      tamanhoBytes: arquivo.size,
      categoria,
      descricao,
      data,
      origem,
    };
    try {
      if (remoto) await container.arquivosRemoto.enviar.executar(entrada, arquivo);
      else await container.arquivos.adicionar.executar(entrada, arquivo);
      limpar();
      setMensagemOk(remoto ? 'Arquivo enviado ao servidor da clínica.' : 'Arquivo anexado neste navegador.');
      recarregar();
    } catch (e) {
      setErro(
        e instanceof ErroDominio || e instanceof ErroApi ? e.message : 'Não foi possível anexar o arquivo.',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function abrir(id: string): Promise<void> {
    setAvisoAbertura(null);
    try {
      const blob = remoto
        ? await container.arquivosRemoto.baixar.executar(id)
        : (await container.arquivos.obterConteudo.executar(id)).blob;
      if (!blob) {
        setAvisoAbertura(
          remoto
            ? 'O servidor não encontrou o conteúdo deste arquivo.'
            : 'Este arquivo não está neste dispositivo — só a ficha dele foi restaurada. Reanexe o arquivo.',
        );
        return;
      }
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setAvisoAbertura(e instanceof ErroApi ? e.message : 'Não foi possível abrir o arquivo.');
    }
  }

  async function remover(id: string): Promise<void> {
    setErro(null);
    try {
      if (remoto) await container.arquivosRemoto.remover.executar(id);
      else await container.arquivos.remover.executar(id);
      recarregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível remover o arquivo.');
    }
  }

  const servidorFora = remoto && servidorOnline === false;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <Upload className="h-4 w-4" aria-hidden="true" /> Documentos e imagens
        </h2>
        <Badge tone={remoto ? 'success' : 'neutral'}>
          {remoto ? (
            <>
              <Cloud className="mr-1 h-3 w-3" aria-hidden="true" /> No servidor da clínica
            </>
          ) : (
            <>
              <HardDrive className="mr-1 h-3 w-3" aria-hidden="true" /> Só neste navegador
            </>
          )}
        </Badge>
      </div>

      {remoto ? (
        <Alert tone="brand" title="Os arquivos deste paciente ficam no servidor da clínica">
          Imagens e documentos anexados aqui são guardados no <strong>sistema de arquivos do servidor</strong> (não no
          navegador) — abrem de qualquer aparelho conectado. O backup <code>.json</code> do navegador <strong>não</strong>{' '}
          inclui estes arquivos; faça cópia da pasta <code>server/dados/</code> à parte (ver README).
        </Alert>
      ) : (
        <Alert tone="warning" title="Os arquivos ficam só neste navegador">
          Imagens e documentos anexados aqui são guardados no armazenamento local deste navegador/dispositivo — não são
          duráveis entre aparelhos. O backup (.json) leva só a <strong>lista</strong>; o conteúdo precisa ser reanexado se
          você trocar de aparelho ou limpar os dados do site. Para guardar os arquivos no servidor da clínica, ligue o
          modo compartilhado (<code>VITE_API_ARQUIVOS=on</code> — ver README).
        </Alert>
      )}

      {servidorFora && (
        <Alert tone="warning" title="Servidor de arquivos fora do ar">
          O modo compartilhado está ligado, mas o servidor não respondeu. Rode <code>npm run server</code> e recarregue a
          página. Enquanto isso, anexar e abrir arquivos fica indisponível.
        </Alert>
      )}

      {!servidorFora && (
        <>
          <Card className="no-print flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
              <Upload className="h-4 w-4" aria-hidden="true" /> Anexar arquivo
            </h3>
            {erro && <Alert tone="danger">{erro}</Alert>}
            {mensagemOk && <Alert tone="success">{mensagemOk}</Alert>}
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="text-sm text-neutral-700 file:mr-3 file:rounded-md file:border file:border-neutral-300 file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium dark:file:border-neutral-700 dark:file:text-neutral-300"
            />
            {arquivo && (
              <p className="text-xs text-neutral-500">
                {arquivo.name} · {formatarTamanhoArquivo(arquivo.size)}
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Categoria">
                <Select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaArquivo)}>
                  {CATEGORIAS_ARQUIVO.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORIA_ARQUIVO_LABEL[c]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Data do arquivo">
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </Field>
              <Field label="Descrição (opcional)">
                <Textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex.: panorâmica inicial; laudo do exame de sangue"
                  rows={2}
                />
              </Field>
              <Field label="Origem (opcional)" hint="De onde veio — ex.: enviado pela paciente, digitalizado na recepção.">
                <Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Enviado pela paciente" />
              </Field>
            </div>
            <Button onClick={() => void adicionar()} loading={salvando} className="self-start">
              {salvando ? (remoto ? 'Enviando ao servidor…' : 'Anexando…') : 'Anexar'}
            </Button>
            <p className="text-xs text-neutral-400">Aceita imagens (JPG, PNG, WEBP) e PDF, até 10 MB por arquivo.</p>
          </Card>

          {remoto && (
            <Alert tone="brand" className="text-xs">
              Radiografias e exames do WIM VITOR/WIM Dental agora têm uma área própria — veja a aba{' '}
              <strong>Exames</strong>.
            </Alert>
          )}

          {remoto && <PainelLixeira pacienteId={paciente.id} aoRestaurar={recarregar} />}

          <Card className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-neutral-700">
              Arquivos anexados {lista && lista.length > 0 ? `(${lista.length})` : ''}
            </h3>
            {avisoAbertura && (
              <Alert tone="warning" className="text-xs">
                {avisoAbertura}
              </Alert>
            )}
            {lista === null && (
              <div className="flex justify-center py-8">
                <Spinner label="Carregando arquivos…" />
              </div>
            )}
            {lista && lista.length === 0 && (
              <EmptyState
                title="Nenhum arquivo anexado"
                description="Use o formulário acima para anexar radiografias, fotos clínicas, exames ou documentos deste paciente."
              />
            )}
            {lista && lista.length > 0 && (
              <ul className="flex flex-col divide-y divide-neutral-100">
                {lista.map(({ props, disponivelLocalmente }) => (
                  <li key={props.id} className="flex flex-wrap items-start gap-3 py-3">
                    <span
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-500"
                      aria-hidden="true"
                    >
                      {ehImagem(props.tipoMime) ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-neutral-900">{props.nome}</span>
                        <Badge tone="neutral">{CATEGORIA_ARQUIVO_LABEL[props.categoria]}</Badge>
                        {!disponivelLocalmente && <Badge tone="warning">Não está neste dispositivo</Badge>}
                      </div>
                      <p className="text-xs text-neutral-500">
                        {formatarDataIso(props.data)} · {formatarTamanhoArquivo(props.tamanhoBytes)}
                        {props.origem ? ` · ${props.origem}` : ''}
                      </p>
                      {props.descricao && (
                        <p className="mt-0.5 text-sm text-neutral-600">{props.descricao}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button variant="secondary" onClick={() => void abrir(props.id)} className="text-xs">
                        <Download className="h-3.5 w-3.5" aria-hidden="true" /> Abrir
                      </Button>
                      <Button variant="secondary" onClick={() => void remover(props.id)} className="text-xs">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {remoto ? 'Mover para lixeira' : 'Remover'}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
