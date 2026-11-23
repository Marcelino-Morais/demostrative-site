import { useCallback } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import type { FichaClinicaContexto } from '../../pages/ficha-clinica-page.js';
import { useContainer } from '../../providers/container-provider.js';
import { useEncerramentosConsultas } from '../../providers/encerramentos-consultas-provider.js';
import { useDataDaClinica } from '../../lib/use-data-da-clinica.js';
import { useLeituraPeriodica } from '../../lib/use-leitura-periodica.js';
import { formatarDataIso } from '../../lib/formatadores.js';
import { Alert } from '../../components/ui/alert.js';
import { Button, buttonClassName } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { AbaOdontograma } from '../odontograma/aba-odontograma.js';

export function AbaAtendimento(){
 const {paciente}=useOutletContext<FichaClinicaContexto>();const container=useContainer();const encerramentos=useEncerramentosConsultas();const hoje=useDataDaClinica();const [params]=useSearchParams();const consultaId=params.get('consulta');
 const ler=useCallback(()=>container.consulta.listarDoPaciente.executar(paciente.id),[container,paciente.id]);
 const leitura=useLeituraPeriodica(ler,30_000,encerramentos?.versao??0);
 // Um id adulterado nunca abre consulta de outro paciente, nem escolhe outra silenciosamente.
 const destaPessoa=leitura.dados?.filter(c=>c.pacienteId===paciente.id);
 const selecionada=consultaId?destaPessoa?.find(c=>c.id===consultaId):destaPessoa?.find(c=>c.toSnapshot().data===hoje&&['AGENDADA','CONFIRMADA'].includes(c.toSnapshot().status));
 const c=selecionada?.toSnapshot();const base=`/pacientes/${paciente.id}`;
 return <div className="flex flex-col gap-4" data-tour="atendimento-unificado">
  <Card className="flex flex-col gap-3"><div><h2 className="text-lg font-semibold">Preparar atendimento</h2><p className="text-sm text-neutral-500">Confira a saúde, registre o trabalho nos dentes e termine com a evolução e o financeiro.</p></div>
   {leitura.erro&&<Alert tone="warning">Não foi possível atualizar a consulta. Confira a agenda antes de prosseguir.<Button variant="secondary" onClick={leitura.atualizar}>Tentar novamente</Button></Alert>}
   {c?<div className="rounded-xl bg-brand-50 p-3 dark:bg-brand-900/30"><p className="font-semibold">{formatarDataIso(c.data)} às {c.horario} · {c.duracaoMinutos} minutos</p><p className="mt-1 text-sm">{c.orcamento?.descricao||c.motivo||'Procedimento a conferir'}</p></div>:!leitura.carregando&&!leitura.erro&&<Alert>{consultaId?'Esta consulta não está disponível nesta ficha. Abra a agenda para conferir.':'Não há consulta aberta para este paciente hoje. Você pode consultar e preencher o prontuário.'}</Alert>}
   <ol className="grid gap-3 text-sm md:grid-cols-3"><li><strong>1. Confira a anamnese</strong><p className="mt-1 text-neutral-500">Leia os alertas acima e confirme as informações com o paciente.</p><Link className="mt-2 inline-block text-brand-700 underline" to={`${base}/anamnese`}>Abrir anamnese completa</Link></li><li><strong>2. Registre o atendimento</strong><p className="mt-1 text-neutral-500">O odontograma e o tratamento ficam juntos logo abaixo.</p><Link className="mt-2 inline-block text-brand-700 underline" to={`${base}/evolucao`}>Registrar evolução</Link></li><li><strong>3. Confira o encerramento</strong><p className="mt-1 text-neutral-500">Concluir atendimento não registra um pagamento. Confira também se precisa de retorno.</p><Link className="mt-2 inline-block text-brand-700 underline" to="/retornos">Ver retornos</Link></li></ol>
   <div className="flex flex-wrap gap-2"><Button disabled={!c||Boolean(leitura.erro)||paciente.estaArquivado||!encerramentos||!container.encerramentosConsultas||Boolean(c.encerramentoFinanceiro)||!['AGENDADA','CONFIRMADA','REALIZADA'].includes(c.status)} onClick={()=>{if(c)void encerramentos?.abrir(c.id);}}>Conferir resultado e valor</Button><Link className={buttonClassName('secondary')} to={`${base}/consultas`}>Ver consultas desta pessoa</Link></div>
   {c?.encerramentoFinanceiro&&<p className="text-sm text-success-700">Resultado e financeiro já conferidos. Veja os pagamentos no plano abaixo.</p>}
  </Card><AbaOdontograma/>
 </div>;
}
