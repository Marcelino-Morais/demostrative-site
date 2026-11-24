import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, ClipboardList, Receipt, Stethoscope } from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Alert } from '../../components/ui/alert.js';
import { Button, buttonClassName } from '../../components/ui/button.js';
import { useContainer } from '../../providers/container-provider.js';
import { useSolicitacoesPendentes } from '../../providers/solicitacoes-pendentes-provider.js';
import { useEncerramentosConsultas } from '../../providers/encerramentos-consultas-provider.js';
import { useDataDaClinica } from '../../lib/use-data-da-clinica.js';
import { useLeituraPeriodica } from '../../lib/use-leitura-periodica.js';
import { centavosParaReaisTexto, formatarDataIso } from '../../lib/formatadores.js';
import { parcelasVencidas } from './resumo-rotina.js';

export function HojeNaClinica() {
  const container = useContainer(); const hoje = useDataDaClinica(); const pedidos = useSolicitacoesPendentes(); const encerramentos = useEncerramentosConsultas();
  const ler = useCallback(async () => {
    const [agenda, financeiro] = await Promise.allSettled([container.consulta.listarIntervalo.executar(hoje, hoje),
      container.sincronizacaoNucleo ? container.gestaoFinanceira.listar() : Promise.reject(new Error('sem-servidor'))]);
    return { agenda, financeiro };
  }, [container, hoje]);
  const leitura = useLeituraPeriodica(ler, 30_000, encerramentos?.versao ?? 0);
  const agenda = leitura.dados?.agenda; const financeiro = leitura.dados?.financeiro;
  const consultas = agenda?.status === 'fulfilled' ? agenda.value : null;
  const ativos = consultas?.filter(c => ['AGENDADA','CONFIRMADA'].includes(c.consulta.toSnapshot().status));
  const vencidas = financeiro?.status === 'fulfilled' ? parcelasVencidas(financeiro.value.parcelas, hoje) : null;
  return <section data-tour="hoje-na-clinica" className="flex flex-col gap-4 rounded-2xl border border-brand-200 bg-brand-50/40 p-4 dark:border-neutral-200 dark:bg-neutral-50 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">Hoje na clínica</h2><p className="text-sm text-neutral-500">{formatarDataIso(hoje)} · Escolha o que precisa resolver.</p></div><Button variant="secondary" onClick={leitura.atualizar}>Atualizar resumo</Button></div>
    {leitura.erro && <Alert tone="warning">Não foi possível atualizar o resumo. Confira as informações antes de decidir.</Alert>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card><CalendarCheck className="mb-2 h-5 w-5 text-brand-700 dark:text-brand-300"/><h3 className="font-semibold">Consultas de hoje</h3><p className="my-2 text-2xl font-semibold">{consultas ? consultas.filter(c=>c.consulta.toSnapshot().status!=='CANCELADA').length : leitura.carregando?'…':'Não verificado'}</p><Link className="text-sm text-brand-700 dark:text-brand-300 underline" to="/agenda">Ver agenda</Link>{agenda?.status==='rejected'&&<p role="status" className="mt-2 text-xs text-warning-700 dark:text-warning-300">Não foi possível consultar a agenda.</p>}</Card>
      <Card><ClipboardList className="mb-2 h-5 w-5 text-brand-700 dark:text-brand-300"/><h3 className="font-semibold">Pedidos para analisar</h3><p className="my-2 text-2xl font-semibold">{pedidos.erro?'Não verificado':pedidos.solicitacoes===null?'…':pedidos.pendentes.length}</p><Link className="text-sm text-brand-700 dark:text-brand-300 underline" to="/agenda">Analisar pedidos</Link>{pedidos.erro&&<p role="status" className="mt-2 text-xs text-warning-700 dark:text-warning-300">Não foi possível verificar os pedidos.</p>}</Card>
      <Card><Stethoscope className="mb-2 h-5 w-5 text-brand-700 dark:text-brand-300"/><h3 className="font-semibold">Atendimentos a conferir</h3><p className="my-2 text-2xl font-semibold">{!container.encerramentosConsultas?'—':encerramentos?.erro?'Não verificado':!encerramentos?.verificado?'…':encerramentos.pendentes.length}</p><Button variant="secondary" disabled={!encerramentos?.pendentes.length||Boolean(encerramentos?.erro)} onClick={()=>void encerramentos?.abrir()}>Conferir resultado e valor</Button><p className="mt-2 text-xs text-neutral-500">Inclui pendências de dias anteriores.</p></Card>
      <Card><Receipt className="mb-2 h-5 w-5 text-brand-700 dark:text-brand-300"/><h3 className="font-semibold">Parcelas vencidas</h3><p className="my-2 text-2xl font-semibold">{vencidas?vencidas.length:leitura.carregando?'…':'Não verificado'}</p>{vencidas&&<p className="mb-2 text-sm">{centavosParaReaisTexto(vencidas.reduce((s,p)=>s+(p.saldoCentavos??0),0))} em aberto</p>}<Link className="text-sm text-brand-700 dark:text-brand-300 underline" to="/relatorios">Conferir parcelas e recebimentos</Link>{financeiro?.status==='rejected'&&<p role="status" className="mt-2 text-xs text-neutral-500">{container.sincronizacaoNucleo?'Não foi possível consultar as parcelas.':'As parcelas dependem do servidor da clínica.'}</p>}</Card>
    </div>
    {ativos&&<div><h3 className="mb-2 text-sm font-semibold">Preparar os atendimentos do dia</h3>{ativos.length===0?<p className="text-sm text-neutral-500">Nenhuma consulta aguardando atendimento hoje.</p>:<ul className="divide-y divide-neutral-200">{ativos.slice(0,6).map(({consulta,nomePaciente})=>{const c=consulta.toSnapshot();return <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{c.horario} · {nomePaciente}</p><p className="text-sm text-neutral-500">{c.motivo||'Procedimento a conferir'} · {c.duracaoMinutos} minutos</p></div><Link className={buttonClassName('primary')} to={`/pacientes/${c.pacienteId}/atendimento?consulta=${encodeURIComponent(c.id)}`}>Iniciar atendimento</Link></li>;})}</ul>}{ativos.length>6&&<Link to="/agenda" className="text-sm text-brand-700 dark:text-brand-300 underline">Ver todos os atendimentos na agenda</Link>}</div>}
  </section>;
}
