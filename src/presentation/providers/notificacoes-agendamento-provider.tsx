import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSolicitacoesPendentes } from './solicitacoes-pendentes-provider.js';

const CHAVE_PREFERENCIA = 'pf_notificacoes_agendamento_ativas';

export type PermissaoNotificacao = 'default' | 'granted' | 'denied' | 'indisponivel';

function lerPermissao(): PermissaoNotificacao {
  if (typeof Notification === 'undefined') return 'indisponivel';
  return Notification.permission;
}

function lerPreferencia(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_PREFERENCIA) === '1';
  } catch {
    return false;
  }
}

export interface NotificacoesAgendamentoContextValue {
  suportado: boolean;
  permissao: PermissaoNotificacao;
  /** `true` só quando a pessoa ativou E a permissão do navegador está concedida. */
  ativo: boolean;
  /** Só deve ser chamado direto de um clique — pede a permissão do navegador. */
  ativar: () => Promise<void>;
  desativar: () => void;
}

const NotificacoesAgendamentoContext = createContext<NotificacoesAgendamentoContextValue | undefined>(undefined);

/**
 * Notificações de novas solicitações de agendamento — SEMPRE opcionais,
 * complementares à janela automática dentro do site (nunca a única
 * forma de avisar). Permissão só é pedida por AÇÃO EXPLÍCITA
 * (`ativar()`, chamado direto de um clique) — nunca automaticamente.
 * Conteúdo sempre genérico ("há novas solicitações"), nunca nome,
 * documento ou procedimento do paciente. Dispara só quando a aba está
 * em segundo plano — em primeiro plano, a janela automática
 * (`janela-novas-solicitacoes.tsx`) já é o aviso. Nunca repete pela
 * MESMA solicitação (rastreio em memória, por aba).
 *
 * Provider (não só um hook) de propósito: o botão em Configurações e o
 * disparo da notificação precisam do MESMO estado — um hook chamado em
 * dois lugares teria dois `useState` independentes, fora de sincronia.
 *
 * Limite real, deliberadamente nunca prometido na interface: só
 * funciona com o navegador ABERTO (mesmo que em outra aba/minimizado).
 * Navegador fechado, computador desligado ou servidor fora do ar nunca
 * disparam nada — não existe (nem foi implementada aqui) a
 * infraestrutura de push de verdade (Service Worker + servidor push)
 * que seria necessária pra isso.
 */
export function NotificacoesAgendamentoProvider({ children }: { children: ReactNode }) {
  const { pendentes } = useSolicitacoesPendentes();
  const [permissao, setPermissao] = useState<PermissaoNotificacao>(lerPermissao);
  const [ativo, setAtivo] = useState<boolean>(lerPreferencia);
  const jaNotificadosRef = useRef<Set<string>>(new Set());

  async function ativar(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    const resultado = await Notification.requestPermission();
    setPermissao(resultado);
    if (resultado === 'granted') {
      setAtivo(true);
      try {
        window.localStorage.setItem(CHAVE_PREFERENCIA, '1');
      } catch {
        /* localStorage indisponível — preferência só vale pra esta sessão */
      }
    }
  }

  function desativar(): void {
    setAtivo(false);
    try {
      window.localStorage.setItem(CHAVE_PREFERENCIA, '0');
    } catch {
      /* ignora */
    }
  }

  useEffect(() => {
    if (!ativo || permissao !== 'granted') return;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
    const novas = pendentes.filter((s) => !jaNotificadosRef.current.has(s.id));
    if (novas.length === 0) return;
    novas.forEach((s) => jaNotificadosRef.current.add(s.id));

    const notificacao = new Notification('Consultório — novas solicitações de agendamento', {
      body:
        novas.length === 1
          ? 'Há uma nova solicitação de agendamento aguardando análise.'
          : `Há ${novas.length} novas solicitações de agendamento aguardando análise.`,
      tag: 'pf-solicitacoes-agendamento',
    });
    notificacao.onclick = () => {
      window.focus();
      notificacao.close();
    };
  }, [ativo, permissao, pendentes]);

  const value: NotificacoesAgendamentoContextValue = {
    suportado: typeof Notification !== 'undefined',
    permissao,
    ativo: ativo && permissao === 'granted',
    ativar,
    desativar,
  };

  return <NotificacoesAgendamentoContext.Provider value={value}>{children}</NotificacoesAgendamentoContext.Provider>;
}

export function useNotificacoesAgendamento(): NotificacoesAgendamentoContextValue {
  const ctx = useContext(NotificacoesAgendamentoContext);
  if (!ctx) throw new Error('useNotificacoesAgendamento() precisa estar dentro de <NotificacoesAgendamentoProvider>.');
  return ctx;
}
