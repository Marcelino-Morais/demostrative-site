import { useEffect, useState } from 'react';
import { hojeNaClinica } from '../../domain/value-objects/ciclo-recebimentos.js';

export function useDataDaClinica(): string {
  const [data, setData] = useState(hojeNaClinica);
  useEffect(() => {
    const atualizar = () => setData(hojeNaClinica());
    const timer = window.setInterval(atualizar, 30_000);
    window.addEventListener('focus', atualizar);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', atualizar);
    };
  }, []);
  return data;
}
