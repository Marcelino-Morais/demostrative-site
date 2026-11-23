import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Power, PowerOff, Search } from 'lucide-react';
import type { ProcedimentoCatalogo } from '../../domain/entities/procedimento-catalogo.js';
import { ErroDominio } from '../../domain/types.js';
import { reaisTextoParaCentavos } from '../../domain/value-objects/dinheiro.js';
import { Alert } from '../components/ui/alert.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Checkbox } from '../components/ui/checkbox.js';
import { Field } from '../components/ui/field.js';
import { Input } from '../components/ui/input.js';
import { Spinner } from '../components/ui/spinner.js';
import { centavosParaReaisTexto } from '../lib/formatadores.js';
import { useContainer } from '../providers/container-provider.js';

type TipoPreco = 'fixo' | 'faixa';

interface FormularioProcedimento {
  nome: string;
  categoria: string;
  tipoPreco: TipoPreco;
  preco: string;
  precoMinimo: string;
  precoMaximo: string;
  intervaloRetornoDias: string;
  observacaoInterna: string;
}

const FORMULARIO_VAZIO: FormularioProcedimento = {
  nome: '',
  categoria: '',
  tipoPreco: 'fixo',
  preco: '',
  precoMinimo: '',
  precoMaximo: '',
  intervaloRetornoDias: '',
  observacaoInterna: '',
};

function formularioDoProcedimento(p: ProcedimentoCatalogo): FormularioProcedimento {
  const snap = p.toSnapshot();
  const faixa = snap.precoMinimoCentavos != null && snap.precoMaximoCentavos != null;
  return {
    nome: snap.nome,
    categoria: snap.categoria,
    tipoPreco: faixa ? 'faixa' : 'fixo',
    preco: snap.precoCentavos != null ? (snap.precoCentavos / 100).toFixed(2).replace('.', ',') : '',
    precoMinimo: snap.precoMinimoCentavos != null ? (snap.precoMinimoCentavos / 100).toFixed(2).replace('.', ',') : '',
    precoMaximo: snap.precoMaximoCentavos != null ? (snap.precoMaximoCentavos / 100).toFixed(2).replace('.', ',') : '',
    intervaloRetornoDias: snap.intervaloRetornoDias != null ? String(snap.intervaloRetornoDias) : '',
    observacaoInterna: snap.observacaoInterna,
  };
}

function rotuloPreco(p: ProcedimentoCatalogo): string {
  const snap = p.toSnapshot();
  if (snap.precoMinimoCentavos != null && snap.precoMaximoCentavos != null) {
    return `${centavosParaReaisTexto(snap.precoMinimoCentavos)} – ${centavosParaReaisTexto(snap.precoMaximoCentavos)}`;
  }
  return snap.precoCentavos != null ? centavosParaReaisTexto(snap.precoCentavos) : '—';
}

/**
 * Gestão do catálogo de procedimentos (Configurações) — busca, cria,
 * edita, ativa/desativa. Nunca remove de verdade (ver
 * `ProcedimentoCatalogo.desativar`): um procedimento já referenciado por
 * orçamentos antigos precisa continuar existindo, mesmo desativado.
 */
export function CatalogoProcedimentosPage() {
  const container = useContainer();
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [lista, setLista] = useState<ProcedimentoCatalogo[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormularioProcedimento>(FORMULARIO_VAZIO);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [alternandoId, setAlternandoId] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setBuscaAplicada(busca), 200);
    return () => clearTimeout(id);
  }, [busca]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await container.catalogoProcedimentos.listar.executar({
        termo: buscaAplicada,
        incluirInativos: mostrarInativos,
      });
      setLista(resultado);
    } catch {
      setErro('Não foi possível carregar o catálogo agora.');
    } finally {
      setCarregando(false);
    }
  }, [container, buscaAplicada, mostrarInativos]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function abrirNovo(): void {
    setEditandoId(null);
    setForm(FORMULARIO_VAZIO);
    setErroForm(null);
    setFormAberto(true);
  }

  function abrirEdicao(p: ProcedimentoCatalogo): void {
    setEditandoId(p.id);
    setForm(formularioDoProcedimento(p));
    setErroForm(null);
    setFormAberto(true);
  }

  async function salvar(): Promise<void> {
    setErroForm(null);
    let precoCentavos: number | null = null;
    let precoMinimoCentavos: number | null = null;
    let precoMaximoCentavos: number | null = null;
    if (form.tipoPreco === 'fixo') {
      precoCentavos = reaisTextoParaCentavos(form.preco);
      if (precoCentavos === null) {
        setErroForm('Informe um preço válido.');
        return;
      }
    } else {
      precoMinimoCentavos = reaisTextoParaCentavos(form.precoMinimo);
      precoMaximoCentavos = reaisTextoParaCentavos(form.precoMaximo);
      if (precoMinimoCentavos === null || precoMaximoCentavos === null) {
        setErroForm('Informe os dois valores da faixa de preço.');
        return;
      }
    }
    const intervaloRetornoDias = form.intervaloRetornoDias.trim() ? Number(form.intervaloRetornoDias) : null;

    setSalvando(true);
    try {
      const input = {
        nome: form.nome,
        categoria: form.categoria,
        precoCentavos,
        precoMinimoCentavos,
        precoMaximoCentavos,
        intervaloRetornoDias,
        observacaoInterna: form.observacaoInterna,
      };
      if (editandoId) {
        await container.catalogoProcedimentos.editar.executar(editandoId, input);
      } else {
        await container.catalogoProcedimentos.criar.executar(input);
      }
      setFormAberto(false);
      await carregar();
    } catch (erroCapturado) {
      setErroForm(erroCapturado instanceof ErroDominio ? erroCapturado.message : 'Não foi possível salvar o procedimento.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(p: ProcedimentoCatalogo): Promise<void> {
    setAlternandoId(p.id);
    try {
      if (p.ativo) await container.catalogoProcedimentos.desativar.executar(p.id);
      else await container.catalogoProcedimentos.ativar.executar(p.id);
      await carregar();
    } finally {
      setAlternandoId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div>
        <Link
          to="/configuracoes"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-brand-700 dark:hover:text-brand-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar a Configurações
        </Link>
        <h1 className="text-xl font-semibold text-neutral-900">Catálogo de procedimentos</h1>
        <p className="text-sm text-neutral-600">
          Procedimentos reutilizáveis com nome e preço padrão, pra preencher o orçamento mais rápido. Editar aqui nunca
          muda orçamentos já criados — o preço de cada orçamento é sempre fixado no momento em que o item é adicionado.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou categoria" className="pl-8" />
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="mostrar-inativos"
              label="Mostrar desativados"
              checked={mostrarInativos}
              onChange={(e) => setMostrarInativos(e.target.checked)}
            />
            <Button onClick={abrirNovo} className="text-xs">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Novo procedimento
            </Button>
          </div>
        </div>

        {erro && <Alert tone="danger">{erro}</Alert>}

        {formAberto && (
          <div className="flex flex-col gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3 dark:bg-brand-900/10">
            <h2 className="text-sm font-semibold text-neutral-700">
              {editandoId ? 'Editar procedimento' : 'Novo procedimento'}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nome">
                <Input value={form.nome} onChange={(e) => setForm((v) => ({ ...v, nome: e.target.value }))} />
              </Field>
              <Field label="Categoria">
                <Input value={form.categoria} onChange={(e) => setForm((v) => ({ ...v, categoria: e.target.value }))} />
              </Field>
            </div>
            <div className="flex items-center gap-4 text-sm text-neutral-700">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={form.tipoPreco === 'fixo'}
                  onChange={() => setForm((v) => ({ ...v, tipoPreco: 'fixo' }))}
                />
                Preço fixo
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={form.tipoPreco === 'faixa'}
                  onChange={() => setForm((v) => ({ ...v, tipoPreco: 'faixa' }))}
                />
                Faixa de preço (ex.: varia por caso)
              </label>
            </div>
            {form.tipoPreco === 'fixo' ? (
              <Field label="Preço (R$)">
                <Input value={form.preco} onChange={(e) => setForm((v) => ({ ...v, preco: e.target.value }))} placeholder="150,00" />
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mínimo (R$)">
                  <Input value={form.precoMinimo} onChange={(e) => setForm((v) => ({ ...v, precoMinimo: e.target.value }))} />
                </Field>
                <Field label="Máximo (R$)">
                  <Input value={form.precoMaximo} onChange={(e) => setForm((v) => ({ ...v, precoMaximo: e.target.value }))} />
                </Field>
              </div>
            )}
            <Field label="Intervalo de retorno automático, em dias (opcional)">
              <Input
                value={form.intervaloRetornoDias}
                onChange={(e) => setForm((v) => ({ ...v, intervaloRetornoDias: e.target.value }))}
                placeholder="Ex.: 180"
                inputMode="numeric"
              />
            </Field>
            <Field label="Nota interna (opcional — nunca aparece no orçamento impresso)">
              <Input
                value={form.observacaoInterna}
                onChange={(e) => setForm((v) => ({ ...v, observacaoInterna: e.target.value }))}
              />
            </Field>
            {erroForm && <Alert tone="danger">{erroForm}</Alert>}
            <div className="flex gap-2">
              <Button onClick={() => void salvar()} loading={salvando} disabled={!form.nome.trim() || !form.categoria.trim()}>
                Salvar
              </Button>
              <Button variant="secondary" onClick={() => setFormAberto(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {carregando && !lista ? (
          <div className="flex justify-center py-6">
            <Spinner label="Carregando catálogo…" />
          </div>
        ) : lista && lista.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum procedimento encontrado.</p>
        ) : (
          lista && (
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Nome</th>
                    <th scope="col" className="px-3 py-2 font-medium">Categoria</th>
                    <th scope="col" className="px-3 py-2 font-medium">Preço</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {lista.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 text-neutral-800">{p.nome}</td>
                      <td className="px-3 py-2 text-neutral-600">{p.toSnapshot().categoria}</td>
                      <td className="px-3 py-2 text-neutral-600">{rotuloPreco(p)}</td>
                      <td className="px-3 py-2">
                        <Badge tone={p.ativo ? 'success' : 'neutral'}>{p.ativo ? 'Ativo' : 'Desativado'}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="secondary" className="text-xs" onClick={() => abrirEdicao(p)}>
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Editar
                          </Button>
                          <Button
                            variant="secondary"
                            className="text-xs"
                            loading={alternandoId === p.id}
                            onClick={() => void alternarAtivo(p)}
                          >
                            {p.ativo ? (
                              <>
                                <PowerOff className="h-3.5 w-3.5" aria-hidden="true" /> Desativar
                              </>
                            ) : (
                              <>
                                <Power className="h-3.5 w-3.5" aria-hidden="true" /> Ativar
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </Card>
    </div>
  );
}
