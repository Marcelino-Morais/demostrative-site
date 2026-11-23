import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import {
  FILTROS_PRONTIDAO_VAZIO,
  type FiltrosProntidao,
  type PacienteComProntidao,
} from '../../application/use-cases/prontidao.js';
import { calcularIdade } from '../../domain/entities/paciente.js';
import {
  NIVEL_PRONTIDAO_LABEL,
  TOM_POR_GRAVIDADE_PRONTIDAO,
  TOM_POR_NIVEL_PRONTIDAO,
} from '../../domain/value-objects/prontidao-paciente.js';
import { Alert } from '../components/ui/alert.js';
import { Badge } from '../components/ui/badge.js';
import { Button, buttonClassName } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { EmptyState } from '../components/ui/empty-state.js';
import { Input } from '../components/ui/input.js';
import { Spinner } from '../components/ui/spinner.js';
import { cn } from '../lib/cn.js';
import { formatarDataIso } from '../lib/formatadores.js';
import { useContainer } from '../providers/container-provider.js';

/** Chip de filtro — texto sempre carrega o sentido, a cor é reforço. */
function ChipFiltro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        ativo
          ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
          : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-200/10',
      )}
    >
      {children}
    </button>
  );
}

const FILTRO_LABEL: Record<keyof FiltrosProntidao, string> = {
  anamneseIncompleta: 'Anamnese incompleta',
  saldoAberto: 'Saldo em aberto',
  comConsultaFutura: 'Com consulta futura',
  consentimentoWhatsappPendente: 'Consentimento WhatsApp pendente',
};

export function PacientesListPage() {
  const container = useContainer();
  const [resultado, setResultado] = useState<PacienteComProntidao[] | null>(null);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosProntidao>(FILTROS_PRONTIDAO_VAZIO);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [pendenteMigrar, setPendenteMigrar] = useState(0);

  useEffect(() => {
    if (!container.sincronizacaoNucleo) return;
    let cancelado = false;
    container.migracao.planejar
      .executar()
      .then((plano) => {
        if (cancelado || !plano.servidorDisponivel) return;
        const faltando = plano.local.pacientes - (plano.servidor?.pacientes ?? 0);
        setPendenteMigrar(faltando > 0 ? faltando : 0);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [container, tentativa]);

  // Debounce leve: não refaz a consulta a cada tecla, mas continua ágil.
  useEffect(() => {
    const id = setTimeout(() => setBuscaAplicada(busca), 200);
    return () => clearTimeout(id);
  }, [busca]);

  useEffect(() => {
    let cancelado = false;
    // Sem `setResultado(null)` aqui: a lista anterior fica visível enquanto a
    // nova carrega, então digitar na busca não pisca um spinner a cada letra.
    setErroCarregar(false);
    container.prontidao.listarComProntidao
      .executar({ incluirArquivados: mostrarArquivados, termo: buscaAplicada, filtros })
      .then((lista) => {
        if (!cancelado) setResultado(lista);
      })
      .catch(() => {
        if (!cancelado) {
          setErroCarregar(true);
          setResultado([]);
        }
      });
    return () => {
      cancelado = true;
    };
  }, [container, mostrarArquivados, buscaAplicada, filtros, tentativa]);

  const buscando = buscaAplicada.trim().length > 0;
  const filtrosProntidaoAtivos = (Object.keys(filtros) as (keyof FiltrosProntidao)[]).filter((k) => filtros[k]);
  const algumFiltro = buscando || mostrarArquivados || filtrosProntidaoAtivos.length > 0;

  function alternarFiltro(chave: keyof FiltrosProntidao): void {
    setFiltros((atual) => ({ ...atual, [chave]: !atual[chave] }));
  }

  function limparTudo(): void {
    setBusca('');
    setBuscaAplicada('');
    setMostrarArquivados(false);
    setFiltros(FILTROS_PRONTIDAO_VAZIO);
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Pacientes</h1>
          <p className="mt-2 text-sm text-neutral-500">Encontre um cadastro e abra a ficha para consultar ou atualizar os dados.</p>
        </div>
        <Link to="/pacientes/novo" className={buttonClassName('primary', 'w-full sm:w-auto')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Novo paciente
        </Link>
      </div>

      <div className="relative w-full max-w-xl">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          aria-hidden="true"
        />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, telefone, e-mail, CPF…"
          className="pl-9"
          aria-label="Buscar paciente"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold text-neutral-500">Filtrar por</span>
        {(Object.keys(FILTRO_LABEL) as (keyof FiltrosProntidao)[]).map((chave) => (
          <ChipFiltro key={chave} ativo={filtros[chave]} onClick={() => alternarFiltro(chave)}>
            {FILTRO_LABEL[chave]}
          </ChipFiltro>
        ))}
        <ChipFiltro ativo={mostrarArquivados} onClick={() => setMostrarArquivados((v) => !v)}>
          Incluir arquivados
        </ChipFiltro>
        {algumFiltro && (
          <button
            type="button"
            onClick={limparTudo}
            className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {pendenteMigrar > 0 && (
        <Alert tone="brand" title="Há pacientes guardados só neste navegador">
          <span>
            {pendenteMigrar} paciente{pendenteMigrar > 1 ? 's' : ''} ainda não{' '}
            {pendenteMigrar > 1 ? 'foram enviados' : 'foi enviado'} ao servidor da clínica.{' '}
            <Link to="/configuracoes" className="font-medium underline">
              Guardar no servidor
            </Link>
            .
          </span>
        </Alert>
      )}

      {erroCarregar && (
        <Alert tone="warning" title="Não foi possível carregar os pacientes do servidor da clínica">
          <div className="flex flex-col items-start gap-2">
            <span>O servidor pode estar fora do ar. Verifique a conexão e tente de novo.</span>
            <Button variant="secondary" onClick={() => setTentativa((t) => t + 1)} className="text-xs">
              Tentar de novo
            </Button>
          </div>
        </Alert>
      )}

      {resultado === null && (
        <div className="flex justify-center py-10">
          <Spinner label="Carregando pacientes…" />
        </div>
      )}

      {resultado !== null && resultado.length === 0 && !algumFiltro && !erroCarregar && (
        <EmptyState
          title="Nenhum paciente cadastrado ainda"
          description="Cadastre o primeiro paciente para começar a usar a ficha clínica, anamnese e odontograma."
          action={
            <Link to="/pacientes/novo" className={buttonClassName('primary')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Cadastrar primeiro paciente
            </Link>
          }
        />
      )}

      {resultado !== null && resultado.length === 0 && algumFiltro && (
        <EmptyState
          title="Nenhum paciente encontrado"
          description={
            buscando
              ? `Nada corresponde a “${buscaAplicada.trim()}” com os filtros atuais.`
              : 'Nenhum paciente se encaixa nos filtros selecionados.'
          }
          action={
            <button type="button" onClick={limparTudo} className={buttonClassName('secondary')}>
              Limpar filtros
            </button>
          }
        />
      )}

      {resultado !== null && resultado.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            <p className="col-span-full text-sm text-neutral-500" role="status">
              {resultado.length} paciente{resultado.length > 1 ? 's' : ''}
              {buscando ? ` para “${buscaAplicada.trim()}”` : ''}
            </p>
          )}
          {resultado.map(({ paciente, prontidao }) => {
            const snap = paciente.toSnapshot();
            const idade = calcularIdade(snap.dataNascimento);
            return (
              <Link key={snap.id} to={`/pacientes/${snap.id}`}>
                <Card className="flex h-full flex-col gap-2 transition-colors hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-brand-900/20">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-neutral-900">{snap.nomeCompleto}</p>
                    {snap.arquivadoEm && <Badge tone="neutral">Arquivado</Badge>}
                    {prontidao.nivel !== 'completa' && (
                      <Badge tone={TOM_POR_NIVEL_PRONTIDAO[prontidao.nivel]}>
                        {NIVEL_PRONTIDAO_LABEL[prontidao.nivel]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-neutral-500">
                    {idade !== null ? `${idade} anos` : 'Idade não informada'}
                  </p>
                  {snap.celular && <p className="text-sm text-neutral-500">{snap.celular}</p>}
                  {prontidao.indicadores.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {prontidao.indicadores.map((indicador) => (
                        <Badge key={indicador.chave} tone={TOM_POR_GRAVIDADE_PRONTIDAO[indicador.gravidade]}>
                          {indicador.rotulo}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="mt-auto pt-2 text-xs text-neutral-400">
                    <span>Cadastrado em {formatarDataIso(snap.criadoEm)}</span><span className="mt-2 block text-sm font-semibold text-brand-700">Abrir ficha →</span>
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
