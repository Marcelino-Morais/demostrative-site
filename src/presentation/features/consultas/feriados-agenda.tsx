import { useState } from 'react';
import type { FeriadoGoogle, StatusFeriadosGoogle } from '../../../application/ports/porta-google-calendar.js';
import { Alert } from '../../components/ui/alert.js';
import { Button } from '../../components/ui/button.js';
import { Checkbox } from '../../components/ui/checkbox.js';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '../../components/ui/dialog.js';
import { useContainer } from '../../providers/container-provider.js';
import { RegiaoFeriados } from './regiao-feriados.js';

export function AvisosFeriados({ eventos = [] }: { eventos?: FeriadoGoogle[] }) {
  return <>{eventos.map(e => <p key={e.id} className="px-1 text-xs text-amber-700 dark:text-amber-300">
    {e.nome} · {e.ignorado ? 'agendamento liberado' : 'sem atendimento'}
  </p>)}</>;
}

export function DialogFeriados({ aberto, fechar, status, atualizado, erroCarregar }: {
  aberto: boolean; fechar: () => void; status: StatusFeriadosGoogle | null;
  atualizado: () => Promise<void>; erroCarregar: boolean;
}) {
  const { googleCalendar } = useContainer();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [salvando, setSalvando] = useState(false);
  const [ocupadoRegiao, setOcupadoRegiao] = useState(false);
  const [erro, setErro] = useState('');
  async function alterar(e: FeriadoGoogle, ignorado: boolean) {
    if (salvando) return;
    setSalvando(true); setErro('');
    try { await googleCalendar.ignorarFeriado(e.id, ignorado); await atualizado(); }
    catch { setErro('Não foi possível confirmar a alteração. Confira novamente antes de agendar.'); }
    finally { setSalvando(false); }
  }
  const eventos = status?.eventos.filter(e => e.data.startsWith(String(ano))) ?? [];
  const bloqueado = salvando || ocupadoRegiao;
  return <Dialog open={aberto} onOpenChange={v => { if (!v && !bloqueado) fechar(); }}>
    <DialogContent className="max-w-xl">
      <DialogTitle>Ignorar feriados</DialogTitle>
      <p className="text-sm text-neutral-600">Marque “Ignorar” nos dias em que a clínica vai atender. O nome continua na Agenda. Bloqueios manuais e horários ocupados continuam valendo.</p>
      <p className="text-xs text-neutral-500">Feriados nacionais fixos e municipais cadastrados bloqueiam por padrão. Datas comemorativas e pontos facultativos vêm liberados; desmarque para fechar.</p>
      {status && <RegiaoFeriados regiao={status.regiao} atualizado={atualizado} onOcupado={setOcupadoRegiao} desabilitado={salvando} />}
      {status?.regiao && !status.coberturaRegional.municipal.includes(ano) && <Alert tone="warning">Ainda não há lista municipal conferida para {status.regiao.cidade}/{status.regiao.uf} em {ano}. Inclua os feriados locais em “Bloquear dia(s)”. Os feriados nacionais continuam disponíveis.</Alert>}
      {status?.regiao && <p className="my-2 text-xs text-neutral-500">Não há lista estadual automática cadastrada para {status.regiao.uf}. Confira e inclua eventuais feriados estaduais manualmente.</p>}
      <label className="text-sm">Ano <select aria-label="Ano dos feriados" value={ano} onChange={e => setAno(Number(e.target.value))}>
        {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(a => <option key={a}>{a}</option>)}
      </select></label>
      {erroCarregar && <Alert tone="warning">Não foi possível carregar a lista. Tente novamente.</Alert>}
      {erro && <Alert tone="warning">{erro}</Alert>}
      {status?.erro && <Alert tone="warning">{status.erro}</Alert>}
      {status && !status.habilitado && <Alert tone="warning">Ative a integração com o Google Agenda no servidor para consultar esta lista.</Alert>}
      <div className="max-h-[45vh] overflow-y-auto">
        {eventos.map(e => <div key={e.id} className="border-b border-neutral-200 py-2">
          <p className="text-sm font-medium">{e.data.split('-').reverse().join('/')} — {e.nome}</p>
          <p className="text-xs text-neutral-500">{e.nacional ? 'Feriado nacional' : e.municipal ? `Feriado municipal — ${status?.regiao?.cidade}` : 'Outra data — confira o funcionamento da clínica'}</p>
          {e.fonte && <a className="text-xs underline" href={e.fonte} target="_blank" rel="noreferrer">Fonte oficial</a>}
          <Checkbox aria-label={`Ignorar ${e.nome} em ${e.data}`} checked={e.ignorado} disabled={bloqueado || erroCarregar} onChange={v => void alterar(e, v.target.checked)} label="Ignorar feriado (permitir agendamento)" />
          <p className="text-xs text-neutral-500">{e.ignorado ? 'Este feriado está liberado para agendamento.' : 'Este feriado está sem atendimento.'}</p>
        </div>)}
        {status?.habilitado && !eventos.length && <p className="text-sm">Nenhuma data disponível para este ano. A lista ainda pode estar sendo atualizada.</p>}
      </div>
      {status?.atualizadoEm && <p className="text-xs text-neutral-500">Fonte: {status.fonte}. Atualizado em {new Date(status.atualizadoEm).toLocaleString('pt-BR')}. A atualização é automática a cada hora, enquanto o servidor estiver ligado.</p>}
      <div className="flex justify-end gap-2"><Button variant="secondary" disabled={bloqueado} onClick={() => void atualizado()}>Conferir lista</Button><DialogClose asChild><Button disabled={bloqueado}>Fechar</Button></DialogClose></div>
    </DialogContent>
  </Dialog>;
}
