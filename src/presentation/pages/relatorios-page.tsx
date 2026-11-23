import { FechamentoFinanceiro } from '../features/plano-tratamento/fechamento-financeiro.js';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Download, Printer } from 'lucide-react';
import type {
  RelatorioClinico,
  RelatorioConsultas,
  RelatorioFinanceiro,
} from '../../application/use-cases/relatorios.js';
import { STATUS_CONSULTA_ORDEM } from '../../application/use-cases/relatorios.js';
import { STATUS_CONSULTA_LABEL, TOM_POR_STATUS_CONSULTA } from '../../domain/entities/consulta.js';
import { CONFIGURACAO_CLINICA } from '../../infrastructure/bootstrap/configuracao-clinica.js';
import { Alert } from '../components/ui/alert.js';
import { Badge } from '../components/ui/badge.js';
import { Button, buttonClassName } from '../components/ui/button.js';
import { CabecalhoImpressao } from '../components/ui/cabecalho-impressao.js';
import { Card } from '../components/ui/card.js';
import { Input } from '../components/ui/input.js';
import { Spinner } from '../components/ui/spinner.js';
import { montarCsv, baixarTexto, type CelulaCsv } from '../lib/csv.js';
import { adicionarDias, fimDoMes, hojeIso, inicioDaSemana, inicioDoMes } from '../lib/datas-agenda.js';
import { centavosParaReaisTexto, formatarDataHoraIso, formatarDataIso } from '../lib/formatadores.js';
import { useDataDaClinica } from '../lib/use-data-da-clinica.js';
import { cn } from '../lib/cn.js';
import { useContainer } from '../providers/container-provider.js';

type Periodo = 'hoje' | 'semana' | 'mes' | 'personalizado';

const PERIODO_LABEL: Record<Periodo, string> = {
  hoje: 'Hoje',
  semana: 'Esta semana',
  mes: 'Este mês',
  personalizado: 'Personalizado',
};

function intervaloDoPeriodo(periodo: Periodo, inicioCustom: string, fimCustom: string): [string, string] {
  const hoje = hojeIso();
  switch (periodo) {
    case 'hoje':
      return [hoje, hoje];
    case 'semana': {
      const inicio = inicioDaSemana(hoje);
      return [inicio, adicionarDias(inicio, 6)];
    }
    case 'mes':
      return [inicioDoMes(hoje), fimDoMes(hoje)];
    case 'personalizado':
      return inicioCustom <= fimCustom ? [inicioCustom, fimCustom] : [fimCustom, inicioCustom];
  }
}

function Numero({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: 'danger' | 'success' }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-neutral-500">{rotulo}</p>
      <p
        className={cn(
          'mt-0.5 text-lg font-semibold text-neutral-900',
          tom === 'danger' && 'text-danger-700 dark:text-danger-500',
          tom === 'success' && 'text-success-700 dark:text-success-500',
        )}
      >
        {valor}
      </p>
    </div>
  );
}

function ChipPeriodo({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        ativo
          ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
          : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-200/10',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Relatórios de gestão (Etapa 15) — panorama clínico, financeiro e de
 * consultas de um consultório único. A tela só escolhe o período e
 * desenha; TODA a conta (`GerarRelatorio*`) vive na camada de
 * aplicação. Impressão reaproveita o `@media print` global; o CSV é
 * gerado no navegador sem dependência (`lib/csv.ts`) e traz só
 * agregados / dados operacionais, nunca resposta de anamnese.
 */
export function RelatoriosPage() {
  const container = useContainer();
  const hoje = useDataDaClinica();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [inicioCustom, setInicioCustom] = useState(hojeIso());
  const [fimCustom, setFimCustom] = useState(hojeIso());

  const [clinico, setClinico] = useState<RelatorioClinico | null>(null);
  const [financeiro, setFinanceiro] = useState<RelatorioFinanceiro | null>(null);
  const [consultas, setConsultas] = useState<RelatorioConsultas | null>(null);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const [dataInicio, dataFim] = useMemo(
    () => intervaloDoPeriodo(periodo, inicioCustom, fimCustom),
    [periodo, inicioCustom, fimCustom],
  );

  useEffect(() => {
    let cancelado = false;
    Promise.all([
      container.relatorios.clinico.executar(),
      container.relatorios.financeiro.executar(hoje),
    ])
      .then(([c, f]) => {
        if (cancelado) return;
        setClinico(c);
        setFinanceiro(f);
      })
      .catch(() => {
        if (cancelado) return;
        setErroCarregar(true);
      });
    return () => {
      cancelado = true;
    };
  }, [container, hoje, tentativa]);

  useEffect(() => {
    if (financeiro && clinico && consultas && window.location.hash === '#historico-recebimentos') {
      document.getElementById('historico-recebimentos')?.scrollIntoView();
    }
  }, [financeiro, clinico, consultas]);

  useEffect(() => {
    let cancelado = false;
    container.relatorios.consultas
      .executar(dataInicio, dataFim)
      .then((r) => {
        if (!cancelado) setConsultas(r);
      })
      .catch(() => {
        if (!cancelado) setErroCarregar(true);
      });
    return () => {
      cancelado = true;
    };
  }, [container, dataInicio, dataFim, tentativa]);

  const carregando = !clinico || !financeiro || !consultas;

  function baixarCsv(): void {
    if (carregando) return;
    const linhas: CelulaCsv[][] = [];
    linhas.push(['Relatório — ' + CONFIGURACAO_CLINICA.nomeClinica]);
    linhas.push(['Gerado em', formatarDataHoraIso(new Date().toISOString())]);
    linhas.push(['Observação', 'Dados agregados e operacionais. Não contém respostas de anamnese nem motivo de consulta.']);
    linhas.push([]);

    linhas.push(['PANORAMA CLÍNICO']);
    linhas.push(['Indicador', 'Valor']);
    linhas.push(['Pacientes ativos', clinico.pacientesAtivos]);
    linhas.push(['Pacientes arquivados', clinico.pacientesArquivados]);
    linhas.push(['Pacientes no total', clinico.pacientesTotal]);
    linhas.push(['Ativos com anamnese incompleta', clinico.anamneseIncompleta]);
    linhas.push(['Ativos com registro no odontograma', clinico.comRegistroOdontograma]);
    linhas.push(['Ativos com pendência clínica aberta', clinico.comPendenciaClinica]);
    linhas.push([]);

    linhas.push(['FINANCEIRO (PLANOS ATIVOS)']);
    linhas.push(['Indicador', 'Valor']);
    linhas.push(['Planos ativos', financeiro.planosAtivos]);
    linhas.push(['Valor planejado', centavosParaReaisTexto(financeiro.valorPlanejadoCentavos)]);
    linhas.push(['Valor pago', centavosParaReaisTexto(financeiro.valorPagoCentavos)]);
    linhas.push(['Saldo em aberto', centavosParaReaisTexto(financeiro.saldoDevedorCentavos)]);
    linhas.push([
      'Taxas de emergência',
      `${centavosParaReaisTexto(financeiro.taxaEmergenciaCentavos)} (${financeiro.planosEmergencia} plano(s))`,
    ]);
    linhas.push([]);
    linhas.push(['Pagamentos por método', 'Quantidade', 'Total']);
    for (const m of financeiro.pagamentosPorMetodo) {
      linhas.push([m.metodo, m.quantidade, centavosParaReaisTexto(m.totalCentavos)]);
    }
    linhas.push([]);
    linhas.push(['Pacientes com saldo em aberto', 'Saldo']);
    for (const p of financeiro.pacientesComSaldo) {
      linhas.push([p.nomePaciente, centavosParaReaisTexto(p.saldoDevedorCentavos)]);
    }
    linhas.push([]);

    linhas.push([`CONSULTAS (${formatarDataIso(consultas.dataInicio)} a ${formatarDataIso(consultas.dataFim)})`]);
    linhas.push(['Status', 'Quantidade']);
    for (const s of STATUS_CONSULTA_ORDEM) linhas.push([STATUS_CONSULTA_LABEL[s], consultas.porStatus[s]]);
    linhas.push(['Emergências', consultas.emergencias]);
    linhas.push(['Total', consultas.total]);
    linhas.push([]);
    linhas.push(['Data', 'Horário', 'Paciente', 'Status', 'Emergência']);
    for (const c of consultas.consultas) {
      linhas.push([
        formatarDataIso(c.data),
        c.horario,
        c.nomePaciente,
        STATUS_CONSULTA_LABEL[c.status],
        c.ehEmergencia ? 'Sim' : '',
      ]);
    }

    baixarTexto(`relatorio-${hojeIso()}.csv`, montarCsv(linhas));
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <CabecalhoImpressao subtitulo="Relatórios de gestão" />
        <FechamentoFinanceiro />

      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-neutral-900">
          <BarChart3 className="h-5 w-5" aria-hidden="true" /> Relatórios
        </h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()} className={buttonClassName('secondary')}>
            <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir
          </button>
          <button
            type="button"
            onClick={baixarCsv}
            disabled={carregando}
            className={buttonClassName('secondary', carregando ? 'opacity-50' : '')}
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Baixar CSV
          </button>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase text-neutral-500">Período das consultas</span>
        {(Object.keys(PERIODO_LABEL) as Periodo[]).map((p) => (
          <ChipPeriodo key={p} ativo={periodo === p} onClick={() => setPeriodo(p)}>
            {PERIODO_LABEL[p]}
          </ChipPeriodo>
        ))}
        {periodo === 'personalizado' && (
          <span className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={inicioCustom}
              onChange={(e) => e.target.value && setInicioCustom(e.target.value)}
              aria-label="Data inicial"
              className="max-w-44"
            />
            <span className="text-sm text-neutral-500">até</span>
            <Input
              type="date"
              value={fimCustom}
              onChange={(e) => e.target.value && setFimCustom(e.target.value)}
              aria-label="Data final"
              className="max-w-44"
            />
          </span>
        )}
      </div>

      <p className="hidden text-xs text-neutral-500 print:block">
        Consultas de {formatarDataIso(dataInicio)} a {formatarDataIso(dataFim)}.
      </p>

      {erroCarregar ? (
        <Alert tone="warning" title="Não foi possível carregar os relatórios do servidor da clínica">
          <div className="flex flex-col items-start gap-2">
            <span>O servidor pode estar fora do ar. Veja o aviso no topo da tela e tente de novo.</span>
            <Button
              variant="secondary"
              onClick={() => {
                setErroCarregar(false);
                setTentativa((t) => t + 1);
              }}
              className="text-xs"
            >
              Tentar de novo
            </Button>
          </div>
        </Alert>
      ) : carregando ? (
        <div className="flex justify-center py-10">
          <Spinner label="Preparando relatórios…" />
        </div>
      ) : (
        <>
          <Card className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-neutral-700">Panorama clínico</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
              <Numero rotulo="Pacientes ativos" valor={String(clinico.pacientesAtivos)} />
              <Numero rotulo="Arquivados" valor={String(clinico.pacientesArquivados)} />
              <Numero rotulo="Anamnese incompleta" valor={String(clinico.anamneseIncompleta)} />
              <Numero rotulo="Com odontograma" valor={String(clinico.comRegistroOdontograma)} />
              <Numero rotulo="Pendência clínica" valor={String(clinico.comPendenciaClinica)} />
              <Numero rotulo="Total cadastrado" valor={String(clinico.pacientesTotal)} />
            </div>
            <p className="text-xs text-neutral-500">
              Contagens de pacientes ativos (arquivados contam só onde indicado). Sem nenhuma resposta clínica —
              detalhe por paciente fica na aba <Link to="/pacientes" className="text-brand-700 hover:underline dark:text-brand-400">Pacientes</Link>.
            </p>
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 id="historico-recebimentos" className="scroll-mt-20 text-sm font-semibold text-neutral-700">Histórico de recebimentos</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                    <th scope="col" className="py-2 pr-3">Período</th>
                    <th scope="col" className="py-2 pr-3">Pagamentos</th>
                    <th scope="col" className="py-2 text-right">Recebido</th>
                  </tr>
                </thead>
                <tbody>
                  {[financeiro.ciclosRecebimentos.atual, ...financeiro.ciclosRecebimentos.anteriores].map((ciclo, indice) => (
                    <tr key={ciclo.inicio} className="border-b border-neutral-100">
                      <td className="py-2 pr-3">
                        {formatarDataIso(ciclo.inicio)} a {formatarDataIso(ciclo.fim)}
                        {indice === 0 && <span className="ml-2 text-xs text-neutral-500">Atual</span>}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{ciclo.quantidade}</td>
                      <td className="py-2 text-right tabular-nums">{centavosParaReaisTexto(ciclo.totalCentavos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-neutral-700">Financeiro — planos ativos</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
              <Numero rotulo="Planejado" valor={centavosParaReaisTexto(financeiro.valorPlanejadoCentavos)} />
              <Numero rotulo="Recebido acumulado" valor={centavosParaReaisTexto(financeiro.valorPagoCentavos)} tom="success" />
              <Numero
                rotulo="Em aberto"
                valor={centavosParaReaisTexto(financeiro.saldoDevedorCentavos)}
                tom={financeiro.saldoDevedorCentavos > 0 ? 'danger' : undefined}
              />
              <Numero
                rotulo="Taxas de emergência"
                valor={centavosParaReaisTexto(financeiro.taxaEmergenciaCentavos)}
              />
              <Numero rotulo="Planos ativos" valor={String(financeiro.planosAtivos)} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Pagamentos por método</h3>
                {financeiro.pagamentosPorMetodo.length === 0 ? (
                  <p className="mt-1 text-sm text-neutral-500">Nenhum pagamento lançado em plano ativo.</p>
                ) : (
                  <div className="mt-1 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                          <th className="py-1.5 pr-2 font-medium">Método</th>
                          <th className="py-1.5 pr-2 font-medium">Qtd.</th>
                          <th className="py-1.5 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financeiro.pagamentosPorMetodo.map((m) => (
                          <tr key={m.metodo} className="border-b border-neutral-100">
                            <td className="py-1.5 pr-2">{m.metodo}</td>
                            <td className="py-1.5 pr-2 tabular-nums">{m.quantidade}</td>
                            <td className="py-1.5 tabular-nums">{centavosParaReaisTexto(m.totalCentavos)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Pacientes com saldo em aberto ({financeiro.pacientesComSaldo.length})
                </h3>
                {financeiro.pacientesComSaldo.length === 0 ? (
                  <p className="mt-1 text-sm text-neutral-500">Nenhum saldo em aberto nos planos ativos.</p>
                ) : (
                  <ul className="mt-1 flex flex-col divide-y divide-neutral-100">
                    {financeiro.pacientesComSaldo.map((p) => (
                      <li key={p.pacienteId} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                        <Link
                          to={`/pacientes/${p.pacienteId}/plano-tratamento`}
                          className="font-medium text-neutral-900 hover:text-brand-700 dark:hover:text-brand-400"
                        >
                          {p.nomePaciente}
                        </Link>
                        <span className="shrink-0 tabular-nums text-danger-700 dark:text-danger-500">
                          {centavosParaReaisTexto(p.saldoDevedorCentavos)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-neutral-700">Consultas no período</h2>
              <span className="text-xs text-neutral-500">
                {formatarDataIso(consultas.dataInicio)} a {formatarDataIso(consultas.dataFim)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
              {STATUS_CONSULTA_ORDEM.map((s) => (
                <Link
                  key={s}
                  to={`/agenda?dia=${consultas.dataInicio}${periodo === 'hoje' ? '' : '&modo=semana'}`}
                  className="rounded-md border border-neutral-200 px-2 py-1.5 hover:border-brand-500"
                >
                  <p className="text-xs font-medium uppercase text-neutral-500">{STATUS_CONSULTA_LABEL[s]}</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900">{consultas.porStatus[s]}</p>
                </Link>
              ))}
              <Numero rotulo="Emergências" valor={String(consultas.emergencias)} />
            </div>

            {consultas.consultas.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhuma consulta neste período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                      <th className="py-1.5 pr-3 font-medium">Data</th>
                      <th className="py-1.5 pr-3 font-medium">Hora</th>
                      <th className="py-1.5 pr-3 font-medium">Paciente</th>
                      <th className="py-1.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consultas.consultas.map((c) => (
                      <tr key={c.id} className="border-b border-neutral-100">
                        <td className="py-1.5 pr-3 tabular-nums">
                          <Link
                            to={`/agenda?dia=${c.data}&consulta=${c.id}`}
                            className="hover:text-brand-700 dark:hover:text-brand-400"
                          >
                            {formatarDataIso(c.data)}
                          </Link>
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums">{c.horario}</td>
                        <td className="py-1.5 pr-3">
                          <Link
                            to={`/pacientes/${c.pacienteId}/consultas`}
                            className="font-medium text-neutral-900 hover:text-brand-700 dark:hover:text-brand-400"
                          >
                            {c.nomePaciente}
                          </Link>
                        </td>
                        <td className="py-1.5">
                          <span className="inline-flex items-center gap-1.5">
                            <Badge tone={TOM_POR_STATUS_CONSULTA[c.status]}>{STATUS_CONSULTA_LABEL[c.status]}</Badge>
                            {c.ehEmergencia && <Badge tone="warning">Emergência</Badge>}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
