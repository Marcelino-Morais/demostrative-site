import type { RegistroDental } from '../../../domain/entities/registro-dental.js';
import { FechamentoFinanceiro } from './fechamento-financeiro.js';
import { Alert } from '../../components/ui/alert.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { PlanoTratamento } from '../../../domain/entities/plano-tratamento.js';
import { avaliarDisponibilidadeWhatsapp } from '../../../../whatsapp-itens/src/domain/value-objects/whatsapp.js';
import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import { EmptyState } from '../../components/ui/empty-state.js';
import { Spinner } from '../../components/ui/spinner.js';
import { formatarDataIso } from '../../lib/formatadores.js';
import type { FichaClinicaContexto } from '../../pages/ficha-clinica-page.js';
import { useContainer } from '../../providers/container-provider.js';
import { PlanoTratamentoDetalhe } from './plano-tratamento-detalhe.js';

const STATUS_TOM = { ATIVO: 'brand', CONCLUIDO: 'success', CANCELADO: 'neutral' } as const;
const STATUS_LABEL = { ATIVO: 'Ativo', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' } as const;

export function AbaPlanoTratamento({ denteInicial, aoAtualizar, registrosOdontograma = [] }: { denteInicial?: number | null; aoAtualizar?: () => void; registrosOdontograma?: RegistroDental[] } = {}) {
  const { paciente } = useOutletContext<FichaClinicaContexto>();
  const container = useContainer();
  const versaoLeitura = useRef(0);
  const [falhaLeitura, setFalhaLeitura] = useState(false);
  const [planos, setPlanos] = useState<PlanoTratamento[] | null>(null);
  const [planoSelecionadoId, setPlanoSelecionadoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [erroCriacao, setErroCriacao] = useState(false);

  const recarregar = useCallback(
    (selecionarId?: string) => {
      const versao = ++versaoLeitura.current;
      container.planoTratamento.listarDoPaciente
        .executar(paciente.id)
        .then((lista) => {
          if (versao !== versaoLeitura.current) return;
          setFalhaLeitura(false);
          setPlanos(lista);
          if (selecionarId) {
            setPlanoSelecionadoId(selecionarId);
          } else if (!planoSelecionadoId && lista.length > 0) {
            setPlanoSelecionadoId(lista[0]?.id ?? null);
          }
        })
        .catch(() => { if (versao === versaoLeitura.current) setFalhaLeitura(true); });
    },
    [container, paciente.id, planoSelecionadoId],
  );

  useEffect(() => {
    recarregar();
    return () => { versaoLeitura.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container, paciente.id]);

  async function handleNovoPlano(): Promise<void> {
    setCriando(true);
    setErroCriacao(false);
    try {
      const novo = await container.planoTratamento.criar.executar(paciente.id);
      recarregar(novo.id);
    } catch {
      setErroCriacao(true);
    } finally {
      setCriando(false);
    }
  }

  if (falhaLeitura) {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="danger">Não foi possível carregar os registros. Isso não significa que foram apagados.</Alert>
        <Button variant="secondary" className="self-start" onClick={() => recarregar()}>Tentar novamente</Button>
      </div>
    );
  }

  if (planos === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner label="Carregando plano de tratamento…" />
      </div>
    );
  }

  const planoSelecionado = planos.find((p) => p.id === planoSelecionadoId) ?? planos[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Registros vinculados" className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" to={`/pacientes/${paciente.id}/anamnese`}>Consultar anamnese deste paciente</Link>
        <Link className="underline" to={`/pacientes/${paciente.id}/documentos`}>Orçamentos, recibos e documentos vinculados</Link>
      </nav>

      {erroCriacao && <Alert tone="danger">Não foi possível criar o plano. Verifique a conexão e tente novamente.</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {planos.map((plano) => {
            const snap = plano.toSnapshot();
            return (
              <button
                key={snap.id}
                type="button"
                onClick={() => setPlanoSelecionadoId(snap.id)}
                className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                  snap.id === planoSelecionado?.id
                    ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300'
                    : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {formatarDataIso(snap.criadoEm)}
                <Badge tone={STATUS_TOM[snap.status]}>{STATUS_LABEL[snap.status]}</Badge>
              </button>
            );
          })}
        </div>
        <Button variant="secondary" onClick={() => void handleNovoPlano()} loading={criando} className="no-print">
          Novo orçamento / tratamento
        </Button>
      </div>

      {!planoSelecionado && (
        <EmptyState
          title="Nenhum plano de tratamento ainda"
          description="Crie um orçamento com os trabalhos a executar, valores e condições de pagamento."
        />
      )}

      {planoSelecionado && (
        // Achado de revisão: sem `key`, os campos em digitação de um plano
        // (item/pagamento/condições de pagamento) sobreviviam à troca de
        // plano selecionado (quando há mais de um) — texto digitado pra um
        // plano podia acabar sendo salvo no outro. `key` força remontagem
        // limpa a cada troca de plano.
        <PlanoTratamentoDetalhe
          key={planoSelecionado.id}
          plano={planoSelecionado}
          denteInicial={denteInicial}
          registrosOdontograma={registrosOdontograma}
          whatsappLiberado={
            avaliarDisponibilidadeWhatsapp(
              paciente.toSnapshot().celular,
              paciente.toSnapshot().consentimentoWhatsapp.status,
            ).liberado
          }
          onAtualizado={() => { recarregar(planoSelecionado.id); aoAtualizar?.(); }}
        />
      )}
      <details className="no-print rounded-xl border border-neutral-200"><summary className="cursor-pointer p-4 text-sm font-semibold">Parcelas, recebimentos e fechamento financeiro</summary><div className="px-4 pb-4">
      <FechamentoFinanceiro pacienteId={paciente.id} chaveAtualizacao={planos.map(p=>p.toSnapshot().atualizadoEm).join('|')} />      </div></details>
    </div>
  );
}
