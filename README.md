# Demonstração do consultório da Dra. Fernanda

Uma cópia visual do sistema, destinada à avaliação da profissional. Não atende pacientes de verdade.

## Como conhecer

1. Abra a demonstração publicada no GitHub Pages.
2. Use **Simular atendimento** para ver a conversa, o pedido pelo formulário, a análise da clínica, o aceite da paciente e a confirmação final na agenda.
3. Em **Pacientes**, explore Ana, Bruno e Carla — todas as pessoas e informações clínicas são fictícias.
4. Use a **lâmpada no cabeçalho** ou **Configurações → Tutoriais** para os guias de cada área.
5. Use **Reiniciar**, ou recarregue a página, para voltar à amostra original.

## Limites claros

- Nenhum dado é salvo no servidor, no GitHub, no armazenamento local ou entre recarregamentos. As alterações ficam somente na memória desta página.
- Não informe dados reais. Não há WhatsApp, Google Forms, Google Agenda, e-mail, sensor ou servidor da clínica conectado.
- As solicitações de rede do aplicativo são resolvidas por um simulador em memória. A política de conteúdo também bloqueia conexões externas.
- Os links externos de atendimento levam ao simulador; os links reais dos formulários foram retirados.
- As imagens dos exames são desenhos ilustrativos identificados como tais. Não servem para diagnóstico.
- Backup operacional, autenticação, aquisição física, integrações e envio real de mensagens não funcionam nesta versão. As telas clínicas e seus tutoriais são mantidos para avaliação; os cálculos usam dados fictícios.
- Os preços são exemplos; não representam proposta comercial da clínica.

## Desenvolvimento

Requer Node.js 22.12 ou superior. Execute `npm ci`, depois `npm run dev`. `npm run build` gera o site estático em `dist/`. `npm test` verifica as transições do simulador.

O repositório contém apenas código de apresentação, regras compartilhadas sem integração e imagens públicas da interface. Nunca copie arquivos `.env`, `server/dados`, backups, sessões WAHA ou credenciais para cá.

Publicação: o conteúdo compilado fica em `docs/`, com GitHub Pages configurado para a pasta `/docs` da branch `main`. A navegação usa `#`, inclusive para permitir abrir e recarregar qualquer tela sem servidor.

## Rotina do dia

O painel **Hoje na clínica** reúne consultas, pedidos, conferências e parcelas vencidas. **Iniciar atendimento** abre saúde, dentes e tratamento juntos. O encerramento começa pelo plano existente quando há um, para evitar cobrar novamente; os pagamentos continuam exigindo registro explícito. A lâmpada oferece também o guia do atendimento.

## Organização e tutoriais

Inclui busca global, correção cadastral conferida, lista de espera, materiais com estoque e validade, acompanhamento ilustrativo das mensagens e preparação de relatos. Os 26 tutoriais permanecem disponíveis pela lâmpada e pelas Configurações. As novas funções também usam somente a memória: recarregar apaga as alterações da demonstração.

## V1.2.0

O portal local dos pacientes foi retirado. As solicitações são representadas pelo simulador do Google Forms. Despesas e parcelas oferecem Editar com motivo e histórico; o simulador usa as mesmas regras de edição do servidor. Os tutoriais de Anamnese e Pagamentos/parcelas foram atualizados. Nenhum dado real é enviado ou retido.

## V1.3.0

Funcionamento e descanso inclui pausa após cada consulta, padrão de 10 minutos. Zero desativa. A amostra usa a regra compartilhada de encaixe para respeitar a pausa antes e depois de outros atendimentos, preservando as reservas existentes. O tutorial da página explica a configuração.

## V1.3.1 — revisão da apresentação

Ao trocar de paciente, a edição financeira e a conferência de anamnese não permanecem abertas para a ficha anterior. A aplicação de resposta também possui proteção de duplo clique. Versão de apresentação atualizada; continuam somente dados fictícios em memória, sem integrações reais.
