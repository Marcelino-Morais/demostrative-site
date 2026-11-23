import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock, Printer } from 'lucide-react';
import type { DocumentosDoPaciente } from '../../application/use-cases/documentos-paciente.js';
import { Alert } from '../components/ui/alert.js';
import { buttonClassName } from '../components/ui/button.js';
import { Spinner } from '../components/ui/spinner.js';
import {
  AreaAssinaturas,
  CabecalhoDocumento,
  SecaoAnamneseDoc,
  SecaoConsultasDoc,
  SecaoEvolucaoDoc,
  SecaoFichaClinica,
  SecaoFinanceiroDoc,
  SecaoOdontogramaDoc,
} from '../features/documentos/secoes-documento.js';
import { mensagemDeErro } from '../lib/erros.js';
import { useContainer } from '../providers/container-provider.js';

type ChaveSecao = 'ficha' | 'anamnese' | 'odontograma' | 'financeiro' | 'evolucao' | 'consultas';

const ORDEM_SECOES: ChaveSecao[] = ['ficha', 'anamnese', 'odontograma', 'financeiro', 'evolucao', 'consultas'];

const TITULO_SECAO: Record<ChaveSecao, string> = {
  ficha: 'Ficha clínica',
  anamnese: 'Anamnese',
  odontograma: 'Histórico do odontograma',
  financeiro: 'Plano de tratamento e pagamentos',
  evolucao: 'Evolução clínica',
  consultas: 'Histórico de consultas',
};

function parseSecoes(param: string | null): ChaveSecao[] {
  if (!param) return [...ORDEM_SECOES];
  const pedidas = param
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is ChaveSecao => (ORDEM_SECOES as string[]).includes(s));
  return pedidas.length > 0 ? ORDEM_SECOES.filter((s) => pedidas.includes(s)) : [...ORDEM_SECOES];
}

/**
 * Página de impressão de documentos clínicos — renderiza só as seções
 * pedidas por `?secoes=` (ou o pacote completo, sem parâmetro), com
 * identidade da clínica/paciente e data. Fora do `AppShell` (rota
 * própria): sem abas nem sidebar; a barra de ações é `no-print`.
 * Nenhuma regra aqui — só desenha o que `MontarDocumentosDoPaciente`
 * preparou.
 */
export function DocumentoImpressaoPage() {
  const { pacienteId } = useParams<{ pacienteId: string }>();
  const [searchParams] = useSearchParams();
  const container = useContainer();
  const [documentos, setDocumentos] = useState<DocumentosDoPaciente | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  // CPF/RG completos só depois de "Preparar impressão" — nunca no
  // carregamento comum desta página (ver `documentos-impressao.ts`).
  const [documentosCompletos, setDocumentosCompletos] = useState<{ cpf: string | null; rg: string | null } | null>(null);
  const [preparandoImpressao, setPreparandoImpressao] = useState(false);
  const [erroImpressao, setErroImpressao] = useState<string | null>(null);

  const secoes = useMemo(() => parseSecoes(searchParams.get('secoes')), [searchParams]);

  async function prepararImpressao(): Promise<void> {
    if (!pacienteId) return;
    setErroImpressao(null);
    setPreparandoImpressao(true);
    try {
      const docs = await container.documentosImpressao.obter.executar(pacienteId);
      setDocumentosCompletos(docs);
    } catch (erroCapturado) {
      setErroImpressao(mensagemDeErro(erroCapturado, 'Não foi possível preparar a impressão agora.'));
    } finally {
      setPreparandoImpressao(false);
    }
  }

  useEffect(() => {
    if (!pacienteId) return;
    let cancelado = false;
    setCarregando(true);
    // Troca de paciente nunca pode manter CPF/RG completos de OUTRO
    // paciente em memória — cada paciente exige seu próprio "Preparar
    // impressão" de novo.
    setDocumentosCompletos(null);
    setErroImpressao(null);
    container.documentos.montar
      .executar(pacienteId)
      .then((d) => {
        if (!cancelado) setDocumentos(d);
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
  }, [container, pacienteId]);

  if (carregando) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Preparando documentos…" />
      </div>
    );
  }

  if (erro || !documentos) {
    return (
      <div className="p-4 sm:p-6">
        <Alert tone="danger">Não foi possível montar os documentos deste paciente.</Alert>
        <Link
          to={pacienteId ? `/pacientes/${pacienteId}/documentos` : '/pacientes'}
          className="mt-3 inline-block text-sm text-brand-700 hover:underline dark:text-brand-400"
        >
          ← Voltar
        </Link>
      </div>
    );
  }

  const pacote = secoes.length === ORDEM_SECOES.length;
  const tituloDocumento = pacote
    ? 'Prontuário odontológico — documento completo'
    : secoes.length === 1
      ? TITULO_SECAO[secoes[0]!]
      : `Documentos: ${secoes.map((s) => TITULO_SECAO[s]).join(', ')}`;

  // Em modo com servidor, `documentos.paciente.cpf/.rg` chegam
  // MASCARADOS por padrão — só mostra o completo depois de "Preparar
  // impressão". Em modo 100% local não há mascaramento, então o
  // completo já está disponível desde o início.
  const precisaPrepararImpressao = container.sincronizacaoNucleo && !documentosCompletos;
  const documentosParaExibir = documentosCompletos
    ? { ...documentos, paciente: { ...documentos.paciente, cpf: documentosCompletos.cpf, rg: documentosCompletos.rg } }
    : documentos;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-4 sm:p-6 print:p-0">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link
          to={`/pacientes/${pacienteId}/documentos`}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-brand-700 dark:hover:text-brand-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar aos documentos
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
            <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir
          </button>
        )}
      </div>

      {erroImpressao && (
        <Alert tone="danger" className="no-print">
          {erroImpressao}
        </Alert>
      )}

      <p className="no-print rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
        Esta página contém dados clínicos do paciente. Confira o conteúdo antes de imprimir e guarde a impressão em local
        seguro.
      </p>

      <article className="flex flex-col gap-6 rounded-lg border border-neutral-200 bg-surface p-6 text-neutral-900 print:border-0 print:bg-transparent print:p-0">
        <CabecalhoDocumento documentos={documentosParaExibir} tituloDocumento={tituloDocumento} />

        {secoes.map((secao) => {
          switch (secao) {
            case 'ficha':
              return <SecaoFichaClinica key={secao} paciente={documentosParaExibir.paciente} idade={documentos.idade} />;
            case 'anamnese':
              return <SecaoAnamneseDoc key={secao} anamnese={documentos.anamnese} />;
            case 'odontograma':
              return <SecaoOdontogramaDoc key={secao} odontograma={documentos.odontograma} />;
            case 'financeiro':
              return <SecaoFinanceiroDoc key={secao} planos={documentos.planos} />;
            case 'evolucao':
              return <SecaoEvolucaoDoc key={secao} evolucoes={documentos.evolucoes} />;
            case 'consultas':
              return <SecaoConsultasDoc key={secao} consultas={documentos.consultas} />;
            default:
              return null;
          }
        })}

        <AreaAssinaturas nomePaciente={documentos.paciente.nomeCompleto} />
      </article>
    </div>
  );
}
