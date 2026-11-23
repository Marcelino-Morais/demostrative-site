import { ContainerProvider } from './presentation/providers/container-provider.js';
import { EdicaoPendenteProvider } from './presentation/providers/edicao-pendente-provider.js';
import { JanelaNovasSolicitacoes } from './presentation/features/consultas/janela-novas-solicitacoes.js';
import { NotificacoesAgendamentoProvider } from './presentation/providers/notificacoes-agendamento-provider.js';
import { SincronizacaoProvider } from './presentation/providers/sincronizacao-provider.js';
import { SolicitacoesPendentesProvider } from './presentation/providers/solicitacoes-pendentes-provider.js';
import { ThemeProvider } from './presentation/providers/theme-provider.js';
import { AppRouter } from './presentation/router/app-router.js';
import { EncerramentosConsultasProvider } from './presentation/providers/encerramentos-consultas-provider.js';

export function App() {
  return (
    <ThemeProvider>
      <ContainerProvider>
        <SincronizacaoProvider>
          <EdicaoPendenteProvider>
            <SolicitacoesPendentesProvider>
              <NotificacoesAgendamentoProvider>
                <EncerramentosConsultasProvider>
                <AppRouter />
                <JanelaNovasSolicitacoes />
                </EncerramentosConsultasProvider>
              </NotificacoesAgendamentoProvider>
            </SolicitacoesPendentesProvider>
          </EdicaoPendenteProvider>
        </SincronizacaoProvider>
      </ContainerProvider>
    </ThemeProvider>
  );
}
