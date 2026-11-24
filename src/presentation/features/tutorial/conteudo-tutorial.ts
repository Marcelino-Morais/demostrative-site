export interface EtapaTutorial { titulo: string; texto: string; rota: string; alvo: string; alternativo?: string; ausente?: string }
export interface ModuloTutorial { id: string; nome: string; paciente?: boolean; cenario?: boolean; continuarCadastro?: boolean; etapas: EtapaTutorial[] }
const e = (titulo: string, texto: string, rota: string, alvo: string, alternativo?: string, ausente?: string): EtapaTutorial => ({ titulo, texto, rota, alvo, alternativo, ausente });
const ficha = '/pacientes/:pacienteId';
export const MODULOS_TUTORIAL: ModuloTutorial[] = [
 {id:'busca-global',nome:'Encontrar uma ficha sem voltar à lista',etapas:[
  e('Busque de qualquer página','A lupa no cabeçalho abre uma busca por nome ou contato. Digite pelo menos dois caracteres e escolha a pessoa pelo nome. Documentos continuam mascarados.','/','css:[data-tour="busca-global"]'),
  e('Preserve o que está preenchendo','Se houver alteração não salva, a busca avisa e impede trocar de paciente. Salve ou cancele essa edição antes de abrir outra ficha.','/','css:[data-tour="busca-global"]'),
 ]},
 {id:'correcao-cadastral',nome:'Corrigir cadastro com conferência e histórico',paciente:true,etapas:[
  e('Abra a correção na ficha certa','Use Corrigir cadastro com conferência quando identificar um erro. A edição comum continua protegida. Pacientes arquivados precisam ser reativados antes.',`${ficha}/dados`,'css:[data-tour="correcoes-cadastro"]'),
  e('Confira os novos dados','Informe as correções e um motivo claro. CPF e RG atuais não são revelados; deixe os campos de novo documento vazios para manter os atuais. Veja a prévia e confirme a identidade com o paciente antes de salvar.',`${ficha}/dados`,'css:[data-tour="correcoes-cadastro"]'),
  e('Revise o histórico','O botão Ver histórico de correções mostra o antes, o depois e o motivo, com documentos mascarados. Ao mudar o celular, confirme as autorizações de mensagens novamente para o novo número.',`${ficha}/dados`,'css:[data-tour="correcoes-cadastro"]'),
 ]},
 {id:'lista-espera',nome:'Organizar encaixes na lista de espera',etapas:[
  e('Registre a disponibilidade','Escolha um paciente ativo e escreva os dias ou horários em que pode vir. Adicionar à lista não cria consulta e não envia mensagem.','/lista-espera','css:[data-tour="lista-espera"]'),
  e('Combine antes de agendar','Quando surgir uma vaga, abra a ficha e faça o contato. Marcar contato feito registra apenas o que a equipe informou; não prova envio nem aceite. Confira a duração e os conflitos na Agenda.','/lista-espera','css:[data-tour="lista-espera"]'),
  e('Finalize o pedido','Depois de combinar e agendar, marque como resolvido. Cancelar encerra o pedido sem apagar o histórico. Use a caixa de seleção para rever os encerrados.','/lista-espera','css:[data-tour="lista-espera"]'),
 ]},
 {id:'materiais',nome:'Controlar materiais, validade e reposição',etapas:[
  e('Cadastre o item ou lote','Abra Cadastrar material ou novo lote. Informe nome, unidade, quantidade inicial, lote e validade quando houver. O mínimo informado aciona o aviso de reposição.','/materiais','texto:Cadastrar material ou novo lote'),
  e('Registre entradas e saídas','No cartão do material, use Registrar entrada ou saída. Confira a unidade, informe quantidade inteira e motivo. O saldo não pode ficar negativo; abrir um atendimento não desconta estoque.','/materiais','css:[data-tour="materiais"]'),
  e('Confira avisos e histórico','Revise validade e reposição nos cartões. O histórico mantém cada entrada e saída. Só é possível arquivar um item sem saldo; registre o descarte quando cabível antes de arquivar.','/materiais','css:[data-tour="materiais"]'),
 ]},
 {id:'mensagens',nome:'Entender programação, envio e entrega',etapas:[
  e('Consulte sem disparar','Esta página apenas acompanha a fila. Use o filtro para separar programadas, pendentes, enviadas, entregues e falhas. Atualizar não manda mensagens.','/mensagens','css:[data-tour="acompanhar-mensagens"]'),
  e('Enviada não é entregue','Entrega ou leitura só aparece com confirmação do provedor. Sem confirmação não prova que a pessoa não recebeu. Confira os detalhes antes de reenviar para não duplicar o aviso.','/mensagens','css:[data-tour="acompanhar-mensagens"]'),
 ]},
 {id:'relatar-problema',nome:'Preparar um relato para a manutenção',etapas:[
  e('Explique o que aconteceu','Use Relatar problema nesta página, no rodapé, ou abra Ajuda. Descreva o que tentou e o resultado. Não inclua nomes, documentos, contatos, senhas ou informações clínicas.','/ajuda','css:[data-tour="relatar-problema"]'),
  e('Revise antes de compartilhar','A prévia inclui sua descrição, a área e a versão. Não anexa prontuários, imagens nem registros automaticamente. Confirme a revisão para guardar localmente ou copiar e enviar pelo canal que escolher.','/ajuda','css:[data-tour="relatar-problema"]'),
 ]},
 { id:'atendimento',nome:'Do preparo ao encerramento do atendimento',paciente:true,etapas:[
  e('1. Confira a consulta','Nesta área, confira o paciente, o dia, o horário e o procedimento previsto. Abrir esta página não marca a consulta como realizada.',`${ficha}/atendimento`,'css:[data-tour="atendimento-unificado"]'),
  e('2. Leia os alertas de saúde','Leia os pontos de atenção e confirme as informações com o paciente. Abra a anamnese completa quando necessário; um campo vazio não significa ausência de problema.',`${ficha}/atendimento`,'css:[data-tour="alertas-clinicos"]'),
  e('3. Registre dentes e trabalho','O odontograma e o orçamento estão na mesma página. Marque os dentes, registre as observações e confira o que será executado e cobrado.',`${ficha}/atendimento`,'css:[data-tour="mapa-dentes"]'),
  e('4. Evolução e encerramento','Use Registrar evolução para descrever o que foi feito. Depois, confira o resultado e o valor. Se houver plano ou pagamento adiantado, confira o existente antes de criar nova cobrança. Retornos são combinados separadamente.',`${ficha}/atendimento`,'texto:Conferir resultado e valor'),
 ]},
 { id:'primeiro-paciente',nome:'Receber o primeiro paciente',cenario:true,continuarCadastro:true,etapas:[
  e('1. Confira se já existe cadastro','Comece buscando a pessoa pelo nome ou contato. Se encontrar uma ficha, use a existente. Para receber o primeiro paciente pelo sistema, siga para o cadastro.','/pacientes','css:main input'),
  e('2. Identifique a pessoa','Digite o nome completo como a pessoa informa. Esta é a identificação usada na agenda, no tratamento e nos documentos. Durante esta explicação nada é digitado ou salvo.','/pacientes/novo','campo:Nome completo'),
  e('3. Data de nascimento','A data permite conferir a idade e mostrar o aniversário na Agenda. Ela não autoriza mensagens de felicitação; essa escolha é separada. Confira dia, mês e ano.','/pacientes/novo','campo:Data de nascimento'),
  e('4. Estado civil','Escolha uma opção da lista quando essa informação for fornecida. Se não souber, mantenha Não informado; não é necessário inventar uma resposta para cadastrar a pessoa.','/pacientes/novo','campo:Estado civil'),
  e('5. Documentos e privacidade','Confira CPF e RG com cuidado para identificar a pessoa e evitar duplicatas. Esses dados ficam protegidos e mascarados na ficha; não invente números para passar pelo cadastro.','/pacientes/novo','campo:CPF'),
  e('6. Contato','Informe celular com DDD, e-mail e endereço quando disponíveis. O telefone correto é importante para avisos e formulários. As autorizações de WhatsApp são conferidas na ficha, sem presumir consentimento.','/pacientes/novo','campo:Celular'),
  e('7. Endereço e indicação','Preencha o endereço quando disponível. Em Indicado por, registre como a pessoa conheceu a clínica, por exemplo indicação de outra pessoa. Esses campos ajudam na organização, sem substituir a identificação.','/pacientes/novo','campo:Endereço'),
  e('8. Foto e cadastro pelo Forms','Se preferir, envie a Ficha inicial por este link para o paciente responder. A foto pode ser enviada pelo Forms e é opcional; o envio de arquivo exige conta Google. Confira a importação antes de criar outro cadastro manual para a mesma pessoa.','/configuracoes','css:[data-tour="formularios-google"]'),
  e('9. Agora faça o cadastro','Escolha Preencher cadastro e continuar para sair desta explicação. Preencha os dados e pressione Cadastrar paciente. Esse cadastro será real. Só depois de salvar com sucesso o guia continua na nova ficha. Se ainda não quiser cadastrar, use Pular.','/pacientes/novo','texto:Cadastrar paciente'),
 ]},
 { id:'primeiro-atendimento',nome:'Preparar o primeiro atendimento',cenario:true,paciente:true,etapas:[
  e('1. Confira a ficha criada','Aqui ficam os dados dessa pessoa. Confira nome, nascimento e contato antes de prosseguir. Use as abas para manter histórico clínico, agenda, tratamento e documentos juntos.',`${ficha}/dados`,'css:main h1'),
  e('2. Confira as autorizações','A ficha contém as escolhas sobre WhatsApp e aniversário. Confirme com o paciente antes de autorizar. Autorizar avisos de consulta não autoriza campanhas ou felicitações automaticamente.',`${ficha}/dados`,'css:[data-tour="consentimentos-paciente"]','css:main h1'),
  e('3. Solicite o histórico de saúde','Use esta área para copiar ou enviar o link da anamnese no Google Forms. Peça para a pessoa preencher e confira a sincronização e a vinculação antes do atendimento.',`${ficha}/anamnese`,'texto:Anamnese pelo paciente'),
  e('4. Leia os alertas','Leia os pontos de atenção e a anamnese completa. Campos vazios não indicam ausência de problemas. Os relatos precisam ser avaliados pela profissional.',`${ficha}/anamnese`,'css:[data-tour="alertas-clinicos"]'),
  e('5. Combine o horário','Em Nova consulta, selecione esta pessoa e informe data, hora e duração. Se o pedido veio pelo Forms, siga a análise, a proposta ao paciente quando necessária e a aprovação final. Não registre o mesmo pedido duas vezes.','/agenda','texto:Nova consulta'),
  e('6. Examine e registre os dentes','Na ficha, selecione um dente para registrar condição, observações e desenho. Salve as marcações. A posição e a numeração identificam a região clínica corretamente.',`${ficha}/odontograma`,'css:[data-tour="mapa-dentes"]'),
  e('7. Planeje o trabalho','Crie um orçamento quando ainda não houver. Escolha os procedimentos, dentes e região; confira valor e quantidade. Vários dentes podem ser separados por vírgula ou ponto e vírgula. A visita não cria o orçamento.',`${ficha}/odontograma`,'campo:Dente(s)','texto:Novo orçamento / tratamento','Ainda não há orçamento nesta ficha. Fora da visita, use Novo orçamento / tratamento para abrir os campos.'),
  e('8. Combine e registre o pagamento','Registre as condições combinadas. Quando houver recebimento, inclusive adiantado, lance data, valor, forma e as confirmações necessárias no plano correto. A realização da consulta não equivale a pagamento.',`${ficha}/odontograma`,'campo:Valor recebido (R$)','texto:Novo orçamento / tratamento','Pagamentos e condições ficam disponíveis depois de criar um orçamento.'),
  e('9. Termine o atendimento com histórico','Após atender, confira o encerramento da consulta e registre a evolução clínica. Revise os documentos e os recebimentos quando necessário. Você pode repetir cada guia específico nas configurações.',`${ficha}/evolucao`,'css:main textarea','css:main h2'),
 ]},
 { id:'pedido-forms',nome:'Chegou um pedido pelo Forms',cenario:true,etapas:[
  e('1. Localize a solicitação','A sincronização traz o pedido para a Agenda. Procure o aviso e use Analisar solicitação. Se não houver aviso, confira a sincronização nas configurações; não crie outra consulta antes de verificar.','/agenda','css:[data-tour="solicitacoes-agenda"]','css:main h1','Não há pedidos aguardando análise agora. O aviso aparece nesta área quando uma resposta chega.'),
  e('2. Defina o procedimento e a duração','Na análise do pedido, confira a pessoa, escolha o procedimento ou a avaliação no consultório e preencha a duração em minutos. O sistema verifica o intervalo completo e procura um encaixe quando necessário.','/agenda','css:[data-tour="solicitacoes-agenda"]','css:main h1','Os campos de análise aparecem quando existe uma solicitação para abrir.'),
  e('3. Aguarde o aceite e finalize','Se houver proposta de horário ao paciente, aguarde o aceite antes da aprovação final da clínica. Só a consulta confirmada deve ser tratada como horário marcado. Confira também a fila de mensagens.','/agenda','css:main h1'),
  e('4. Confira o envio','Confirme aqui o resultado dos avisos. Servidor e WAHA precisam estar conectados. Não repita mensagens com resultado incerto sem conferir o WhatsApp.','/configuracoes/whatsapp-automatico','css:main h1'),
 ]},
 { id:'adiantamento',nome:'O paciente pagou adiantado',cenario:true,paciente:true,etapas:[
  e('1. Abra o tratamento certo','Confira a pessoa e o orçamento antes de lançar o dinheiro. O adiantamento precisa pertencer ao tratamento correto; não crie um pagamento sem esse vínculo.',`${ficha}/odontograma`,'css:[data-tour="trabalhos-tratamento"]','texto:Novo orçamento / tratamento','Crie o orçamento do tratamento antes de registrar o adiantamento.'),
  e('2. Lance o que realmente recebeu','Em Pagamentos efetuados, informe a data do recebimento, o valor e a forma de pagamento. Registre as confirmações e o comprovante quando disponíveis. Não espere o dia da consulta para lançar um pagamento já recebido.',`${ficha}/odontograma`,'campo:Valor recebido (R$)','texto:Novo orçamento / tratamento','Os campos de pagamento aparecem depois de criar um orçamento.'),
  e('3. Confira o saldo depois','Confira o total pago e o saldo do plano, além das parcelas e baixas. Quando a consulta ocorrer, não lance esse mesmo recebimento novamente. Realização e pagamento são registros diferentes.',`${ficha}/odontograma`,'texto:Parcelas, recebimentos e fechamento financeiro'),
 ]},
 { id:'fechar-dia',nome:'Conferir e fechar o dia',cenario:true,etapas:[
  e('1. Confira os atendimentos','Revise as consultas do dia e seus desfechos. Confirme o que foi realizado e as faltas. O encerramento exige conferência; não use como prova de recebimento.','/agenda','css:main h1'),
  e('2. Confira entradas e despesas','Revise o período, os recebimentos confirmados, as pendências e as despesas. Um valor planejado ainda pode estar em aberto; o fechamento deve preservar o histórico.','/relatorios','css:main h1'),
  e('3. Proteja os registros','Faça a cópia de segurança e confira a conclusão. Guarde a senha ou chave em local seguro. Ao sair, bloqueie o sistema; deixe o computador e os serviços ligados quando precisar de automações.','/configuracoes','css:[data-tour="backup-configuracoes"]'),
 ]},
 { id:'inicio', nome:'Conhecer o sistema', etapas:[
  e('Este é o painel', 'Aqui você acompanha o consultório. Planejado é o que foi combinado; recebido é o pagamento registrado. Use Próximo para conhecer as telas.', '/', 'texto:Visão geral'),
  e('A agenda fica aqui', 'Este botão abre os horários e as solicitações recebidas dos formulários. No celular, o menu fica embaixo.', '/', 'css:[data-tour="menu-agenda"]'),
  e('Hoje na clínica','Este resumo reúne as consultas do dia, os pedidos para analisar, os atendimentos a conferir e as parcelas vencidas. Use Iniciar atendimento para abrir os alertas, os dentes e o tratamento juntos.','/','css:[data-tour="hoje-na-clinica"]'),
  e('Acesse em outro aparelho','Copie aqui o endereço do painel para um dispositivo conectado à mesma rede da clínica. Entre com a senha da clínica; mantenha o computador principal e o servidor ligados. Este link é da equipe, não dos pacientes.','/','css:[data-tour="acesso-painel-rede"]'),
  e('Encontre os pacientes', 'Nesta tela você busca e abre uma ficha. Confira se a pessoa já está cadastrada antes de criar outra.', '/pacientes','css:main input'),
  e('Cadastro de uma pessoa', 'Preencha o nome completo aqui e confira os demais dados. Esta visita apenas mostra o formulário: não preenche nem salva nada.', '/pacientes/novo','campo:Nome completo'),
  e('Criar uma consulta', 'Use Nova consulta para abrir o agendamento. Depois escolha paciente, data, hora e duração. Confira o intervalo inteiro antes de confirmar.', '/agenda','texto:Nova consulta'),
  e('Relatórios do consultório', 'Os relatórios ajudam a acompanhar o período. Confira os filtros e diferencie recebimentos, valores em aberto e despesas.', '/relatorios','css:main h1'),
  e('Onde encontrar ajuda novamente', 'Nas configurações, use Abrir tutorial interativo para escolher um passo a passo de qualquer recurso.', '/configuracoes','texto:Abrir tutorial interativo'),
 ]},
 { id:'pacientes',nome:'Cadastro e ficha do paciente',etapas:[
  e('Procure antes de cadastrar','Digite nome, telefone ou outro identificador para encontrar uma ficha. Use Abrir ficha no resultado.','/pacientes','css:main input'),
  e('Nome e dados pessoais','Este é o formulário de cadastro. Só o nome é obrigatório; confira os demais campos. O paciente também pode enviar dados e foto pela ficha inicial do Forms.','/pacientes/novo','campo:Nome completo'),
  e('Salvar o cadastro','Este botão salva a ficha quando você estiver trabalhando normalmente. Durante a visita, os controles da página ficam protegidos e nada é cadastrado.','/pacientes/novo','texto:Cadastrar paciente'),
 ]},
 { id:'agenda',nome:'Agenda e solicitações',etapas:[
  e('Visão da agenda','Consulte aqui os horários. Uma solicitação do Forms ainda precisa de análise e dos aceites necessários antes de se tornar consulta confirmada.','/agenda','css:main h1'),
  e('Nova consulta','Este botão abre o formulário. Escolha a pessoa, o dia, a hora e a duração em minutos. O atendimento deve caber nos horários de funcionamento e descanso definidos nas configurações.','/agenda','texto:Nova consulta'),
  e('Solicitações recebidas','As solicitações aguardando análise aparecem nesta área quando existem. Abra Analisar solicitação, informe duração e procedimento e siga o aceite do paciente e a aprovação final.','/agenda','css:[data-tour="solicitacoes-agenda"]','css:main h1','Não há solicitações para destacar agora. Elas aparecem na Agenda quando um pedido chega pelo Forms.'),
 ]},
 { id:'funcionamento',nome:'Descanso, bloqueios e feriados',etapas:[
  e('Opções da agenda','Abra Mais opções para bloquear dias e consultar feriados. Use o motivo público somente para informações que o paciente pode receber; observações internas não devem ser divulgadas.','/agenda','texto:Mais opções'),
  e('Funcionamento e descanso','Configure aqui abertura, fechamento e intervalo de descanso. Os encaixes respeitam esse intervalo, os bloqueios e a duração do atendimento.','/configuracoes','css:#descanso-diario'),
 ]},
 { id:'anamnese',nome:'Anamnese e alertas',paciente:true,etapas:[
  e('Confira os alertas','Leia os pontos de atenção antes do atendimento. Um aviso resume o relato; confira a anamnese completa. Respostas ausentes não significam ausência de risco.',`${ficha}/anamnese`,'css:[data-tour="alertas-clinicos"]','css:main h1'),
  e('Respostas recebidas','A primeira resposta do Forms aparece na ficha após sincronizar. Se já existe anamnese salva, use Conferir resposta recebida, revise as respostas e aplique somente após conferir. O acesso local antigo dos pacientes foi retirado.',`${ficha}/anamnese`,'css:main h1'),
  e('Solicitar a anamnese','Nesta área você copia, abre ou envia ao paciente o link do Google Forms. Peça a anamnese quando necessário e confira a vinculação da resposta.',`${ficha}/anamnese`,'texto:Anamnese pelo paciente','css:main h2'),
 ]},
 { id:'odontograma',nome:'Dentes, desenhos e tratamento',paciente:true,etapas:[
  e('Escolha o dente','Clique no desenho ou número para abrir o painel do dente. Nele você registra a condição e desenha sobre a imagem. Salve o registro para preservar o desenho no histórico.',`${ficha}/odontograma`,'css:[data-tour="mapa-dentes"]'),
  e('Trabalho a executar','Escolha um procedimento do catálogo ou um registro do odontograma. Ao selecionar um registro, o valor de referência preenche o orçamento para revisão. Para vários dentes, use vírgula ou ponto e vírgula, como 11, 12; 21. Para um trabalho geral, digite Todos ou boca inteira. Região é uma lista. Confira valor e quantidade: listar dentes não multiplica a cobrança.',`${ficha}/odontograma`,'campo:Dente(s)','texto:Novo orçamento / tratamento','Ainda não há um orçamento nesta ficha. Fora da visita, use Novo orçamento / tratamento para mostrar os campos de trabalho, dentes, região e valor.'),
  e('Desenhos já salvos','O histórico guarda os registros e as marcações salvas. Abra o dente para consultar os detalhes; desenhar sem salvar não conclui um procedimento.',`${ficha}/odontograma`,'texto:Histórico completo do odontograma (0)','css:[data-tour="historico-dental"]'),
 ]},
 { id:'financeiro',nome:'Pagamentos e parcelas',paciente:true,etapas:[
  e('Combine o pagamento','Informe desconto, entrada e parcelas nas condições de pagamento do plano. Depois confira as parcelas efetivamente lançadas e seus vencimentos.',`${ficha}/odontograma`,'campo:Desconto à vista (%)','texto:Novo orçamento / tratamento','Crie primeiro um orçamento nesta ficha, fora da visita, para acessar condições e pagamentos.'),
  e('Registrar o recebimento','Quando receber, mesmo adiantado, registre data, valor, forma e as confirmações exigidas. Realizar uma consulta não significa que houve pagamento. Confira para não lançar o mesmo valor duas vezes.',`${ficha}/odontograma`,'campo:Valor recebido (R$)','texto:Novo orçamento / tratamento','Os campos de pagamento aparecem quando a ficha possui um orçamento.'),
  e('Corrigir despesa ou parcela','Use Editar ao lado do lançamento. Corrija a data, a descrição e, quando permitido, o valor; informe o motivo. A correção mantém o histórico e os pagamentos. Parcelas de planos com pagamentos têm o valor protegido.', '/relatorios','css:[data-tour="fechamento-financeiro"]','css:main h1'),
  e('Parcelas e fechamento','Abra esta seção para acompanhar parcelas, recebimentos e fechamento. Dê baixa no que foi pago para evitar cobranças indevidas.',`${ficha}/odontograma`,'texto:Parcelas, recebimentos e fechamento financeiro'),
 ]},
 { id:'evolucao',nome:'Realização e evolução clínica',paciente:true,etapas:[
  e('Histórico do atendimento','Registre aqui a data e o que foi realizado clinicamente. Revise antes de salvar. Evolução e pagamento têm finalidades diferentes.',`${ficha}/evolucao`,'css:main textarea','css:main h2'),
  e('Encerrar a consulta','Na Agenda, confira a consulta e o aviso de encerramento para indicar realização, falta ou outro desfecho. O aviso pede sua decisão; não comprova atendimento nem recebimento sozinho.','/agenda','css:main h1'),
 ]},
 { id:'documentos',nome:'Documentos e impressão',paciente:true,etapas:[
  e('Documentos da pessoa','Escolha aqui os documentos e confira os dados vinculados à ficha, à anamnese e ao financeiro. Um recibo deve corresponder ao recebimento registrado.',`${ficha}/documentos`,'texto:Pacote completo do paciente','css:main h2'),
  e('Conferir antes de imprimir','Revise paciente, dentes, valores e páginas. CPF e RG ficam mascarados; use Preparar impressão quando precisar dos dados completos para o documento.',`${ficha}/documentos`,'css:main button','css:main h2'),
 ]},
 { id:'exames',nome:'Exames e arquivos',paciente:true,etapas:[
  e('Radiografias e anotações','Abra uma imagem para ampliar, girar, comparar e desenhar. Salve as anotações antes de fechar. Medidas em pixels não equivalem a milímetros sem calibração válida.',`${ficha}/exames`,'css:main h2'),
  e('Outros arquivos','Anexe aqui os documentos da pessoa e confira a ficha antes de importar. A captura com sensor físico ainda depende de validação profissional; uma captura sintética não é um exame real.',`${ficha}/arquivos`,'css:main input[type="file"]','css:main h2'),
 ]},
 { id:'whatsapp',nome:'WhatsApp e mensagens',etapas:[
  e('Acompanhar os envios','Esta tela mostra a fila e os resultados dos envios. O computador, o servidor e o WAHA precisam estar ligados e conectados. A página pode ficar fechada.','/configuracoes/whatsapp-automatico','css:main h1'),
  e('Conferir falhas e autorizações','Confira pendências e erros antes de repetir uma mensagem. PARAR precisa ser respeitado; MENU não autoriza novamente aniversário ou campanhas. Esta visita não dispara envios.','/configuracoes/whatsapp-automatico','css:main [role="alert"]','css:main h1'),
 ]},
 { id:'aniversarios',nome:'Aniversários e retornos',etapas:[
  e('Aniversários','Os aniversários aparecem na Agenda. A felicitação automática exige autorização específica e ocorre no próprio dia entre 9h e 17h, com os serviços conectados. Campanhas têm autorização separada.','/aniversarios','css:main h1'),
  e('Acompanhamentos','Use Retornos para acompanhar quem precisa voltar. Um retorno pendente não reserva um horário: combine a data e agende na Agenda.','/retornos','css:main h1'),
 ]},
 { id:'relatorios',nome:'Relatórios e fechamento',etapas:[
  e('Confira o período','Revise os filtros antes de comparar valores. O fechamento separa períodos e preserva o histórico; não confunda planejado com recebido.','/relatorios','css:main h1'),
  e('Recebimentos e despesas','Registre e confira as despesas e os recebimentos do período. O resultado financeiro depende dos dois. Os detalhes ficam nos relatórios e no fechamento dos tratamentos.','/relatorios','css:main select','css:main h1'),
 ]},
 { id:'backup',nome:'Backup e configurações',etapas:[
  e('Cópias de segurança','Crie uma cópia antes de mudanças importantes e confira sua conclusão. Guarde a senha ou chave em local seguro; ela é necessária para recuperar o backup.','/configuracoes','css:[data-tour="backup-configuracoes"]','css:main h1'),
  e('Integrações e segurança','Confira a sincronização e o estado das integrações nas configurações. Revise a prévia antes de restaurar um backup; restaurar não é um atalho para editar cadastros protegidos.','/configuracoes','css:main h1'),
  e('Refazer a visita','Use este botão para escolher qualquer guia novamente. Você pode sair de uma visita a qualquer momento com Pular ou pela tecla Esc.','/configuracoes','texto:Abrir tutorial interativo'),
 ]},
];
export function urlEtapaTutorial(id: string, passo = 0, pacienteId = ''): string {
 const modulo = MODULOS_TUTORIAL.find(m => m.id === id);
 const etapa = modulo?.etapas[passo];
 if (!etapa || (modulo.paciente && !pacienteId)) return '/configuracoes/tutorial';
 const rota = etapa.rota.replace(':pacienteId', encodeURIComponent(pacienteId));
 const params = new URLSearchParams({ guia: id, passo: String(passo) });
 if (modulo.paciente) params.set('paciente', pacienteId);
 return `${rota}?${params}`;
}
