import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  Cake,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Copy,
  ExternalLink,
  FileHeart,
  Grid3x3,
  HardDrive,
  ListChecks,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Receipt,
  Stethoscope,
  Users,
} from 'lucide-react';
import { STATUS_CONSULTA_LABEL, TOM_POR_STATUS_CONSULTA } from '../../domain/entities/consulta.js';
import type { ConsultaProxima } from '../../application/use-cases/consulta.js';
import type { EvolucaoRecente } from '../../application/use-cases/evolucao.js';
import type { ResumoDoPainel } from '../../application/use-cases/painel.js';
import type { PendenciaPaciente, ResumoPendencias } from '../../application/use-cases/prontidao.js';
import type { Paciente } from '../../domain/entities/paciente.js';
import { Alert } from '../components/ui/alert.js';
import { Badge } from '../components/ui/badge.js';
import { CONFIGURACAO_CLINICA } from '../../infrastructure/bootstrap/configuracao-clinica.js';
import { Button, buttonClassName } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog.js';
import { EmptyState } from '../components/ui/empty-state.js';
import { Input, Textarea } from '../components/ui/input.js';
import { centavosParaReaisTexto, formatarDataIso } from '../lib/formatadores.js';
import { useDataDaClinica } from '../lib/use-data-da-clinica.js';
import { useContainer } from '../providers/container-provider.js';
import { useSincronizacao } from '../providers/sincronizacao-provider.js';
import { useEncerramentosConsultas } from '../providers/encerramentos-consultas-provider.js';

function CartaoEstatistica({ titulo, valor, tom }: { titulo: string; valor: string; tom?: 'danger' }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase text-neutral-500">{titulo}</p>
      <p className={`mt-1 text-xl font-semibold ${tom === 'danger' ? 'text-danger-700 dark:text-danger-500' : 'text-neutral-900'}`}>
        {valor}
      </p>
    </Card>
  );
}

const ATALHOS = [
  { to: '/agenda', label: 'Abrir agenda', icon: CalendarDays, descricao: 'Consultas, horários e novos agendamentos' },
  { to: '/pacientes', label: 'Ver pacientes', icon: Users, descricao: 'Lista completa de pacientes' },
  { to: '/pacientes/novo', label: 'Novo paciente', icon: Plus, descricao: 'Cadastrar uma nova ficha' },
  { to: '/retornos', label: 'Retornos', icon: CalendarClock, descricao: 'Acompanhamento pós-procedimento' },
  { to: '/aniversarios', label: 'Aniversários', icon: Cake, descricao: 'Mensagens de cortesia e campanhas' },
  { to: '/configuracoes', label: 'Cópias de segurança', icon: HardDrive, descricao: 'Backups e sincronização dos formulários' },
];

const LIMITE_PENDENCIAS = 6;

/**
 * Um grupo de pendências operacionais no Painel — cada item leva à
 * seção que resolve a pendência. Mostra só nome + um resumo curto e
 * não sensível (nunca uma resposta clínica).
 */
function GrupoPendencia({
  titulo,
  Icone,
  itens,
}: {
  titulo: string;
  Icone: typeof FileHeart;
  itens: { chave: string; nome: string; detalhe: string; destino: string }[];
}) {
  if (itens.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        <Icone className="h-3.5 w-3.5" aria-hidden="true" /> {titulo}
        <span className="rounded-full bg-neutral-200 px-1.5 text-[0.65rem] font-semibold tabular-nums text-neutral-600">
          {itens.length}
        </span>
      </h3>
      <ul className="flex flex-col divide-y divide-neutral-100">
        {itens.slice(0, LIMITE_PENDENCIAS).map((item) => (
          <li key={item.chave} className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <Link
              to={item.destino}
              className="font-medium text-neutral-900 hover:text-brand-700 dark:hover:text-brand-400"
            >
              {item.nome}
            </Link>
            <span className="shrink-0 text-xs text-neutral-500">{item.detalhe}</span>
          </li>
        ))}
      </ul>
      {itens.length > LIMITE_PENDENCIAS && (
        <p className="text-xs text-neutral-400">e mais {itens.length - LIMITE_PENDENCIAS}…</p>
      )}
    </div>
  );
}

function paraLinha(
  itens: PendenciaPaciente[],
  destino: (id: string) => string,
): { chave: string; nome: string; detalhe: string; destino: string }[] {
  return itens.map((it) => ({
    chave: it.pacienteId,
    nome: it.nomePaciente,
    detalhe: it.detalhe,
    destino: destino(it.pacienteId),
  }));
}

/**
 * Primeira tela do sistema (pedido do usuário: "tela inicial de
 * verdade, com informação útil de clínica/paciente — não uma landing
 * page"). Números reais agregados das entidades já cadastradas (nunca
 * dado fictício) + atalhos diretos pra ficha clínica/anamnese/
 * odontograma/plano de tratamento/evolução de cada paciente recente.
 */
export function HomePage() {
  const container = useContainer();
  const hoje = useDataDaClinica();
  const { diagnostico } = useSincronizacao();
  const versaoAtendimentos = useEncerramentosConsultas()?.versao ?? 0;
  const [resumo, setResumo] = useState<ResumoDoPainel | null>(null);
  const [pacientesRecentes, setPacientesRecentes] = useState<Paciente[]>([]);
  const [ultimosAtendimentos, setUltimosAtendimentos] = useState<EvolucaoRecente[]>([]);
  const [proximasConsultas, setProximasConsultas] = useState<ConsultaProxima[]>([]);
  const [pendencias, setPendencias] = useState<ResumoPendencias | null>(null);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  // Endereço editável da clínica (Etapa 54) — pode mudar de lugar.
  const [enderecoClinica, setEnderecoClinica] = useState<string | null>(null);
  const [dialogEnderecoAberto, setDialogEnderecoAberto] = useState(false);
  const [rascunhoEndereco, setRascunhoEndereco] = useState('');
  const [salvandoEndereco, setSalvandoEndereco] = useState(false);

  const origemAtual = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3999';
  const urlAtual = `${origemAtual.replace(/\/$/, '')}/entrar`;
  let linkUniversal = urlAtual;
  if (diagnostico?.saude?.enderecoLan) {
    try {
      const porta = new URL(origemAtual).port;
      linkUniversal = `http://${diagnostico.saude.enderecoLan}${porta ? `:${porta}` : ''}/entrar`;
    } catch {
      linkUniversal = urlAtual;
    }
  }

  async function copiarLinkUniversal(): Promise<void> {
    await navigator.clipboard.writeText(linkUniversal);
    setLinkCopiado(true);
    window.setTimeout(() => setLinkCopiado(false), 2000);
  }

  function abrirEdicaoEndereco(): void {
    setRascunhoEndereco(enderecoClinica ?? '');
    setDialogEnderecoAberto(true);
  }

  async function salvarEndereco(): Promise<void> {
    setSalvandoEndereco(true);
    try {
      const resultado = await container.configuracaoClinica.salvar.executar({ endereco: rascunhoEndereco });
      setEnderecoClinica(resultado.endereco || null);
      setDialogEnderecoAberto(false);
    } finally {
      setSalvandoEndereco(false);
    }
  }

  useEffect(() => {
    let cancelado = false;
    container.configuracaoClinica.obter
      .executar()
      .then((config) => {
        if (!cancelado) setEnderecoClinica(config.endereco || null);
      })
      .catch(() => {
        /* endereço fica "não configurado" — nunca trava o Painel por causa disso */
      });
    return () => {
      cancelado = true;
    };
  }, [container]);

  useEffect(() => {
    let cancelado = false;
    setErroCarregar(false);
    Promise.all([
      container.painel.obterResumo.executar(hoje),
      container.pacientes.listarRecentes.executar(),
      container.evolucao.listarRecentes.executar(5),
      container.consulta.listarProximas.executar(),
      container.prontidao.resumoPendencias.executar(),
    ])
      .then(([resumoObtido, pacientes, evolucoes, consultas, pendenciasObtidas]) => {
        if (cancelado) return;
        setResumo(resumoObtido);
        setPacientesRecentes(pacientes);
        setUltimosAtendimentos(evolucoes);
        setProximasConsultas(consultas);
        setPendencias(pendenciasObtidas);
      })
      .catch(() => {
        if (!cancelado) setErroCarregar(true);
      });
    return () => {
      cancelado = true;
    };
  }, [container, hoje, versaoAtendimentos]);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-300">Rotina do consultório</p>
        <h1 className="text-xl font-semibold text-neutral-900">Visão geral</h1>
        <p className="mt-2 mb-3 text-sm text-neutral-500">Acompanhe as consultas e escolha por onde começar.</p>
        <p className="text-sm text-neutral-600">
          {CONFIGURACAO_CLINICA.nomeProfissional} · {CONFIGURACAO_CLINICA.registroProfissional}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {enderecoClinica ? (
            <span>{enderecoClinica}</span>
          ) : (
            <span className="italic">Endereço da clínica ainda não configurado</span>
          )}
          <button
            type="button"
            onClick={abrirEdicaoEndereco}
            className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline dark:text-brand-400"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            {enderecoClinica ? 'Editar' : 'Adicionar'}
          </button>
        </div>
        <Link
          to="/configuracoes"
          className="mt-1 inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-brand-700 dark:hover:text-brand-400"
        >
          <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
          Configurações e cópias de segurança
        </Link>
      </div>

      <Dialog open={dialogEnderecoAberto} onOpenChange={setDialogEnderecoAberto}>
        <DialogContent>
          <DialogTitle className="text-base font-semibold text-neutral-900">Endereço da clínica</DialogTitle>
          <DialogDescription asChild>
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-sm text-neutral-600">
                Aparece no Painel e nos documentos impressos. A clínica pode mudar de lugar — deixe em branco pra não
                mostrar nenhum endereço.
              </p>
              <Textarea
                value={rascunhoEndereco}
                onChange={(e) => setRascunhoEndereco(e.target.value)}
                rows={3}
                placeholder="Rua, número, bairro, cidade - UF"
              />
            </div>
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose className={buttonClassName('secondary')}>Cancelar</DialogClose>
            <Button onClick={() => void salvarEndereco()} loading={salvandoEndereco}>
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {erroCarregar && (
        <Alert tone="warning" title="Não foi possível carregar os dados do servidor da clínica">
          O servidor pode estar fora do ar — alguns números abaixo podem não aparecer. Veja o aviso no topo da tela.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ATALHOS.map((atalho) => {
          const Icon = atalho.icon;
          return (
            <Link key={atalho.to} to={atalho.to} className={buttonClassName('secondary', 'h-auto justify-start gap-3 py-4 text-left')}>
              <Icon className="h-5 w-5 shrink-0 text-brand-700 dark:text-brand-400" aria-hidden="true" />
              <span className="flex flex-col items-start">
                <span className="font-medium">{atalho.label}</span>
                <span className="text-xs font-normal text-neutral-500">{atalho.descricao}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <CalendarClock className="h-4 w-4" aria-hidden="true" /> Próximas consultas
          <Link to="/agenda" className="ml-auto text-xs font-normal text-brand-700 hover:underline dark:text-brand-400">
            Ver agenda
          </Link>
        </h2>
        {proximasConsultas.length === 0 && (
          <EmptyState
            title="Nenhuma consulta agendada"
            description="Use a Agenda para marcar a próxima consulta."
          />
        )}
        <ul className="flex flex-col divide-y divide-neutral-100">
          {proximasConsultas.map(({ consulta, nomePaciente }) => {
            const snap = consulta.toSnapshot();
            return (
              <li key={snap.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <Link
                    to={`/agenda?dia=${snap.data}&consulta=${snap.id}`}
                    className="font-medium text-neutral-900 hover:text-brand-700 dark:hover:text-brand-400"
                  >
                    {nomePaciente}
                  </Link>
                  {snap.motivo && <p className="text-xs text-neutral-500">{snap.motivo}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-600">
                    {formatarDataIso(snap.data)} · {snap.horario}
                  </span>
                  <Badge tone={TOM_POR_STATUS_CONSULTA[snap.status]}>{STATUS_CONSULTA_LABEL[snap.status]}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {resumo && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CartaoEstatistica titulo="Pacientes cadastrados" valor={String(resumo.totalPacientes)} />
            <CartaoEstatistica titulo="Planos em andamento" valor={String(resumo.planosDeTratamentoAtivos)} />
            <CartaoEstatistica titulo="Registros no odontograma" valor={String(resumo.registrosNoOdontograma)} />
            <CartaoEstatistica titulo="Evoluções registradas" valor={String(resumo.evolucoesRegistradas)} />
          </div>

          <Card className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-neutral-700">Financeiro</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500">Planejado</p>
                <p className="mt-0.5 text-lg font-semibold text-neutral-900">
                  {centavosParaReaisTexto(resumo.valorPlanejadoTotalCentavos)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500">Recebido no ciclo</p>
                <p className="mt-0.5 text-lg font-semibold text-success-700 dark:text-success-500">
                  {centavosParaReaisTexto(resumo.recebimentosDoCiclo.totalCentavos)}
                </p>
                <p className="text-xs text-neutral-500">
                  {formatarDataIso(resumo.recebimentosDoCiclo.inicio)} a {formatarDataIso(resumo.recebimentosDoCiclo.fim)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500">Em aberto</p>
                <p
                  className={`mt-0.5 text-lg font-semibold ${
                    resumo.saldoDevedorTotalCentavos > 0 ? 'text-danger-700 dark:text-danger-500' : 'text-neutral-900'
                  }`}
                >
                  {centavosParaReaisTexto(resumo.saldoDevedorTotalCentavos)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500">Pacientes com saldo</p>
                <p className="mt-0.5 text-lg font-semibold text-neutral-900">{resumo.pacientesComSaldoAberto}</p>
              </div>
            </div>
            <Link to="/relatorios#historico-recebimentos" className="self-start text-sm text-brand-700 hover:underline dark:text-brand-400">
              Ver histórico de recebimentos
            </Link>
          </Card>
        </>
      )}

      {pendencias && (
        <Card className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
            <ListChecks className="h-4 w-4" aria-hidden="true" /> O que precisa de atenção
            <Link
              to="/relatorios"
              className="ml-auto text-xs font-normal text-brand-700 hover:underline dark:text-brand-400"
            >
              Ver relatórios
            </Link>
          </h2>
          {pendencias.vazio ? (
            <p className="text-sm text-neutral-500">Nada pendente no momento — anamneses, saldos e consultas em dia.</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <GrupoPendencia
                titulo="Anamnese incompleta"
                Icone={FileHeart}
                itens={paraLinha(pendencias.anamneseIncompleta, (id) => `/pacientes/${id}/anamnese`)}
              />
              <GrupoPendencia
                titulo="Saldo em aberto"
                Icone={Receipt}
                itens={paraLinha(pendencias.saldoAberto, (id) => `/pacientes/${id}/plano-tratamento`)}
              />
              <GrupoPendencia
                titulo="Sem consentimento de WhatsApp"
                Icone={MessageCircle}
                itens={paraLinha(pendencias.semConsentimentoWhatsapp, (id) => `/pacientes/${id}/dados`)}
              />
              <GrupoPendencia
                titulo="Arquivado com consulta futura"
                Icone={Archive}
                itens={paraLinha(pendencias.arquivadosComConsultaFutura, (id) => `/pacientes/${id}/consultas`)}
              />
              {pendencias.consultasNaoConfirmadas.length > 0 && (
                <div className="flex flex-col gap-1">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> Próximas consultas não confirmadas
                    <span className="rounded-full bg-neutral-200 px-1.5 text-[0.65rem] font-semibold tabular-nums text-neutral-600">
                      {pendencias.consultasNaoConfirmadas.length}
                    </span>
                  </h3>
                  <ul className="flex flex-col divide-y divide-neutral-100">
                    {pendencias.consultasNaoConfirmadas.slice(0, LIMITE_PENDENCIAS).map((c) => (
                      <li key={c.consultaId} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                        <Link
                          to={`/agenda?dia=${c.data}&consulta=${c.consultaId}`}
                          className="font-medium text-neutral-900 hover:text-brand-700 dark:hover:text-brand-400"
                        >
                          {c.nomePaciente}
                        </Link>
                        <span className="shrink-0 text-xs text-neutral-500">
                          {formatarDataIso(c.data)} · {c.horario}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {pendencias.consultasNaoConfirmadas.length > LIMITE_PENDENCIAS && (
                    <p className="text-xs text-neutral-400">
                      e mais {pendencias.consultasNaoConfirmadas.length - LIMITE_PENDENCIAS}…
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      )}



      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-neutral-700">Pacientes recentes</h2>
          {pacientesRecentes.length === 0 && (
            <EmptyState
              title="Nenhum paciente ainda"
              description="Cadastre o primeiro paciente para começar."
            />
          )}
          <ul className="flex flex-col divide-y divide-neutral-100">
            {pacientesRecentes.map((paciente) => {
              const snap = paciente.toSnapshot();
              return (
                <li key={snap.id} className="flex flex-col gap-1.5 py-2.5">
                  <Link to={`/pacientes/${snap.id}`} className="font-medium text-neutral-900 hover:text-brand-700 dark:hover:text-brand-400">
                    {snap.nomeCompleto}
                  </Link>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <Link to={`/pacientes/${snap.id}/consultas`} className="inline-flex items-center gap-1 text-neutral-500 hover:text-brand-700 dark:hover:text-brand-400">
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> Consultas
                    </Link>
                    <Link to={`/pacientes/${snap.id}/anamnese`} className="inline-flex items-center gap-1 text-neutral-500 hover:text-brand-700 dark:hover:text-brand-400">
                      <FileHeart className="h-3.5 w-3.5" aria-hidden="true" /> Anamnese
                    </Link>
                    <Link to={`/pacientes/${snap.id}/odontograma`} className="inline-flex items-center gap-1 text-neutral-500 hover:text-brand-700 dark:hover:text-brand-400">
                      <Grid3x3 className="h-3.5 w-3.5" aria-hidden="true" /> Dentes e tratamento
                    </Link>

                    <Link to={`/pacientes/${snap.id}/evolucao`} className="inline-flex items-center gap-1 text-neutral-500 hover:text-brand-700 dark:hover:text-brand-400">
                      <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" /> Evolução
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
            <ClipboardList className="h-4 w-4" aria-hidden="true" /> Últimos atendimentos
          </h2>
          {ultimosAtendimentos.length === 0 && (
            <EmptyState
              title="Nenhuma evolução registrada ainda"
              description="Os atendimentos aparecem aqui assim que forem lançados na aba Evolução de cada paciente."
            />
          )}
          <ul className="flex flex-col divide-y divide-neutral-100">
            {ultimosAtendimentos.map(({ evolucao, nomePaciente }) => (
              <li key={evolucao.id} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to={`/pacientes/${evolucao.pacienteId}/evolucao`}
                    className="font-medium text-neutral-900 hover:text-brand-700 dark:hover:text-brand-400"
                  >
                    {nomePaciente}
                  </Link>
                  <span className="shrink-0 text-xs text-neutral-500">{formatarDataIso(evolucao.data)}</span>
                </div>
                <p className="truncate text-sm text-neutral-600">{evolucao.tratamentosRealizados}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <details className="rounded-2xl border border-neutral-200 bg-surface p-5">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-700">Acesso dos pacientes na rede da clínica</summary>
        <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-neutral-700">Link de acesso local</h2>
            <p className="text-sm text-neutral-500">
              Acesso com CPF, RG ou celular cadastrado, para uso na clínica.
            </p>
          </div>
          <a
            href={linkUniversal}
            target="_blank"
            rel="noreferrer"
            className={buttonClassName('secondary', 'h-9 gap-2')}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> Abrir
          </a>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={linkUniversal} aria-label="Link de acesso local" className="text-xs" />
          <Button variant="secondary" onClick={() => void copiarLinkUniversal()} className="shrink-0">
            <Copy className="h-4 w-4" aria-hidden="true" /> {linkCopiado ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        {diagnostico?.saude?.enderecoLan ? (
          <Alert tone="warning">
            Use apenas na <strong>mesma rede da clínica</strong>. Não funciona fora dela e não deve ser divulgado
            em uma bio pública. Os links do Google Forms enviados pelo WhatsApp são independentes deste acesso.
          </Alert>
        ) : (
          <p className="text-xs text-neutral-500">
            Este endereço só funciona neste computador — o sistema ainda não encontrou o endereço de rede da
            clínica para gerar um link que funcione em outro aparelho.
          </p>
        )}
        </div>
      </details>

    </div>
  );
}
