import { useEffect, useState } from 'react';
import type { OrcamentoConsulta } from '../../../domain/entities/consulta.js';
import type { ProcedimentoCatalogoProps } from '../../../domain/entities/procedimento-catalogo.js';
import { TAXA_EMERGENCIA_CENTAVOS } from '../../../domain/value-objects/atendimento-emergencia.js';
import { Alert } from '../../components/ui/alert.js';
import { Field } from '../../components/ui/field.js';
import { Select } from '../../components/ui/input.js';
import { centavosParaReaisTexto as reais } from '../../lib/formatadores.js';
import { useContainer } from '../../providers/container-provider.js';

export const AVALIAR_NO_CONSULTORIO = 'avaliar-no-consultorio';

export function ValorPrevistoConsulta({ orcamento, emergencia = false, taxaEmergenciaCentavos = TAXA_EMERGENCIA_CENTAVOS }: { taxaEmergenciaCentavos?: number; orcamento?: OrcamentoConsulta | null; emergencia?: boolean }) {
  if (!orcamento) return null;
  const adicional = emergencia ? taxaEmergenciaCentavos : 0;
  return <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm dark:border-brand-800 dark:bg-brand-900/20">
    <p className="font-semibold text-neutral-900">{orcamento.descricao}</p>
    {orcamento.valorCentavos != null ? <p className="mt-1 font-semibold text-brand-800 dark:text-brand-200">Valor previsto: {reais(orcamento.valorCentavos + adicional)}</p>
      : orcamento.valorMinimoCentavos != null && orcamento.valorMaximoCentavos != null ? <p className="mt-1 text-neutral-700">Faixa prevista: {reais(orcamento.valorMinimoCentavos + adicional)} a {reais(orcamento.valorMaximoCentavos + adicional)}. Valor final definido no consultório.</p>
      : <p className="mt-1 text-neutral-700">Valor a definir pessoalmente no consultório.</p>}
    {emergencia && <p className="mt-1 text-xs text-neutral-600">{orcamento.valorCentavos != null || orcamento.valorMinimoCentavos != null ? 'Inclui' : 'Acrescentar ao valor do procedimento'} a taxa de emergência de {reais(taxaEmergenciaCentavos)}.</p>}
    <p className="mt-1 text-xs text-neutral-600">Previsão de valor. Não registra pagamento nem lança cobrança no plano de tratamento.</p>
  </div>;
}

export function ProcedimentoAgendamento({ valor, onChange, emergencia }: { valor: string; onChange: (id: string, nome: string) => void; emergencia: boolean }) {
  const container = useContainer();
  const [lista, setLista] = useState<ProcedimentoCatalogoProps[]>([]);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let ativo = true;
    setEstado('carregando');
    container.catalogoProcedimentos.listar.executar({}).then(itens => {
      if (!ativo) return;
      setLista(itens.map(item => item.toSnapshot()).filter(item => item.ativo)); setEstado('pronto');
    }).catch(() => { if (ativo) setEstado('erro'); });
    return () => { ativo = false; };
  }, [container, tentativa]);
  const item = lista.find(p => p.id === valor);
  const orcamento: OrcamentoConsulta = item ? { procedimentoId: item.id, descricao: item.nome, valorCentavos: item.precoCentavos,
    valorMinimoCentavos: item.precoMinimoCentavos, valorMaximoCentavos: item.precoMaximoCentavos, definirNoConsultorio: item.precoCentavos == null }
    : { procedimentoId: null, descricao: 'Avaliar no consultório', valorCentavos: null, valorMinimoCentavos: null, valorMaximoCentavos: null, definirNoConsultorio: true };
  return <div className="flex flex-col gap-3">
    <Field label="Procedimento / motivo da consulta">
      <Select value={valor} onChange={e => { const p = lista.find(item => item.id === e.target.value); onChange(e.target.value, p?.nome ?? 'Avaliar no consultório'); }}>
        <option value={AVALIAR_NO_CONSULTORIO}>Avaliar no consultório / pessoalmente</option>
        {lista.map(p => <option key={p.id} value={p.id}>{p.nome}{p.precoCentavos != null ? ` — ${reais(p.precoCentavos)}` : p.precoMinimoCentavos != null && p.precoMaximoCentavos != null ? ` — ${reais(p.precoMinimoCentavos)} a ${reais(p.precoMaximoCentavos)}` : ' — a definir'}</option>)}
      </Select>
    </Field>
    {estado === 'carregando' && <p role="status" className="text-xs text-neutral-500">Carregando tabela de procedimentos…</p>}
    {estado === 'erro' && <Alert tone="warning">Não foi possível carregar os preços. Você pode agendar para avaliação pessoalmente. <button type="button" className="underline" onClick={() => setTentativa(n => n + 1)}>Tentar novamente</button></Alert>}
    <ValorPrevistoConsulta orcamento={orcamento} emergencia={emergencia} />
  </div>;
}
