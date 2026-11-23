import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarCheck2, CalendarClock, RefreshCcw, ShieldCheck, XCircle } from 'lucide-react';
import { AVISO_TAXA_EMERGENCIA } from '../../../../src/domain/value-objects/atendimento-emergencia.js';
import {
  montarMensagemConfirmacaoAgendamentoWhatsapp,
  saudacaoPorHorario,
} from '../../domain/value-objects/whatsapp.js';
import { ErroApi } from '../../../../src/application/ports/api-client.js';
import { CONFIGURACAO_CLINICA } from '../../../../src/infrastructure/bootstrap/configuracao-clinica.js';
import { Alert } from '../../../../src/presentation/components/ui/alert.js';
import { Button } from '../../../../src/presentation/components/ui/button.js';
import { Field } from '../../../../src/presentation/components/ui/field.js';
import { Input } from '../../../../src/presentation/components/ui/input.js';
import { Spinner } from '../../../../src/presentation/components/ui/spinner.js';
import { formatarDataIso } from '../../../../src/presentation/lib/formatadores.js';
import { hojeIso } from '../../../../src/presentation/lib/datas-agenda.js';
import { useContainer } from '../../../../src/presentation/providers/container-provider.js';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'recusado'; titulo: string; texto: string }
  | { fase: 'inicio'; nome: string }
  | { fase: 'formulario'; nome: string; emergencia: boolean }
  | { fase: 'confirmar'; nome: string; data: string; horario: string; motivo: string; emergencia: boolean }
  | { fase: 'confirmado'; nome: string; data: string; horario: string; emergencia: boolean }
  | { fase: 'cancelado'; nome: string };

const RECUSA: Record<string, { titulo: string; texto: string }> = {
  'nao-encontrado': {
    titulo: 'Link inválido',
    texto: 'Este link de agendamento não foi reconhecido. Peça um link novo ao consultório.',
  },
  revogado: {
    titulo: 'Link cancelado',
    texto: 'Este link foi cancelado pelo consultório. Peça um link novo.',
  },
  expirado: {
    titulo: 'Link expirado',
    texto: 'Este link passou da validade. Peça um link novo ao consultório.',
  },
};

function amanhaIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function dataBr(iso: string): string {
  return formatarDataIso(iso);
}

export function AgendamentoWhatsappPublicoPage() {
  const { token } = useParams<{ token: string }>();
  const container = useContainer();
  const saudacao = useMemo(() => saudacaoPorHorario(), []);

  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });
  const [data, setData] = useState(amanhaIso());
  const [horario, setHorario] = useState('09:00');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!token) {
      setEstado({ fase: 'recusado', ...RECUSA['nao-encontrado']! });
      return;
    }
    let cancelado = false;
    container.whatsapp.abrirAgendamentoPublico
      .executar(token)
      .then((r) => {
        if (cancelado) return;
        if (!r.ok) setEstado({ fase: 'recusado', ...(RECUSA[r.motivo] ?? RECUSA['nao-encontrado']!) });
        else setEstado({ fase: 'inicio', nome: r.primeiroNomePaciente || 'tudo bem' });
      })
      .catch(() => {
        if (!cancelado) setEstado({ fase: 'recusado', ...RECUSA['nao-encontrado']! });
      });
    return () => {
      cancelado = true;
    };
  }, [container, token]);

  function abrirFormulario(emergencia: boolean): void {
    setErro(null);
    setEstado((atual) => ({
      fase: 'formulario',
      nome: 'nome' in atual ? atual.nome : 'tudo bem',
      emergencia,
    }));
  }

  function prepararConfirmacao(emergencia: boolean): void {
    if (!data || data < hojeIso()) {
      setErro('Escolha uma data de hoje em diante.');
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) {
      setErro('Escolha um horário válido.');
      return;
    }
    if (motivo.trim().length > 300) {
      setErro('Use até 300 caracteres no motivo da marcação.');
      return;
    }
    setErro(null);
    setEstado((atual) => ({
      fase: 'confirmar',
      nome: 'nome' in atual ? atual.nome : 'tudo bem',
      data,
      horario,
      motivo: motivo.trim(),
      emergencia,
    }));
  }

  async function confirmar(): Promise<void> {
    if (!token || estado.fase !== 'confirmar') return;
    setEnviando(true);
    setErro(null);
    try {
      await container.whatsapp.confirmarAgendamentoPublico.executar(token, {
        data: estado.data,
        horario: estado.horario,
        motivo: estado.motivo,
        ehEmergencia: estado.emergencia,
      });
      setEstado({
        fase: 'confirmado',
        nome: estado.nome,
        data: estado.data,
        horario: estado.horario,
        emergencia: estado.emergencia,
      });
    } catch (e) {
      setErro(
        e instanceof ErroApi && e.codigo === 'conflito-horario'
          ? 'Este horário acabou de ficar indisponível. Escolha outro.'
          : 'Não foi possível confirmar agora. Tente novamente ou fale com o consultório pelo WhatsApp.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1 border-b border-neutral-200 pb-3">
        <p className="text-sm font-semibold text-brand-800 dark:text-brand-300">{CONFIGURACAO_CLINICA.nomeClinica}</p>
        <p className="text-xs text-neutral-500">
          {CONFIGURACAO_CLINICA.nomeProfissional} · {CONFIGURACAO_CLINICA.registroProfissional}
        </p>
      </header>

      {estado.fase === 'carregando' && (
        <div className="flex justify-center py-16">
          <Spinner label="Abrindo agendamento…" />
        </div>
      )}

      {estado.fase === 'recusado' && (
        <Alert tone="danger" title={estado.titulo}>
          {estado.texto}
        </Alert>
      )}

      {estado.fase === 'inicio' && (
        <section className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-neutral-500">{saudacao}, {estado.nome}.</p>
            <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Como podemos te atender?</h1>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={() => abrirFormulario(false)} className="min-h-14 justify-center">
              <CalendarClock className="h-4 w-4" aria-hidden="true" /> Agendar consulta
            </Button>
            <Button variant="secondary" onClick={() => abrirFormulario(true)} className="min-h-14 justify-center">
              Emergência
            </Button>
          </div>
          <Alert tone="warning">
            Consultas de emergência possuem uma taxa de R$150,00 a mais.
          </Alert>
        </section>
      )}

      {estado.fase === 'formulario' && (
        <section className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-neutral-500">{estado.emergencia ? 'Emergência' : 'Agendamento de consulta'}</p>
            <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Escolha data e horário</h1>
          </div>
          {estado.emergencia && <Alert tone="warning">{AVISO_TAXA_EMERGENCIA}</Alert>}
          {erro && <Alert tone="danger">{erro}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Data">
              <Input type="date" min={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} />
            </Field>
            <Field label="Horário">
              <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
            </Field>
          </div>
          <Field label="Motivo da marcação (opcional)">
            <Input
              value={motivo}
              maxLength={300}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: avaliação, retorno, dor, limpeza"
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setEstado({ fase: 'inicio', nome: estado.nome })}>
              Voltar
            </Button>
            <Button onClick={() => prepararConfirmacao(estado.emergencia)}>Continuar</Button>
          </div>
        </section>
      )}

      {estado.fase === 'confirmar' && (
        <section className="flex flex-col gap-4">
          <Alert tone={estado.emergencia ? 'warning' : 'brand'} title={`Confirmar consulta pro dia ${dataBr(estado.data)}, às ${estado.horario}?`}>
            <span className="flex flex-col gap-1">
              <span>{estado.emergencia ? AVISO_TAXA_EMERGENCIA : 'Confira a data e o horário antes de confirmar.'}</span>
              {estado.motivo && <span>Motivo informado: {estado.motivo}</span>}
            </span>
          </Alert>
          {erro && <Alert tone="danger">{erro}</Alert>}
          <div className="grid gap-2 sm:grid-cols-3">
            <Button onClick={() => void confirmar()} loading={enviando}>
              Sim
            </Button>
            <Button variant="secondary" onClick={() => setEstado({ fase: 'formulario', nome: estado.nome, emergencia: estado.emergencia })}>
              <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Não, mudar data
            </Button>
            <Button variant="secondary" onClick={() => setEstado({ fase: 'cancelado', nome: estado.nome })}>
              <XCircle className="h-4 w-4" aria-hidden="true" /> Não, cancelar
            </Button>
          </div>
        </section>
      )}

      {estado.fase === 'confirmado' && (
        <Alert tone="success" title="Consulta confirmada">
          <div className="flex flex-col gap-2">
            <span className="flex items-start gap-2">
              <CalendarCheck2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {montarMensagemConfirmacaoAgendamentoWhatsapp({
                dataFormatada: dataBr(estado.data),
                horario: estado.horario,
                ehEmergencia: estado.emergencia,
              })}
            </span>
            <span className="text-xs text-success-700 dark:text-success-200">
              Lembrete preparado somente para 1 dia antes da consulta — se o envio automático por
              WhatsApp estiver ativo no consultório, ele chega sozinho; senão, a Dra. Fernanda confirma por
              outro meio.
            </span>
          </div>
        </Alert>
      )}

      {estado.fase === 'cancelado' && (
        <Alert tone="brand" title="Agendamento cancelado">
          Nenhuma consulta foi marcada. Se precisar, volte pelo link do WhatsApp e escolha outro horário.
        </Alert>
      )}

      <footer className="mt-auto flex items-center gap-1.5 pt-4 text-xs text-neutral-400">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Link exclusivo do consultório — a confirmação cai direto na agenda da Dra. Fernanda.
      </footer>
    </div>
  );
}
