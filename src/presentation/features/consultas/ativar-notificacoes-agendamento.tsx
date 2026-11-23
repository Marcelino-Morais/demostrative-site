import { Bell, BellOff } from 'lucide-react';
import { Alert } from '../../components/ui/alert.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { useNotificacoesAgendamento } from '../../providers/notificacoes-agendamento-provider.js';

/**
 * Card de Configurações — liga/desliga a notificação do navegador para
 * novas solicitações de agendamento. A janela automática dentro do site
 * (`janela-novas-solicitacoes.tsx`) continua funcionando de qualquer
 * jeito, ligada ou não, negada ou não — isto é só um complemento.
 */
export function AtivarNotificacoesAgendamento() {
  const { suportado, permissao, ativo, ativar, desativar } = useNotificacoesAgendamento();

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
        {ativo ? <Bell className="h-4 w-4" aria-hidden="true" /> : <BellOff className="h-4 w-4" aria-hidden="true" />}
        Avisos de agendamento
      </h2>
      <p className="text-sm text-neutral-600">
        Receba um aviso quando chegar um pedido pelo Forms. Mantenha o navegador e o servidor ligados para receber os avisos.
      </p>

      {!suportado && <Alert tone="warning">Este navegador não aceita notificações — o aviso dentro do site continua funcionando normalmente.</Alert>}

      {suportado && permissao === 'denied' && (
        <Alert tone="warning">
          A permissão de notificação foi negada para este site. Para ativar, mude a permissão nas configurações do
          próprio navegador — o aviso dentro do site continua funcionando normalmente enquanto isso.
        </Alert>
      )}

      {suportado && permissao !== 'denied' && (
        <Button variant={ativo ? 'secondary' : 'primary'} onClick={() => void (ativo ? desativar() : ativar())} className="self-start">
          {ativo ? 'Desativar avisos' : 'Ativar avisos'}
        </Button>
      )}
    </Card>
  );
}
