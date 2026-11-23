import { useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import type { ResumoConsultasFuturas } from '../../../application/use-cases/consulta.js';
import { mensagemDeErro } from '../../lib/erros.js';
import { Alert } from '../../components/ui/alert.js';
import { Button, buttonClassName } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog.js';
import { formatarDataIso } from '../../lib/formatadores.js';
import { useContainer } from '../../providers/container-provider.js';
import { ContatoWhatsapp } from '../../../../whatsapp-itens/src/presentation/features/whatsapp/contato-whatsapp.js';
import { ConsentimentoCortesia } from './consentimento-cortesia.js';
import { DadosPacienteSomenteLeitura } from './dados-paciente-somente-leitura.js';
import { PerfilDoForms } from './perfil-forms.js';
import type { FichaClinicaContexto } from '../../pages/ficha-clinica-page.js';

export function AbaDadosPaciente() {
  const { paciente, recarregarPaciente } = useOutletContext<FichaClinicaContexto>();
  const container = useContainer();
  const navigate = useNavigate();
  const cancelarExclusaoRef = useRef<HTMLButtonElement>(null);
  const exclusaoEmAndamento = useRef(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [aceitouExclusao, setAceitouExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [confirmandoArquivamento, setConfirmandoArquivamento] = useState(false);
  const [alterandoArquivamento, setAlterandoArquivamento] = useState(false);
  const [resumoFuturas, setResumoFuturas] = useState<ResumoConsultasFuturas | null>(null);

  useEffect(() => {
    let cancelado = false;
    container.consulta.resumoFuturasDoPaciente.executar(paciente.id).then((resumo) => {
      if (!cancelado) setResumoFuturas(resumo);
    });
    return () => {
      cancelado = true;
    };
  }, [container, paciente.id]);

  const snapshot = paciente.toSnapshot();
  const consultasFuturas = resumoFuturas?.total ?? 0;
  const plural = consultasFuturas > 1;

  async function handleArquivar(): Promise<void> {
    setAlterandoArquivamento(true);
    try {
      await container.pacientes.arquivar.executar(paciente.id);
      // Consistência de dados (Etapa 20): um link de anamnese ainda ATIVO no
      // servidor não deve seguir aceitando respostas de um ex-paciente.
      // Best-effort — se o servidor estiver fora do ar, o arquivamento local
      // acontece do mesmo jeito (o link fica pendente de revogação).
      if (container.sincronizacaoAnamnese) {
        try {
          await container.anamneseRemota.revogarLinkAtivoDoPaciente.executar(paciente.id);
        } catch {
          /* servidor indisponível — segue */
        }
      }
      // Mesma ideia para o link de agendamento por WhatsApp (achado na
      // auditoria da Etapa 27) — esse fluxo não tem uma flag de "ligado/
      // desligado" própria (sempre fala com o servidor), então tenta
      // sempre, best-effort.
      try {
        await container.whatsapp.revogarLinkAgendamentoAtivoDoPaciente.executar(paciente.id);
      } catch {
        /* servidor indisponível — segue */
      }
      setConfirmandoArquivamento(false);
      recarregarPaciente();
    } finally {
      setAlterandoArquivamento(false);
    }
  }

  async function handleReativar(): Promise<void> {
    setAlterandoArquivamento(true);
    try {
      await container.pacientes.reativar.executar(paciente.id);
      recarregarPaciente();
    } finally {
      setAlterandoArquivamento(false);
    }
  }

  async function handleExcluir(): Promise<void> {
    if (!aceitouExclusao || exclusaoEmAndamento.current) return;
    exclusaoEmAndamento.current = true;
    setExcluindo(true);
    setErroExclusao(null);
    try {
      await container.pacientes.remover.executar(paciente.id);
      navigate('/pacientes', { replace: true });
    } catch (erroCapturado) {
      setErroExclusao(mensagemDeErro(erroCapturado, 'Não foi possível excluir o paciente. Tente novamente.'));
    } finally {
      exclusaoEmAndamento.current = false;
      setExcluindo(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PerfilDoForms key={paciente.id} pacienteId={paciente.id} aoAtualizar={recarregarPaciente} />
      <DadosPacienteSomenteLeitura paciente={snapshot} />

      <div data-tour="consentimentos-paciente" className="flex flex-col gap-4"><ContatoWhatsapp paciente={paciente} aoAtualizar={recarregarPaciente} />

      <ConsentimentoCortesia paciente={paciente} aoAtualizar={recarregarPaciente} /></div>

      <Card className="no-print flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-700">Ciclo de vida do paciente</h2>
        {snapshot.arquivadoEm ? (
          <>
            <p className="text-sm text-neutral-600">
              Este paciente está arquivado desde {new Date(snapshot.arquivadoEm).toLocaleDateString('pt-BR')} — não
              aparece na lista principal de pacientes, mas todo o histórico clínico (anamnese, odontograma, plano de
              tratamento, evolução) continua aqui, intacto.
            </p>
            <Button variant="secondary" onClick={() => void handleReativar()} loading={alterandoArquivamento} className="self-start">
              <ArchiveRestore className="h-4 w-4" aria-hidden="true" /> Reativar paciente
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-neutral-600">
              Arquivar remove este paciente da lista principal (útil quando o tratamento terminou ou o paciente não
              retorna mais) sem apagar nada — todo o histórico clínico continua acessível aqui a qualquer momento, e o
              paciente pode ser reativado depois.
            </p>
            {consultasFuturas > 0 && (
              <p className="text-sm font-medium text-warning-700 dark:text-warning-400">
                Atenção: {consultasFuturas} consulta{plural ? 's' : ''} futura{plural ? 's' : ''} agendada
                {plural ? 's' : ''} — o aviso de arquivamento explica o que acontece com {plural ? 'elas' : 'ela'}.
              </p>
            )}
            <Button variant="secondary" onClick={() => setConfirmandoArquivamento(true)} className="self-start">
              <Archive className="h-4 w-4" aria-hidden="true" /> Arquivar paciente
            </Button>
          </>
        )}
      </Card>

      <Card className="no-print flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-danger-600">Excluir paciente</h2>
        <p className="text-sm text-neutral-600">
          A exclusão é permanente. Para manter o histórico e apenas retirar o paciente da lista, use Arquivar paciente.
        </p>
        <Button variant="danger" className="self-start" onClick={() => {
          setAceitouExclusao(false);
          setErroExclusao(null);
          setConfirmandoExclusao(true);
        }}>
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir paciente
        </Button>
      </Card>

      <Dialog open={confirmandoExclusao} onOpenChange={(aberto) => {
        if (!exclusaoEmAndamento.current) setConfirmandoExclusao(aberto);
      }}>
        <DialogContent onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelarExclusaoRef.current?.focus();
        }}>
          <DialogTitle className="text-base font-semibold text-neutral-900">
            Excluir {snapshot.nomeCompleto}?
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-neutral-600">
            Esta ação não pode ser desfeita nesta tela. No servidor, também remove consultas e registros clínicos vinculados,
            incluindo anamnese, odontograma, planos de tratamento e evoluções. Não apaga as respostas originais no Google Forms.
          </DialogDescription>
          <label className="mt-4 flex items-start gap-2 text-sm text-neutral-800">
            <input type="checkbox" className="mt-1" checked={aceitouExclusao} disabled={excluindo}
              onChange={(event) => setAceitouExclusao(event.target.checked)} />
            Entendo que estou excluindo este paciente permanentemente.
          </label>
          {erroExclusao && <Alert tone="danger" className="mt-3">{erroExclusao}</Alert>}
          <div className="mt-4 flex justify-end gap-2">
            <Button ref={cancelarExclusaoRef} variant="secondary" disabled={excluindo}
              onClick={() => setConfirmandoExclusao(false)}>Cancelar</Button>
            <Button variant="danger" disabled={!aceitouExclusao} loading={excluindo}
              onClick={() => void handleExcluir()}>Excluir definitivamente</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmandoArquivamento} onOpenChange={setConfirmandoArquivamento}>
        <DialogContent>
          <DialogTitle className="text-base font-semibold text-neutral-900">Arquivar {snapshot.nomeCompleto}?</DialogTitle>
          <DialogDescription asChild>
            <p className="mt-2 text-sm text-neutral-600">
              O paciente sai da lista principal, mas nada é apagado — anamnese, odontograma, plano de tratamento e
              evolução continuam disponíveis, e você pode reativar a qualquer momento.
              {container.sincronizacaoAnamnese && (
                <> Se houver um link de anamnese ativo no servidor, ele será revogado (pode gerar outro ao reativar).</>
              )}
            </p>
          </DialogDescription>
          {consultasFuturas > 0 && (
            <Alert tone="warning" className="mt-3">
              <p className="font-medium">
                {consultasFuturas === 1
                  ? 'Este paciente tem 1 consulta futura agendada.'
                  : `Este paciente tem ${consultasFuturas} consultas futuras agendadas.`}
              </p>
              <p className="mt-1">
                Ao arquivar, {plural ? 'elas deixam' : 'ela deixa'} de aparecer na Agenda do consultório e no Painel,
                mas {plural ? 'continuam registradas' : 'continua registrada'} na aba Consultas deste paciente — nada é
                cancelado nem apagado.
                {resumoFuturas?.proxima && (
                  <> Próxima: {formatarDataIso(resumoFuturas.proxima.data)} às {resumoFuturas.proxima.horario}.</>
                )}
              </p>
            </Alert>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmandoArquivamento(false)} className={buttonClassName('secondary')}>
              Cancelar
            </button>
            <Button onClick={() => void handleArquivar()} loading={alterandoArquivamento}>
              Arquivar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
