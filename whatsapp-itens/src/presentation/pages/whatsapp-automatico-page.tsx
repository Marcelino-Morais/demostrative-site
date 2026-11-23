import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  HelpCircle,
  MessageCircleWarning,
  Power,
  PowerOff,
  RefreshCw,
  Send,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type {
  ResultadoProcessamentoWhatsappAutomatico,
  StatusFilaWhatsappAutomatica,
  StatusMensagemWhatsappAutomatica,
} from '../../application/ports/porta-whatsapp-automatico.js';
import type {
  EstadoSupervisionado,
  EtapasVerificacaoPilotoDesktop,
  ResultadoTestePilotoDesktop,
  StatusPilotoDesktop,
  StatusTentativaSupervisionada,
} from '../../application/ports/porta-whatsapp-piloto-desktop.js';
import { Alert } from '../../../../src/presentation/components/ui/alert.js';
import { Badge, type BadgeTone } from '../../../../src/presentation/components/ui/badge.js';
import { Button, buttonClassName } from '../../../../src/presentation/components/ui/button.js';
import { Card } from '../../../../src/presentation/components/ui/card.js';
import { Checkbox } from '../../../../src/presentation/components/ui/checkbox.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../../../../src/presentation/components/ui/dialog.js';
import { Spinner } from '../../../../src/presentation/components/ui/spinner.js';
import { cn } from '../../../../src/presentation/lib/cn.js';
import {
  contarMensagensRepresadas,
  destaqueLinhaPorStatus,
  estadoOperacionalProvedor,
  filaComMuitasRepresadas,
  ORDEM_STATUS,
  rotuloMotivoProvedor,
  rotuloStatusMensagem,
  rotuloStatusEntregaProvedor,
  rotuloTipoMensagem,
  rotuloUltimoErro,
  tomStatusMensagem,
} from '../features/whatsapp-automatico/whatsapp-automatico-format.js';
import { formatarDataHoraIso } from '../../../../src/presentation/lib/formatadores.js';
import { useContainer } from '../../../../src/presentation/providers/container-provider.js';

type Filtro = 'TODAS' | StatusMensagemWhatsappAutomatica;

function ChipFiltro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        ativo
          ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
          : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-200/10',
      )}
    >
      {children}
    </button>
  );
}

const ROTULO_MOTIVO_PILOTO: Record<string, string> = {
  'piloto-desabilitado': 'O piloto está desligado (comportamento padrão).',
  'modo-nao-suportado-nesta-etapa': 'Configurado num modo diferente de dry-run — nesta etapa só dry-run é aceito.',
  'allowlist-vazia': 'Nenhum número autorizado foi configurado para o piloto.',
};

function rotuloMotivoPiloto(motivo: string | null): string {
  if (!motivo) return '';
  return ROTULO_MOTIVO_PILOTO[motivo] ?? 'O piloto não está disponível no momento.';
}

const ROTULO_ETAPA: Record<keyof EtapasVerificacaoPilotoDesktop, string> = {
  desktopDesbloqueado: 'Área de trabalho desbloqueada',
  whatsappLogado: 'WhatsApp logado',
  cabecalho: 'Cabeçalho da conversa confirmado',
  telefone: 'Telefone confirmado no painel de contato',
  editor: 'Mensagem confirmada na caixa de texto',
};

const ROTULO_FASE_SUPERVISIONADO: Record<string, string> = {
  pronta: 'Pronto para iniciar',
  iniciando: 'Iniciando…',
  'desktop-verificado': 'Área de trabalho verificada',
  'login-verificado': 'Login do WhatsApp verificado',
  'cabecalho-verificado': 'Conversa localizada',
  'editor-verificado': 'Mensagem preenchida',
  'telefone-verificado': 'Telefone confirmado',
  'editor-revalidado': 'Mensagem confirmada de novo',
  'pre-enter-verificado': 'Última verificação antes de enviar',
  'enter-pressionado': 'Enter apertado — enviando',
};

function rotuloFaseSupervisionado(fase: string): string {
  return ROTULO_FASE_SUPERVISIONADO[fase] ?? fase;
}

const ROTULO_STATUS_SUPERVISIONADO: Record<StatusTentativaSupervisionada, { label: string; tom: BadgeTone }> = {
  PRONTA: { label: 'Preparando', tom: 'neutral' },
  EM_ANDAMENTO: { label: 'Em andamento', tom: 'brand' },
  ENTER_PRESSIONADO: { label: 'Enter apertado', tom: 'warning' },
  INCERTO: { label: 'Incerto — confira no WhatsApp', tom: 'warning' },
  CANCELADA: { label: 'Cancelada', tom: 'neutral' },
  FALHA_RECUPERAVEL: { label: 'Falhou antes de enviar (nada foi enviado)', tom: 'danger' },
  // Nunca "confirmado" sozinho — precisa deixar claro que foi VOCÊ quem
  // confirmou, nunca um recibo oficial do WhatsApp (achado do fechamento
  // da Etapa B: o rótulo anterior podia ser lido como se o sistema
  // tivesse confirmado a entrega sozinho).
  CONFIRMADO_MANUALMENTE: { label: 'Você confirmou o recebimento', tom: 'success' },
  NAO_CONFIRMADO: { label: 'Não confirmado', tom: 'danger' },
};

/** Status em que a tentativa ainda está rodando (worker de pé) — usados para decidir se vale continuar sondando. */
const STATUS_SUPERVISIONADO_ATIVOS = new Set<StatusTentativaSupervisionada>(['PRONTA', 'EM_ANDAMENTO', 'ENTER_PRESSIONADO']);

function segundosDecorridos(desde: string, agora: number): number {
  const inicio = new Date(desde).getTime();
  if (Number.isNaN(inicio)) return 0;
  return Math.max(0, Math.floor((agora - inicio) / 1000));
}

function formatarDuracao(segundos: number): string {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return min > 0 ? `${min}min ${seg}s` : `${seg}s`;
}

function ItemEtapa({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-danger-600" aria-hidden="true" />
      )}
      <span className={ok ? 'text-neutral-700' : 'text-neutral-500'}>{label}</span>
    </li>
  );
}

function textoResultadoProcessamento(r: ResultadoProcessamentoWhatsappAutomatico): string {
  const partes: string[] = [];
  if (r.enviadas > 0) partes.push(`${r.enviadas} enviada(s)`);
  if (r.aguardandoProvedor > 0) partes.push(`${r.aguardandoProvedor} aguardando provedor`);
  if (r.bloqueadas > 0) partes.push(`${r.bloqueadas} bloqueada(s)`);
  if (r.falhas > 0) partes.push(`${r.falhas} com falha`);
  return partes.length > 0 ? partes.join(', ') + '.' : 'Nada para processar agora — nenhuma mensagem venceu ainda.';
}

/**
 * Tela de operação "WhatsApp automático" (Etapa 26) — mostra a fila que
 * o servidor já mantém sozinho (confirmação + lembrete de 24h
 * criados ao confirmar um agendamento pelo link de WhatsApp): se há
 * provedor de envio configurado, quantas mensagens há em cada status, e
 * a lista com paciente/tipo/horário/status/erro. Só LÊ e dispara o
 * processamento manual — nenhuma regra de agendamento/bloqueio mora
 * aqui, isso já é do servidor. Nunca mostra número completo nem texto
 * de mensagem (o servidor já não devolve isso).
 */
export function WhatsappAutomaticoPage() {
  const container = useContainer();
  const disponivel = container.sincronizacaoNucleo;

  const [status, setStatus] = useState<StatusFilaWhatsappAutomatica | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoProcessamentoWhatsappAutomatico | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('TODAS');

  // Piloto de WhatsApp Desktop (Etapa 62), Etapa A — estado próprio,
  // separado do provedor genérico acima; nunca compartilha resultado.
  const [statusPiloto, setStatusPiloto] = useState<StatusPilotoDesktop | null>(null);
  const [testandoPiloto, setTestandoPiloto] = useState(false);
  const [ultimoTestePiloto, setUltimoTestePiloto] = useState<ResultadoTestePilotoDesktop | null>(null);

  // Etapa B — autoteste supervisionado (um envio real, só para o dono,
  // sob confirmação explícita). Estado próprio, sondado à parte porque
  // uma tentativa pode levar minutos e precisa de progresso ao vivo.
  const [estadoSupervisionado, setEstadoSupervisionado] = useState<EstadoSupervisionado | null>(null);
  const [dialogoConfirmacaoAberto, setDialogoConfirmacaoAberto] = useState(false);
  const [checkboxConfirmado, setCheckboxConfirmado] = useState(false);
  const [iniciandoSupervisionado, setIniciandoSupervisionado] = useState(false);
  const [cancelandoSupervisionado, setCancelandoSupervisionado] = useState(false);
  const [confirmandoResultado, setConfirmandoResultado] = useState<'confirmado' | 'nao-confirmado' | null>(null);
  const [alternandoKillSwitch, setAlternandoKillSwitch] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (!disponivel) return;
    let cancelado = false;
    setErro(false);
    container.whatsappAutomatico.obterStatus
      .executar()
      .then((s) => {
        if (!cancelado) setStatus(s);
      })
      .catch(() => {
        if (!cancelado) setErro(true);
      });
    return () => {
      cancelado = true;
    };
  }, [container, disponivel, tentativa]);

  const processarAgora = useCallback(async () => {
    setProcessando(true);
    setResultado(null);
    try {
      const r = await container.whatsappAutomatico.processarAgora.executar();
      setResultado(r);
      setTentativa((t) => t + 1); // recarrega a lista com o que mudou
    } catch {
      setErro(true);
    } finally {
      setProcessando(false);
    }
  }, [container]);

  const atualizar = useCallback(() => {
    setErro(false);
    setTentativa((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!disponivel) return;
    let cancelado = false;
    container.whatsappPilotoDesktop.obterStatus
      .executar()
      .then((s) => {
        if (!cancelado) {
          setStatusPiloto(s);
          if (s.ultimoResultadoTeste) setUltimoTestePiloto(s.ultimoResultadoTeste);
        }
      })
      .catch(() => {
        // Silencioso de propósito: o piloto é uma seção secundária,
        // opcional e desligada por padrão — uma falha aqui não deve
        // travar nem ofuscar a tela principal da fila automática.
      });
    return () => {
      cancelado = true;
    };
  }, [container, disponivel, tentativa]);

  const testarPiloto = useCallback(async () => {
    setTestandoPiloto(true);
    try {
      const r = await container.whatsappPilotoDesktop.testarComMeuNumero.executar();
      setUltimoTestePiloto(r);
    } catch {
      setUltimoTestePiloto({ ok: false, codigo: 'erro-de-conexao', etapas: null, em: new Date().toISOString() });
    } finally {
      setTestandoPiloto(false);
    }
  }, [container]);

  const tentativaSupervisionada = estadoSupervisionado?.tentativaAtual ?? null;
  const tentativaAtiva = tentativaSupervisionada ? STATUS_SUPERVISIONADO_ATIVOS.has(tentativaSupervisionada.status) : false;

  // Sonda o estado supervisionado: sempre uma vez ao montar/quando a seção
  // é habilitada, e a cada 2s enquanto houver uma tentativa em andamento —
  // é o que dá o progresso "ao vivo" sem precisar de WebSocket.
  useEffect(() => {
    if (!disponivel) return;
    let cancelado = false;

    async function sondar() {
      try {
        const s = await container.whatsappPilotoDesktop.obterEstadoSupervisionado.executar();
        if (!cancelado) setEstadoSupervisionado(s);
      } catch {
        // Silencioso — mesma justificativa da seção da Etapa A acima.
      }
    }

    sondar();
    const intervalo = tentativaAtiva ? setInterval(sondar, 2000) : null;
    return () => {
      cancelado = true;
      if (intervalo) clearInterval(intervalo);
    };
  }, [container, disponivel, tentativa, tentativaAtiva]);

  // Relógio para o tempo decorrido exibido durante uma tentativa ativa.
  useEffect(() => {
    if (!tentativaAtiva) return;
    const intervalo = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [tentativaAtiva]);

  const iniciarSupervisionado = useCallback(async () => {
    setIniciandoSupervisionado(true);
    try {
      const r = await container.whatsappPilotoDesktop.iniciarTesteSupervisionado.executar(true);
      if (r.ok) {
        setDialogoConfirmacaoAberto(false);
        setCheckboxConfirmado(false);
      }
      const s = await container.whatsappPilotoDesktop.obterEstadoSupervisionado.executar();
      setEstadoSupervisionado(s);
    } finally {
      setIniciandoSupervisionado(false);
    }
  }, [container]);

  const cancelarSupervisionado = useCallback(async () => {
    setCancelandoSupervisionado(true);
    try {
      await container.whatsappPilotoDesktop.cancelarTesteSupervisionado.executar();
      const s = await container.whatsappPilotoDesktop.obterEstadoSupervisionado.executar();
      setEstadoSupervisionado(s);
    } finally {
      setCancelandoSupervisionado(false);
    }
  }, [container]);

  const confirmarResultadoSupervisionado = useCallback(
    async (resultado: 'confirmado' | 'nao-confirmado') => {
      setConfirmandoResultado(resultado);
      try {
        await container.whatsappPilotoDesktop.confirmarResultadoSupervisionado.executar(resultado);
        const s = await container.whatsappPilotoDesktop.obterEstadoSupervisionado.executar();
        setEstadoSupervisionado(s);
      } finally {
        setConfirmandoResultado(null);
      }
    },
    [container],
  );

  const alternarKillSwitch = useCallback(async () => {
    setAlternandoKillSwitch(true);
    try {
      if (estadoSupervisionado?.killSwitchAtivo) {
        await container.whatsappPilotoDesktop.desarmarKillSwitch.executar();
      } else {
        await container.whatsappPilotoDesktop.ativarKillSwitch.executar();
      }
      const s = await container.whatsappPilotoDesktop.obterEstadoSupervisionado.executar();
      setEstadoSupervisionado(s);
    } finally {
      setAlternandoKillSwitch(false);
    }
  }, [container, estadoSupervisionado]);

  const mensagensFiltradas = useMemo(
    () => (status && filtro !== 'TODAS' ? status.mensagens.filter((m) => m.status === filtro) : (status?.mensagens ?? [])),
    [status, filtro],
  );

  const estadoProvedor = useMemo(() => (status ? estadoOperacionalProvedor(status) : null), [status]);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div>
        <Link
          to="/configuracoes"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-brand-700 dark:hover:text-brand-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar a Backup
        </Link>
        <h1 className="text-xl font-semibold text-neutral-900">WhatsApp automático</h1>
        <p className="text-sm text-neutral-600">
          Confirmações e lembretes de consulta agendados automaticamente quando a paciente marca pelo link de
          WhatsApp — o servidor cria as mensagens sozinho; aqui você acompanha o que está pendente e processa a fila
          na hora, se precisar.
        </p>
      </div>

      {!disponivel ? (
        <Alert tone="brand" title="Este recurso depende do servidor da clínica">
          A fila automática de WhatsApp vive no servidor da clínica (modo compartilhado). Inicie o sistema com{' '}
          <code>npm start</code> ou <code>npm run clinica</code> para usá-la.
        </Alert>
      ) : erro ? (
        <Alert tone="warning" title="Não foi possível falar com o servidor da clínica">
          <div className="flex flex-col items-start gap-2">
            <span>O servidor pode estar fora do ar. Veja o aviso no topo da tela e tente de novo.</span>
            <Button variant="secondary" onClick={atualizar} className="text-xs">
              Tentar de novo
            </Button>
          </div>
        </Alert>
      ) : !status ? (
        <div className="flex justify-center py-10">
          <Spinner label="Carregando a fila de WhatsApp…" />
        </div>
      ) : (
        <>
          {filaComMuitasRepresadas(status) && (
            <Alert tone="danger" title="Muitas mensagens represadas">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {contarMensagensRepresadas(status)} mensagens estão em "aguardando provedor" ou "falha no envio" —
                  bem mais do que o normal. Confira se o provedor está configurado e no ar, e clique em "Processar
                  agora" depois de corrigir. Nenhuma mensagem é perdida enquanto isso — elas continuam na fila e são
                  tentadas de novo automaticamente.
                </span>
              </div>
            </Alert>
          )}

          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-neutral-700">Provedor de envio</h2>
              <Button variant="secondary" onClick={processarAgora} loading={processando} className="text-xs">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Processar agora
              </Button>
            </div>

            <div>
              <Badge tone={status.provedorConfigurado ? 'success' : 'warning'}>
                {status.provedorConfigurado ? `Provedor configurado (${status.nomeProvedor})` : 'Provedor não configurado'}
              </Badge>
            </div>

            {status.templatesMeta && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-neutral-600">
                  Templates configurados (só diz se um NOME está preenchido na configuração do servidor — não
                  confirma que está aprovado na Meta):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['Confirmação', status.templatesMeta.confirmacao],
                      ['Lembrete 24h', status.templatesMeta.lembrete24h],
                                            ['Confirmação (emergência)', status.templatesMeta.confirmacaoEmergencia],
                      ['Lembrete 24h (emergência)', status.templatesMeta.lembrete24hEmergencia],
                                          ] as const
                  ).map(([rotulo, configurado]) => (
                    <Badge key={rotulo} tone={configurado ? 'success' : 'neutral'}>
                      {rotulo}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {estadoProvedor === 'nao-configurado' && (
              <Alert tone="warning" title="As mensagens estão sendo preparadas, mas não serão enviadas">
                <div className="flex items-start gap-2">
                  <MessageCircleWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {rotuloMotivoProvedor(status.motivo)} A confirmação e os lembretes continuam sendo agendados
                    normalmente e ficam <strong>aguardando provedor</strong> — nada é enviado de verdade, e o sistema
                    nunca finge que foi, até você configurar um provedor real (veja como abaixo). Se alguma dessas
                    consultas precisa mesmo de confirmação/lembrete agora, use os botões <strong>"Falar no
                    WhatsApp"</strong> na Agenda ou no perfil do paciente (mandam a mensagem manualmente), ou ligue
                    para o paciente — a fila sozinha não vai entregar nada enquanto ficar assim.
                  </span>
                </div>
              </Alert>
            )}

            {estadoProvedor === 'falhando' && (
              <Alert tone="danger" title="Provedor configurado, mas as últimas tentativas de envio falharam">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Confira se <code>WHATSAPP_PROVIDER_WEBHOOK_URL</code> e <code>WHATSAPP_PROVIDER_TOKEN</code> ainda
                    estão corretos, e se o provedor está no ar. O motivo de cada falha aparece na coluna "Observação"
                    da mensagem, na lista abaixo — mensagens com falha são tentadas de novo automaticamente.
                  </span>
                </div>
              </Alert>
            )}

            {estadoProvedor === 'funcionando' && (
              <Alert tone="success" title="Provedor funcionando">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {status.nomeProvedor?.startsWith('meta-cloud-api') ? (
                      <>
                        {status.porStatus.ENVIADA ?? 0} mensagem(ns) já {(status.porStatus.ENVIADA ?? 0) === 1 ? 'foi' : 'foram'}{' '}
                        aceita(s) pela Meta.{' '}
                        {status.webhookMetaConfigurado
                          ? 'O webhook de status está configurado; entregas, leituras e falhas pós-aceite aparecem na lista.'
                          : 'A confirmação de entrega/leitura depende de configurar o webhook de status.'}
                      </>
                    ) : (
                      <>
                        {status.porStatus.ENVIADA ?? 0} mensagem(ns) já {(status.porStatus.ENVIADA ?? 0) === 1 ? 'foi' : 'foram'}{' '}
                        entregue(s) ao provedor com sucesso.
                      </>
                    )}
                  </span>
                </div>
              </Alert>
            )}

            {estadoProvedor === 'pronto-sem-envios' && (
              <Alert tone="brand" title="Provedor configurado">
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    A fila está pronta. Assim que uma confirmação ou lembrete vencer, ele é enviado automaticamente —
                    nenhuma mensagem foi entregue ainda porque nenhuma venceu.
                  </span>
                </div>
              </Alert>
            )}

            {resultado && <Alert tone="brand">Processamento concluído: {textoResultadoProcessamento(resultado)}</Alert>}

            <div className="flex flex-wrap gap-2">
              {ORDEM_STATUS.map((s) => (
                <Badge key={s} tone={tomStatusMensagem(s)}>
                  {rotuloStatusMensagem(s)}: {status.porStatus[s] ?? 0}
                </Badge>
              ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-neutral-700">Piloto de WhatsApp Desktop (experimental)</h2>
              <Badge tone={statusPiloto?.habilitado ? 'brand' : 'neutral'}>
                {statusPiloto?.habilitado ? `Habilitado — modo ${statusPiloto.modo}` : 'Desabilitado'}
              </Badge>
            </div>

            <Alert tone="brand" title="Nenhuma mensagem será enviada por este piloto ainda">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Esta é a Etapa A (só verificação): o worker abre o WhatsApp, confere cabeçalho, telefone e
                  mensagem, e para antes de apertar Enter — sempre, mesmo quando tudo confere. Nenhum paciente é
                  usado; o teste só roda no próprio número autorizado do operador. Pode levar até alguns minutos
                  se o WhatsApp Desktop precisar "acordar" de um estado ocioso — isso é normal, não feche o
                  sistema nem mexa no WhatsApp enquanto espera.
                </span>
              </div>
            </Alert>

            {!statusPiloto?.habilitado && (
              <p className="text-sm text-neutral-500">{rotuloMotivoPiloto(statusPiloto?.motivo ?? null)}</p>
            )}

            {statusPiloto?.habilitado && (
              <>
                <div>
                  <Button variant="secondary" onClick={testarPiloto} loading={testandoPiloto} className="text-xs">
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Testar com meu número
                  </Button>
                </div>

                {ultimoTestePiloto && (
                  <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
                    <Badge tone={ultimoTestePiloto.ok ? 'success' : 'warning'}>
                      {ultimoTestePiloto.ok ? 'Verificação concluída' : `Não concluído: ${ultimoTestePiloto.codigo}`}
                    </Badge>
                    {ultimoTestePiloto.etapas && (
                      <ul className="flex flex-col gap-1">
                        {(Object.keys(ROTULO_ETAPA) as Array<keyof EtapasVerificacaoPilotoDesktop>).map((chave) => (
                          <ItemEtapa key={chave} ok={ultimoTestePiloto.etapas![chave]} label={ROTULO_ETAPA[chave]} />
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </Card>

          {estadoSupervisionado?.habilitado && (
            <Card className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-neutral-700">Autoteste supervisionado (envio real)</h2>
                <div className="flex items-center gap-2">
                  {estadoSupervisionado.numeroMascarado && (
                    <span className="font-mono text-xs text-neutral-500">{estadoSupervisionado.numeroMascarado}</span>
                  )}
                  {estadoSupervisionado.killSwitchAtivo && <Badge tone="danger">Kill switch ativo</Badge>}
                  <Button
                    variant={estadoSupervisionado.killSwitchAtivo ? 'secondary' : 'danger'}
                    onClick={alternarKillSwitch}
                    loading={alternandoKillSwitch}
                    className="text-xs"
                  >
                    {estadoSupervisionado.killSwitchAtivo ? (
                      <>
                        <Power className="h-3.5 w-3.5" aria-hidden="true" /> Desarmar kill switch
                      </>
                    ) : (
                      <>
                        <PowerOff className="h-3.5 w-3.5" aria-hidden="true" /> Kill switch
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <Alert tone="warning" title="Isto envia UMA mensagem real">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Diferente da verificação acima, este autoteste aperta Enter de verdade — uma mensagem é
                    entregue no seu próprio WhatsApp. Continua restrito ao número autorizado do operador; nenhum
                    paciente é usado ou pode ser usado por aqui.
                  </span>
                </div>
              </Alert>

              {!tentativaSupervisionada || !STATUS_SUPERVISIONADO_ATIVOS.has(tentativaSupervisionada.status) ? (
                <div>
                  <Button
                    variant="primary"
                    onClick={() => setDialogoConfirmacaoAberto(true)}
                    disabled={estadoSupervisionado.killSwitchAtivo}
                    className="text-xs"
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden="true" /> Enviar teste para meu número
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone={ROTULO_STATUS_SUPERVISIONADO[tentativaSupervisionada.status].tom}>
                      {ROTULO_STATUS_SUPERVISIONADO[tentativaSupervisionada.status].label}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatarDuracao(segundosDecorridos(tentativaSupervisionada.criadoEm, agora))}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600">{rotuloFaseSupervisionado(tentativaSupervisionada.fase)}</p>
                  <p className="text-xs text-neutral-500">Não toque no WhatsApp Desktop enquanto isto estiver rodando.</p>
                  {!tentativaSupervisionada.enterPressionado && (
                    <div>
                      <Button
                        variant="secondary"
                        onClick={cancelarSupervisionado}
                        loading={cancelandoSupervisionado}
                        className="text-xs"
                      >
                        <Ban className="h-3.5 w-3.5" aria-hidden="true" /> Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {tentativaSupervisionada?.status === 'INCERTO' && (
                <div className="flex flex-col gap-2 rounded-lg border border-warning-300 bg-warning-50 p-3 dark:bg-warning-900/20">
                  <div className="flex items-start gap-2 text-sm text-warning-800 dark:text-warning-200">
                    <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      A ação de envio foi realizada. Confira no seu WhatsApp se a mensagem chegou, e confirme
                      abaixo — o sistema não consegue verificar isso sozinho.
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      onClick={() => confirmarResultadoSupervisionado('confirmado')}
                      loading={confirmandoResultado === 'confirmado'}
                      disabled={confirmandoResultado !== null}
                      className="text-xs"
                    >
                      Confirmar que recebi
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => confirmarResultadoSupervisionado('nao-confirmado')}
                      loading={confirmandoResultado === 'nao-confirmado'}
                      disabled={confirmandoResultado !== null}
                      className="text-xs"
                    >
                      Não consegui confirmar
                    </Button>
                  </div>
                </div>
              )}

              {tentativaSupervisionada &&
                !STATUS_SUPERVISIONADO_ATIVOS.has(tentativaSupervisionada.status) &&
                tentativaSupervisionada.status !== 'INCERTO' && (
                  <p className="text-xs text-neutral-500">
                    Última tentativa: {ROTULO_STATUS_SUPERVISIONADO[tentativaSupervisionada.status].label}
                    {tentativaSupervisionada.ultimoErro ? ` (${tentativaSupervisionada.ultimoErro})` : ''}.
                  </p>
                )}
            </Card>
          )}

          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-neutral-700">Mensagens agendadas</h2>
              <Button variant="secondary" onClick={atualizar} className="text-xs">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Atualizar
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <ChipFiltro ativo={filtro === 'TODAS'} onClick={() => setFiltro('TODAS')}>
                Todas ({status.mensagens.length})
              </ChipFiltro>
              {ORDEM_STATUS.map((s) => (
                <ChipFiltro key={s} ativo={filtro === s} onClick={() => setFiltro(s)}>
                  {rotuloStatusMensagem(s)} ({status.porStatus[s] ?? 0})
                </ChipFiltro>
              ))}
            </div>

            {status.mensagens.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhuma mensagem agendada ainda.</p>
            ) : mensagensFiltradas.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhuma mensagem com esse status agora.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-neutral-200">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Paciente</th>
                      <th scope="col" className="px-3 py-2 font-medium">Mensagem</th>
                      <th scope="col" className="px-3 py-2 font-medium">Agendada para</th>
                      <th scope="col" className="px-3 py-2 font-medium">Status</th>
                      <th scope="col" className="px-3 py-2 font-medium">Número</th>
                      <th scope="col" className="px-3 py-2 font-medium">Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {mensagensFiltradas.map((m) => (
                      <tr key={m.id} className={destaqueLinhaPorStatus(m.status)}>
                        <td className="px-3 py-2 text-neutral-800">{m.pacienteNome ?? '(paciente removido)'}</td>
                        <td className="px-3 py-2 text-neutral-600">{rotuloTipoMensagem(m.tipo)}</td>
                        <td className="px-3 py-2 text-neutral-600">{formatarDataHoraIso(m.agendadaPara)}</td>
                        <td className="px-3 py-2">
                          <Badge tone={tomStatusMensagem(m.status)}>{rotuloStatusMensagem(m.status)}</Badge>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-neutral-500">{m.numeroMascarado || '—'}</td>
                        <td className="px-3 py-2 text-xs text-neutral-500">
                          {rotuloUltimoErro(m.ultimoErro) ?? '—'}
                          {rotuloStatusEntregaProvedor(m.statusEntregaProvedor) && (
                            <div className="text-neutral-500">
                              Meta: {rotuloStatusEntregaProvedor(m.statusEntregaProvedor)}
                              {m.codigoErroEntregaProvedor ? ` (${rotuloUltimoErro(m.codigoErroEntregaProvedor) ?? 'erro informado pela Meta'})` : ''}
                            </div>
                          )}
                          {m.status === 'FALHA' && m.proximaTentativaEm && (
                            <div className="text-neutral-400">
                              Próxima tentativa: {formatarDataHoraIso(m.proximaTentativaEm)}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Alert tone="brand" title="Configurar um provedor real de WhatsApp depois">
            <div className="flex flex-col gap-1.5">
              <p>
                Enquanto nenhum provedor estiver configurado, as mensagens ficam represadas em "aguardando provedor" —
                de propósito, para nunca fingir um envio que não aconteceu. O sistema fala com um{' '}
                <strong>provedor genérico</strong>: qualquer serviço (Cloud API, Twilio, Z-API, um broker próprio) que
                aceite receber um <code>POST</code> HTTPS funciona, sem precisar mudar nada no sistema — só apontar a
                URL certa. No computador que roda o servidor:
              </p>
              <ol className="list-inside list-decimal">
                <li>
                  Defina <code>WHATSAPP_PROVIDER_WEBHOOK_URL</code> com o endpoint HTTPS do provedor (localhost vale
                  só para teste local).
                </li>
                <li>
                  Se o provedor exigir um token, defina <code>WHATSAPP_PROVIDER_TOKEN</code> — ele é enviado como{' '}
                  <code>Bearer</code>.
                </li>
                <li>
                  O servidor envia um <code>POST</code> para essa URL com{' '}
                  <code>{'{ to, template, text }'}</code>.
                </li>
              </ol>
              <p>
                Para testar o envio de verdade antes de escolher um provedor pago, rode{' '}
                <code>npm run whatsapp:provedor-fake</code> num terminal e aponte{' '}
                <code>WHATSAPP_PROVIDER_WEBHOOK_URL</code> para ele — é só para desenvolvimento, nunca envia nada de
                verdade.
              </p>
              <p>
                Para voltar ao modo sem provedor a qualquer momento, apague ou deixe em branco{' '}
                <code>WHATSAPP_PROVIDER_WEBHOOK_URL</code> e reinicie o sistema — as mensagens voltam a ficar
                represadas em "aguardando provedor", sem perder nada da fila.
              </p>
              <p>Reinicie o sistema depois de definir as variáveis. Veja o guia completo em `server/README.md`.</p>
            </div>
          </Alert>
        </>
      )}

      <Dialog
        open={dialogoConfirmacaoAberto}
        onOpenChange={(aberto) => {
          setDialogoConfirmacaoAberto(aberto);
          if (!aberto) setCheckboxConfirmado(false);
        }}
      >
        <DialogContent>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <AlertTriangle className="h-5 w-5 text-warning-600" aria-hidden="true" />
            Confirmar envio real de teste
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-2 flex flex-col gap-3 text-sm text-neutral-600">
              <p>
                Uma mensagem real será enviada agora para o número autorizado do operador
                {estadoSupervisionado?.numeroMascarado ? (
                  <>
                    {' '}
                    (<span className="font-mono">{estadoSupervisionado.numeroMascarado}</span>)
                  </>
                ) : (
                  ' '
                )}
                — não um paciente. A verificação completa pode levar vários minutos — não toque no WhatsApp Desktop
                nem no computador enquanto isso.
              </p>
              <p>
                O resultado não pode ser confirmado automaticamente pelo sistema: depois do envio, você vai
                precisar conferir no seu WhatsApp e confirmar manualmente na tela.
              </p>
              <p className="text-xs text-neutral-500">
                Contas do WhatsApp podem ser restringidas por uso automatizado excessivo — use este autoteste com
                moderação, nunca em sequência.
              </p>
              <Checkbox
                id="confirmar-envio-supervisionado"
                checked={checkboxConfirmado}
                onChange={(e) => setCheckboxConfirmado(e.target.checked)}
                label="Entendi que isto envia uma mensagem real e vou acompanhar sem mexer no WhatsApp."
              />
            </div>
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose className={buttonClassName('secondary')}>Cancelar</DialogClose>
            <Button
              variant="primary"
              onClick={iniciarSupervisionado}
              loading={iniciandoSupervisionado}
              disabled={!checkboxConfirmado}
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" /> Enviar teste para meu número
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
