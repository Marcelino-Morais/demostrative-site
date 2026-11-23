import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { StatusGoogleCalendar as Status, ConflitoGoogleCalendar } from '../../../application/ports/porta-google-calendar.js';
import { Alert } from '../../components/ui/alert.js';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '../../components/ui/dialog.js';
import { formatarDataHoraIso } from '../../lib/formatadores.js';
import { useContainer } from '../../providers/container-provider.js';

export function StatusGoogleCalendar() {
  const { googleCalendar } = useContainer();
  const [status, setStatus] = useState<Status | null>(null);
  const [falha, setFalha] = useState(false);
  const [revisao, setRevisao] = useState<ConflitoGoogleCalendar | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroRevisao, setErroRevisao] = useState<string | null>(null);
  const trava = useRef(false);
  async function decidir(escolha: 'manter-google' | 'usar-sistema') {
    if (!revisao?.token || trava.current) return;
    trava.current = true; setSalvando(true); setErroRevisao(null);
    try {
      await googleCalendar.resolverConflito(revisao.id, revisao.token, escolha);
      setRevisao(null);
      setStatus(await googleCalendar.obterStatus());
    } catch (e) { setErroRevisao(e instanceof Error ? e.message : 'Não foi possível revisar.'); }
    finally { trava.current = false; setSalvando(false); }
  }
  useEffect(() => {
    let ativo = true;
    let emCurso = false;
    const atualizar = async () => {
      if (emCurso) return;
      emCurso = true;
      try { const valor = await googleCalendar.obterStatus(); if (ativo) { setStatus(valor); setFalha(false); } }
      catch { if (ativo) setFalha(true); }
      finally { emCurso = false; }
    };
    void atualizar();
    const timer = window.setInterval(() => void atualizar(), 30000);
    return () => { ativo = false; window.clearInterval(timer); };
  }, [googleCalendar]);
  const erro = falha || status?.ultimoErro || status?.erroConfiguracao;
  return <Card className="flex flex-col gap-3">
    <h2 className="text-sm font-semibold">Google Agenda</h2>
    {erro ? <Alert tone="warning">Não foi possível confirmar a sincronização. As consultas continuam salvas no sistema. Verifique com a manutenção.</Alert>
      : !status ? <p className="text-sm">Verificando conexão…</p>
      : !status.configurado ? <p className="text-sm">Integração não configurada neste servidor.</p>
      : <p className="text-sm">{status.ultimoSucessoEm ? `Última verificação: ${formatarDataHoraIso(status.ultimoSucessoEm)}.` : 'Aguardando a primeira sincronização.'} {status.eventosVinculados !== undefined && `${status.eventosVinculados} item(ns) vinculado(s), entre consultas e dias fechados.`}</p>}
    {Boolean(status?.conflitos) && <Alert tone="warning">Há {status?.conflitos} alteração(ões) no Google que precisam ser conferidas pela manutenção. Elas não foram sobrescritas.</Alert>}
    {Boolean(status?.detalhesConflitos?.length) && <ul className="space-y-2 text-sm">
      {status?.detalhesConflitos?.map(c => <li key={c.id}>
        {c.tipo === 'bloqueio' ? 'Dia fechado' : 'Consulta'}{c.data ? ` em ${c.data.split('-').reverse().join('/')}` : ' removida do sistema'}{c.horario ? ` às ${c.horario}` : ''}: {c.motivo === 'removido-no-google' ? 'evento removido no Google' : c.motivo === 'alterado-no-google' ? 'evento alterado no Google' : 'evento divergente, precisa de conferência'}.
        {' '}<Link className="underline" to={c.data ? `/agenda?dia=${encodeURIComponent(c.data)}&modo=dia` : '/agenda'}>Conferir na Agenda</Link>
        {c.token && <Button variant="secondary" onClick={() => { setErroRevisao(null); setRevisao(c); }}>Revisar diferença</Button>}
      </li>)}
    </ul>}
    <p className="text-sm text-neutral-600">Verifica atualizações a cada 30 segundos com o servidor ligado. Altere as consultas pelo sistema: mudanças no Google ainda não voltam para cá. Para avisos no celular, configure as notificações desta agenda na sua conta Google.</p>
    <Dialog open={Boolean(revisao)} onOpenChange={aberto => { if (!aberto && !salvando) setRevisao(null); }}>
      <DialogContent>
        <DialogTitle>Revisar diferença do Google Agenda</DialogTitle>
        <DialogDescription>Esta escolha não altera a agenda clínica. Confira o evento no Google antes de decidir.</DialogDescription>
        <p className="text-sm">Manter no Google preserva a edição ou exclusão feita lá e encerra este aviso. Uma nova mudança no sistema poderá atualizar o evento depois. Usar o sistema substitui no Google os dados do evento pelos dados atuais da agenda clínica.</p>
        {erroRevisao && <Alert tone="warning">{erroRevisao}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={salvando} variant="secondary" onClick={() => void decidir('manter-google')}>Manter no Google</Button>
          {revisao?.podeUsarSistema && <Button disabled={salvando} onClick={() => void decidir('usar-sistema')}>Usar os dados do sistema no Google</Button>}
          <DialogClose asChild><Button disabled={salvando} variant="secondary">Voltar sem decidir</Button></DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  </Card>;
}
