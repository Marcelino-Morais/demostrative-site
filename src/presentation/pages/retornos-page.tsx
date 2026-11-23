import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Ban, Calendar, CheckCircle2, Clock, History, Plus, User } from 'lucide-react';
import type { GrupoOperacionalRetornos } from '../../application/use-cases/retornos.js';
import type { Paciente } from '../../domain/entities/paciente.js';
import type { RetornoProps, StatusRetorno } from '../../domain/entities/retorno.js';
import { STATUS_RETORNO_LABEL } from '../../domain/entities/retorno.js';
import { ErroDominio } from '../../domain/types.js';
import { Alert } from '../components/ui/alert.js';
import { Badge, type BadgeTone } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Field } from '../components/ui/field.js';
import { Input } from '../components/ui/input.js';
import { Spinner } from '../components/ui/spinner.js';
import { formatarDataIso, hojeParaInputDate } from '../lib/formatadores.js';
import { useContainer } from '../providers/container-provider.js';

/**
 * Criação manual de retorno (achado da validação em navegador: o caso
 * de uso `container.retorno.criarManual` já existia desde a Fase de
 * follow-up, mas nenhuma tela chamava ele — esta era a única forma de
 * criar um retorno sem vir de um item de orçamento concluído). Busca de
 * paciente com o mesmo padrão com debounce do catálogo de
 * procedimentos.
 */
function NovoRetornoManual({ onCriado }: { onCriado: () => void }) {
  const container = useContainer();
  const [termo, setTermo] = useState('');
  const [termoAplicado, setTermoAplicado] = useState('');
  const [resultados, setResultados] = useState<Paciente[]>([]);
  const [pacienteSelecionado, setPacienteSelecionado] = useState<Paciente | null>(null);
  const [dataPrevista, setDataPrevista] = useState(hojeParaInputDate());
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTermoAplicado(termo), 200);
    return () => clearTimeout(id);
  }, [termo]);

  useEffect(() => {
    if (!termoAplicado.trim()) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    container.pacientes.listar
      .executar(false, termoAplicado)
      .then((lista) => {
        if (!cancelado) setResultados(lista);
      })
      .catch(() => {
        if (!cancelado) setResultados([]);
      });
    return () => {
      cancelado = true;
    };
  }, [container, termoAplicado]);

  async function criar(): Promise<void> {
    if (!pacienteSelecionado) {
      setErro('Escolha um paciente.');
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await container.retorno.criarManual.executar({ pacienteId: pacienteSelecionado.id, dataPrevista, observacao });
      setPacienteSelecionado(null);
      setTermo('');
      setObservacao('');
      setDataPrevista(hojeParaInputDate());
      onCriado();
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof ErroDominio ? erroCapturado.message : 'Não foi possível criar o retorno.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
        <Plus className="h-4 w-4" aria-hidden="true" /> Novo retorno manual
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem]">
        <Field label="Paciente">
          <Input
            value={pacienteSelecionado ? pacienteSelecionado.toSnapshot().nomeCompleto : termo}
            onChange={(e) => {
              setPacienteSelecionado(null);
              setTermo(e.target.value);
            }}
            placeholder="Buscar paciente por nome"
          />
        </Field>
        <Field label="Data prevista">
          <Input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
        </Field>
      </div>
      {!pacienteSelecionado && resultados.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-lg border border-neutral-200">
          {resultados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  setPacienteSelecionado(p);
                  setResultados([]);
                }}
                className="flex w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
              >
                {p.toSnapshot().nomeCompleto}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Field label="Observação (opcional)">
        <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      </Field>
      {erro && <Alert tone="danger">{erro}</Alert>}
      <Button onClick={() => void criar()} loading={salvando} className="self-start">
        Criar retorno
      </Button>
    </Card>
  );
}

const TOM_STATUS: Record<StatusRetorno, BadgeTone> = {
  PENDENTE: 'neutral',
  AGENDADO: 'brand',
  CONCLUIDO: 'success',
  DISPENSADO: 'neutral',
};

function LinhaRetorno({
  retorno,
  nomePaciente,
  atrasado,
  onAgendar,
  onConcluir,
  onDispensar,
  onAdiar,
}: {
  retorno: RetornoProps;
  nomePaciente: string | null;
  atrasado: boolean;
  onAgendar: () => void;
  onConcluir: () => void;
  onDispensar: () => void;
  onAdiar: (novaData: string) => void;
}) {
  const [adiando, setAdiando] = useState(false);
  const [novaData, setNovaData] = useState(retorno.dataPrevista);
  const finalizado = retorno.status === 'CONCLUIDO' || retorno.status === 'DISPENSADO';

  return (
    <div className="flex flex-col gap-2 border-b border-neutral-100 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/pacientes/${retorno.pacienteId}/dados`} className="font-medium text-neutral-800 hover:text-brand-700">
            {nomePaciente ?? '(paciente)'}
          </Link>
          <Badge tone={atrasado ? 'danger' : TOM_STATUS[retorno.status]}>
            {atrasado ? 'Atrasado' : STATUS_RETORNO_LABEL[retorno.status]}
          </Badge>
        </div>
        <p className="text-sm text-neutral-600">
          Previsto para {formatarDataIso(retorno.dataPrevista)}
          {retorno.observacao && <span className="text-neutral-400"> — {retorno.observacao}</span>}
        </p>
      </div>
      {!finalizado && (
        <div className="flex flex-wrap gap-1.5">
          {adiando ? (
            <>
              <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} className="w-40 text-xs" />
              <Button
                variant="secondary"
                className="text-xs"
                onClick={() => {
                  onAdiar(novaData);
                  setAdiando(false);
                }}
              >
                Confirmar
              </Button>
              <Button variant="secondary" className="text-xs" onClick={() => setAdiando(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Link to={`/pacientes/${retorno.pacienteId}/consultas`} className="inline-flex">
                <Button variant="secondary" className="text-xs">
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" /> Agendar
                </Button>
              </Link>
              {retorno.status === 'PENDENTE' && (
                <Button variant="secondary" className="text-xs" onClick={onAgendar}>
                  Marcar agendado
                </Button>
              )}
              <Button variant="secondary" className="text-xs" onClick={onConcluir}>
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Concluir
              </Button>
              <Button variant="secondary" className="text-xs" onClick={() => setAdiando(true)}>
                <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Adiar
              </Button>
              <Button variant="secondary" className="text-xs" onClick={onDispensar}>
                <Ban className="h-3.5 w-3.5" aria-hidden="true" /> Dispensar
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Tela operacional de retornos/follow-up (Etapa — acompanhamento
 * pós-procedimento). Nunca agenda consulta sozinha — "Agendar" só leva
 * pra aba Consultas do paciente, onde a Agenda de verdade (com suas
 * regras de conflito/dia bloqueado) decide o horário.
 */
export function RetornosPage() {
  const container = useContainer();
  const [grupos, setGrupos] = useState<GrupoOperacionalRetornos | null>(null);
  const [nomes, setNomes] = useState<Record<string, string | null>>({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(false);
    try {
      const resultado = await container.retorno.listarOperacional.executar(hojeParaInputDate());
      setGrupos(resultado);
      const idsUnicos = new Set(
        [...resultado.atrasados, ...resultado.hoje, ...resultado.proximos7Dias, ...resultado.depois, ...resultado.historico].map(
          (r) => r.pacienteId,
        ),
      );
      const entradas = await Promise.all(
        [...idsUnicos].map(async (id) => {
          try {
            const paciente = await container.pacientes.obter.executar(id);
            return [id, paciente?.toSnapshot().nomeCompleto ?? null] as const;
          } catch {
            return [id, null] as const;
          }
        }),
      );
      setNomes(Object.fromEntries(entradas));
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, [container]);

  useEffect(() => {
    void carregar();
  }, [carregar, tentativa]);

  function atualizar(): void {
    setTentativa((t) => t + 1);
  }

  async function agir(acao: (id: string) => Promise<void>, id: string): Promise<void> {
    await acao(id);
    atualizar();
  }

  const secoes: { titulo: string; icone: typeof AlertTriangle; itens: RetornoProps[]; vazio: string }[] = grupos
    ? [
        { titulo: 'Atrasados', icone: AlertTriangle, itens: grupos.atrasados, vazio: 'Nenhum retorno atrasado.' },
        { titulo: 'Hoje', icone: Clock, itens: grupos.hoje, vazio: 'Nenhum retorno previsto para hoje.' },
        { titulo: 'Próximos 7 dias', icone: Calendar, itens: grupos.proximos7Dias, vazio: 'Nenhum retorno nos próximos 7 dias.' },
        { titulo: 'Mais tarde', icone: Calendar, itens: grupos.depois, vazio: 'Nenhum retorno mais distante agendado.' },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Retornos</h1>
        <p className="text-sm text-neutral-600">
          Acompanhamento pós-procedimento — gerado automaticamente ao concluir um item do orçamento com retorno
          configurado no catálogo, ou criado manualmente. "Agendar" sempre leva pra Agenda de verdade; nada aqui cria
          consulta sozinho.
        </p>
      </div>

      {erro && (
        <Alert tone="warning" title="Não foi possível carregar os retornos">
          <Button variant="secondary" onClick={atualizar} className="text-xs">
            Tentar de novo
          </Button>
        </Alert>
      )}

      <NovoRetornoManual onCriado={atualizar} />

      {carregando && !grupos ? (
        <div className="flex justify-center py-10">
          <Spinner label="Carregando retornos…" />
        </div>
      ) : (
        grupos && (
          <>
            {secoes.map(({ titulo, icone: Icone, itens, vazio }) => (
              <Card key={titulo} className="flex flex-col gap-1">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                  <Icone className="h-4 w-4" aria-hidden="true" /> {titulo} ({itens.length})
                </h2>
                {itens.length === 0 ? (
                  <p className="py-2 text-sm text-neutral-500">{vazio}</p>
                ) : (
                  <div className="flex flex-col">
                    {itens.map((r) => (
                      <LinhaRetorno
                        key={r.id}
                        retorno={r}
                        nomePaciente={nomes[r.pacienteId] ?? null}
                        atrasado={titulo === 'Atrasados'}
                        onAgendar={() => void agir((id) => container.retorno.marcarAgendado.executar(id), r.id)}
                        onConcluir={() => void agir((id) => container.retorno.marcarConcluido.executar(id), r.id)}
                        onDispensar={() => void agir((id) => container.retorno.dispensar.executar(id), r.id)}
                        onAdiar={(novaData) =>
                          void agir((id) => container.retorno.adiar.executar(id, novaData), r.id)
                        }
                      />
                    ))}
                  </div>
                )}
              </Card>
            ))}

            <Card className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setMostrarHistorico((v) => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-neutral-700"
              >
                <History className="h-4 w-4" aria-hidden="true" /> Histórico ({grupos.historico.length})
              </button>
              {mostrarHistorico &&
                (grupos.historico.length === 0 ? (
                  <p className="py-2 text-sm text-neutral-500">Nenhum retorno concluído ou dispensado ainda.</p>
                ) : (
                  <div className="flex flex-col">
                    {grupos.historico.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-2 border-b border-neutral-100 py-2 last:border-b-0">
                        <span className="flex items-center gap-2 text-sm text-neutral-700">
                          <User className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                          {nomes[r.pacienteId] ?? '(paciente)'} — {formatarDataIso(r.dataPrevista)}
                        </span>
                        <Badge tone={TOM_STATUS[r.status]}>{STATUS_RETORNO_LABEL[r.status]}</Badge>
                      </div>
                    ))}
                  </div>
                ))}
            </Card>
          </>
        )
      )}
    </div>
  );
}
