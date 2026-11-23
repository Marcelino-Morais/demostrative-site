import { useCallback, useEffect, useRef, useState } from 'react';

/** Leitura sem efeitos colaterais; resultados de uma leitura anterior nunca substituem a atual. */
export function useLeituraPeriodica<T>(ler: () => Promise<T>, intervaloMs = 30_000, revisao = 0) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const geracao = useRef(0);
  useEffect(() => {
    const atual = ++geracao.current;
    let ocupado = false;
    setDados(null); setErro(false); setCarregando(true); setAtualizadoEm(null);
    async function buscar() {
      if (ocupado || geracao.current !== atual) return;
      ocupado = true;
      let limite: ReturnType<typeof setTimeout> | undefined;
      try {
        const resultado = await Promise.race([ler(), new Promise<never>((_, rejeitar) => { limite = setTimeout(() => rejeitar(new Error('leitura-expirou')), 12_000); })]);
        if (geracao.current === atual) { setDados(resultado); setErro(false); setAtualizadoEm(new Date()); }
      } catch { if (geracao.current === atual) setErro(true); }
      finally { clearTimeout(limite); ocupado = false; if (geracao.current === atual) setCarregando(false); }
    }
    void buscar();
    const timer = window.setInterval(() => { if (document.visibilityState !== 'hidden') void buscar(); }, intervaloMs);
    const aoVoltar = () => { if (document.visibilityState !== 'hidden') void buscar(); };
    window.addEventListener('focus', aoVoltar); window.addEventListener('online', aoVoltar); document.addEventListener('visibilitychange', aoVoltar);
    return () => { geracao.current = atual + 1; window.clearInterval(timer); window.removeEventListener('focus', aoVoltar); window.removeEventListener('online', aoVoltar); document.removeEventListener('visibilitychange', aoVoltar); };
  }, [ler, intervaloMs, tentativa, revisao]);
  const atualizar = useCallback(() => setTentativa(v => v + 1), []);
  return { dados, erro, carregando, atualizadoEm, atualizar };
}
