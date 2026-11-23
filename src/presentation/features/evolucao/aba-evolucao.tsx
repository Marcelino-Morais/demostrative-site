import { useCallback, useEffect, useId, useState } from 'react';
import { useBlocker, useOutletContext, type BlockerFunction } from 'react-router-dom';
import { History } from 'lucide-react';
import type { EvolucaoClinica } from '../../../domain/entities/evolucao-clinica.js';
import { ErroDominio } from '../../../domain/types.js';
import { Alert } from '../../components/ui/alert.js';
import { Badge } from '../../components/ui/badge.js';
import { Button, buttonClassName } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog.js';
import { EmptyState } from '../../components/ui/empty-state.js';
import { Field } from '../../components/ui/field.js';
import { Input, Textarea } from '../../components/ui/input.js';
import { Spinner } from '../../components/ui/spinner.js';
import { formatarDataIso, hojeParaInputDate } from '../../lib/formatadores.js';
import type { FichaClinicaContexto } from '../../pages/ficha-clinica-page.js';
import { useContainer } from '../../providers/container-provider.js';
import { useRegistrarEdicaoPendente } from '../../providers/edicao-pendente-provider.js';

/**
 * Evolução clínica (docx: "tratamentos realizados" por sessão). Pedido
 * do usuário: "conectar com o histórico do odontograma quando
 * possível" — o campo opcional "dente relacionado" faz essa ponte sem
 * duplicar o registro (o lançamento formal do procedimento continua
 * no odontograma; aqui é a narrativa da sessão como um todo).
 *
 * Guarda de trabalho não salvo (Etapa 47): diferente dos outros
 * formulários curtos da ficha (dados, odontograma, consulta), este
 * tem duas áreas de texto livre — "Tratamentos realizados" e
 * "Observações" — que podem levar minutos pra escrever bem, e a
 * evolução é IMUTÁVEL depois de registrada (não dá pra "editar
 * depois"), então perder o rascunho custa reescrever tudo do zero.
 * Segue o mesmo espírito do aviso já usado na anamnese (Etapa 2/Etapa
 * 16), mas na versão simples — sem rascunho salvo automaticamente,
 * só o aviso antes de sair.
 */
export function AbaEvolucao() {
  const { paciente } = useOutletContext<FichaClinicaContexto>();
  const container = useContainer();
  const [falhaLeitura, setFalhaLeitura] = useState(false);
  const [evolucoes, setEvolucoes] = useState<EvolucaoClinica[] | null>(null);
  const [data, setData] = useState(hojeParaInputDate());
  const [tratamentosRealizados, setTratamentosRealizados] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [denteRelacionado, setDenteRelacionado] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const sujo = tratamentosRealizados.trim() !== '' || observacoes.trim() !== '';

  useEffect(() => {
    function aoTentarSair(evento: BeforeUnloadEvent): void {
      if (!sujo) return;
      evento.preventDefault();
      evento.returnValue = '';
    }
    window.addEventListener('beforeunload', aoTentarSair);
    return () => window.removeEventListener('beforeunload', aoTentarSair);
  }, [sujo]);

  // Mesmo "sujo", registrado no compartilhado — pra janela automática de
  // solicitações saber que não é seguro interromper agora.
  useRegistrarEdicaoPendente(useId(), sujo);

  const bloquear: BlockerFunction = useCallback(
    ({ currentLocation, nextLocation }) => sujo && currentLocation.pathname !== nextLocation.pathname,
    [sujo],
  );
  const blocker = useBlocker(bloquear);

  const recarregar = useCallback(() => {
    container.evolucao.listarDoPaciente
      .executar(paciente.id)
      .then((lista) => { setEvolucoes(lista); setFalhaLeitura(false); })
      .catch(() => setFalhaLeitura(true));
  }, [container, paciente.id]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  async function handleRegistrar(): Promise<void> {
    setSalvando(true);
    setErro(null);
    try {
      await container.evolucao.registrar.executar({
        pacienteId: paciente.id,
        data,
        tratamentosRealizados,
        observacoes,
        numeroDenteRelacionado: denteRelacionado ? Number(denteRelacionado) : null,
      });
      setTratamentosRealizados('');
      setObservacoes('');
      setDenteRelacionado('');
      setData(hojeParaInputDate());
      recarregar();
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof ErroDominio ? erroCapturado.message : 'Não foi possível registrar a evolução.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleConfirmarAssinatura(evolucaoId: string): Promise<void> {
    await container.evolucao.confirmarAssinatura.executar(paciente.id, evolucaoId);
    recarregar();
  }

  if (falhaLeitura) {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="danger">Não foi possível carregar os registros. Isso não significa que foram apagados.</Alert>
        <Button variant="secondary" className="self-start" onClick={() => recarregar()}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="no-print flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-700">Nova evolução</h2>
        {erro && <Alert tone="danger">{erro}</Alert>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Data">
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Field>
          <Field label="Dente relacionado (opcional)" hint="Ex.: 26 — conecta esta evolução ao histórico do odontograma.">
            <Input value={denteRelacionado} onChange={(e) => setDenteRelacionado(e.target.value)} placeholder="Ex.: 26" inputMode="numeric" />
          </Field>
        </div>
        <Field label="Tratamentos realizados" required>
          <Textarea value={tratamentosRealizados} onChange={(e) => setTratamentosRealizados(e.target.value)} rows={4} />
        </Field>
        <Field label="Observações">
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
        </Field>
        <Button
          onClick={() => void handleRegistrar()}
          loading={salvando}
          disabled={!tratamentosRealizados.trim()}
          className="self-start"
        >
          Registrar evolução
        </Button>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">Linha do tempo</h2>
        {evolucoes === null && (
          <div className="flex justify-center py-10">
            <Spinner label="Carregando evoluções…" />
          </div>
        )}
        {evolucoes !== null && evolucoes.length === 0 && (
          <EmptyState title="Nenhuma evolução registrada ainda" description="Registre o primeiro atendimento acima." />
        )}
        <ol className="relative flex flex-col gap-4 border-l border-neutral-200 pl-5">
          {evolucoes?.map((evolucao) => {
            const snap = evolucao.toSnapshot();
            return (
              <li key={snap.id} className="relative">
                <span
                  className="absolute -left-[1.45rem] top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-surface"
                  aria-hidden="true"
                />
                <Card className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-neutral-900">{formatarDataIso(snap.data)}</span>
                    <div className="flex items-center gap-2">
                      {snap.numeroDenteRelacionado && <Badge tone="tooth">Dente {snap.numeroDenteRelacionado}</Badge>}
                      <Badge tone={snap.statusAssinaturaPaciente === 'CONFIRMADO' ? 'success' : 'neutral'}>
                        {snap.statusAssinaturaPaciente === 'CONFIRMADO' ? 'Confirmado pelo paciente' : 'Aguardando confirmação'}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-800">{snap.tratamentosRealizados}</p>
                  {snap.observacoes && <p className="text-sm text-neutral-500">{snap.observacoes}</p>}
                  {snap.statusAssinaturaPaciente === 'PENDENTE' && (
                    <button
                      type="button"
                      onClick={() => void handleConfirmarAssinatura(snap.id)}
                      className="no-print self-start text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
                    >
                      Confirmar assinatura do paciente
                    </button>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
      </div>

      <Dialog open={blocker.state === 'blocked'} onOpenChange={(aberto) => !aberto && blocker.reset?.()}>
        <DialogContent>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <History className="h-5 w-5 text-warning-600" aria-hidden="true" />
            Sair sem registrar esta evolução?
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-2 flex flex-col gap-2 text-sm text-neutral-600">
              <p>O que você digitou em "Tratamentos realizados"/"Observações" ainda não foi salvo.</p>
              <p>Você pode continuar editando e clicar em "Registrar evolução", ou sair mesmo assim — o texto será perdido.</p>
            </div>
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => blocker.reset?.()} className={buttonClassName('secondary')}>
              Continuar editando
            </button>
            <Button variant="danger" onClick={() => blocker.proceed?.()}>
              Sair mesmo assim
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
