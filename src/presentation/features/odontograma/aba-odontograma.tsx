import { dentesDoTratamento } from '../../../domain/value-objects/dentes-tratamento.js';
import { DesenhoDente } from './desenho-dente.js';
import { Alert } from '../../components/ui/alert.js';
import { Button } from '../../components/ui/button.js';
import { AbaPlanoTratamento } from '../plano-tratamento/aba-plano-tratamento.js';
import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { EstadoDoDente, RegistroDental } from '../../../domain/entities/registro-dental.js';
import { CONDICAO_DENTAL_LABEL, TIPO_REGISTRO_DENTAL_LABEL, TOM_POR_CONDICAO } from '../../../domain/entities/registro-dental.js';
import type { NumeroDente } from '../../../domain/value-objects/numeracao-dental.js';
import { Badge } from '../../components/ui/badge.js';
import { Card } from '../../components/ui/card.js';
import { EmptyState } from '../../components/ui/empty-state.js';
import { Spinner } from '../../components/ui/spinner.js';
import { centavosParaReaisTexto, formatarDataIso } from '../../lib/formatadores.js';
import type { FichaClinicaContexto } from '../../pages/ficha-clinica-page.js';
import { useContainer } from '../../providers/container-provider.js';
import { DenteDetalheDrawer } from './dente-detalhe-drawer.js';
import { OdontogramaImagem } from './odontograma-imagem.js';
import { CLASSES_POR_TOM } from './tom-dental-classes.js';

const LEGENDA = Object.entries(CONDICAO_DENTAL_LABEL) as [keyof typeof CONDICAO_DENTAL_LABEL, string][];

export function AbaOdontograma() {
  const { paciente } = useOutletContext<FichaClinicaContexto>();
  const container = useContainer();
  const [erroLeitura, setErroLeitura] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [historico, setHistorico] = useState<RegistroDental[]>([]);
  const [estados, setEstados] = useState<Map<NumeroDente, EstadoDoDente>>(new Map());
  const [planejamentos, setPlanejamentos] = useState<Map<NumeroDente, string[]>>(new Map());
  const [dentePlanejamento, setDentePlanejamento] = useState<NumeroDente | null>(null);
  const [denteSelecionado, setDenteSelecionado] = useState<NumeroDente | null>(null);

  const [edicaoDente, setEdicaoDente] = useState({ sujo: false, salvando: false });
  const atualizarEdicao = useCallback((sujo: boolean, salvando: boolean) => setEdicaoDente({ sujo, salvando }), []);
  const [destinoPendente, setDestinoPendente] = useState<{ numero: NumeroDente | null } | null>(null);
  function aplicarSelecao(numero: NumeroDente | null) {
    setEdicaoDente({ sujo: false, salvando: false });
    setDestinoPendente(null);
    setDenteSelecionado(numero);
    if (numero) requestAnimationFrame(() => document.getElementById('detalhe-dente')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  function selecionarDente(numero: NumeroDente | null) {
    if (numero === denteSelecionado || edicaoDente.salvando) return;
    if (edicaoDente.sujo) {
      setDestinoPendente({ numero });
      requestAnimationFrame(() => document.getElementById('confirmacao-dente')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    aplicarSelecao(numero);
  }

  const recarregar = useCallback(() => {
    setCarregando(true);
    Promise.all([
      container.odontograma.listarHistorico.executar(paciente.id),
      container.odontograma.obterEstado.executar(paciente.id),
      container.planoTratamento.listarDoPaciente.executar(paciente.id),
    ])
      .then(([listaHistorico, mapaEstados, planos]) => {
        const mapa = new Map<NumeroDente, string[]>();
        for (const plano of planos) if (plano.toSnapshot().status === 'ATIVO') for (const item of plano.toSnapshot().itens) {
          if (!item.concluido) for (const dente of dentesDoTratamento(item)) mapa.set(dente, [...(mapa.get(dente) ?? []), item.trabalhoAExecutar]);
        }
        setErroLeitura(false);
        setPlanejamentos(mapa);
        setHistorico(listaHistorico);
        setEstados(mapaEstados);
      })
      .catch(() => {
        setErroLeitura(true);
      })
      .finally(() => setCarregando(false));
  }, [container, paciente.id]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return (
    <div className="flex flex-col gap-4">
      {erroLeitura && <Alert tone="danger">Não foi possível atualizar o odontograma e o planejamento. Os dados não foram apagados. <Button variant="secondary" onClick={recarregar}>Tentar novamente</Button></Alert>}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-surface p-4"><div><h2 className="text-lg font-semibold">Odontograma e tratamento</h2><p className="text-sm text-neutral-500">Selecione o dente, registre a condição e planeje o tratamento.</p></div><a href="#planejamento-dental" className="text-sm font-medium text-brand-700 underline">Ir para trabalhos e pagamento</a></div>
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-neutral-700">1. Selecione um dente</h2>
          <p className="text-xs text-neutral-500">Clique em um dente para ver o histórico e adicionar um registro.</p>
        </div>
        {carregando ? (
          <div className="flex justify-center py-10">
            <Spinner label="Carregando odontograma…" />
          </div>
        ) : (
          <div data-tour="mapa-dentes"><OdontogramaImagem planejamentos={planejamentos} estados={estados} denteSelecionado={denteSelecionado} onSelecionarDente={selecionarDente} /></div>
        )}

        <details className="mt-4 border-t border-neutral-100 pt-3"><summary className="cursor-pointer text-xs text-neutral-500">Legenda das condições</summary><div className="mt-2 flex flex-wrap gap-2">
          {LEGENDA.map(([condicao, rotulo]) => (
            <span
              key={condicao}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${CLASSES_POR_TOM[TOM_POR_CONDICAO[condicao]]}`}
            >
              {rotulo}
            </span>
          ))}
        </div></details>
      </Card>

      {destinoPendente && <div id="confirmacao-dente"><Alert tone="warning">
        <p>Há dados ou desenho não salvos no dente {denteSelecionado}. Deseja descartá-los para {destinoPendente.numero ? `abrir o dente ${destinoPendente.numero}` : 'fechar o painel'}?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setDestinoPendente(null)}>Continuar preenchendo</Button>
          <Button variant="secondary" disabled={edicaoDente.salvando} onClick={() => aplicarSelecao(destinoPendente.numero)}>Descartar alterações</Button>
        </div>
      </Alert></div>}
      {denteSelecionado !== null && <DenteDetalheDrawer
        key={`${paciente.id}:${denteSelecionado}`}
        onEstadoEdicao={atualizarEdicao}
        pacienteId={paciente.id}
        numeroDente={denteSelecionado}
        historico={historico}
        onPlanejar={() => { setDentePlanejamento(denteSelecionado); setTimeout(() => document.getElementById('planejamento-dental')?.scrollIntoView({ behavior: 'smooth' }), 0); }}
        onFechar={() => selecionarDente(null)}
        onRegistroAdicionado={recarregar}
      />}



      <section id="planejamento-dental" className="flex flex-col gap-3">
        <h2 className="font-semibold">Plano de tratamento {dentePlanejamento ? `— dente ${dentePlanejamento}` : ''}</h2>
        <p className="text-sm">Selecione um dente no desenho e escolha planejar um procedimento. Os valores e pagamentos são os mesmos do orçamento.</p>
        <AbaPlanoTratamento registrosOdontograma={historico} denteInicial={dentePlanejamento} aoAtualizar={recarregar} />
      </section>

      <details data-tour="historico-dental" className="historico-odontograma rounded-xl border border-neutral-200"><summary className="cursor-pointer p-4 text-sm font-semibold">Histórico completo do odontograma ({historico.length})</summary>
      <Card className="imprimir-expandir flex flex-col gap-3">
        
        {!carregando && historico.length === 0 && (
          <EmptyState
            title="Nenhum registro ainda"
            description="Clique em um dente no gráfico acima para começar a registrar procedimentos, observações e condições."
          />
        )}
        {historico.length > 0 && (
          <div className="imprimir-expandir overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Dente</th>
                  <th scope="col" className="px-3 py-2 font-medium">Data</th>
                  <th scope="col" className="px-3 py-2 font-medium">Tipo</th>
                  <th scope="col" className="px-3 py-2 font-medium">Condição</th>
                  <th scope="col" className="px-3 py-2 font-medium">Descrição</th>
                  <th scope="col" className="px-3 py-2 font-medium">Valor</th>
                  <th scope="col" className="px-3 py-2 font-medium">Profissional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {historico.map((registro) => {
                  const snap = registro.toSnapshot();
                  return (
                    <tr key={snap.id}>
                      <td className="px-3 py-2 font-medium text-neutral-900">{snap.numeroDente}</td>
                      <td className="px-3 py-2 text-neutral-700">{formatarDataIso(snap.data)}</td>
                      <td className="px-3 py-2 text-neutral-700">{TIPO_REGISTRO_DENTAL_LABEL[snap.tipo]}</td>
                      <td className="px-3 py-2">
                        {snap.condicao ? (
                          <Badge tone={TOM_POR_CONDICAO[snap.condicao]}>{CONDICAO_DENTAL_LABEL[snap.condicao]}</Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-neutral-700">
                        {snap.descricao && <p>{snap.descricao}</p>}
                        {snap.desenho?.tracos.length ? <div className="mt-2 flex flex-wrap items-start gap-3">
                          <div className="w-24 shrink-0"><DesenhoDente numero={snap.numeroDente} desenho={snap.desenho} /></div>
                          <div className="text-xs"><p>Desenho salvo neste registro</p><button type="button" className="no-print mt-2 font-medium text-brand-700 underline" onClick={() => selecionarDente(snap.numeroDente)}>Abrir dente {snap.numeroDente}</button></div>
                        </div> : <p className="mt-1 text-xs text-neutral-500">Sem desenho salvo neste registro.</p>}
                      </td>
                      <td className="px-3 py-2 text-neutral-700">
                        {snap.valorCentavos !== null ? centavosParaReaisTexto(snap.valorCentavos) : '—'}
                      </td>
                      <td className="px-3 py-2 text-neutral-500">{snap.profissionalResponsavel || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </details>
    </div>
  );
}
