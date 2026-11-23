import { textoDentesTratamento } from '../../domain/value-objects/dentes-tratamento.js';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Printer } from 'lucide-react';
import type { PlanoTratamento } from '../../domain/entities/plano-tratamento.js';
import { calcularPlanoDePagamento, calcularResumoFinanceiro } from '../../domain/entities/plano-tratamento.js';
import type { Paciente } from '../../domain/entities/paciente.js';
import { CONFIGURACAO_CLINICA } from '../../infrastructure/bootstrap/configuracao-clinica.js';
import { Alert } from '../components/ui/alert.js';
import { buttonClassName } from '../components/ui/button.js';
import { Spinner } from '../components/ui/spinner.js';
import {
  linhasPlanoDePagamento,
  resumoCondicoesDePagamento,
} from '../features/plano-tratamento/plano-tratamento-format.js';
import { centavosParaReaisTexto, formatarDataHoraIso, formatarDataIso } from '../lib/formatadores.js';
import { mensagemDeErro } from '../lib/erros.js';
import { useContainer } from '../providers/container-provider.js';

/**
 * Folha de orçamento voltada ao paciente e à impressão — segue a
 * estrutura do documento original: identificação da clínica, tabela
 * "Dente / Trabalho a executar / Valor" com total, validade de 90
 * dias, condições/plano de pagamento e áreas de assinatura. Só lê
 * (`container.pacientes.obter` + `container.planoTratamento.obter`);
 * nenhum cálculo financeiro é feito aqui — vem do domínio.
 */
export function OrcamentoPage() {
  const { pacienteId, planoId } = useParams<{ pacienteId: string; planoId: string }>();
  const container = useContainer();
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [plano, setPlano] = useState<PlanoTratamento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  // CPF/RG completos só depois de "Preparar impressão" — nunca no
  // carregamento comum desta página (ver `documentos-impressao.ts`).
  const [documentosCompletos, setDocumentosCompletos] = useState<{ cpf: string | null; rg: string | null } | null>(null);
  const [preparandoImpressao, setPreparandoImpressao] = useState(false);
  const [erroImpressao, setErroImpressao] = useState<string | null>(null);

  async function prepararImpressao(): Promise<void> {
    if (!pacienteId) return;
    setErroImpressao(null);
    setPreparandoImpressao(true);
    try {
      const documentos = await container.documentosImpressao.obter.executar(pacienteId);
      setDocumentosCompletos(documentos);
    } catch (erroCapturado) {
      setErroImpressao(mensagemDeErro(erroCapturado, 'Não foi possível preparar a impressão agora.'));
    } finally {
      setPreparandoImpressao(false);
    }
  }

  useEffect(() => {
    if (!pacienteId || !planoId) return;
    let cancelado = false;
    setCarregando(true);
    // Troca de paciente/plano nunca pode manter CPF/RG completos de
    // OUTRO paciente em memória — exige "Preparar impressão" de novo.
    setDocumentosCompletos(null);
    setErroImpressao(null);
    Promise.all([container.pacientes.obter.executar(pacienteId), container.planoTratamento.obter.executar(planoId)])
      .then(([pac, pl]) => {
        if (cancelado) return;
        const valido = Boolean(pac) && Boolean(pl) && pl?.pacienteId === pacienteId;
        setPaciente(pac ?? null);
        setPlano(pl ?? null);
        setErro(!valido);
      })
      .catch(() => {
        if (!cancelado) setErro(true);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [container, pacienteId, planoId]);

  if (carregando) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Carregando orçamento…" />
      </div>
    );
  }

  if (erro || !paciente || !plano) {
    return (
      <div className="p-4 sm:p-6">
        <Alert tone="danger">Orçamento não encontrado.</Alert>
        <Link to={pacienteId ? `/pacientes/${pacienteId}/plano-tratamento` : '/pacientes'} className="mt-3 inline-block text-sm text-brand-700 hover:underline dark:text-brand-400">
          ← Voltar
        </Link>
      </div>
    );
  }

  const snap = plano.toSnapshot();
  const pac = paciente.toSnapshot();
  const resumo = calcularResumoFinanceiro(snap);
  const planoDePagamento = calcularPlanoDePagamento(resumo.valorTotalCentavos, snap.condicoesDePagamento);
  const linhasPagamento = linhasPlanoDePagamento(planoDePagamento, snap.condicoesDePagamento);
  const observacoes = snap.condicoesDePagamento.observacoes.trim();
  const semCondicoes = resumoCondicoesDePagamento(snap.condicoesDePagamento) === null;
  // Em modo com servidor, `pac.cpf`/`pac.rg` chegam MASCARADOS por
  // padrão — só mostra o completo depois de "Preparar impressão". Em
  // modo 100% local não há mascaramento (nem fronteira de rede pra
  // proteger), então o completo já está disponível desde o início.
  const precisaPrepararImpressao = container.sincronizacaoNucleo && !documentosCompletos;
  const cpfExibido = documentosCompletos ? documentosCompletos.cpf : pac.cpf;
  const rgExibido = documentosCompletos ? documentosCompletos.rg : pac.rg;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-4 sm:p-6 print:p-0">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link
          to={`/pacientes/${pacienteId}/plano-tratamento`}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-brand-700 dark:hover:text-brand-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao plano de tratamento
        </Link>
        {precisaPrepararImpressao ? (
          <button
            type="button"
            onClick={() => void prepararImpressao()}
            disabled={preparandoImpressao}
            className={buttonClassName('primary')}
          >
            <Lock className="h-4 w-4" aria-hidden="true" /> {preparandoImpressao ? 'Preparando…' : 'Preparar impressão'}
          </button>
        ) : (
          <button type="button" onClick={() => window.print()} className={buttonClassName('primary')}>
            <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir orçamento
          </button>
        )}
      </div>
      {erroImpressao && (
        <Alert tone="danger" className="no-print">
          {erroImpressao}
        </Alert>
      )}

      <article className="flex flex-col gap-5 rounded-lg border border-neutral-200 bg-surface p-6 text-neutral-900 print:border-0 print:bg-transparent print:p-0">
        <header className="flex flex-col gap-0.5 border-b border-neutral-300 pb-3">
          <p className="text-lg font-semibold">{CONFIGURACAO_CLINICA.nomeClinica}</p>
          <p className="text-sm text-neutral-600">
            {CONFIGURACAO_CLINICA.nomeProfissional} · {CONFIGURACAO_CLINICA.registroProfissional}
          </p>
          <p className="text-xs text-neutral-500">{CONFIGURACAO_CLINICA.cidade}</p>
        </header>

        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Orçamento odontológico</h1>
          <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 text-sm">
            <p>
              <span className="text-neutral-500">Paciente:</span>{' '}
              <span className="font-medium">{pac.nomeCompleto}</span>
            </p>
            <p>
              <span className="text-neutral-500">Emitido em:</span> {formatarDataIso(snap.criadoEm)}
            </p>
          </div>
          {(cpfExibido || rgExibido) && (
            <div className="flex flex-wrap gap-x-6 gap-y-0.5 text-sm text-neutral-700">
              {cpfExibido && (
                <span>
                  <span className="text-neutral-500">CPF:</span> {cpfExibido}
                </span>
              )}
              {rgExibido && (
                <span>
                  <span className="text-neutral-500">RG:</span> {rgExibido}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="imprimir-expandir overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Dente / região</th>
                <th scope="col" className="px-3 py-2 font-medium">Trabalho a executar</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Qtd.</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {snap.itens.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-neutral-500">
                    Nenhum trabalho lançado neste orçamento.
                  </td>
                </tr>
              )}
              {snap.itens.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 align-top text-neutral-700">
                    {textoDentesTratamento(item) || item.regiao || '—'}
                    {item.numeroDente !== null && item.regiao && (
                      <span className="block text-xs text-neutral-400">{item.regiao}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {item.trabalhoAExecutar}
                    {item.observacao && (
                      <span className="block text-xs text-neutral-500">{item.observacao}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right align-top tabular-nums text-neutral-700">{item.quantidade}</td>
                  <td className="px-3 py-2 text-right align-top tabular-nums text-neutral-700">
                    {centavosParaReaisTexto(item.valorCentavos * item.quantidade)}
                    {item.quantidade > 1 && (
                      <span className="block text-xs text-neutral-400">{centavosParaReaisTexto(item.valorCentavos)} un.</span>
                    )}
                  </td>
                </tr>
              ))}
              {resumo.taxaEmergenciaCentavos > 0 && (
                <tr>
                  <td className="px-3 py-2 align-top text-neutral-700">—</td>
                  <td className="px-3 py-2 align-top">Taxa de atendimento de emergência</td>
                  <td className="px-3 py-2 text-right align-top tabular-nums text-neutral-700">1</td>
                  <td className="px-3 py-2 text-right align-top tabular-nums text-neutral-700">
                    {centavosParaReaisTexto(resumo.taxaEmergenciaCentavos)}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t border-neutral-300">
              <tr>
                <td className="px-3 py-2 text-xs font-semibold uppercase text-neutral-500" colSpan={3}>
                  Total
                </td>
                <td className="px-3 py-2 text-right text-base font-semibold tabular-nums">
                  {centavosParaReaisTexto(resumo.valorTotalCentavos)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-sm">
          Orçamento válido até <strong>{formatarDataIso(snap.validoAte)}</strong> — 90 dias a partir da emissão.
          Valores sujeitos a reavaliação clínica.
        </p>

        {snap.emergencia && (
          <p className="rounded-md border border-warning-300 bg-warning-50 p-2.5 text-sm text-warning-800 dark:border-warning-700 dark:bg-warning-900/20 dark:text-warning-200">
            Taxa adicional deste plano: {centavosParaReaisTexto(resumo.taxaEmergenciaCentavos)}
          </p>
        )}

        <section className="flex flex-col gap-1.5">
          <h2 className="text-sm font-semibold uppercase text-neutral-500">Condições de pagamento</h2>
          {linhasPagamento.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-5 text-sm">
              {linhasPagamento.map((linha) => (
                <li key={linha}>{linha}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-600">
              Pagamento à vista do valor total{semCondicoes ? '' : '.'}
            </p>
          )}
          {observacoes && <p className="text-sm text-neutral-700">{observacoes}</p>}
        </section>

        <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 print:grid-cols-2">
          <div className="border-t border-neutral-500 pt-2 text-center text-sm">
            <p className="font-medium">{pac.nomeCompleto}</p>
            <p className="text-neutral-500">Assinatura do paciente</p>
          </div>
          <div className="border-t border-neutral-500 pt-2 text-center text-sm">
            <p className="font-medium">{CONFIGURACAO_CLINICA.nomeProfissional}</p>
            <p className="text-neutral-500">{CONFIGURACAO_CLINICA.registroProfissional}</p>
          </div>
        </div>

        <p className="text-right text-[0.65rem] text-neutral-400">
          Emitido pelo sistema em {formatarDataHoraIso(new Date().toISOString())}
        </p>
      </article>
    </div>
  );
}
