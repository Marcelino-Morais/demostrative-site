import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, SearchCheck, Table2 } from 'lucide-react';
import { ErroApi } from '../../../application/ports/api-client.js';
import type {
  ResultadoReconciliacao,
  StatusSincronizacaoGoogleSheets as StatusSincronizacao,
  TipoFormularioGoogle,
} from '../../../application/ports/porta-google-sheets-sync.js';
import { Alert } from '../../components/ui/alert.js';
import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog.js';
import { Spinner } from '../../components/ui/spinner.js';
import { formatarDataHoraIso } from '../../lib/formatadores.js';
import { useContainer } from '../../providers/container-provider.js';
import {
  ROTULO_MOTIVO_NAO_CONFIGURADO,
  TOM_POR_ESTADO,
  estadoOperacionalSincronizacao,
  rotuloUltimoErro,
  totalDuplicatas,
} from './google-sheets-sync-format.js';
import { useStatusSincronizacaoGoogleSheets } from './usar-status-sincronizacao.js';

const ROTULO_TIPO: Record<string, string> = {
  'ficha-inicial': 'Ficha inicial',
  anamnese: 'Anamnese',
  agendamento: 'Agendamento',
};

/**
 * Card de status da sincronização automática do Google Forms por
 * planilha (Etapa 58) — pensado pra Dra. Fernanda, sem jargão técnico.
 * Nunca mostra ID de planilha, e-mail da conta de serviço, caminho de
 * credencial, CPF/RG/celular, nome de paciente, ou resposta de
 * formulário — só se está funcionando, quando rodou, e quantas
 * respostas em cada situação.
 */
export function StatusSincronizacaoGoogleSheets() {
  const container = useContainer();
  const { status, carregando, erro, recarregar } = useStatusSincronizacaoGoogleSheets();
  const [sincronizando, setSincronizando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  // Achado real de verificação (Etapa 59 — Playwright, cliques disparados no
  // mesmo tick): `disabled={loading}` do Button só passa a valer depois do
  // React confirmar o re-render, então dois cliques bem próximos ainda
  // conseguiam disparar duas chamadas concorrentes a
  // `/api/google-sheets-sync/processar`. Uma ref (síncrona, não espera
  // re-render) fecha essa janela.
  const emAndamentoRef = useRef(false);
  const [reconciliacao, setReconciliacao] = useState<ResultadoReconciliacao | null>(null);
  const [verificandoConsistencia, setVerificandoConsistencia] = useState(false);
  const [erroReconciliacao, setErroReconciliacao] = useState<string | null>(null);
  const [tipoParaRecuperar, setTipoParaRecuperar] = useState<TipoFormularioGoogle | null>(null);
  const [recuperando, setRecuperando] = useState(false);
  const [mensagemRecuperacao, setMensagemRecuperacao] = useState<string | null>(null);

  async function sincronizarAgora() {
    if (emAndamentoRef.current) return;
    emAndamentoRef.current = true;
    setErroAcao(null);
    setSincronizando(true);
    try {
      await container.googleSheetsSync.sincronizarAgora.executar();
      await recarregar();
    } catch (e) {
      setErroAcao(e instanceof ErroApi ? e.message : 'Não foi possível sincronizar agora.');
    } finally {
      emAndamentoRef.current = false;
      setSincronizando(false);
    }
  }

  async function verificarConsistencia() {
    setErroReconciliacao(null);
    setVerificandoConsistencia(true);
    try {
      setReconciliacao(await container.googleSheetsSync.obterReconciliacao.executar());
    } catch (e) {
      setErroReconciliacao(e instanceof ErroApi ? e.message : 'Não foi possível verificar a consistência do histórico.');
    } finally {
      setVerificandoConsistencia(false);
    }
  }

  async function confirmarRecuperacao() {
    if (!tipoParaRecuperar) return;
    setRecuperando(true);
    try {
      const resultado = await container.googleSheetsSync.recuperarRespostas.executar(tipoParaRecuperar);
      setTipoParaRecuperar(null);
      if (resultado.jaEmAndamento) {
        setMensagemRecuperacao('Uma sincronização já estava em andamento — tente de novo em alguns segundos.');
      } else {
        setMensagemRecuperacao(
          `${resultado.recuperadas} resposta(s) recuperada(s)${resultado.falharam > 0 ? `, ${resultado.falharam} não puderam ser recuperadas agora` : ''}.`,
        );
      }
      await verificarConsistencia();
    } catch (e) {
      setTipoParaRecuperar(null);
      setMensagemRecuperacao(e instanceof ErroApi ? e.message : 'Não foi possível recuperar as respostas agora.');
    } finally {
      setRecuperando(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <Table2 className="h-4 w-4" aria-hidden="true" /> Sincronização automática do Google Forms
        </h2>
        {status?.configurado && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void verificarConsistencia()} loading={verificandoConsistencia} className="text-xs">
              <SearchCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verificar consistência do histórico
            </Button>
            <Button variant="secondary" onClick={sincronizarAgora} loading={sincronizando} className="text-xs">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Sincronizar agora
            </Button>
          </div>
        )}
      </div>

      {carregando && (
        <div className="flex items-center gap-2 py-2 text-sm text-neutral-500">
          <Spinner label="Consultando status da sincronização…" />
        </div>
      )}

      {!carregando && erro && <Alert tone="danger">{erro}</Alert>}

      {!carregando && !erro && status && (
        <ConteudoStatus status={status} erroAcao={erroAcao} reconciliacao={reconciliacao} />
      )}

      {erroReconciliacao && <Alert tone="danger">{erroReconciliacao}</Alert>}
      {mensagemRecuperacao && <Alert tone="brand">{mensagemRecuperacao}</Alert>}

      {reconciliacao && <ReconciliacaoDetalhe reconciliacao={reconciliacao} aoEscolherRecuperar={setTipoParaRecuperar} />}

      <Dialog open={tipoParaRecuperar !== null} onOpenChange={(aberto) => !aberto && setTipoParaRecuperar(null)}>
        <DialogContent>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <AlertTriangle className="h-5 w-5 text-warning-600" aria-hidden="true" />
            Recuperar respostas de {tipoParaRecuperar && ROTULO_TIPO[tipoParaRecuperar]}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-2 flex flex-col gap-2 text-sm text-neutral-600">
              <p>
                Isto reaplica, pelo mesmo caminho de importação de sempre, as respostas marcadas como recuperáveis —
                cada uma passa pelas mesmas regras de identificação (CPF/RG/celular) e conflito de agenda de qualquer
                importação normal. Respostas ambíguas (sem identificador seguro) NÃO são tocadas; ficam pendentes de
                revisão manual.
              </p>
              <p className="font-medium text-neutral-800">
                A sincronização automática continua desligada enquanto isto roda, e nenhuma outra recuperação pode
                rodar ao mesmo tempo.
              </p>
            </div>
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose className="text-sm text-neutral-600 hover:underline">Cancelar</DialogClose>
            <Button variant="danger" onClick={() => void confirmarRecuperacao()} loading={recuperando}>
              Recuperar agora
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function totalAusentes(reconciliacao: ResultadoReconciliacao | null): number {
  if (!reconciliacao) return 0;
  return Object.values(reconciliacao.porTipo).reduce((soma, r) => soma + (r?.ausentes ?? 0), 0);
}

function ReconciliacaoDetalhe({
  reconciliacao,
  aoEscolherRecuperar,
}: {
  reconciliacao: ResultadoReconciliacao;
  aoEscolherRecuperar: (tipo: TipoFormularioGoogle) => void;
}) {
  const tipos = Object.entries(reconciliacao.porTipo) as [TipoFormularioGoogle, ResultadoReconciliacao['porTipo'][TipoFormularioGoogle]][];
  const algumAusente = totalAusentes(reconciliacao) > 0;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
      <p className="text-xs font-medium text-neutral-600">
        Consistência entre o histórico de importação e o cadastro atual — distinto de "a planilha foi lida com
        sucesso" acima.
      </p>
      <ul className="flex flex-col gap-1 text-sm">
        {tipos.map(([tipo, resumo]) => {
          if (!resumo) return null;
          if (resumo.erro) {
            return (
              <li key={tipo} className="text-neutral-500">
                {ROTULO_TIPO[tipo]}: não foi possível verificar ({resumo.erro}).
              </li>
            );
          }
          return (
            <li key={tipo} className="flex flex-wrap items-center gap-2">
              <span className="text-neutral-700">{ROTULO_TIPO[tipo]}:</span>
              <span className="text-neutral-800">{resumo.jaImportadas} resposta(s) com destino presente</span>
              {(resumo.excluidas ?? 0) > 0 && <span>{resumo.excluidas} excluída(s) intencionalmente; não serão reimportadas</span>}
              {(resumo.historicoSemLinha ?? 0) > 0 && <span>{resumo.historicoSemLinha} marcação(ões) antigas sem linha correspondente — não representam pacientes adicionais confirmados</span>}
              {resumo.ausentes > 0 && (
                <>
                  <span className="text-warning-700">
                    {resumo.ausentes} ausente(s) ({resumo.recuperaveis} recuperável(is), {resumo.ambiguas} ambígua(s))
                  </span>
                  {resumo.recuperaveis > 0 && (
                    <Button variant="secondary" onClick={() => aoEscolherRecuperar(tipo)} className="text-xs">
                      Recuperar
                    </Button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
      {algumAusente && (
        <Alert tone="warning" title="Há respostas já lidas da planilha que não estão refletidas no cadastro">
          Isso costuma acontecer quando um paciente/consulta foi apagado depois de importado (ex.: reset de teste)
          sem reconciliar o histórico. Respostas ambíguas nunca são associadas automaticamente — revise-as
          manualmente, se precisar, pela ficha do paciente.
        </Alert>
      )}
    </div>
  );
}

function ConteudoStatus({
  status,
  erroAcao,
  reconciliacao,
}: {
  status: StatusSincronizacao;
  erroAcao: string | null;
  reconciliacao: ResultadoReconciliacao | null;
}) {
  const estado = estadoOperacionalSincronizacao(status);
  const tom = TOM_POR_ESTADO[estado];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Badge tone={estado === 'nao-configurado' ? 'neutral' : tom}>
          {estado === 'nao-configurado' && 'Não configurada'}
          {estado === 'em-andamento' && 'Sincronizando agora…'}
          {estado === 'falhando' && 'Última tentativa falhou'}
          {estado === 'pronto-sem-execucao' && 'Configurada — aguardando primeira execução'}
          {estado === 'funcionando' && 'Planilha lida com sucesso'}
          {estado === 'revisao' && 'Respostas aguardando revisão'}
        </Badge>
      </div>

      {estado === 'nao-configurado' && (
        <Alert tone="brand" title="A sincronização automática ainda não foi configurada">
          <span>
            {(status.motivoNaoConfigurado && ROTULO_MOTIVO_NAO_CONFIGURADO[status.motivoNaoConfigurado]) ||
              'Enquanto isso, use "Google Forms por e-mail" pra importar as respostas manualmente.'}{' '}
            Veja o passo a passo em <code>server/README.md</code>.
          </span>
        </Alert>
      )}

      {estado !== 'nao-configurado' && (
        <>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-neutral-500">Última leitura das planilhas com sucesso</dt>
              <dd className="text-neutral-800">{formatarDataHoraIso(status.ultimoSucessoEm)}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Última tentativa</dt>
              <dd className="text-neutral-800">{formatarDataHoraIso(status.ultimaTentativaEm)}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Próxima execução automática</dt>
              <dd className="text-neutral-800">
                {status.emAndamento ? 'Em andamento agora' : formatarDataHoraIso(status.proximaExecucaoEm)}
              </dd>
            </div>
          </dl>

          {status.ultimoResultado && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                    <th className="py-1 pr-3 font-medium">Formulário</th>
                    <th className="py-1 pr-3 font-medium">Importadas</th>
                    <th className="py-1 pr-3 font-medium">Já tinham entrado</th>
                    <th className="py-1 pr-3 font-medium">Recusadas</th>
                    <th className="py-1 font-medium">Aguardando</th>
                  </tr>
                </thead>
                <tbody>
                  {(['ficha-inicial', 'anamnese', 'agendamento'] as const).map((tipo) => {
                    const linha = status.ultimoResultado?.porTipo[tipo];
                    return (
                      <tr key={tipo} className="border-b border-neutral-100 last:border-0">
                        <td className="py-1.5 pr-3 text-neutral-700">{ROTULO_TIPO[tipo]}</td>
                        <td className="py-1.5 pr-3 text-neutral-800">{linha?.processadas ?? 0}</td>
                        <td className="py-1.5 pr-3 text-neutral-800">{linha?.ignoradas ?? 0}</td>
                        <td className="py-1.5 pr-3 text-neutral-800">{linha?.rejeitadas ?? 0}</td>
                        <td className="py-1.5 text-neutral-800">{linha?.pendentes ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {estado === 'revisao' && <Alert tone="warning" title="A planilha foi lida, mas há respostas pendentes">
            Verifique a consistência do histórico para revisar destinos ausentes ou identificadores conflitantes. Nenhum cadastro ambíguo será unido automaticamente.
          </Alert>}
          {(status.ultimoResultado?.recuperadas ?? 0) > 0 && <p>{status.ultimoResultado?.recuperadas} resposta(s) recuperada(s) com segurança nesta rodada.</p>}
          {(status.ultimoResultado?.excluidas ?? 0) > 0 && <p>{status.ultimoResultado?.excluidas} resposta(s) mantida(s) excluída(s) por decisão anterior.</p>}
          {status.ultimoResultado && totalDuplicatas(status.ultimoResultado.duplicatas) > 0 && (
            <p className="text-xs text-neutral-500">
              {totalDuplicatas(status.ultimoResultado.duplicatas)} resposta(s) reconhecida(s) como já importada(s)
              nesta rodada
              {status.ultimoResultado.duplicatas['conteudo-exato'] + status.ultimoResultado.duplicatas.normalizado >
              0
                ? ` — ${status.ultimoResultado.duplicatas['conteudo-exato'] + status.ultimoResultado.duplicatas.normalizado} pelo mesmo conteúdo já ter entrado por outro caminho (e-mail ou webhook), sem duplicar nada.`
                : '.'}
            </p>
          )}

          {status.ultimoErro && (
            <Alert tone="danger" title="A última sincronização não terminou direito">
              <span className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {rotuloUltimoErro(status.ultimoErro)}
              </span>
            </Alert>
          )}

          {!status.ultimoErro && (status.ultimoResultado?.rejeitadas ?? 0) > 0 && (
            <Alert tone="warning" title="Alguma resposta foi recusada na última rodada">
              Confira a coluna "Recusadas" acima — geralmente é dado incompleto ou um conflito de horário. Corrija
              direto na ficha da paciente; a sincronização não tenta essa mesma resposta de novo sozinha.
            </Alert>
          )}

          {estado === 'funcionando' && !status.ultimoErro && (status.ultimoResultado?.rejeitadas ?? 0) === 0 && (
            <p className="flex items-center gap-2 text-xs text-neutral-500">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success-600" aria-hidden="true" />
              {totalAusentes(reconciliacao) === 0
                ? 'A leitura das planilhas está funcionando — respostas novas entram sozinhas, a cada poucos minutos.'
                : 'A leitura das planilhas está funcionando, mas há respostas pendentes de reconciliar — veja abaixo.'}
            </p>
          )}

          {estado === 'pronto-sem-execucao' && (
            <p className="flex items-center gap-2 text-xs text-neutral-500">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Configurada agora mesmo — a primeira
              sincronização deve rodar em instantes, ou clique em "Sincronizar agora".
            </p>
          )}
        </>
      )}

      {erroAcao && <Alert tone="danger">{erroAcao}</Alert>}
    </div>
  );
}
