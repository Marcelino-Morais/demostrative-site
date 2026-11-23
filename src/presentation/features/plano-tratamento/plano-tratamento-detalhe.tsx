import type { RegistroDental } from '../../../domain/entities/registro-dental.js';
import { RegiaoTratamentoSelector } from './regiao-tratamento-selector.js';
import { interpretarDentesTratamento, textoDentesTratamento } from '../../../domain/value-objects/dentes-tratamento.js';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Paperclip } from 'lucide-react';
import type { PlanoTratamento, StatusPlanoTratamento } from '../../../domain/entities/plano-tratamento.js';
import { calcularPlanoDePagamento, calcularResumoFinanceiro } from '../../../domain/entities/plano-tratamento.js';
import { reaisTextoParaCentavos } from '../../../domain/value-objects/dinheiro.js';
import { ErroDominio } from '../../../domain/types.js';
import { ErroApi } from '../../../application/ports/api-client.js';
import { TIPOS_MIME_COMPROVANTE_ACEITOS } from '../../../application/use-cases/comprovantes-pagamento.js';
import { Alert } from '../../components/ui/alert.js';
import { Badge } from '../../components/ui/badge.js';
import { Button, buttonClassName } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Checkbox } from '../../components/ui/checkbox.js';
import { Field } from '../../components/ui/field.js';
import { Input, Select, Textarea } from '../../components/ui/input.js';
import { centavosParaReaisTexto, formatarDataIso, hojeParaInputDate } from '../../lib/formatadores.js';
import { useRegistrarEdicaoPendente } from '../../providers/edicao-pendente-provider.js';
import { useContainer } from '../../providers/container-provider.js';
import { BotaoWhatsapp } from '../../../../whatsapp-itens/src/presentation/features/whatsapp/botao-whatsapp.js';
import { linhasPlanoDePagamento, resumoCondicoesDePagamento } from './plano-tratamento-format.js';
import { ProcedimentoCatalogoSelector } from './procedimento-catalogo-selector.js';

const STATUS_TOM = {
  ATIVO: 'brand',
  CONCLUIDO: 'success',
  CANCELADO: 'neutral',
} as const;

const STATUS_LABEL = {
  ATIVO: 'Ativo',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
} as const;

const STATUS_OPCOES: StatusPlanoTratamento[] = ['ATIVO', 'CONCLUIDO', 'CANCELADO'];

const FORMAS_PAGAMENTO = [
  'Dinheiro',
  'PIX',
  'Cartão de débito',
  'Cartão de crédito',
  'Transferência',
  'Cheque',
  'Outro',
];

interface CamposItem {
  dente: string;
  regiao: string;
  trabalho: string;
  valor: string;
  quantidade: string;
  observacao: string;
  /** Procedimento do catálogo que originou os campos acima — `null` para item de texto livre. */
  procedimentoId: string | null;
  registroDentalId: string | null;
  valorReferenciaCentavos: number | null;
  /** Faixa de preço do procedimento selecionado (ex.: extração infantil) — obriga o operador a digitar um valor dentro dela, nunca escolhido sozinho. */
  faixaPreco: { minimoCentavos: number; maximoCentavos: number } | null;
}

const ITEM_VAZIO: CamposItem = {
  dente: '',
  regiao: '',
  trabalho: '',
  valor: '',
  quantidade: '1',
  observacao: '',
  procedimentoId: null,
  registroDentalId: null,
  valorReferenciaCentavos: null,
  faixaPreco: null,
};

/**
 * Sem aviso de "sair sem salvar" de propósito (revisão de segurança
 * operacional, Etapa 47): item de plano, pagamento e condições de
 * pagamento são formulários curtos de campos objetivos (dente,
 * trabalho, valor, data) — rápidos de refazer, ao contrário de um
 * texto longo como a Anamnese/Evolução clínica. Isso é só sobre o aviso
 * ao SAIR da página — registrar no `EdicaoPendenteProvider` (pra adiar
 * o popup automático de novas solicitações) é preocupação separada e
 * continua valendo para estes sub-formulários.
 */
export function PlanoTratamentoDetalhe({
  plano,
  denteInicial,
  registrosOdontograma = [],
  whatsappLiberado = false,
  onAtualizado,
}: {
  plano: PlanoTratamento;
  denteInicial?: number | null;
  registrosOdontograma?: RegistroDental[];
  /** Número válido E consentimento de WhatsApp AUTORIZADO — calculado na aba, que tem o paciente inteiro. */
  whatsappLiberado?: boolean;
  onAtualizado: () => void;
}) {
  const container = useContainer();
  const snap = plano.toSnapshot();
  const resumo = calcularResumoFinanceiro(snap);
  const planoDePagamento = calcularPlanoDePagamento(resumo.valorTotalCentavos, snap.condicoesDePagamento);
  const linhasPagamento = linhasPlanoDePagamento(planoDePagamento, snap.condicoesDePagamento);
  const textoCondicoes = resumoCondicoesDePagamento(snap.condicoesDePagamento);

  const [novoItem, setNovoItem] = useState<CamposItem>(ITEM_VAZIO);
  useEffect(() => {
    if (denteInicial) setNovoItem(atual => ({ ...atual, dente: String(denteInicial) }));
  }, [denteInicial]);
  const [erroItem, setErroItem] = useState<string | null>(null);
  const [salvandoItem, setSalvandoItem] = useState(false);

  const [editandoItemId, setEditandoItemId] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<CamposItem>(ITEM_VAZIO);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [removendoItemId, setRemovendoItemId] = useState<string | null>(null);

  const [dataPagamento, setDataPagamento] = useState(hojeParaInputDate());
  const [valorPagamento, setValorPagamento] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('');
  const [confirmadoPaciente, setConfirmadoPaciente] = useState(false);
  const [confirmadoDentista, setConfirmadoDentista] = useState(false);
  const [observacaoPagamento, setObservacaoPagamento] = useState('');
  const [erroPagamento, setErroPagamento] = useState<string | null>(null);
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);
  const [removendoPagamentoId, setRemovendoPagamentoId] = useState<string | null>(null);
  // Comprovante de pagamento (Etapa 54) — só existe em modo servidor; ver `container.sincronizacaoNucleo`.
  const [arquivoComprovante, setArquivoComprovante] = useState<File | null>(null);
  const inputComprovanteRef = useRef<HTMLInputElement>(null);
  const [avisoComprovante, setAvisoComprovante] = useState<string | null>(null);

  const [descontoAVista, setDescontoAVista] = useState(String(snap.condicoesDePagamento.descontoAVistaPercentual ?? ''));
  const [percentualEntrada, setPercentualEntrada] = useState(String(snap.condicoesDePagamento.percentualEntrada ?? ''));
  const [parcelasCartao, setParcelasCartao] = useState(String(snap.condicoesDePagamento.parcelasCartaoSemJuros ?? ''));
  const [observacoesCondicoes, setObservacoesCondicoes] = useState(snap.condicoesDePagamento.observacoes);
  const [salvandoCondicoes, setSalvandoCondicoes] = useState(false);
  const [alterandoStatus, setAlterandoStatus] = useState(false);
  const [alterandoEmergencia, setAlterandoEmergencia] = useState(false);

  // Qualquer um dos 4 sub-formulários desta tela com algo não salvo —
  // adia o popup automático de novas solicitações. Nunca reabre aviso de
  // "sair sem salvar" (Etapa 47 preservada).
  const novoItemSujo =
    novoItem.trabalho.trim() !== '' ||
    novoItem.dente.trim() !== '' ||
    novoItem.regiao.trim() !== '' ||
    novoItem.valor.trim() !== '' ||
    novoItem.observacao.trim() !== '' ||
    novoItem.quantidade !== '1';
  const edicaoItemSujo = editandoItemId !== null;
  const pagamentoSujo =
    valorPagamento.trim() !== '' ||
    metodoPagamento !== '' ||
    observacaoPagamento.trim() !== '' ||
    arquivoComprovante !== null ||
    confirmadoPaciente ||
    confirmadoDentista;
  const condicoesSujo =
    descontoAVista !== String(snap.condicoesDePagamento.descontoAVistaPercentual ?? '') ||
    percentualEntrada !== String(snap.condicoesDePagamento.percentualEntrada ?? '') ||
    parcelasCartao !== String(snap.condicoesDePagamento.parcelasCartaoSemJuros ?? '') ||
    observacoesCondicoes !== snap.condicoesDePagamento.observacoes;
  useRegistrarEdicaoPendente(useId(), novoItemSujo || edicaoItemSujo || pagamentoSujo || condicoesSujo);

  async function handleAdicionarItem(): Promise<void> {
    const centavos = reaisTextoParaCentavos(novoItem.valor);
    if (centavos === null) {
      setErroItem('Informe um valor válido.');
      return;
    }
    if (novoItem.faixaPreco && (centavos < novoItem.faixaPreco.minimoCentavos || centavos > novoItem.faixaPreco.maximoCentavos)) {
      setErroItem(
        `Este procedimento tem faixa de preço: escolha um valor entre ${centavosParaReaisTexto(novoItem.faixaPreco.minimoCentavos)} e ${centavosParaReaisTexto(novoItem.faixaPreco.maximoCentavos)}.`,
      );
      return;
    }
    const quantidade = Number(novoItem.quantidade);
    setSalvandoItem(true);
    setErroItem(null);
    try {
      await container.planoTratamento.adicionarItem.executar(plano.id, {
        ...interpretarDentesTratamento(novoItem.dente),
        regiao: novoItem.regiao,
        trabalhoAExecutar: novoItem.trabalho,
        valorCentavos: centavos,
        quantidade,
        observacao: novoItem.observacao,
        procedimentoId: novoItem.procedimentoId,
        registroDentalId: novoItem.registroDentalId,
      });
      setNovoItem({ ...ITEM_VAZIO, dente: denteInicial ? String(denteInicial) : '' });
      onAtualizado();
    } catch (erro) {
      setErroItem(erro instanceof ErroDominio ? erro.message : 'Não foi possível adicionar o item.');
    } finally {
      setSalvandoItem(false);
    }
  }

  function iniciarEdicao(itemId: string): void {
    const item = snap.itens.find((i) => i.id === itemId);
    if (!item) return;
    setEdicao({
      dente: item.todosOsDentes ? 'Todos' : textoDentesTratamento(item),
      regiao: item.regiao,
      trabalho: item.trabalhoAExecutar,
      valor: (item.valorCentavos / 100).toFixed(2).replace('.', ','),
      quantidade: String(item.quantidade ?? 1),
      observacao: item.observacao,
      procedimentoId: item.procedimentoId,
      registroDentalId: item.registroDentalId ?? null,
      valorReferenciaCentavos: null,
      faixaPreco: null,
    });
    setErroEdicao(null);
    setEditandoItemId(itemId);
  }

  async function handleSalvarEdicao(): Promise<void> {
    if (!editandoItemId) return;
    const centavos = reaisTextoParaCentavos(edicao.valor);
    if (centavos === null) {
      setErroEdicao('Informe um valor válido.');
      return;
    }
    const quantidade = Number(edicao.quantidade);
    setSalvandoEdicao(true);
    setErroEdicao(null);
    try {
      await container.planoTratamento.editarItem.executar(plano.id, editandoItemId, {
        ...interpretarDentesTratamento(edicao.dente),
        regiao: edicao.regiao,
        trabalhoAExecutar: edicao.trabalho,
        valorCentavos: centavos,
        quantidade,
        observacao: edicao.observacao,
        // Edição nunca troca qual procedimento do catálogo originou o item
        // — só ajusta descrição/valor/quantidade (preservado de `iniciarEdicao`).
        procedimentoId: edicao.procedimentoId,
        registroDentalId: edicao.registroDentalId,
      });
      setEditandoItemId(null);
      onAtualizado();
    } catch (erro) {
      setErroEdicao(erro instanceof ErroDominio ? erro.message : 'Não foi possível salvar o item.');
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function handleMarcarConcluido(itemId: string, concluido: boolean): Promise<void> {
    await container.planoTratamento.marcarItemConcluido.executar(plano.id, itemId, concluido);
    onAtualizado();
  }

  async function handleRemoverItem(itemId: string): Promise<void> {
    await container.planoTratamento.removerItem.executar(plano.id, itemId);
    setRemovendoItemId(null);
    onAtualizado();
  }

  async function handleRegistrarPagamento(): Promise<void> {
    const centavos = reaisTextoParaCentavos(valorPagamento);
    if (centavos === null) {
      setErroPagamento('Informe um valor válido.');
      return;
    }
    setSalvandoPagamento(true);
    setErroPagamento(null);
    try {
      const atualizado = await container.planoTratamento.registrarPagamento.executar(plano.id, {
        data: dataPagamento,
        valorCentavos: centavos,
        metodo: metodoPagamento,
        confirmadoPeloPaciente: confirmadoPaciente,
        confirmadoPelaDentista: confirmadoDentista,
        observacao: observacaoPagamento,
      });

      // O comprovante só pode ser enviado DEPOIS que o pagamento existe
      // (o id é gerado nesse passo, não escolhido de fora) — por isso é
      // um segundo passo, não parte do mesmo envio. Um problema aqui
      // NUNCA desfaz o pagamento, que já foi registrado com sucesso.
      if (arquivoComprovante) {
        const novoPagamento = atualizado.toSnapshot().pagamentos.at(-1);
        if (novoPagamento) {
          try {
            const comprovante = await container.comprovantes.enviar.executar(
              {
                pagamentoId: novoPagamento.id,
                planoId: plano.id,
                pacienteId: snap.pacienteId,
                nome: arquivoComprovante.name,
                tipoMime: arquivoComprovante.type,
              },
              arquivoComprovante,
            );
            await container.planoTratamento.anexarComprovante.executar(plano.id, novoPagamento.id, comprovante.id);
          } catch (erroComprovante) {
            setErroPagamento(
              `Pagamento registrado, mas o comprovante não pôde ser anexado: ${
                erroComprovante instanceof ErroDominio || erroComprovante instanceof ErroApi
                  ? erroComprovante.message
                  : 'erro inesperado.'
              }`,
            );
          }
        }
      }

      setValorPagamento('');
      setMetodoPagamento('');
      setConfirmadoPaciente(false);
      setConfirmadoDentista(false);
      setObservacaoPagamento('');
      setArquivoComprovante(null);
      if (inputComprovanteRef.current) inputComprovanteRef.current.value = '';
      onAtualizado();
    } catch (erro) {
      setErroPagamento(erro instanceof ErroDominio ? erro.message : 'Não foi possível registrar o pagamento.');
    } finally {
      setSalvandoPagamento(false);
    }
  }

  async function handleRemoverPagamento(pagamentoId: string): Promise<void> {
    await container.planoTratamento.removerPagamento.executar(plano.id, pagamentoId);
    setRemovendoPagamentoId(null);
    onAtualizado();
  }

  async function abrirComprovante(id: string): Promise<void> {
    setAvisoComprovante(null);
    try {
      const blob = await container.comprovantes.baixar.executar(id);
      if (!blob) {
        setAvisoComprovante('O servidor não encontrou o conteúdo deste comprovante.');
        return;
      }
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setAvisoComprovante(e instanceof ErroApi ? e.message : 'Não foi possível abrir o comprovante.');
    }
  }

  async function handleSalvarCondicoes(): Promise<void> {
    setSalvandoCondicoes(true);
    try {
      await container.planoTratamento.definirCondicoesDePagamento.executar(plano.id, {
        descontoAVistaPercentual: descontoAVista ? Number(descontoAVista) : null,
        percentualEntrada: percentualEntrada ? Number(percentualEntrada) : null,
        parcelasCartaoSemJuros: parcelasCartao ? Number(parcelasCartao) : null,
        observacoes: observacoesCondicoes,
      });
      onAtualizado();
    } finally {
      setSalvandoCondicoes(false);
    }
  }

  async function handleAlterarStatus(novoStatus: StatusPlanoTratamento): Promise<void> {
    setAlterandoStatus(true);
    try {
      await container.planoTratamento.definirStatus.executar(plano.id, novoStatus);
      onAtualizado();
    } finally {
      setAlterandoStatus(false);
    }
  }

  async function handleAlterarEmergencia(valor: boolean): Promise<void> {
    setAlterandoEmergencia(true);
    try {
      await container.planoTratamento.definirEmergencia.executar(plano.id, valor);
      onAtualizado();
    } finally {
      setAlterandoEmergencia(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-500">Criado em {formatarDataIso(snap.criadoEm)}</p>
        <div className="no-print flex items-center gap-3">
          <Link
            to={`/pacientes/${snap.pacienteId}/orcamento/${snap.id}`}
            className={buttonClassName('secondary', 'text-sm')}
          >
            <FileText className="h-4 w-4" aria-hidden="true" /> Ver / imprimir orçamento
          </Link>
          <div className="flex items-center gap-2">
            <label htmlFor="status-plano" className="text-xs font-medium text-neutral-600">
              Status do plano
            </label>
            <Select
              id="status-plano"
              value={snap.status}
              disabled={alterandoStatus}
              onChange={(e) => void handleAlterarStatus(e.target.value as StatusPlanoTratamento)}
              className="min-h-9 w-auto py-0 text-sm"
            >
              {STATUS_OPCOES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase text-neutral-500">Valor planejado</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900">{centavosParaReaisTexto(resumo.valorTotalCentavos)}</p>
          {resumo.taxaEmergenciaCentavos > 0 && (
            <p className="mt-0.5 text-xs text-neutral-500">
              Trabalhos {centavosParaReaisTexto(resumo.valorItensCentavos)} + emergência{' '}
              {centavosParaReaisTexto(resumo.taxaEmergenciaCentavos)}
            </p>
          )}
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-neutral-500">Pago</p>
          <p className="mt-1 text-xl font-semibold text-success-700 dark:text-success-500">
            {centavosParaReaisTexto(resumo.valorPagoCentavos)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-neutral-500">Saldo devedor</p>
          <p
            className={`mt-1 text-xl font-semibold ${resumo.saldoDevedorCentavos > 0 ? 'text-danger-700 dark:text-danger-500' : 'text-neutral-900'}`}
          >
            {centavosParaReaisTexto(resumo.saldoDevedorCentavos)}
          </p>
        </Card>
      </div>

      <div className="no-print flex flex-col gap-2">
        <Checkbox
          id={`plano-emergencia-${snap.id}`}
          label={`Atendimento de emergência (soma ${centavosParaReaisTexto(snap.taxaEmergenciaCentavos ?? 15000)} ao valor planejado)`}
          checked={snap.emergencia}
          disabled={alterandoEmergencia}
          onChange={(e) => void handleAlterarEmergencia(e.target.checked)}
        />
        {snap.emergencia && <Alert tone="warning">Taxa adicional deste plano: {centavosParaReaisTexto(resumo.taxaEmergenciaCentavos)}</Alert>}
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 data-tour="trabalhos-tratamento" className="text-sm font-semibold text-neutral-700">Trabalho a executar</h2>
          <Badge tone={STATUS_TOM[snap.status]}>{STATUS_LABEL[snap.status]}</Badge>
        </div>

        {snap.itens.length === 0 && <p className="text-sm text-neutral-500">Nenhum item lançado ainda.</p>}
        {snap.itens.length > 0 && (
          <div className="imprimir-expandir relative overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full min-w-[36rem] text-left text-sm print:min-w-0">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Dente / região</th>
                  <th scope="col" className="px-3 py-2 font-medium">Trabalho a executar</th>
                  <th scope="col" className="px-3 py-2 font-medium">Valor</th>
                  <th scope="col" className="px-3 py-2 font-medium">Concluído</th>
                  <th scope="col" className="no-print px-3 py-2 font-medium">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {snap.itens.map((item) =>
                  editandoItemId === item.id ? (
                    <tr key={item.id} className="no-print">
                      <td colSpan={5} className="px-3 py-3">
                        <div className="flex flex-col gap-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[10rem_10rem_1fr_8rem_5rem]">
                            <Field label="Dente(s)">
                              <Input
                                placeholder="11, 12; 21 ou Todos"
                                value={edicao.dente}
                                onChange={(e) => setEdicao((v) => ({ ...v, dente: e.target.value }))}
                                inputMode="text"
                              />
                            </Field>
                            <Field label="Região">
                              <RegiaoTratamentoSelector value={edicao.regiao} onChange={(regiao) => setEdicao((v) => ({ ...v, regiao }))} />
                            </Field>
                            <Field label="Trabalho a executar">
                              <Input
                                value={edicao.trabalho}
                                onChange={(e) => setEdicao((v) => ({ ...v, trabalho: e.target.value }))}
                              />
                            </Field>
                            <Field label="Valor (R$)">
                              <Input
                                value={edicao.valor}
                                onChange={(e) => setEdicao((v) => ({ ...v, valor: e.target.value }))}
                              />
                            </Field>
                            <Field label="Quantidade">
                              <Input
                                value={edicao.quantidade}
                                onChange={(e) => setEdicao((v) => ({ ...v, quantidade: e.target.value }))}
                                inputMode="text"
                              />
                            </Field>
                          </div>
                          <Field label="Observação">
                            <Input
                              value={edicao.observacao}
                              onChange={(e) => setEdicao((v) => ({ ...v, observacao: e.target.value }))}
                              placeholder="Opcional"
                            />
                          </Field>
                          {erroEdicao && <Alert tone="danger">{erroEdicao}</Alert>}
                          <div className="flex gap-2">
                            <Button onClick={() => void handleSalvarEdicao()} loading={salvandoEdicao} className="self-start">
                              Salvar item
                            </Button>
                            <Button variant="secondary" onClick={() => setEditandoItemId(null)} className="self-start">
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.id}>
                      <td className="px-3 py-2 align-top text-neutral-700">
                        {textoDentesTratamento(item) || item.regiao || '—'}
                        {item.numeroDente !== null && item.regiao && (
                          <span className="block text-xs text-neutral-400">{item.regiao}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-neutral-900">
                        {item.trabalhoAExecutar}
                        {item.observacao && (
                          <span className="block text-xs font-normal text-neutral-500">{item.observacao}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-neutral-700">
                        {centavosParaReaisTexto(item.valorCentavos)}
                        {item.quantidade > 1 && (
                          <span className="block text-xs text-neutral-400">
                            × {item.quantidade} = {centavosParaReaisTexto(item.valorCentavos * item.quantidade)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Checkbox
                          id={`item-concluido-${item.id}`}
                          label=""
                          aria-label={`Marcar "${item.trabalhoAExecutar}" como concluído`}
                          checked={item.concluido}
                          onChange={(e) => void handleMarcarConcluido(item.id, e.target.checked)}
                        />
                      </td>
                      <td className="no-print border-l border-neutral-200 bg-surface px-3 py-2 align-top text-right">
                        {removendoItemId === item.id ? (
                          <span className="flex flex-col items-end gap-1">
                            <span className="text-xs text-neutral-500">Remover?</span>
                            <span className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void handleRemoverItem(item.id)}
                                className="text-xs font-medium text-danger-600 hover:underline dark:text-danger-500"
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                onClick={() => setRemovendoItemId(null)}
                                className="text-xs font-medium text-neutral-500 hover:underline"
                              >
                                Não
                              </button>
                            </span>
                          </span>
                        ) : (
                          <span className="flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => iniciarEdicao(item.id)}
                              className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setRemovendoItemId(item.id)}
                              className="text-xs font-medium text-danger-600 hover:underline dark:text-danger-500"
                            >
                              Remover
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
              <tfoot className="border-t border-neutral-200">
                {resumo.taxaEmergenciaCentavos > 0 && (
                  <>
                    <tr>
                      <td className="px-3 py-2 text-neutral-700" colSpan={2}>
                        Trabalhos a executar
                      </td>
                      <td className="px-3 py-2 text-neutral-700">{centavosParaReaisTexto(resumo.valorItensCentavos)}</td>
                      <td className="px-3 py-2" />
                      <td className="no-print px-3 py-2" />
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-neutral-700" colSpan={2}>
                        Taxa de atendimento de emergência
                      </td>
                      <td className="px-3 py-2 text-neutral-700">
                        {centavosParaReaisTexto(resumo.taxaEmergenciaCentavos)}
                      </td>
                      <td className="px-3 py-2" />
                      <td className="no-print px-3 py-2" />
                    </tr>
                  </>
                )}
                <tr>
                  <td className="px-3 py-2 text-xs font-semibold uppercase text-neutral-500" colSpan={2}>
                    Total planejado
                  </td>
                  <td className="px-3 py-2 font-semibold text-neutral-900">
                    {centavosParaReaisTexto(resumo.valorTotalCentavos)}
                  </td>
                  <td className="px-3 py-2" />
                  <td className="no-print px-3 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {erroItem && <Alert tone="danger" className="no-print">{erroItem}</Alert>}
        <div className="no-print flex flex-col gap-3">
          <ProcedimentoCatalogoSelector
            registros={registrosOdontograma}
            pacienteId={snap.pacienteId}
            valor={novoItem.registroDentalId ? `odontograma:${novoItem.registroDentalId}` : novoItem.procedimentoId ?? ''}
            onSelecionar={(resultado) =>
              setNovoItem((v) => ({
                ...v,
                trabalho: resultado.nome,
                valor: resultado.precoCentavos != null ? (resultado.precoCentavos / 100).toFixed(2).replace('.', ',') : '',
                procedimentoId: resultado.registroDentalId ? null : resultado.id || null,
                registroDentalId: resultado.registroDentalId ?? null,
                valorReferenciaCentavos: resultado.registroDentalId ? resultado.precoCentavos : null,
                dente: resultado.numeroDente ? String(resultado.numeroDente) : v.dente,
                faixaPreco: resultado.faixa,
              }))
            }
          />
          {novoItem.registroDentalId && <p role="status" className="text-sm text-brand-800">{novoItem.valorReferenciaCentavos !== null ? `Valor de referência do odontograma: ${centavosParaReaisTexto(novoItem.valorReferenciaCentavos)}. Confira o valor do orçamento antes de adicionar.` : 'Este registro não tem valor de referência. Informe o valor do orçamento.'}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[10rem_10rem_1fr_8rem_5rem]">
            <Field label="Dente(s)" hint="Ex.: 11, 12; 21 ou Todos para limpeza geral.">
              <Input
                value={novoItem.dente}
                onChange={(e) => setNovoItem((v) => ({ ...v, dente: e.target.value }))}
                placeholder="11, 12; 21 ou Todos"
                inputMode="numeric"
              />
            </Field>
            <Field label="Região">
              <RegiaoTratamentoSelector value={novoItem.regiao} onChange={(regiao) => setNovoItem((v) => ({ ...v, regiao }))} />
            </Field>
            <Field label="Trabalho a executar">
              <Input
                value={novoItem.trabalho}
                onChange={(e) => setNovoItem((v) => ({ ...v, trabalho: e.target.value, procedimentoId: null, registroDentalId: null, valorReferenciaCentavos: null, faixaPreco: null }))}
                placeholder="Ex.: Restauração em resina"
              />
            </Field>
            <Field label={novoItem.faixaPreco ? `Valor (R$) — entre ${centavosParaReaisTexto(novoItem.faixaPreco.minimoCentavos)} e ${centavosParaReaisTexto(novoItem.faixaPreco.maximoCentavos)}` : 'Valor (R$)'}>
              <Input
                value={novoItem.valor}
                onChange={(e) => setNovoItem((v) => ({ ...v, valor: e.target.value }))}
                placeholder={novoItem.faixaPreco ? 'Obrigatório — escolha um valor' : '150,00'}
              />
            </Field>
            <Field label="Quantidade">
              <Input
                value={novoItem.quantidade}
                onChange={(e) => setNovoItem((v) => ({ ...v, quantidade: e.target.value }))}
                inputMode="numeric"
              />
            </Field>
          </div>
          <Field label="Observação (opcional)">
            <Input
              value={novoItem.observacao}
              onChange={(e) => setNovoItem((v) => ({ ...v, observacao: e.target.value }))}
              placeholder="Ex.: sob anestesia; encaminhar para endodontia antes"
            />
          </Field>
          <Button
            onClick={() => void handleAdicionarItem()}
            loading={salvandoItem}
            disabled={!novoItem.trabalho.trim()}
            className="self-start"
          >
            Adicionar procedimento
          </Button>
        </div>
        <section aria-label="Condições de pagamento" className="mt-2 flex flex-col gap-3 border-t border-neutral-200 pt-4">
        <h2 data-tour="condicoes-pagamento" className="text-sm font-semibold text-neutral-700">Condições de pagamento</h2>
        <div className="no-print grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Desconto à vista (%)">
            <Input
              type="number"
              min={0}
              max={100}
              value={descontoAVista}
              onChange={(e) => setDescontoAVista(e.target.value)}
              placeholder="Ex.: 10"
            />
          </Field>
          <Field label="Entrada (%)">
            <Input
              type="number"
              min={0}
              max={100}
              value={percentualEntrada}
              onChange={(e) => setPercentualEntrada(e.target.value)}
              placeholder="Ex.: 5"
            />
          </Field>
          <Field label="Parcelas no cartão sem juros">
            <Input
              type="number"
              min={0}
              value={parcelasCartao}
              onChange={(e) => setParcelasCartao(e.target.value)}
              placeholder="Ex.: 4"
            />
          </Field>
        </div>
        <div className="no-print flex flex-col gap-3">
          <Field
            label="Acordo / observações"
            hint='Ex.: "todo tratamento se inicia mediante entrada"; nota sobre juros no cartão parcelado.'
          >
            <Textarea value={observacoesCondicoes} onChange={(e) => setObservacoesCondicoes(e.target.value)} />
          </Field>
          <Button onClick={() => void handleSalvarCondicoes()} loading={salvandoCondicoes} variant="secondary" className="self-start">
            Salvar condições de pagamento
          </Button>
        </div>

        <div className="border-t border-neutral-100 pt-3 text-sm text-neutral-600">
          <p className="text-xs font-medium uppercase text-neutral-500">Plano de pagamento deste orçamento</p>
          {resumo.taxaEmergenciaCentavos > 0 && (
            <p className="mt-1 font-medium text-warning-700 dark:text-warning-400">
              Inclui taxa de atendimento de emergência: {centavosParaReaisTexto(resumo.taxaEmergenciaCentavos)}.
            </p>
          )}
          {resumo.valorTotalCentavos === 0 ? (
            <p className="mt-1 text-neutral-500">Lance os trabalhos a executar para calcular o plano de pagamento.</p>
          ) : linhasPagamento.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {linhasPagamento.map((linha) => (
                <li key={linha}>{linha}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-neutral-500">Nenhuma condição estruturada definida — só o valor total à vista.</p>
          )}
          {snap.condicoesDePagamento.observacoes.trim() && (
            <p className="mt-2 text-neutral-700">{snap.condicoesDePagamento.observacoes.trim()}</p>
          )}
          <p className="mt-2 text-xs text-neutral-500">
            Orçamento válido até {formatarDataIso(snap.validoAte)}.
            {textoCondicoes === null && ' Condições de pagamento ainda não definidas para este plano.'}
          </p>
        </div>
        </section>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 data-tour="pagamentos-tratamento" className="text-sm font-semibold text-neutral-700">Pagamentos efetuados</h2>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-neutral-600">
          <span>
            Total pago: <span className="font-medium text-neutral-900">{centavosParaReaisTexto(resumo.valorPagoCentavos)}</span>
          </span>
          <span>
            Saldo devedor:{' '}
            <span className={`font-medium ${resumo.saldoDevedorCentavos > 0 ? 'text-danger-700 dark:text-danger-500' : 'text-neutral-900'}`}>
              {centavosParaReaisTexto(resumo.saldoDevedorCentavos)}
            </span>
          </span>
          {whatsappLiberado && resumo.saldoDevedorCentavos > 0 && (
            <span className="no-print">
              <BotaoWhatsapp
                rotulo="Lembrete de pagamento no WhatsApp"
                preparar={() => container.whatsapp.prepararLembretePagamento.executar(plano.id)}
                aoAbrir={(numeroNormalizado, tipo) =>
                  container.whatsapp.registrarAbertura.executar({ pacienteId: snap.pacienteId, tipo, numeroNormalizado })
                }
              />
            </span>
          )}
        </div>
        {snap.pagamentos.length === 0 && <p className="text-sm text-neutral-500">Nenhum pagamento registrado ainda.</p>}
        {snap.pagamentos.length > 0 && (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {snap.pagamentos.map((pagamento) => (
              <li key={pagamento.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="font-medium text-neutral-900">{centavosParaReaisTexto(pagamento.valorCentavos)}</span>
                <span className="text-neutral-500">{formatarDataIso(pagamento.data)}</span>
                {pagamento.metodo && <Badge tone="neutral">{pagamento.metodo}</Badge>}
                {pagamento.confirmadoPeloPaciente && <Badge tone="success">Paciente confirmou</Badge>}
                {pagamento.confirmadoPelaDentista && <Badge tone="brand">Dentista confirmou</Badge>}
                {pagamento.comprovanteArquivoId && (
                  <button
                    type="button"
                    onClick={() => void abrirComprovante(pagamento.comprovanteArquivoId!)}
                    className="no-print inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
                    title="Abrir comprovante"
                  >
                    <Paperclip className="h-3 w-3" aria-hidden="true" /> Comprovante
                  </button>
                )}
                {removendoPagamentoId === pagamento.id ? (
                  <span className="no-print ml-auto flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Remover?</span>
                    <button
                      type="button"
                      onClick={() => void handleRemoverPagamento(pagamento.id)}
                      className="text-xs font-medium text-danger-600 hover:underline dark:text-danger-500"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemovendoPagamentoId(null)}
                      className="text-xs font-medium text-neutral-500 hover:underline"
                    >
                      Não
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRemovendoPagamentoId(pagamento.id)}
                    className="no-print ml-auto text-xs font-medium text-danger-600 hover:underline dark:text-danger-500"
                  >
                    Remover
                  </button>
                )}
                {pagamento.observacao && <span className="w-full text-neutral-500">{pagamento.observacao}</span>}
              </li>
            ))}
          </ul>
        )}

        {erroPagamento && <Alert tone="danger" className="no-print">{erroPagamento}</Alert>}
        <div className="no-print flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Data do pagamento">
              <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
            </Field>
            <Field label="Valor recebido (R$)">
              <Input value={valorPagamento} onChange={(e) => setValorPagamento(e.target.value)} placeholder="150,00" />
            </Field>
            <Field label="Forma de pagamento">
              <Select value={metodoPagamento} onChange={(e) => setMetodoPagamento(e.target.value)}>
                <option value="">Não informar</option>
                {FORMAS_PAGAMENTO.map((forma) => (
                  <option key={forma} value={forma}>
                    {forma}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Observação do pagamento">
            <Input value={observacaoPagamento} onChange={(e) => setObservacaoPagamento(e.target.value)} />
          </Field>
          {container.sincronizacaoNucleo && (
            <Field
              label="Comprovante (opcional)"
              hint="Foto ou PDF do comprovante — nunca obrigatório. O arquivo fica só no servidor da clínica, não entra no backup baixado pelo navegador (ver tela Backup)."
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={inputComprovanteRef}
                  type="file"
                  accept={TIPOS_MIME_COMPROVANTE_ACEITOS.join(',')}
                  onChange={(e) => setArquivoComprovante(e.target.files?.[0] ?? null)}
                  className="text-sm text-neutral-600 file:mr-2 file:rounded-md file:border file:border-neutral-300 file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-50"
                />
                {arquivoComprovante && (
                  <button
                    type="button"
                    onClick={() => {
                      setArquivoComprovante(null);
                      if (inputComprovanteRef.current) inputComprovanteRef.current.value = '';
                    }}
                    className="text-xs font-medium text-neutral-500 hover:underline"
                  >
                    Remover arquivo escolhido
                  </button>
                )}
              </div>
            </Field>
          )}
          {avisoComprovante && <Alert tone="danger" className="no-print">{avisoComprovante}</Alert>}
          <div className="flex flex-wrap gap-4">
            <Checkbox
              id="confirmado-paciente"
              label="Confirmado pelo paciente"
              checked={confirmadoPaciente}
              onChange={(e) => setConfirmadoPaciente(e.target.checked)}
            />
            <Checkbox
              id="confirmado-dentista"
              label="Confirmado pela dentista"
              checked={confirmadoDentista}
              onChange={(e) => setConfirmadoDentista(e.target.checked)}
            />
          </div>
          <Button onClick={() => void handleRegistrarPagamento()} loading={salvandoPagamento} className="self-start">
            Registrar pagamento
          </Button>
        </div>
      </Card>


    </div>
  );
}
