import { AtalhosOrganizacao } from '../features/rotina/atalhos-organizacao.js';
import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileLock2,
  Lock,
  Mail,
  MessageCircle,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { analisarBackup, type DadosBackup, type ResumoDoBackup } from '../../application/use-cases/backup.js';
import {
  criptografarBackup,
  descriptografarBackup,
  EXTENSAO_BACKUP_CRIPTOGRAFADO,
  pareceEnvelopeCriptografado,
  TAMANHO_MAXIMO_ARQUIVO_BYTES,
} from '../../infrastructure/crypto/backup-criptografia.js';
import { Alert } from '../components/ui/alert.js';
import { Button, buttonClassName } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog.js';
import { Field } from '../components/ui/field.js';
import { Input } from '../components/ui/input.js';
import { AlterarSenhaClinica } from '../features/configuracoes/alterar-senha-clinica.js';
import { AtivarNotificacoesAgendamento } from '../features/consultas/ativar-notificacoes-agendamento.js';
import { StatusGoogleCalendar } from '../features/consultas/status-google-calendar.js';
import { DescansoAgenda } from '../features/consultas/descanso-agenda.js';
import { StatusSincronizacaoGoogleSheets } from '../features/google-sheets-sync/status-sincronizacao-google-sheets.js';
import { PainelMigracao } from '../features/sincronizacao/painel-migracao.js';
import { PainelCopiasLocais } from '../features/sincronizacao/painel-copias-locais.js';
import { PainelSincronizacao } from '../features/sincronizacao/painel-sincronizacao.js';
import { formatarDataHoraIso } from '../lib/formatadores.js';
import { useContainer } from '../providers/container-provider.js';

const TAMANHO_MINIMO_SENHA_BACKUP = 8;

/**
 * Links dos formulários do Google já criados pra este consultório —
 * SÓ o link público (de resposta), nunca o de edição. Estático de
 * propósito (mesmo espírito de `CONFIGURACAO_CLINICA`): são URLs reais
 * que só mudam se algum formulário for recriado do zero; o link de
 * edição de cada um fica documentado só em
 * `integracao-google-forms/README.md`, nunca aqui — esta tela é
 * pensada pra copiar/divulgar, não pra editar formulário.
 */
const LINKS_FORMULARIOS_GOOGLE = [
  {
    nome: 'Ficha inicial',
    link: 'https://demonstracao.invalid/formulario',
  },
  {
    nome: 'Anamnese',
    link: 'https://demonstracao.invalid/formulario',
  },
  {
    nome: 'Agendamento de consulta',
    link: 'https://demonstracao.invalid/formulario',
  },
] as const;

/**
 * Tela de backup/restauração — o único lugar do sistema que toca em
 * TODOS os dados de uma vez. Só conversa com `container.backup.*`
 * (`application/use-cases/backup.ts`); a análise do arquivo
 * (`analisarBackup`), as contagens e a semântica de restauração vivem
 * lá, nunca aqui. A tela só faz I/O de arquivo (baixar/ler), diálogo de
 * confirmação e mensagens.
 */
export function ConfiguracoesPage() {
  const container = useContainer();
  const nucleoNoServidor = container.sincronizacaoNucleo;
  const algumSliceLigado =
    container.sincronizacaoNucleo || container.sincronizacaoAnamnese || container.sincronizacaoArquivos;
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const inputConverterRef = useRef<HTMLInputElement>(null);
  const [mensagem, setMensagem] = useState<{ tom: 'success' | 'danger'; texto: string } | null>(null);
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [pendente, setPendente] = useState<{ dados: DadosBackup; resumo: ResumoDoBackup; criptografado: boolean } | null>(
    null,
  );
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null);

  // Exportação criptografada (padrão) — senha pedida ANTES de gerar o arquivo.
  const [dialogoExportarAberto, setDialogoExportarAberto] = useState(false);
  const [senhaExportar, setSenhaExportar] = useState('');
  const [confirmarSenhaExportar, setConfirmarSenhaExportar] = useState('');
  const [erroSenhaExportar, setErroSenhaExportar] = useState<string | null>(null);

  // Restauração: quando o arquivo escolhido é um envelope criptografado, pede a senha antes de analisar o conteúdo.
  const [envelopePendente, setEnvelopePendente] = useState<unknown | null>(null);
  const [senhaRestaurar, setSenhaRestaurar] = useState('');
  const [erroSenhaRestaurar, setErroSenhaRestaurar] = useState<string | null>(null);
  const [decifrando, setDecifrando] = useState(false);

  // Converter um backup antigo (.json, sem criptografia) para o formato criptografado, sem restaurá-lo.
  const [arquivoParaConverter, setArquivoParaConverter] = useState<{ dados: DadosBackup } | null>(null);
  const [senhaConverter, setSenhaConverter] = useState('');
  const [confirmarSenhaConverter, setConfirmarSenhaConverter] = useState('');
  const [erroSenhaConverter, setErroSenhaConverter] = useState<string | null>(null);
  const [convertendo, setConvertendo] = useState(false);

  const copiarLinkFormulario = useCallback(async (nome: string, link: string) => {
    await navigator.clipboard.writeText(link);
    setLinkCopiado(nome);
    window.setTimeout(() => setLinkCopiado((atual) => (atual === nome ? null : atual)), 2000);
  }, []);

  const mensagemContagens = useCallback(
    (dados: DadosBackup): string => {
      const c = dados.contagens;
      const notaServidor = algumSliceLigado
        ? (nucleoNoServidor
            ? ' Este arquivo traz uma cópia portátil de todo o registro clínico do servidor (pacientes, agenda, planos, pagamentos, odontograma, evolução, WhatsApp e anamnese).'
            : '') +
          ' Anamnese pelo link e arquivos que estão no servidor NÃO entram aqui — a cópia deles é a pasta server/dados/ (npm run backup:servidor).'
        : '';
      return (
        `Backup exportado (${c.pacientes} paciente(s), ${c.anamneses} anamnese(s), ${c.registrosDentais} registro(s) de ` +
        `odontograma, ${c.planosTratamento} plano(s), ${c.evolucoes} evolução(ões), ${c.consultas} consulta(s), ` +
        `${c.registrosWhatsapp} ação(ões) de WhatsApp, ${c.linksAnamnese} link(s) de anamnese, ` +
        `${dados.despesas?.length ?? 0} despesa(s), ${dados.parcelas?.length ?? 0} parcela(s), ` +
        `${c.arquivosPaciente} arquivo(s) — só a lista, sem o conteúdo, ${c.bloqueiosAgenda} dia(s) bloqueado(s) na agenda). ` +
        notaServidor
      );
    },
    [algumSliceLigado, nucleoNoServidor],
  );

  function baixarArquivo(conteudo: string, nome: string) {
    const blob = new Blob([conteudo], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const abrirDialogoExportar = useCallback(() => {
    setMensagem(null);
    setSenhaExportar('');
    setConfirmarSenhaExportar('');
    setErroSenhaExportar(null);
    setDialogoExportarAberto(true);
  }, []);

  const confirmarExportarCriptografado = useCallback(async () => {
    if (senhaExportar.length < TAMANHO_MINIMO_SENHA_BACKUP) {
      setErroSenhaExportar(`Use uma senha de pelo menos ${TAMANHO_MINIMO_SENHA_BACKUP} caracteres.`);
      return;
    }
    if (senhaExportar !== confirmarSenhaExportar) {
      setErroSenhaExportar('As duas senhas digitadas não são iguais.');
      return;
    }
    setErroSenhaExportar(null);
    setExportando(true);
    try {
      const dataDeHoje = new Date().toISOString().slice(0, 10);
      if (nucleoNoServidor) {
        // Montado E cifrado no SERVIDOR — a coleção completa nunca
        // existe em claro aqui no navegador (ver `backupServidor`).
        const envelope = await container.backupServidor.exportar.executar(senhaExportar);
        baixarArquivo(JSON.stringify(envelope), `backup-consultorio-${dataDeHoje}${EXTENSAO_BACKUP_CRIPTOGRAFADO}`);
        setMensagem({
          tom: 'success',
          texto:
            'Backup gerado e cifrado pelo servidor da clínica, com a senha que você digitou, e está na pasta de ' +
            'downloads do navegador. Guarde a senha em local seguro: sem ela, ninguém — nem este sistema — consegue ' +
            'abrir este arquivo de novo.',
        });
      } else {
        const dadosBase = await container.backup.exportar.executar();
      const lancamentos = container.sincronizacaoNucleo ? await container.gestaoFinanceira.listar() : null;
      const dados = { ...dadosBase, ...(lancamentos ? { despesas: lancamentos.despesas, parcelas: lancamentos.parcelas } : {}) };
        const envelope = await criptografarBackup(JSON.stringify(dados), senhaExportar);
        baixarArquivo(JSON.stringify(envelope), `backup-consultorio-${dados.exportadoEm.slice(0, 10)}${EXTENSAO_BACKUP_CRIPTOGRAFADO}`);
        setMensagem({
          tom: 'success',
          texto:
            `${mensagemContagens(dados)} O arquivo foi cifrado com a senha que você digitou e está na pasta de downloads ` +
            `do navegador. Guarde a senha em local seguro: sem ela, ninguém — nem este sistema — consegue abrir este arquivo de novo.`,
        });
      }
      setDialogoExportarAberto(false);
      setSenhaExportar('');
      setConfirmarSenhaExportar('');
    } finally {
      setExportando(false);
    }
  }, [container, nucleoNoServidor, senhaExportar, confirmarSenhaExportar, mensagemContagens]);

  /** Caminho avançado, sem criptografia — nunca o botão principal, de propósito. */
  const exportarSemCriptografia = useCallback(async () => {
    setMensagem(null);
    setExportando(true);
    try {
      const dadosBase = await container.backup.exportar.executar();
      const lancamentos = container.sincronizacaoNucleo ? await container.gestaoFinanceira.listar() : null;
      const dados = { ...dadosBase, ...(lancamentos ? { despesas: lancamentos.despesas, parcelas: lancamentos.parcelas } : {}) };
      baixarArquivo(JSON.stringify(dados, null, 2), `backup-consultorio-${dados.exportadoEm.slice(0, 10)}.json`);
      setMensagem({
        tom: 'success',
        texto:
          `${mensagemContagens(dados)} ATENÇÃO: este arquivo NÃO está criptografado — qualquer pessoa que abri-lo lê os ` +
          `dados clínicos e financeiros diretamente. Prefira "Exportar agora" (com senha) para o uso do dia a dia.`,
      });
    } finally {
      setExportando(false);
    }
  }, [container, mensagemContagens]);

  const escolherArquivo = useCallback(() => {
    setMensagem(null);
    inputArquivoRef.current?.click();
  }, []);

  const arquivoSelecionado = useCallback(async (evento: ChangeEvent<HTMLInputElement>) => {
    const arquivo = evento.target.files?.[0];
    evento.target.value = ''; // permite reescolher o mesmo arquivo se precisar tentar de novo
    if (!arquivo) return;
    setMensagem(null);

    if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO_BYTES) {
      setMensagem({
        tom: 'danger',
        texto: 'Este arquivo é maior do que o aceito para restauração. Nenhum dado foi alterado.',
      });
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(await arquivo.text());
    } catch {
      setMensagem({ tom: 'danger', texto: 'Não foi possível ler este arquivo como JSON. Nenhum dado foi alterado.' });
      return;
    }

    if (pareceEnvelopeCriptografado(json)) {
      setSenhaRestaurar('');
      setErroSenhaRestaurar(null);
      setEnvelopePendente(json);
      return;
    }

    const analise = analisarBackup(json);
    if (!analise.ok) {
      setMensagem({ tom: 'danger', texto: analise.mensagem });
      return;
    }
    setPendente({ dados: analise.dados, resumo: analise.resumo, criptografado: false });
  }, []);

  const confirmarSenhaEDecifrar = useCallback(async () => {
    if (!envelopePendente) return;
    setDecifrando(true);
    try {
      const resultado = await descriptografarBackup(envelopePendente, senhaRestaurar);
      if (!resultado.ok) {
        setErroSenhaRestaurar(resultado.mensagem);
        return;
      }
      let json: unknown;
      try {
        json = JSON.parse(resultado.textoClaro);
      } catch {
        setErroSenhaRestaurar('O conteúdo decifrado não é um backup válido. Nenhum dado foi alterado.');
        return;
      }
      const analise = analisarBackup(json);
      if (!analise.ok) {
        setErroSenhaRestaurar(analise.mensagem);
        return;
      }
      setEnvelopePendente(null);
      setSenhaRestaurar('');
      setErroSenhaRestaurar(null);
      setPendente({ dados: analise.dados, resumo: analise.resumo, criptografado: true });
    } finally {
      setDecifrando(false);
    }
  }, [envelopePendente, senhaRestaurar]);

  const confirmarImportacao = useCallback(async () => {
    if (!pendente) return;
    setImportando(true);
    try {
      if (nucleoNoServidor) {
        // Paciente já existente NUNCA tem nenhum campo alterado por
        // esta restauração (ver `pacientes-restauracao.mjs`) — nunca
        // vira um caminho alternativo de edição cadastral disfarçada.
        const resultado = await container.backupServidor.restaurar.executar({ dados: pendente.dados });
        const pac = resultado.porColecao.pacientes;
        const recuperados = pac?.restauradosExcluidos ?? 0;
        const partes = [`${(pac?.criados ?? 0) - recuperados} paciente(s) novo(s) criado(s)`];
        if (recuperados > 0) partes.push(`${recuperados} paciente(s) excluído(s) recuperado(s) do backup`);
        if ((pac?.preservadosSemAlteracao ?? 0) > 0) {
          partes.push(`${pac?.preservadosSemAlteracao} já existente(s) — dados cadastrais preservados, não alterados`);
        }
        if ((pac?.excluidosIntencionalmente ?? 0) > 0) {
          partes.push(`${pac?.excluidosIntencionalmente} não recriado(s) por exclusão intencional anterior`);
        }
        if (resultado.conflitosIdentidadePacientes.length > 0) {
          partes.push(
            `${resultado.conflitosIdentidadePacientes.length} com conflito de identidade (CPF/RG já pertence a outro ` +
              `paciente já cadastrado) — não recriado(s), revise manualmente se necessário`,
          );
        }
        setPendente(null);
        const parcial = (pac?.excluidosIntencionalmente ?? 0) > 0 || resultado.conflitosIdentidadePacientes.length > 0;
        setMensagem({ tom: parcial ? 'danger' : 'success', texto: `Restauração ${parcial ? 'parcial' : 'concluída'}: ${partes.join('; ')}.` });
      } else {
        await container.backup.importar.executar(pendente.dados);
        setPendente(null);
        setMensagem({
          tom: 'success',
          texto: 'Backup restaurado com sucesso. Abra a aba Pacientes para conferir os dados.',
        });
      }
    } catch (erro) {
      setPendente(null);
      setMensagem({
        tom: 'danger',
        texto:
          erro instanceof Error && erro.message
            ? erro.message
            : 'Não foi possível concluir a restauração. Confira os dados antes de repetir a operação.',
      });
    } finally {
      setImportando(false);
    }
  }, [container, nucleoNoServidor, pendente]);

  const escolherArquivoConverter = useCallback(() => {
    setMensagem(null);
    inputConverterRef.current?.click();
  }, []);

  const arquivoAntigoSelecionado = useCallback(async (evento: ChangeEvent<HTMLInputElement>) => {
    const arquivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!arquivo) return;
    setMensagem(null);

    if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO_BYTES) {
      setMensagem({ tom: 'danger', texto: 'Este arquivo é maior do que o aceito. Nenhum dado foi alterado.' });
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(await arquivo.text());
    } catch {
      setMensagem({ tom: 'danger', texto: 'Não foi possível ler este arquivo como JSON.' });
      return;
    }

    if (pareceEnvelopeCriptografado(json)) {
      setMensagem({ tom: 'danger', texto: 'Este arquivo já está no formato criptografado — não precisa converter.' });
      return;
    }

    const analise = analisarBackup(json);
    if (!analise.ok) {
      setMensagem({ tom: 'danger', texto: analise.mensagem });
      return;
    }
    setSenhaConverter('');
    setConfirmarSenhaConverter('');
    setErroSenhaConverter(null);
    setArquivoParaConverter({ dados: analise.dados });
  }, []);

  const confirmarConverter = useCallback(async () => {
    if (!arquivoParaConverter) return;
    if (senhaConverter.length < TAMANHO_MINIMO_SENHA_BACKUP) {
      setErroSenhaConverter(`Use uma senha de pelo menos ${TAMANHO_MINIMO_SENHA_BACKUP} caracteres.`);
      return;
    }
    if (senhaConverter !== confirmarSenhaConverter) {
      setErroSenhaConverter('As duas senhas digitadas não são iguais.');
      return;
    }
    setErroSenhaConverter(null);
    setConvertendo(true);
    try {
      const envelope = await criptografarBackup(JSON.stringify(arquivoParaConverter.dados), senhaConverter);
      baixarArquivo(
        JSON.stringify(envelope),
        `backup-consultorio-${arquivoParaConverter.dados.exportadoEm.slice(0, 10)}${EXTENSAO_BACKUP_CRIPTOGRAFADO}`,
      );
      setArquivoParaConverter(null);
      setSenhaConverter('');
      setConfirmarSenhaConverter('');
      setMensagem({
        tom: 'success',
        texto:
          'Cópia criptografada gerada e baixada. O arquivo antigo (sem criptografia) não foi apagado nem alterado — ' +
          'decida você se quer removê-lo depois de confirmar que a nova cópia abre com a senha escolhida.',
      });
    } finally {
      setConvertendo(false);
    }
  }, [arquivoParaConverter, senhaConverter, confirmarSenhaConverter]);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Configurações do consultório</h1><AtalhosOrganizacao /><p className="demo-nota">Esta é uma demonstração. Você pode explorar os tutoriais, o catálogo e os horários. Backup, notificações do aparelho e integrações externas não são ativados aqui. Para entender o atendimento, use Simular atendimento.</p>
        <p className="text-sm text-neutral-600">
          Veja onde cada tipo de dado fica guardado, exporte uma cópia de segurança (backup), ou restaure uma cópia
          salva antes.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Passo a passo simples de abrir, parar e fazer backup do sistema: arquivo{' '}
          <strong>GUIA-RAPIDO.md</strong>, na pasta do sistema.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Aprender a usar o sistema</h2>
        <p className="text-sm text-neutral-600">Conheça cada recurso nas próprias telas, com os campos e botões destacados. Sem perguntas, sem alterar pacientes e sem enviar mensagens. Pode repetir quantas vezes quiser.</p>
        <Link className={buttonClassName('secondary', 'self-start')} to="/configuracoes/tutorial">Abrir tutorial interativo</Link>
      </Card>
      <AlterarSenhaClinica />

      {nucleoNoServidor && <AtivarNotificacoesAgendamento />}
      {nucleoNoServidor && <StatusGoogleCalendar />}
      <DescansoAgenda />

      <PainelSincronizacao />

      {nucleoNoServidor && <PainelMigracao />}
      {nucleoNoServidor && <PainelCopiasLocais />}

      {nucleoNoServidor && (
        <Card className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp automático
          </h2>
          <p className="text-sm text-neutral-600">
            Confirmações e lembretes de consulta que o servidor agenda sozinho quando a paciente marca pelo link de
            WhatsApp. Veja se há um provedor de envio configurado, quantas mensagens estão em cada status, e processe
            a fila na hora se precisar.
          </p>
          <Link to="/configuracoes/whatsapp-automatico" className={buttonClassName('secondary') + ' self-start'}>
            Abrir WhatsApp automático
          </Link>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <ClipboardList className="h-4 w-4" aria-hidden="true" /> Catálogo de procedimentos
        </h2>
        <p className="text-sm text-neutral-600">
          Procedimentos reutilizáveis com nome e preço padrão, pra preencher o orçamento mais rápido. Buscar, criar,
          editar e desativar — editar um preço aqui nunca muda orçamentos já criados.
        </p>
        <Link to="/configuracoes/catalogo-procedimentos" className={buttonClassName('secondary') + ' self-start'}>
          Abrir catálogo de procedimentos
        </Link>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <span data-tour="formularios-google"><ExternalLink className="inline h-4 w-4" aria-hidden="true" /> Links dos formulários do Google</span>
        </h2>
        <p className="text-sm text-neutral-600">
          Estes são os links que podem ser divulgados para pacientes (Instagram, WhatsApp, cartão digital, QR code).
        </p>
        <ul className="flex flex-col gap-2">
          {LINKS_FORMULARIOS_GOOGLE.map((formulario) => (
            <li key={formulario.nome} className="flex flex-wrap items-center gap-2">
              <span className="min-w-[11rem] text-sm font-medium text-neutral-800">{formulario.nome}</span>
              <a
                href={formulario.link}
                target="_blank"
                rel="noreferrer"
                className={buttonClassName('secondary')}
              >
                Abrir
              </a>
              <Button variant="secondary" onClick={() => void copiarLinkFormulario(formulario.nome, formulario.link)}>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                {linkCopiado === formulario.nome ? 'Copiado!' : 'Copiar link'}
              </Button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-neutral-500">
          O link de EDIÇÃO de cada formulário (só da Dra. Fernanda, nunca compartilhar com paciente) fica
          documentado só em <code>integracao-google-forms/README.md</code>, não aqui.
        </p>
      </Card>

      {nucleoNoServidor && <StatusSincronizacaoGoogleSheets />}

      {nucleoNoServidor && (
        <Card className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
            <Mail className="h-4 w-4" aria-hidden="true" /> Google Forms por e-mail{' '}
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-normal text-neutral-500">
              reforço
            </span>
          </h2>
          <p className="text-sm text-neutral-600">
            Desde que a sincronização automática por planilha existe, este caminho é só um <strong>reforço</strong> —
            use aqui apenas quando a sincronização acima estiver falhando ou ainda não tiver sido configurada. Cole o
            texto do e-mail que o Google manda quando o envio direto falha, pra não perder nenhuma resposta.
          </p>
          <Link to="/configuracoes/google-forms-email" className={buttonClassName('secondary') + ' self-start'}>
            Abrir Google Forms por e-mail
          </Link>
        </Card>
      )}

      <Alert tone="warning" title="O que este backup cobre">
        {nucleoNoServidor ? (
          <>
            O registro clínico (pacientes, agenda, planos, pagamentos, odontograma, evolução, WhatsApp, anamnese) vive
            no <strong>servidor da clínica</strong>; esta exportação baixa uma <strong>cópia portátil</strong> dele para
            você guardar offline. Isto inclui, pra cada pagamento, se ele TEM um comprovante anexado — mas não o
            arquivo em si (a foto/PDF): junto com anamnese pelo link e o conteúdo dos arquivos de paciente, o
            comprovante fica só no servidor — <code>npm run backup:servidor</code>.
          </>
        ) : (
          <>
            Tudo o que você cadastra (pacientes, agenda, anamnese, odontograma, planos, pagamentos, evolução) fica no
            armazenamento local deste navegador. Limpar os dados de navegação, trocar de computador/celular, ou
            desinstalar o navegador apaga essas informações permanentemente.
          </>
        )}{' '}
        <strong>Exporte um backup com regularidade</strong> e guarde o arquivo em um lugar seguro.
      </Alert>

      <Alert tone="danger" title="O arquivo de backup contém dados sensíveis">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            O .json exportado tem informações clínicas e financeiras dos pacientes (anamnese, odontograma, valores,
            pagamentos). Trate-o como um prontuário: não envie para serviços públicos, não deixe em pastas
            compartilhadas abertas. Prefira uma nuvem pessoal com senha, um pendrive guardado, ou e-mail só para você.
          </span>
        </div>
      </Alert>

      {mensagem && <Alert tone={mensagem.tom}>{mensagem.texto}</Alert>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
            <Download className="h-4 w-4" aria-hidden="true" /> Salvar cópia de segurança
          </h2>
          <p className="text-sm text-neutral-600">
            Gera um arquivo <strong>criptografado</strong> ({EXTENSAO_BACKUP_CRIPTOGRAFADO}) com <strong>todos</strong> os
            dados cadastrados até agora — pacientes (incluindo os arquivados), anamneses, odontograma, planos de
            tratamento, pagamentos, condições de pagamento e consultas — mais os metadados do arquivo (versão do
            formato, data/hora e contagem por coleção). Você escolhe a senha na hora.
          </p>
          <Button data-tour="backup-configuracoes" onClick={abrirDialogoExportar} loading={exportando} className="self-start">
            Baixar cópia protegida
          </Button>
          <details><summary className="cursor-pointer text-xs text-neutral-500">Opções avançadas de exportação</summary>
          <button
            type="button"
            onClick={() => void exportarSemCriptografia()}
            className="self-start text-xs text-neutral-500 underline hover:text-neutral-700"
          >
            Exportar sem proteção por senha (avançado)
          </button>
          </details>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
            <Upload className="h-4 w-4" aria-hidden="true" /> Recuperar uma cópia de segurança
          </h2>
          <p className="text-sm text-neutral-600">
            Escolha um arquivo {EXTENSAO_BACKUP_CRIPTOGRAFADO} (criptografado) ou .json (formato antigo, sem
            criptografia) exportado por este sistema. Ele é conferido antes de qualquer alteração: um arquivo de outro
            aplicativo, de uma versão futura, com senha errada, adulterado ou com formato inválido é recusado sem tocar
            nos seus dados. Quando o arquivo é válido, você vê o que ele contém e confirma antes de restaurar.
          </p>
          <input
            ref={inputArquivoRef}
            type="file"
            accept={`application/json,${EXTENSAO_BACKUP_CRIPTOGRAFADO}`}
            className="hidden"
            onChange={arquivoSelecionado}
          />
          <Button variant="secondary" onClick={escolherArquivo} className="self-start">
            Escolher cópia para conferir…
          </Button>
        </Card>
      </div>

      <details className="rounded-xl border border-neutral-200"><summary className="cursor-pointer p-4 text-sm font-semibold">Tenho uma cópia antiga e quero protegê-la</summary>
      <Card className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <FileLock2 className="h-4 w-4" aria-hidden="true" /> Converter um backup antigo
        </h2>
        <p className="text-sm text-neutral-600">
          Tem um arquivo .json de backup de antes desta versão (sem criptografia)? Escolha-o aqui para gerar uma cópia{' '}
          {EXTENSAO_BACKUP_CRIPTOGRAFADO} criptografada com uma senha nova — <strong>sem restaurar nada no sistema</strong>{' '}
          e sem apagar ou alterar o arquivo original.
        </p>
        <input
          ref={inputConverterRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={arquivoAntigoSelecionado}
        />
        <Button variant="secondary" onClick={escolherArquivoConverter} className="self-start">
          Escolher backup antigo…
        </Button>
      </Card>
      </details>

      <p className="text-xs text-neutral-500">Antes de recuperar uma cópia, confira o resumo apresentado pelo sistema. Nenhuma restauração começa sem sua confirmação.</p>

      <Dialog open={dialogoExportarAberto} onOpenChange={(aberto) => !aberto && setDialogoExportarAberto(false)}>
        <DialogContent>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <Lock className="h-5 w-5 text-brand-600" aria-hidden="true" />
            Escolha uma senha para este backup
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-2 flex flex-col gap-3 text-sm text-neutral-600">
              <p>
                Esta senha cifra o arquivo que será baixado. <strong>Guarde-a em local seguro</strong> — se você a
                perder, este sistema não tem nenhuma forma de recuperar o arquivo; não existe senha mestra nem reset.
              </p>
              <Field label="Senha" required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={senhaExportar}
                  onChange={(e) => setSenhaExportar(e.target.value)}
                />
              </Field>
              <Field label="Confirme a senha" required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmarSenhaExportar}
                  onChange={(e) => setConfirmarSenhaExportar(e.target.value)}
                />
              </Field>
              {erroSenhaExportar && (
                <p role="alert" className="text-xs text-danger-700">
                  {erroSenhaExportar}
                </p>
              )}
            </div>
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose className={buttonClassName('secondary')}>Cancelar</DialogClose>
            <Button onClick={confirmarExportarCriptografado} loading={exportando}>
              Gerar backup criptografado
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={envelopePendente !== null} onOpenChange={(aberto) => !aberto && setEnvelopePendente(null)}>
        <DialogContent>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <Lock className="h-5 w-5 text-brand-600" aria-hidden="true" />
            Senha deste backup
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-2 flex flex-col gap-3 text-sm text-neutral-600">
              <p>Este arquivo está criptografado. Digite a senha usada na exportação para continuar.</p>
              <Field label="Senha">
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={senhaRestaurar}
                  onChange={(e) => setSenhaRestaurar(e.target.value)}
                />
              </Field>
              {erroSenhaRestaurar && (
                <p role="alert" className="text-xs text-danger-700">
                  {erroSenhaRestaurar}
                </p>
              )}
            </div>
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose className={buttonClassName('secondary')}>Cancelar</DialogClose>
            <Button onClick={confirmarSenhaEDecifrar} loading={decifrando}>
              Decifrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={arquivoParaConverter !== null} onOpenChange={(aberto) => !aberto && setArquivoParaConverter(null)}>
        <DialogContent>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <FileLock2 className="h-5 w-5 text-brand-600" aria-hidden="true" />
            Escolha uma senha para a cópia criptografada
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-2 flex flex-col gap-3 text-sm text-neutral-600">
              <p>
                O arquivo original não será apagado nem alterado. <strong>Guarde esta senha nova</strong> — perdê-la
                torna a cópia criptografada irrecuperável (o arquivo antigo, sem senha, continuaria existindo).
              </p>
              <Field label="Senha" required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={senhaConverter}
                  onChange={(e) => setSenhaConverter(e.target.value)}
                />
              </Field>
              <Field label="Confirme a senha" required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmarSenhaConverter}
                  onChange={(e) => setConfirmarSenhaConverter(e.target.value)}
                />
              </Field>
              {erroSenhaConverter && (
                <p role="alert" className="text-xs text-danger-700">
                  {erroSenhaConverter}
                </p>
              )}
            </div>
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose className={buttonClassName('secondary')}>Cancelar</DialogClose>
            <Button onClick={confirmarConverter} loading={convertendo}>
              Gerar cópia criptografada
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pendente !== null} onOpenChange={(aberto) => !aberto && setPendente(null)}>
        <DialogContent>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <ShieldAlert className="h-5 w-5 text-warning-600" aria-hidden="true" />
            Confirmar restauração
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-2 flex flex-col gap-3 text-sm text-neutral-600">
              {pendente && (
                <p className="text-neutral-700">
                  Arquivo de <span className="font-medium">{pendente.dados.appNome}</span> · formato v
                  {pendente.dados.versao} · gerado em {formatarDataHoraIso(pendente.dados.exportadoEm)}.
                </p>
              )}
              {pendente && !pendente.criptografado && (
                <p className="font-medium text-danger-700">
                  Este arquivo NÃO está criptografado (formato antigo). Qualquer pessoa com acesso a ele podia ler os
                  dados diretamente — depois de restaurar, considere gerar um novo backup criptografado.
                </p>
              )}
              <p>Contém:</p>
              <ul className="list-inside list-disc">
                <li>{pendente?.resumo.pacientes} paciente(s)</li>
                <li>{pendente?.resumo.anamneses} anamnese(s)</li>
                <li>{pendente?.resumo.registrosDentais} registro(s) de odontograma</li>
                <li>{pendente?.resumo.planosTratamento} plano(s) de tratamento</li>
                <li>{pendente?.resumo.evolucoes} evolução(ões)</li>
                <li>{pendente?.resumo.consultas} consulta(s)</li>
                <li>{pendente?.resumo.registrosWhatsapp} ação(ões) de WhatsApp registrada(s)</li>
                <li>{pendente?.resumo.linksAnamnese} link(s) de anamnese</li>
                <li>{pendente?.resumo.arquivosPaciente} arquivo(s) de paciente (só a lista — o conteúdo não vai no backup)</li>
                <li>{pendente?.resumo.bloqueiosAgenda} dia(s) bloqueado(s) na agenda</li>
              </ul>
              {nucleoNoServidor ? (
                <p className="font-medium text-neutral-800">
                  Paciente deste arquivo que já existe aqui (mesmo id) <strong>nunca tem nenhum dado cadastral alterado</strong>{' '}
                  — nome, nascimento, CPF, RG, contato e endereço continuam exatamente como já estão; não existe um fluxo
                  de correção cadastral por restauração neste sistema. Consultas, planos, evolução, odontograma e
                  financeiro deste arquivo substituem o que tiver o mesmo identificador. Cadastros ausentes, inclusive os
                  excluídos com o mesmo identificador do backup, podem ser recuperados se não houver conflito com quem
                  já existe. Depois de confirmar, não dá para desfazer — em caso
                  de dúvida, cancele e exporte um backup do estado atual antes.
                </p>
              ) : (
                <p className="font-medium text-neutral-800">
                  Registros deste arquivo que tiverem o mesmo identificador de algo já cadastrado aqui serão substituídos
                  pelo conteúdo do arquivo. O restante dos dados já cadastrados neste aparelho não é apagado. A ação é
                  aplicada por inteiro ou nada; depois de confirmar, não dá para desfazer — em caso de dúvida, cancele e
                  exporte um backup do estado atual antes.
                </p>
              )}
            </div>
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose className={buttonClassName('secondary')}>Cancelar</DialogClose>
            <Button variant="danger" onClick={confirmarImportacao} loading={importando}>
              Restaurar agora
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
