import { useId, type KeyboardEvent } from 'react';
import type { SimNao } from '../../../domain/types.js';
import { cn } from '../../lib/cn.js';

export interface CampoSimNaoProps {
  label: string;
  value: SimNao;
  onChange: (value: SimNao) => void;
  className?: string;
  rotuloNao?: string;
}

const OPCOES = ['SIM', 'NAO'] as const;

/**
 * Grupo "(  ) sim (  ) não" — o padrão mais repetido do documento
 * original de anamnese (dezenas de vezes ao longo do formulário).
 * Sempre permite voltar a "não respondido" (clicar na opção já
 * selecionada limpa), porque uma anamnese em rascunho não deve forçar
 * uma resposta antes de estar pronta.
 *
 * Achado real de acessibilidade (Etapa 2 — auditoria/hardening): os
 * dois botões já tinham `role="radio"`/`aria-checked`, mas sem um
 * `role="radiogroup"` envolvendo e sem tabindex circulante (roving
 * tabindex), o navegador expõe "botão de opção" pra leitor de tela só
 * pela metade — as setas do teclado não fazem nada (comportamento
 * nativo de radio quebrado) e cada opção ainda é uma parada de Tab
 * separada, o que soma dezenas de Tabs a mais num formulário deste
 * tamanho. Corrigido com `radiogroup` de verdade: só a opção
 * selecionada (ou a primeira, se nenhuma) fica no fluxo do Tab, e as
 * setas ←/→ (ou ↑/↓) movem a seleção entre as duas opções.
 */
export function CampoSimNao({ label, value, onChange, className, rotuloNao = 'Não' }: CampoSimNaoProps) {
  const name = useId();

  function selecionar(novoValor: 'SIM' | 'NAO'): void {
    onChange(novoValor);
  }

  function limpar(novoValor: 'SIM' | 'NAO'): void {
    onChange(value === novoValor ? null : novoValor);
  }

  function aoNavegarPorTeclado(evento: KeyboardEvent<HTMLButtonElement>, indiceAtual: number): void {
    const teclasProximo = ['ArrowRight', 'ArrowDown'];
    const teclasAnterior = ['ArrowLeft', 'ArrowUp'];
    if (!teclasProximo.includes(evento.key) && !teclasAnterior.includes(evento.key)) return;
    evento.preventDefault();
    const passo = teclasProximo.includes(evento.key) ? 1 : -1;
    const proximoIndice = (indiceAtual + passo + OPCOES.length) % OPCOES.length;
    selecionar(OPCOES[proximoIndice]!);
    // Roving tabindex de verdade: o foco precisa acompanhar a seleção,
    // senão o botão antigo (agora tabIndex -1) fica com foco "preso".
    const botoes = evento.currentTarget.parentElement?.querySelectorAll('button');
    (botoes?.[proximoIndice] as HTMLButtonElement | undefined)?.focus();
  }

  return (
    <div className={cn('flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3', className)}>
      <span className="text-sm font-medium text-neutral-800">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-1 self-start rounded-md border border-neutral-300 p-0.5">
        {OPCOES.map((opcao, indice) => (
          <button
            key={opcao}
            type="button"
            role="radio"
            aria-checked={value === opcao}
            tabIndex={value === opcao || (value === null && indice === 0) ? 0 : -1}
            name={name}
            onClick={() => limpar(opcao)}
            onKeyDown={(e) => aoNavegarPorTeclado(e, indice)}
            className={cn(
              'min-h-9 min-w-16 rounded px-3 text-sm font-medium transition-colors',
              value === opcao
                ? 'bg-brand-700 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-200/10',
            )}
          >
            {opcao === 'SIM' ? 'Sim' : rotuloNao}
          </button>
        ))}
      </div>
    </div>
  );
}
