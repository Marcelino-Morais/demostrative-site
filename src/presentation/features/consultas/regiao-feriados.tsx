import { useEffect, useRef, useState } from 'react';
import type { RegiaoClinica, UnidadeFederacao } from '../../../application/ports/porta-google-calendar.js';
import { Button } from '../../components/ui/button.js';
import { Alert } from '../../components/ui/alert.js';
import { Select } from '../../components/ui/input.js';
import { useContainer } from '../../providers/container-provider.js';
import { sugerirMunicipio } from '../../lib/localizar-municipio.js';

export function RegiaoFeriados({ regiao, atualizado, onOcupado, desabilitado = false }: {
  regiao: RegiaoClinica | null; atualizado: () => Promise<void>; onOcupado: (v: boolean) => void; desabilitado?: boolean;
}) {
  const { googleCalendar } = useContainer();
  const [uf, setUf] = useState(regiao?.uf ?? 'MG');
  const [municipioId, setMunicipioId] = useState(regiao?.municipioId ?? '3170206');
  const [ufs, setUfs] = useState<UnidadeFederacao[]>([]);
  const [municipios, setMunicipios] = useState<RegiaoClinica[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const trava = useRef(false);
  const atual = useRef(true);
  useEffect(() => { atual.current = true; return () => { atual.current = false; }; }, []);
  useEffect(() => {
    let ativo = true;
    googleCalendar.obterUfs().then(d => { if (ativo) setUfs(d); }).catch(() => {});
    return () => { ativo = false; };
  }, [googleCalendar]);
  useEffect(() => {
    let ativo = true;
    setCarregando(true); setMunicipios([]);
    googleCalendar.obterLocalidades(uf).then(d => {
      if (ativo) { setUfs(d.ufs); setMunicipios(d.municipios); }
    }).catch(() => { if (ativo) setErro('Não foi possível carregar as cidades. Tente trocar o estado novamente.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [googleCalendar, uf]);
  function iniciar(): boolean {
    if (trava.current || desabilitado) return false;
    trava.current = true; setOcupado(true); onOcupado(true); setErro(''); setAviso(''); return true;
  }
  function finalizar() { trava.current = false; if (atual.current) { setOcupado(false); onOcupado(false); } }
  async function localizar() {
    if (!iniciar()) return;
    try {
      const sugestao = await sugerirMunicipio(googleCalendar, ufs, navigator.geolocation);
      if (!atual.current) return;
      setUf(sugestao.uf); setMunicipioId(sugestao.municipioId);
      setAviso(`Localização sugerida: ${sugestao.cidade}/${sugestao.uf}. Confira e confirme abaixo para alterar a região da clínica.`);
    } catch (e) { if (atual.current) setErro(e instanceof Error ? e.message : 'Selecione a cidade manualmente.'); }
    finally { finalizar(); }
  }
  const candidata = municipios.find(e => e.municipioId === municipioId);
  async function salvar() {
    if (!candidata || !iniciar()) return;
    try {
      await googleCalendar.definirRegiaoFeriados(candidata.municipioId, candidata.uf);
      await atualizado();
      if (atual.current) setAviso(`Região da clínica salva: ${candidata.cidade}/${candidata.uf}. Essa escolha vale para todos os dispositivos.`);
    } catch { if (atual.current) setErro('Não foi possível confirmar a alteração. Confira a região salva antes de tentar novamente.'); }
    finally { finalizar(); }
  }
  return <section className="my-3 space-y-2 rounded-md border border-neutral-200 p-3" aria-label="Localização da clínica para feriados">
    <h3 className="text-sm font-semibold">Localização da clínica</h3>
    <p className="text-xs text-neutral-600">{regiao ? `Região salva: ${regiao.cidade}/${regiao.uf}.` : 'Nenhuma região salva. Uberlândia/MG é apenas uma sugestão inicial.'} A localização deste aparelho só sugere uma cidade; viajar não muda a Agenda.</p>
    <Button variant="secondary" disabled={ocupado || desabilitado || carregando || !ufs.length} onClick={() => void localizar()}>Usar minha localização</Button>
    <p className="text-xs text-neutral-500">A permissão será pedida apenas ao clicar. As coordenadas são comparadas neste navegador com os mapas públicos do IBGE e não são enviadas nem guardadas. Só cidade e estado são salvos ao confirmar. Na rede da clínica, o navegador pode exigir HTTPS; nesse caso, escolha manualmente.</p>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <label className="text-sm">Estado<Select aria-label="Estado da clínica" value={uf} disabled={ocupado || desabilitado} onChange={e => { setUf(e.target.value); setMunicipioId(''); setErro(''); setAviso(''); }}>
        {ufs.length ? ufs.map(u => <option key={u.id} value={u.sigla}>{u.sigla}</option>) : <option value={uf}>{uf}</option>}
      </Select></label>
      <label className="text-sm">Cidade<Select aria-label="Cidade da clínica" value={carregando ? '' : municipioId} disabled={ocupado || desabilitado || carregando} onChange={e => { setMunicipioId(e.target.value); setErro(''); setAviso(''); }}>
        <option value="">{carregando ? 'Carregando cidades…' : 'Selecione a cidade'}</option>
        {municipios.map(m => <option key={m.municipioId} value={m.municipioId}>{m.cidade}</option>)}
      </Select></label>
    </div>
    {uf === 'MG' && !carregando && municipios.length === 1 && municipios[0]?.municipioId === '3170206' && <p className="text-xs text-neutral-500">O IBGE está indisponível. A lista temporária contém apenas Uberlândia, já conferida; tente novamente para outras cidades.</p>}
    <Button disabled={ocupado || desabilitado || carregando || !candidata} onClick={() => void salvar()}>
      {ocupado ? 'Aguarde…' : candidata ? `Confirmar ${candidata.cidade}/${candidata.uf} para a clínica` : 'Confirmar região da clínica'}
    </Button>
    {aviso && <p role="status" className="text-sm text-brand-700 dark:text-brand-300">{aviso}</p>}
    {erro && <Alert tone="warning">{erro}</Alert>}
  </section>;
}
