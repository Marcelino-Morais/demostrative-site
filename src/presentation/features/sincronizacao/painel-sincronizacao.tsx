import { AlertTriangle, CalendarClock, Check, Cloud, CloudOff, Database, HardDrive, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import type { BackupAgendado } from '../../../application/ports/sonda-backend.js';
import type { DiagnosticoSincronizacao } from '../../../application/use-cases/sincronizacao.js';
import { Alert } from '../../components/ui/alert.js';
import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Spinner } from '../../components/ui/spinner.js';
import { formatarDataHoraIso } from '../../lib/formatadores.js';
import { useContainer } from '../../providers/container-provider.js';
import { useSincronizacao } from '../../providers/sincronizacao-provider.js';

type EstadoLinha = 'local' | 'conectado' | 'degradado' | 'offline' | 'desligado';

function PilhaEstado({ estado }: { estado: EstadoLinha }) {
  if (estado === 'conectado') return <Badge tone="success">No servidor · conectado</Badge>;
  if (estado === 'degradado') return <Badge tone="warning">No servidor · com problema</Badge>;
  if (estado === 'offline') return <Badge tone="warning">No servidor · fora do ar</Badge>;
  if (estado === 'desligado') return <Badge tone="neutral">Só neste navegador</Badge>;
  return <Badge tone="neutral">Neste navegador</Badge>;
}

function Linha({
  icone: Icone,
  titulo,
  descricao,
  estado,
}: {
  icone: typeof Database;
  titulo: string;
  descricao: string;
  estado: EstadoLinha;
}) {
  return (
    <li className="flex flex-wrap items-start gap-3 py-3">
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-500"
        aria-hidden="true"
      >
        <Icone className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-neutral-900">{titulo}</span>
          <PilhaEstado estado={estado} />
        </div>
        <p className="text-xs text-neutral-500">{descricao}</p>
      </div>
    </li>
  );
}

function estadoFatia(habilitada: boolean, d: DiagnosticoSincronizacao): EstadoLinha {
  if (!habilitada) return 'desligado';
  if (d.modo === 'degradado') return 'degradado';
  return d.alcancavel ? 'conectado' : 'offline';
}

function ItemArmazenamento({ ok, rotulo }: { ok: boolean; rotulo: string }) {
  return (
    <span className={`flex items-center gap-1 ${ok ? 'text-success-700 dark:text-success-400' : 'text-warning-700 dark:text-warning-400'}`}>
      {ok ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
      {rotulo}
    </span>
  );
}

function textoAgendamento(agendado: BackupAgendado | undefined) {
  if (agendado === undefined) return 'Não consultado automaticamente para evitar abrir PowerShell em segundo plano.';
  if (agendado === null) return 'Não foi possível consultar a tarefa automática neste sistema.';
  if (!agendado.configurado) return 'Backup automático ainda não foi agendado.';
  const proxima = agendado.proximaExecucao ? formatarDataHoraIso(agendado.proximaExecucao) : 'sem próxima execução registrada';
  const ultimoResultado =
    agendado.ultimoResultado === null
      ? ''
      : agendado.ultimoResultado === 0
        ? ' · última execução sem erro'
        : ` · último resultado ${agendado.ultimoResultado}`;
  return `Tarefa ${agendado.estado.toLowerCase()} · próxima execução: ${proxima}${ultimoResultado}`;
}

/**
 * Diagnóstico "onde os dados ficam guardados" (Etapa 20; armazenamento
 * do servidor na Etapa 23), mostrado na tela de Backup. Só lê
 * `useSincronizacao()` (que por sua vez só chama o caso de uso
 * `container.sincronizacao.obterDiagnostico`) — nenhuma lógica de
 * rede/config aqui.
 */
export function PainelSincronizacao() {
  const container = useContainer();
  const { diagnostico, verificando, revalidar } = useSincronizacao();
  const [backupAgendadoManual, setBackupAgendadoManual] = useState<BackupAgendado | undefined>(undefined);
  const [consultandoBackup, setConsultandoBackup] = useState(false);

  async function consultarTarefaBackup() {
    setConsultandoBackup(true);
    try {
      setBackupAgendadoManual(await container.sincronizacao.verificarTarefaBackup.executar());
    } finally {
      setConsultandoBackup(false);
    }
  }

  if (!diagnostico) {
    return (
      <Card className="flex justify-center py-8">
        <Spinner label="Verificando sincronização…" />
      </Card>
    );
  }

  const d = diagnostico;
  const armazenamento = d.saude?.armazenamento;
  const backup = d.saude?.backup;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <Database className="h-4 w-4" aria-hidden="true" /> Onde os dados ficam guardados
        </h2>
        <Button variant="secondary" onClick={revalidar} loading={verificando} className="text-xs">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Verificar agora
        </Button>
      </div>

      {d.modo === 'offline' && (
        <Alert tone="warning" title="Servidor da clínica fora do ar">
          O modo compartilhado está ligado, mas o servidor não respondeu em <code>{d.baseUrl}</code>. Enquanto isso,{' '}
          {d.nucleoHabilitado ? (
            <>
              <strong>o registro clínico</strong> (pacientes, agenda, planos, odontograma, evolução…) não carrega nem
              salva, e os{' '}
            </>
          ) : (
            'os '
          )}
          <strong>links de anamnese</strong> e os <strong>arquivos de paciente</strong> não funcionam entre aparelhos.
          Rode <code>npm start</code> (ou <code>npm run clinica</code>) e clique em "Verificar agora".
        </Alert>
      )}
      {d.modo === 'degradado' && (
        <Alert tone="warning" title="Servidor no ar, mas com problema para salvar dados">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              O servidor em <code>{d.baseUrl}</code> respondeu, mas a pasta de{' '}
              {armazenamento && !armazenamento.dados && !armazenamento.arquivos
                ? 'dados e a de arquivos não estão'
                : armazenamento && !armazenamento.dados
                  ? 'dados não está'
                  : 'arquivos não está'}{' '}
              gravável agora (disco cheio, permissão, ou a pasta foi movida). O que você fizer pode não estar sendo
              salvo — pare o uso, verifique o computador do servidor, e clique em "Verificar agora" antes de continuar.
            </span>
          </div>
        </Alert>
      )}
      {d.modo === 'local' && (
        <Alert tone="brand" title="Este sistema está em modo local">
          Tudo o que você cadastra fica só neste navegador/dispositivo. Para que o registro clínico e os arquivos
          funcionem entre aparelhos, inicie o sistema com <code>npm start</code> (liga o servidor da clínica).
        </Alert>
      )}

      <ul className="flex flex-col divide-y divide-neutral-100">
        <Linha
          icone={d.nucleoHabilitado && d.alcancavel ? Cloud : CloudOff}
          titulo="Registro clínico"
          descricao="Pacientes, agenda, planos de tratamento, pagamentos, odontograma, evolução, anamnese e histórico de WhatsApp."
          estado={estadoFatia(d.nucleoHabilitado, d)}
        />
        <Linha
          icone={d.anamneseHabilitada && d.alcancavel ? Cloud : CloudOff}
          titulo="Anamnese pelo link"
          descricao="Tokens de link e respostas enviadas pelo paciente."
          estado={estadoFatia(d.anamneseHabilitada, d)}
        />
        <Linha
          icone={d.arquivosHabilitados && d.alcancavel ? Cloud : CloudOff}
          titulo="Arquivos de paciente"
          descricao="Imagens e PDFs anexados na aba Documentos e imagens."
          estado={estadoFatia(d.arquivosHabilitados, d)}
        />
        <Linha
          icone={HardDrive}
          titulo="Neste navegador"
          descricao={
            d.nucleoHabilitado
              ? 'Só rascunhos de anamnese em digitação e a preferência de tema — nada de registro clínico.'
              : 'TODO o registro clínico (pacientes, agenda, planos, pagamentos, odontograma, evolução, anamnese, WhatsApp) mais rascunhos e tema (modo local).'
          }
          estado="local"
        />
        <Linha
          icone={Database}
          titulo="Backup .json (abaixo)"
          descricao={
            d.nucleoHabilitado
              ? 'No modo compartilhado, traz uma cópia portátil de todo o registro clínico do servidor. Anamnese pelo link e arquivos ficam só no servidor — npm run backup:servidor.'
              : 'Cobre todos os dados deste navegador (inclusive a lista de arquivos; o conteúdo dos arquivos não vai no .json).'
          }
          estado="local"
        />
      </ul>

      {armazenamento && (
        <div className="rounded-md border border-neutral-200 px-3 py-2 text-xs">
          <p className="mb-1.5 font-medium text-neutral-700">Armazenamento do servidor</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <ItemArmazenamento ok={armazenamento.dados} rotulo="Pasta de dados gravável" />
            <ItemArmazenamento ok={armazenamento.arquivos} rotulo="Pasta de arquivos gravável" />
            <ItemArmazenamento ok={armazenamento.backups} rotulo="Pasta de backups configurada" />
          </div>
          {!armazenamento.backups && (
            <p className="mt-1.5 text-neutral-500">
              Ainda não existe nenhum backup do servidor — rode <code>npm run backup:servidor</code> antes de usar com
              pacientes reais.
            </p>
          )}
          {d.saude?.app?.servindoBuild && (
            <p className="mt-1.5 text-neutral-500">Modo produção local ativo — este servidor também está servindo o app.</p>
          )}
        </div>
      )}

      {backup && (
        <div className="rounded-md border border-neutral-200 px-3 py-2 text-xs">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 font-medium text-neutral-700">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              Backup automático
            </span>
            <Button variant="secondary" onClick={() => void consultarTarefaBackup()} loading={consultandoBackup} className="text-xs">
              Verificar tarefa
            </Button>
          </div>
          <div className="flex flex-col gap-1 text-neutral-500">
            <p>
              {backup.total > 0
                ? `${backup.total} backup(s) do servidor encontrado(s). Último: ${backup.ultimo?.nome ?? 'não identificado'}${
                    backup.ultimo ? ` (${formatarDataHoraIso(backup.ultimo.criadoEm)})` : ''
                  }.`
                : 'Nenhum backup do servidor encontrado ainda.'}
            </p>
            <p>{textoAgendamento(backupAgendadoManual)}</p>
          </div>
        </div>
      )}

      <p className="text-xs text-neutral-400">
        {d.algumHabilitado
          ? `Servidor: ${d.baseUrl} · verificado ${formatarDataHoraIso(d.verificadoEm)}`
          : `Modo local · verificado ${formatarDataHoraIso(d.verificadoEm)}`}
      </p>
    </Card>
  );
}
