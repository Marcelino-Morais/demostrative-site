import { AbaAtendimento } from '../features/consultas/aba-atendimento.js';
import { SimuladorPage } from '../../demo/demonstracao.js';
import { TutorialPage } from '../pages/tutorial-page.js';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppShell } from '../layouts/app-shell.js';
import { AgendaPage } from '../pages/agenda-page.js';
import { AniversariosPage } from '../pages/aniversarios-page.js';
import { CatalogoProcedimentosPage } from '../pages/catalogo-procedimentos-page.js';
import { AgendamentoWhatsappPublicoPage } from '../../../whatsapp-itens/src/presentation/pages/agendamento-whatsapp-publico-page.js';
import { AnamnesePublicaPage } from '../pages/anamnese-publica-page.js';
import { ConfiguracoesPage } from '../pages/configuracoes-page.js';
import { HomePage } from '../pages/home-page.js';
import { LinkUniversalPage } from '../pages/link-universal-page.js';
import { DocumentoImpressaoPage } from '../pages/documento-impressao-page.js';
import { NovoPacientePage } from '../pages/novo-paciente-page.js';
import { OrcamentoPage } from '../pages/orcamento-page.js';
import { PacientesListPage } from '../pages/pacientes-list-page.js';
import { RelatoriosPage } from '../pages/relatorios-page.js';
import { RetornosPage } from '../pages/retornos-page.js';

import { GoogleFormsEmailPage } from '../pages/google-forms-email-page.js';
import { FichaClinicaPage } from '../pages/ficha-clinica-page.js';
import { AbaDadosPaciente } from '../features/pacientes/aba-dados-paciente.js';
import { AbaConsultas } from '../features/consultas/aba-consultas.js';
import { AbaAnamnese } from '../features/anamnese/aba-anamnese.js';
import { AbaOdontograma } from '../features/odontograma/aba-odontograma.js';
import { AbaEvolucao } from '../features/evolucao/aba-evolucao.js';
import { AbaDocumentos } from '../features/documentos/aba-documentos.js';
import { AbaArquivos } from '../features/arquivos/aba-arquivos.js';
import { AbaExames } from '../features/exames/aba-exames.js';

const router = createHashRouter([
  // Página pública do paciente — FORA do AppShell (sem menu, sem outras fichas).
  { path: 'anamnese/:token', element: <AnamnesePublicaPage /> },
  { path: 'agendar/:token', element: <AgendamentoWhatsappPublicoPage /> },
  { path: 'entrar', element: <LinkUniversalPage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'simulador', element: <SimuladorPage /> },
      { path: 'agenda', element: <AgendaPage /> },
      { path: 'relatorios', element: <RelatoriosPage /> },
      { path: 'retornos', element: <RetornosPage /> },
      { path: 'aniversarios', element: <AniversariosPage /> },
      { path: 'pacientes', element: <PacientesListPage /> },
      { path: 'pacientes/novo', element: <NovoPacientePage /> },
      { path: 'pacientes/:pacienteId/orcamento/:planoId', element: <OrcamentoPage /> },
      { path: 'pacientes/:pacienteId/documentos/imprimir', element: <DocumentoImpressaoPage /> },
      { path: 'configuracoes/tutorial', element: <TutorialPage /> },
      { path: 'configuracoes', element: <ConfiguracoesPage /> },
      { path: 'configuracoes/whatsapp-automatico', element: <SimuladorPage /> },
      { path: 'configuracoes/google-forms-email', element: <GoogleFormsEmailPage /> },
      { path: 'configuracoes/catalogo-procedimentos', element: <CatalogoProcedimentosPage /> },
      {
        path: 'pacientes/:pacienteId',
        element: <FichaClinicaPage />,
        children: [
          { index: true, element: <Navigate to="dados" replace /> },
          { path: 'dados', element: <AbaDadosPaciente /> },
          { path: 'consultas', element: <AbaConsultas /> },
          { path: 'atendimento', element: <AbaAtendimento /> },
          { path: 'anamnese', element: <AbaAnamnese /> },
          { path: 'odontograma', element: <AbaOdontograma /> },
          { path: 'plano-tratamento', element: <AbaOdontograma /> },
          { path: 'evolucao', element: <AbaEvolucao /> },
          { path: 'documentos', element: <AbaDocumentos /> },
          { path: 'exames', element: <AbaExames /> },
          { path: 'arquivos', element: <AbaArquivos /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
