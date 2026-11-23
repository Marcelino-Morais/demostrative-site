import type { RegistroDental } from '../../../domain/entities/registro-dental.js';
import { useEffect, useState } from 'react';
import { Select } from '../../components/ui/input.js';
import { centavosParaReaisTexto } from '../../lib/formatadores.js';
import { useContainer } from '../../providers/container-provider.js';

export interface ProcedimentoSelecionado {
  id: string;
  registroDentalId?: string;
  numeroDente?: number;
  nome: string;
  precoCentavos: number | null;
  faixa: { minimoCentavos: number; maximoCentavos: number } | null;
}

export function ProcedimentoCatalogoSelector({ onSelecionar, valor = '', registros = [], pacienteId }: { pacienteId?: string; onSelecionar: (p: ProcedimentoSelecionado) => void; valor?: string; registros?: RegistroDental[] }) {
  const container = useContainer();
  const [resultados, setResultados] = useState<ProcedimentoSelecionado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    container.catalogoProcedimentos.listar.executar({}).then(lista => {
      if (cancelado) return;
      setResultados(lista.map(p => {
        const snap = p.toSnapshot();
        return { id: p.id, nome: p.nome, precoCentavos: snap.precoCentavos,
          faixa: snap.precoMinimoCentavos != null && snap.precoMaximoCentavos != null
            ? { minimoCentavos: snap.precoMinimoCentavos, maximoCentavos: snap.precoMaximoCentavos } : null };
      }));
    }).catch(() => { if (!cancelado) setErro(true); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [container]);
  const referencias: ProcedimentoSelecionado[] = registros.filter(r => !pacienteId || r.toSnapshot().pacienteId === pacienteId).map(registro => {
    const r = registro.toSnapshot();
    return { id: `odontograma:${r.id}`, registroDentalId:r.id, numeroDente:r.numeroDente,
      nome:String(r.descricao ?? '').trim() || `Registro do dente ${r.numeroDente}`, precoCentavos:r.valorCentavos ?? null, faixa:null };
  });
  const selecionado = [...resultados,...referencias].find(p=>p.id===valor);
  return <div>
    <label className="mb-1 block text-sm font-medium" htmlFor="procedimento-tratamento">Selecionar trabalho a executar</label>
    <Select id="procedimento-tratamento" value={valor} disabled={carregando && referencias.length === 0} onChange={e => {
      const escolhido = [...resultados,...referencias].find(p => p.id === e.target.value);
      onSelecionar(escolhido ?? { id: '', nome: '', precoCentavos: null, faixa: null });
    }}>
      <option value="">{carregando ? 'Carregando procedimentos…' : 'Preencher trabalho personalizado'}</option>
      {referencias.length > 0 && <optgroup label="Registros deste odontograma">{referencias.map(p=><option key={p.id} value={p.id}>Dente {p.numeroDente} · {p.nome}{p.precoCentavos !== null ? ` — ${centavosParaReaisTexto(p.precoCentavos)}` : ' — sem valor de referência'}</option>)}</optgroup>}
      <optgroup label="Catálogo de procedimentos">{resultados.map(p => <option key={p.id} value={p.id}>{p.nome}{p.faixa
        ? ` — ${centavosParaReaisTexto(p.faixa.minimoCentavos)} a ${centavosParaReaisTexto(p.faixa.maximoCentavos)}`
        : p.precoCentavos != null ? ` — ${centavosParaReaisTexto(p.precoCentavos)}` : ''}</option>)}</optgroup>
      {valor && !selecionado && <option value={valor}>Registro selecionado anteriormente</option>}
    </Select>
    {erro && <p role="alert" className="mt-1 text-sm text-danger-700">Não foi possível carregar o catálogo. Você pode preencher o trabalho abaixo.</p>}
  </div>;
}
