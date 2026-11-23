import { ProcedimentoAgendamento, AVALIAR_NO_CONSULTORIO } from './procedimento-agendamento.js';
import { useCallback, useEffect, useId, useState } from 'react';
import { useEncerramentosConsultas } from '../../providers/encerramentos-consultas-provider.js';
import { useOutletContext } from 'react-router-dom';
import { CalendarClock, CalendarPlus } from 'lucide-react';
import type { Consulta } from '../../../domain/entities/consulta.js';
import { mensagemDeErro } from '../../lib/erros.js';
import { AVISO_TAXA_EMERGENCIA } from '../../../domain/value-objects/atendimento-emergencia.js';
import { avaliarDisponibilidadeWhatsapp } from '../../../../whatsapp-itens/src/domain/value-objects/whatsapp.js';
import { Alert } from '../../components/ui/alert.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Checkbox } from '../../components/ui/checkbox.js';
import { EmptyState } from '../../components/ui/empty-state.js';
import { Field } from '../../components/ui/field.js';
import { Input } from '../../components/ui/input.js';
import { Spinner } from '../../components/ui/spinner.js';
import { hojeParaInputDate } from '../../lib/formatadores.js';
import type { FichaClinicaContexto } from '../../pages/ficha-clinica-page.js';
import { useRegistrarEdicaoPendente } from '../../providers/edicao-pendente-provider.js';
import { useContainer } from '../../providers/container-provider.js';
import { CartaoConsulta } from './cartao-consulta.js';

/**
 * Agenda de consultas do paciente. A regra "não agendar/reagendar pra
 * paciente arquivado" mora no caso de uso (`AgendarConsulta`) — aqui a
 * tela só antecipa isso com um aviso claro em vez de deixar a pessoa
 * preencher tudo pra tomar um erro no fim.
 *
 * Sem aviso de "sair sem salvar" de propósito (revisão de segurança
 * operacional, Etapa 47): data/horário/duração/motivo é um formulário
 * curto e rápido de refazer — não no mesmo nível de risco de um texto
 * longo como a Anamnese/Evolução clínica. Isso é só sobre o aviso ao
 * sair — registrar no `EdicaoPendenteProvider` é separado.
 */
export function AbaConsultas() {
  const { paciente } = useOutletContext<FichaClinicaContexto>();
  const container = useContainer();
  const versaoAtendimentos = useEncerramentosConsultas()?.versao ?? 0;
  const [falhaLeitura, setFalhaLeitura] = useState(false);
  const [consultas, setConsultas] = useState<Consulta[] | null>(null);
  const [data, setData] = useState(hojeParaInputDate());
  const [horario, setHorario] = useState('09:00');
  const [duracaoMinutos, setDuracaoMinutos] = useState('30');
  const [motivo, setMotivo] = useState('');
  const [procedimentoId, setProcedimentoId] = useState(AVALIAR_NO_CONSULTORIO);
  const [emergencia, setEmergencia] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [avisoEncaixe, setAvisoEncaixe] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  useRegistrarEdicaoPendente(useId(), motivo.trim() !== '' || emergencia);

  const arquivado = paciente.estaArquivado;
  const podeWhatsapp = avaliarDisponibilidadeWhatsapp(
    paciente.toSnapshot().celular,
    paciente.toSnapshot().consentimentoWhatsapp.status,
  ).liberado;

  const recarregar = useCallback(() => {
    container.consulta.listarDoPaciente
      .executar(paciente.id)
      .then((lista) => { setConsultas(lista); setFalhaLeitura(false); })
      .catch(() => setFalhaLeitura(true));
  }, [container, paciente.id]);

  useEffect(() => {
    recarregar();
  }, [recarregar, versaoAtendimentos]);

  async function handleAgendar(): Promise<void> {
    setSalvando(true);
    setErro(null);
    try {
      const criada = await container.consulta.agendar.executar({
        pacienteId: paciente.id,
        data,
        horario,
        duracaoMinutos: Number(duracaoMinutos),
        motivo: motivo.trim() || 'Avaliar no consultório',
        procedimentoId: procedimentoId === AVALIAR_NO_CONSULTORIO ? undefined : procedimentoId,
        definirValorNoConsultorio: procedimentoId === AVALIAR_NO_CONSULTORIO,
        ehEmergencia: emergencia,
      });
      const salva = criada.toSnapshot();
      setAvisoEncaixe(salva.horario !== horario ? 'Horário ajustado de ' + horario + ' para ' + salva.horario + ', próximo horário disponível.' : 'Consulta agendada.');
      setMotivo('');
      setProcedimentoId(AVALIAR_NO_CONSULTORIO);
      setEmergencia(false);
      recarregar();
    } catch (erroCapturado) {
      setErro(mensagemDeErro(erroCapturado, 'Não foi possível agendar a consulta.'));
    } finally {
      setSalvando(false);
    }
  }

  // Mais recente/mais próxima primeiro — a lista já vem em ordem cronológica do caso de uso.
  const consultasParaExibir = consultas ? [...consultas].reverse() : null;

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
      {avisoEncaixe && <Alert tone="success">{avisoEncaixe}</Alert>}
      {arquivado ? (
        <Alert tone="warning" className="no-print">
          Paciente arquivado — reative-o na aba "Dados" para agendar novas consultas. O histórico de consultas
          continua abaixo.
        </Alert>
      ) : (
        <Card className="no-print flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
            <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Agendar consulta
          </h2>
          {erro && <Alert tone="danger">{erro}</Alert>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Data">
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </Field>
            <Field label="Horário">
              <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
            </Field>
            <Field label="Duração (min)">
              <Input type="number" min={5} step={5} value={duracaoMinutos} onChange={(e) => setDuracaoMinutos(e.target.value)} />
            </Field>
          </div>
          <ProcedimentoAgendamento valor={procedimentoId} emergencia={emergencia} onChange={(id, nome) => { setProcedimentoId(id); setMotivo(nome); }} />
            <Field label="Observações / motivo detalhado (opcional)">
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: Retorno, avaliação, urgência" />
          </Field>
          <Checkbox
            id="consulta-emergencia"
            label="Atendimento de emergência (taxa adicional de R$ 350,00)"
            checked={emergencia}
            onChange={(e) => setEmergencia(e.target.checked)}
          />
          {emergencia && <Alert tone="warning">{AVISO_TAXA_EMERGENCIA}</Alert>}
          <Button onClick={() => void handleAgendar()} loading={salvando} className="self-start">
            Agendar consulta
          </Button>
        </Card>
      )}

      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <CalendarClock className="h-4 w-4" aria-hidden="true" /> Consultas
        </h2>
        {consultasParaExibir === null && (
          <div className="flex justify-center py-10">
            <Spinner label="Carregando consultas…" />
          </div>
        )}
        {consultasParaExibir !== null && consultasParaExibir.length === 0 && (
          <EmptyState
            title="Nenhuma consulta registrada ainda"
            description={
              arquivado
                ? 'Este paciente não tem consultas no histórico. Reative-o na aba "Dados" para agendar.'
                : 'Use o formulário acima para agendar a primeira consulta.'
            }
          />
        )}
        <div className="flex flex-col gap-3">
          {consultasParaExibir?.map((consulta) => (
            <CartaoConsulta key={consulta.id} consulta={consulta} onAtualizado={recarregar} podeWhatsapp={podeWhatsapp} />
          ))}
        </div>
      </div>
    </div>
  );
}
