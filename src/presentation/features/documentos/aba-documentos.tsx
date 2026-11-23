import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  CalendarClock,
  ClipboardList,
  FileHeart,
  FileText,
  Grid3x3,
  Layers,
  Printer,
  Receipt,
  Stethoscope,
} from 'lucide-react';
import type { DocumentosDoPaciente } from '../../../application/use-cases/documentos-paciente.js';
import { Card } from '../../components/ui/card.js';
import { Spinner } from '../../components/ui/spinner.js';
import { buttonClassName } from '../../components/ui/button.js';
import { formatarDataIso } from '../../lib/formatadores.js';
import type { FichaClinicaContexto } from '../../pages/ficha-clinica-page.js';
import { useContainer } from '../../providers/container-provider.js';

interface EntradaDocumento {
  chave: string;
  icone: typeof FileText;
  titulo: string;
  descricao: string;
  status: string;
}

/**
 * Central de documentos e impressões do paciente — um lugar só para
 * gerar cada documento clínico ou o pacote completo. Não recalcula
 * nada: lê `MontarDocumentosDoPaciente` para os contadores e monta
 * links para a página de impressão (`documentos/imprimir?secoes=…`) e
 * para a folha de orçamento de cada plano.
 */
export function AbaDocumentos() {
  const { paciente } = useOutletContext<FichaClinicaContexto>();
  const container = useContainer();
  const [dados, setDados] = useState<DocumentosDoPaciente | null>(null);

  useEffect(() => {
    let cancelado = false;
    container.documentos.montar.executar(paciente.id).then((d) => {
      if (!cancelado) setDados(d);
    });
    return () => {
      cancelado = true;
    };
  }, [container, paciente.id]);

  const base = `/pacientes/${paciente.id}/documentos/imprimir`;

  if (!dados) {
    return (
      <div className="flex justify-center py-10">
        <Spinner label="Carregando documentos…" />
      </div>
    );
  }

  const anamneseStatus = dados.anamnese
    ? `Preenchida ${Math.round(dados.anamnese.percentualPreenchido * 100)}%` +
      (dados.anamnese.pontosDeAtencao.length > 0
        ? ` · ${dados.anamnese.pontosDeAtencao.length} ponto(s) de atenção`
        : '')
    : 'Ainda não preenchida';

  const entradas: EntradaDocumento[] = [
    {
      chave: 'ficha',
      icone: FileText,
      titulo: 'Ficha clínica',
      descricao: 'Identificação do paciente: nascimento, contato, endereço, indicação.',
      status: `Cadastrado em ${formatarDataIso(dados.paciente.criadoEm)}`,
    },
    {
      chave: 'anamnese',
      icone: FileHeart,
      titulo: 'Anamnese',
      descricao: 'Histórico de saúde em perguntas e respostas, pontos de atenção e consentimento.',
      status: anamneseStatus,
    },
    {
      chave: 'odontograma',
      icone: Grid3x3,
      titulo: 'Histórico do odontograma',
      descricao: 'Lançamentos por dente: condição, procedimento, data, profissional, valor.',
      status:
        dados.odontograma.totalRegistros > 0
          ? `${dados.odontograma.totalRegistros} registro(s) em ${dados.odontograma.dentesComRegistro} dente(s)`
          : 'Nenhum registro',
    },
    {
      chave: 'financeiro',
      icone: Receipt,
      titulo: 'Plano de tratamento e pagamentos',
      descricao: 'Todos os planos: trabalhos, totais, pagamentos efetuados e plano de pagamento.',
      status: dados.planos.length > 0 ? `${dados.planos.length} plano(s)` : 'Nenhum plano',
    },
    {
      chave: 'evolucao',
      icone: Stethoscope,
      titulo: 'Evolução clínica',
      descricao: 'Linha do tempo dos atendimentos: data, tratamentos realizados, observações.',
      status: dados.evolucoes.length > 0 ? `${dados.evolucoes.length} registro(s)` : 'Nenhum registro',
    },
    {
      chave: 'consultas',
      icone: CalendarClock,
      titulo: 'Histórico de consultas',
      descricao: 'Todas as consultas do paciente: data, horário, motivo e situação.',
      status: dados.consultas.length > 0 ? `${dados.consultas.length} consulta(s)` : 'Nenhuma consulta',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="no-print rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
        Todo documento abre numa página de pré-visualização antes de imprimir — dá para conferir exatamente o que vai
        para o papel. Os dados ficam salvos só neste dispositivo.
      </p>

      <Card className="flex flex-col gap-3 border-brand-200 bg-brand-50/50 dark:border-brand-900 dark:bg-brand-900/10">
        <div className="flex items-start gap-3">
          <Layers className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-400" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-neutral-800">Pacote completo do paciente</h2>
            <p className="text-sm text-neutral-600">
              Ficha, anamnese, odontograma, planos e pagamentos, evolução e consultas — tudo num documento só, com áreas
              de assinatura.
            </p>
          </div>
        </div>
        <Link to={base} className={buttonClassName('primary', 'self-start')}>
          <Printer className="h-4 w-4" aria-hidden="true" /> Abrir pacote completo
        </Link>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {entradas.map((entrada) => {
          const Icon = entrada.icone;
          return (
            <Card key={entrada.chave} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-brand-700 dark:text-brand-400" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-neutral-800">{entrada.titulo}</h3>
              </div>
              <p className="text-sm text-neutral-600">{entrada.descricao}</p>
              <p className="text-xs text-neutral-500">{entrada.status}</p>
              <Link to={`/pacientes/${paciente.id}/${entrada.chave === 'financeiro' || entrada.chave === 'planos' || entrada.chave === 'pagamentos' ? 'odontograma' : entrada.chave === 'ficha' ? 'dados' : entrada.chave}`} className={buttonClassName('secondary')}>Abrir registro de origem</Link>
              <Link
                to={`${base}?secoes=${entrada.chave}`}
                className={buttonClassName('secondary', 'mt-auto self-start text-sm')}
              >
                <Printer className="h-4 w-4" aria-hidden="true" /> Abrir para impressão
              </Link>
            </Card>
          );
        })}
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 shrink-0 text-brand-700 dark:text-brand-400" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-neutral-800">Orçamentos (folha de assinatura)</h3>
        </div>
        {dados.planos.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum plano de tratamento ainda — crie um na aba “Plano de tratamento”.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-200">
            {dados.planos.map((plano) => (
              <li key={plano.props.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-neutral-700">
                  Plano de {formatarDataIso(plano.props.criadoEm)}
                  {plano.props.status !== 'ATIVO' ? ` (${plano.props.status.toLowerCase()})` : ''}
                </span>
                <Link
                  to={`/pacientes/${paciente.id}/orcamento/${plano.props.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Abrir orçamento
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
