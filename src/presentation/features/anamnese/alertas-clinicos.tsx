import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { resumoAnamnese } from '../../../domain/entities/anamnese.js';
import { useContainer } from '../../providers/container-provider.js';
import { Alert } from '../../components/ui/alert.js';
export function AlertasClinicos({ pacienteId }: { pacienteId: string }) {
  const container = useContainer();
  const [estado, setEstado] = useState<{ pacienteId: string; pontos: string[]; resumo: string[]; falha: boolean } | null>(null);
  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const a = await container.anamnese.obter.executar(pacienteId);
        const dados = a?.toSnapshot();
        const resumo = dados ? [
          `Pressão arterial: ${dados.pressaoArterial === 'ALTA' ? 'alta relatada' : dados.pressaoArterial === 'NORMAL' ? 'normal relatada' : 'não informada'}`,
          `Alergia a medicação: ${dados.alergiaMedicacao === 'SIM' ? dados.alergiaMedicacaoQuais || 'sim, sem descrição' : dados.alergiaMedicacao === 'NAO' ? 'não relatada' : 'não informada'}`,
          `Sangramento aumentado: ${dados.historicoSaudeBucal.sangraMuitoAoExtrairOuMachucar === 'SIM' ? 'relatado' : dados.historicoSaudeBucal.sangraMuitoAoExtrairOuMachucar === 'NAO' ? 'não relatado' : 'não informado'}`,
          `Medicamentos em uso: ${dados.usaMedicamento === 'SIM' ? dados.usaMedicamentoQuais || 'sim, sem descrição' : dados.usaMedicamento === 'NAO' ? 'não relatados' : 'não informado'}`,
        ] : [];
        if (ativo) setEstado({ pacienteId, resumo, pontos: a ? resumoAnamnese(a.toSnapshot()).pontosDeAtencao : ['Anamnese ainda não preenchida. Confira o histórico de saúde antes do atendimento.'], falha: false });
      } catch { if (ativo) setEstado({ pacienteId, pontos: [], resumo: [], falha: true }); }
    }
    void carregar();
    const timer = setInterval(() => { if (!document.hidden) void carregar(); }, 20000);
    window.addEventListener('focus', carregar);
    return () => { ativo = false; clearInterval(timer); window.removeEventListener('focus', carregar); };
  }, [container, pacienteId]);
  if (!estado || estado.pacienteId !== pacienteId) return <p className="text-sm">Verificando alertas da anamnese…</p>;
  if (estado.falha) return <Alert tone="warning">Não foi possível verificar a anamnese. Confira os dados de saúde antes do atendimento.</Alert>;
  return <section aria-label="Resumo clínico da anamnese" className="rounded-xl border border-warning-500/40 bg-surface p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Antes do atendimento · Anamnese</h2><Link className="no-print text-sm font-medium underline" to={`/pacientes/${pacienteId}/anamnese`}>Consultar anamnese completa</Link></div>
    {estado.pontos.length > 0 ? <Alert tone="warning" title="Pontos de atenção relatados"><ul className="list-disc pl-5">{estado.pontos.map(p => <li key={p}>{p}</li>)}</ul></Alert> : <p className="text-sm text-neutral-600">Nenhum alerta destacado pelas respostas salvas. Confira a anamnese antes do atendimento.</p>}
    <div className="mt-3 grid gap-2 sm:grid-cols-2">{estado.resumo.map(item => <p key={item} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm">{item}</p>)}</div>
    <p className="mt-3 text-xs text-neutral-500">Informações da anamnese salva, relatadas pelo paciente. Respostas ausentes não significam ausência de risco.</p>
  </section>;
}
