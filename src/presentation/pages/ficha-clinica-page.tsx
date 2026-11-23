import { AlertasClinicos } from '../features/anamnese/alertas-clinicos.js';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { Archive, Check, Printer } from 'lucide-react';
import type { ResumoDaFicha } from '../../application/use-cases/ficha-clinica.js';
import type { Paciente } from '../../domain/entities/paciente.js';
import { calcularIdade } from '../../domain/entities/paciente.js';
import { Alert } from '../components/ui/alert.js';
import { Badge } from '../components/ui/badge.js';
import { Button, buttonClassName } from '../components/ui/button.js';
import { CabecalhoImpressao } from '../components/ui/cabecalho-impressao.js';
import { Spinner } from '../components/ui/spinner.js';
import { cn } from '../lib/cn.js';
import { formatarDataIso } from '../lib/formatadores.js';
import { useContainer } from '../providers/container-provider.js';

export interface FichaClinicaContexto {
  paciente: Paciente;
  recarregarPaciente: () => void;
}

const ABAS = [
  { to: 'atendimento', label: 'Atendimento' },
  { to: 'dados', label: 'Dados' },
  { to: 'consultas', label: 'Consultas' },
  { to: 'anamnese', label: 'Anamnese' },
  { to: 'odontograma', label: 'Odontograma e tratamento' },
  { to: 'evolucao', label: 'Evolução' },
  { to: 'documentos', label: 'Documentos' },
  { to: 'exames', label: 'Exames' },
  { to: 'arquivos', label: 'Arquivos' },
];

/** Contador discreto ao lado do nome da aba (nº de registros na seção). */
function Contador({ children }: { children: number }) {
  return (
    <span className="rounded-full bg-neutral-200 px-1.5 text-[0.65rem] font-semibold tabular-nums text-neutral-600">
      {children}
    </span>
  );
}

/**
 * Indicador da aba — deriva do resumo agregado da ficha
 * (`ObterResumoDaFicha`), nunca conta nada por conta própria: contador
 * de registros nas seções, e para a anamnese um sinal de "a preencher"
 * / "pontos de atenção" / "completa".
 */
function IndicadorAba({ to, resumo }: { to: string; resumo: ResumoDaFicha | null }) {
  if (!resumo) return null;
  switch (to) {
    case 'consultas':
      return resumo.consultas.futuras > 0 ? <Contador>{resumo.consultas.futuras}</Contador> : null;
    case 'odontograma':
      return resumo.odontograma > 0 ? <Contador>{resumo.odontograma}</Contador> : null;
    case 'plano-tratamento':
      return resumo.planosTratamento > 0 ? <Contador>{resumo.planosTratamento}</Contador> : null;
    case 'evolucao':
      return resumo.evolucoes > 0 ? <Contador>{resumo.evolucoes}</Contador> : null;
    case 'anamnese':
      if (!resumo.anamnese.existe)
        return (
          <span className="rounded-full bg-warning-100 px-1.5 text-[0.65rem] font-semibold text-warning-800 dark:bg-warning-900/40 dark:text-warning-300">
            a preencher
          </span>
        );
      if (resumo.anamnese.pontosDeAtencao > 0)
        return (
          <span
            className="rounded-full bg-warning-100 px-1.5 text-[0.65rem] font-semibold tabular-nums text-warning-800 dark:bg-warning-900/40 dark:text-warning-300"
            title={`${resumo.anamnese.pontosDeAtencao} ponto(s) de atenção clínica`}
          >
            ! {resumo.anamnese.pontosDeAtencao}
          </span>
        );
      if (resumo.anamnese.percentual >= 1) return <Check className="h-3.5 w-3.5 text-success-600 dark:text-success-500" aria-hidden="true" />;
      return (
        <span className="text-[0.65rem] font-medium tabular-nums text-neutral-400">
          {Math.round(resumo.anamnese.percentual * 100)}%
        </span>
      );
    default:
      return null;
  }
}

/**
 * Casca da Ficha Clínica de um paciente — cabeçalho fixo com os dados
 * essenciais + abas por URL (não estado local), pra cada seção poder
 * ser aberta direto por link (ex.: a partir do card "Pacientes
 * recentes" do Painel). Carrega o paciente uma vez aqui e repassa por
 * `useOutletContext` pras abas filhas, que nunca buscam o paciente de
 * novo sozinhas.
 */
export function FichaClinicaPage() {
  const { pacienteId } = useParams<{ pacienteId: string }>();
  const container = useContainer();
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [resumoFicha, setResumoFicha] = useState<ResumoDaFicha | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<'nao-encontrado' | 'offline' | null>(null);
  const [chaveRecarregar, setChaveRecarregar] = useState(0);

  useEffect(() => {
    if (!pacienteId) return;
    let cancelado = false;
    setCarregando(true);
    // Trocar de paciente (navegação real) limpa a ficha atual — aí o
    // spinner de página inteira volta. Um refresh do mesmo paciente
    // (`chaveRecarregar`) mantém a ficha visível enquanto recarrega.
    setPaciente((atual) => (atual && atual.id !== pacienteId ? null : atual));
    container.pacientes.obter
      .executar(pacienteId)
      .then((encontrado) => {
        if (cancelado) return;
        setPaciente(encontrado ?? null);
        setErro(encontrado ? null : 'nao-encontrado');
      })
      .catch(() => {
        // Erro de rede (servidor fora do ar) — NÃO é "paciente não existe".
        if (!cancelado) setErro('offline');
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [pacienteId, container, chaveRecarregar]);

  useEffect(() => {
    if (!pacienteId) return;
    let cancelado = false;
    container.fichaClinica.obterResumo
      .executar(pacienteId)
      .then((resumo) => {
        if (!cancelado) setResumoFicha(resumo);
      })
      .catch(() => {
        /* resumo é opcional na ficha — o erro de carga do paciente já é tratado acima */
      });
    return () => {
      cancelado = true;
    };
  }, [pacienteId, container, chaveRecarregar]);

  // Só a PRIMEIRA carga mostra o spinner de página inteira. Um refresh
  // (`recarregarPaciente`, ex.: depois de salvar os dados) mantém a
  // ficha atual visível enquanto recarrega — assim mensagens de sucesso
  // nas abas não são apagadas por um remount, e no modo servidor (com
  // latência de rede) a tela não pisca a cada ação.
  if (carregando && !paciente) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Carregando ficha clínica…" />
      </div>
    );
  }

  if (erro === 'offline' || (!paciente && !carregando && erro === null)) {
    return (
      <div className="p-4 sm:p-6">
        <Alert tone="warning" title="Não foi possível carregar a ficha do servidor da clínica">
          <div className="flex flex-col items-start gap-2">
            <span>O servidor pode estar fora do ar. Veja o aviso no topo da tela e tente de novo.</span>
            <Button variant="secondary" onClick={() => setChaveRecarregar((k) => k + 1)} className="text-xs">
              Tentar de novo
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (erro === 'nao-encontrado' || !paciente) {
    return (
      <div className="p-4 sm:p-6">
        <Alert tone="danger">Paciente não encontrado.</Alert>
      </div>
    );
  }

  const snapshot = paciente.toSnapshot();
  const idade = calcularIdade(snapshot.dataNascimento);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <CabecalhoImpressao subtitulo={snapshot.nomeCompleto} cpf={snapshot.cpf} rg={snapshot.rg} />

      {snapshot.arquivadoEm && (
        <Alert tone="warning" className="no-print">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 shrink-0" aria-hidden="true" />
            Paciente arquivado — não aparece na lista principal. O histórico clínico continua intacto; reative na aba
            "Dados" quando precisar.
          </div>
        </Alert>
      )}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-neutral-900">
            {snapshot.nomeCompleto}
            {snapshot.arquivadoEm && <Badge tone="neutral">Arquivado</Badge>}
          </h1>
          <p className="text-sm text-neutral-600">
            {idade !== null ? `${idade} anos` : 'Idade não informada'}
            {snapshot.celular ? ` · ${snapshot.celular}` : ''}
            {snapshot.dataNascimento ? ` · Nasc. ${formatarDataIso(snapshot.dataNascimento)}` : ''}
          </p>
          {resumoFicha?.consultas.proxima && (
            <p className="mt-0.5 text-xs font-medium text-brand-700 dark:text-brand-400">
              Próxima consulta: {formatarDataIso(resumoFicha.consultas.proxima.data)} às{' '}
              {resumoFicha.consultas.proxima.horario}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className={buttonClassName('secondary', 'no-print')}
          title="Imprime a aba aberta no momento (ex.: anamnese, odontograma, plano de tratamento)"
        >
          <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir esta aba
        </button>
      </div>

      <nav
        aria-label="Seções da ficha clínica"
        className="no-print flex flex-wrap gap-1 border-b border-neutral-200"
      >
        {ABAS.map((aba) => (
          <NavLink
            key={aba.to}
            to={aba.to}
            className={({ isActive }) =>
              cn(
                'min-h-11 shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium text-neutral-600 transition-colors',
                'hover:text-neutral-900',
                'flex items-center gap-1.5',
                isActive && 'border-brand-700 text-brand-800 dark:text-brand-300',
              )
            }
          >
            {aba.label}
            <IndicadorAba to={aba.to} resumo={resumoFicha} />
          </NavLink>
        ))}
      </nav>

      <div data-tour="alertas-clinicos"><AlertasClinicos pacienteId={paciente.id} /></div>
      <Outlet context={{ paciente, recarregarPaciente: () => setChaveRecarregar((n) => n + 1) } satisfies FichaClinicaContexto} />
    </div>
  );
}
