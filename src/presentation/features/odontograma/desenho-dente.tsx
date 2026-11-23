import { useRef, useState, type PointerEvent } from 'react';
import type { DesenhoDental, TracoDental } from '../../../../server/desenho-dental.mjs';
import { Button } from '../../components/ui/button.js';

export function DesenhoDente({ numero, desenho, onChange, disabled = false }: {
  numero: number; desenho: DesenhoDental; onChange?: (valor: DesenhoDental) => void; disabled?: boolean;
}) {
  const [cor, setCor] = useState('#dc2626');
  const [aviso, setAviso] = useState('');
  const ativo = useRef<{ id: number; traco: TracoDental } | null>(null);
  const editavel = Boolean(onChange) && !disabled;
  function ponto(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: Math.round(Math.max(0, Math.min(200, (e.clientX - rect.left) * 200 / rect.width)) * 10) / 10,
      y: Math.round(Math.max(0, Math.min(300, (e.clientY - rect.top) * 300 / rect.height)) * 10) / 10 };
  }
  function iniciar(e: PointerEvent<SVGSVGElement>) {
    if (!editavel || ativo.current || e.button !== 0) return;
    if (desenho.tracos.length >= 80 || desenho.tracos.reduce((n, t) => n + t.pontos.length, 0) >= 5800) {
      setAviso('Limite do desenho atingido. Desfaça um traço ou salve este registro.'); return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const traco = { cor, pontos: [ponto(e)] };
    ativo.current = { id: e.pointerId, traco };
    onChange?.({ tracos: [...desenho.tracos, traco] });
  }
  function mover(e: PointerEvent<SVGSVGElement>) {
    const atual = ativo.current;
    if (!editavel || !atual || atual.id !== e.pointerId || atual.traco.pontos.length >= 200) return;
    const proximo = ponto(e);
    const ultimo = atual.traco.pontos.at(-1)!;
    if (Math.hypot(proximo.x - ultimo.x, proximo.y - ultimo.y) < 1) return;
    atual.traco = { ...atual.traco, pontos: [...atual.traco.pontos, proximo] };
    onChange?.({ tracos: [...desenho.tracos.slice(0, -1), atual.traco] });
  }
  function terminar(e: PointerEvent<SVGSVGElement>) {
    if (ativo.current?.id === e.pointerId) ativo.current = null;
  }
  return <div className="flex flex-col gap-2">
    <svg viewBox="0 0 200 300" role="img" aria-label={`Dente ${numero}${onChange ? ' — área para desenhar' : ' — desenho salvo'}`}
      className={`w-full max-w-64 self-center rounded-lg border border-neutral-300 bg-white ${editavel ? 'touch-none cursor-crosshair' : ''}`}
      onPointerDown={iniciar} onPointerMove={mover} onPointerUp={terminar} onPointerCancel={terminar} onLostPointerCapture={() => { ativo.current = null; }}>
      <image href={`${import.meta.env.BASE_URL}odontograma/dente-${numero}.png`} width="200" height="300" preserveAspectRatio="xMidYMid meet" />
      {desenho.tracos.map((t, i) => t.pontos.length === 1
        ? <circle key={i} cx={t.pontos[0]!.x} cy={t.pontos[0]!.y} r="1.5" fill={t.cor} />
        : <polyline key={i} points={t.pontos.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={t.cor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
    {onChange && <>
      <p className="text-xs text-neutral-500">Desenhe com o mouse ou o dedo sobre as vistas do dente. O desenho será salvo junto ao novo registro.</p>
      <div className="flex flex-wrap gap-2">
        {([['#dc2626', 'Vermelho'], ['#2563eb', 'Azul'], ['#111827', 'Preto']] as const).map(([valor, nome]) =>
          <Button key={valor} variant="secondary" disabled={disabled} aria-pressed={cor === valor} onClick={() => setCor(valor)}>{nome}</Button>)}
        <Button variant="secondary" disabled={disabled || !desenho.tracos.length} onClick={() => { ativo.current = null; onChange({ tracos: desenho.tracos.slice(0, -1) }); }}>Desfazer traço</Button>
        <Button variant="secondary" disabled={disabled || !desenho.tracos.length} onClick={() => { ativo.current = null; onChange({ tracos: [] }); }}>Limpar desenho</Button>
      </div>
      {aviso && <p role="status" className="text-sm text-warning-700">{aviso}</p>}
    </>}
  </div>;
}
