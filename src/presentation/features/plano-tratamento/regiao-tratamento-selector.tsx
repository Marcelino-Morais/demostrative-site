import { Select } from '../../components/ui/input.js';

const REGIOES = ['Arcada superior', 'Arcada inferior', 'Ambas as arcadas', 'Superior direito', 'Superior esquerdo', 'Inferior direito', 'Inferior esquerdo', 'Região anterior', 'Região posterior'];

export function RegiaoTratamentoSelector({ value, onChange, id }: { value: string; onChange: (value: string) => void; id?: string }) {
  return <Select id={id} aria-label="Região" value={value} onChange={e => onChange(e.target.value)}>
    <option value="">Não se aplica / dentes informados</option>
    {value && !REGIOES.includes(value) && <option value={value}>{value}</option>}
    {REGIOES.map(regiao => <option key={regiao} value={regiao}>{regiao}</option>)}
  </Select>;
}
