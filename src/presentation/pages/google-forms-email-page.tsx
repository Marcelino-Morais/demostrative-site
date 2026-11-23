import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ClipboardPaste, Mail } from 'lucide-react';
import { ErroApi } from '../../application/ports/api-client.js';
import type {
  PreVisualizacaoImportacaoEmail,
  TipoRespostaGoogleForms,
} from '../../application/ports/porta-google-forms-email.js';
import { Alert } from '../components/ui/alert.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Textarea } from '../components/ui/input.js';
import { useStatusSincronizacaoGoogleSheets } from '../features/google-sheets-sync/usar-status-sincronizacao.js';
import { useContainer } from '../providers/container-provider.js';

const ROTULO_TIPO: Record<TipoRespostaGoogleForms, string> = {
  'ficha-inicial': 'Ficha inicial (paciente novo)',
  anamnese: 'Anamnese',
  agendamento: 'Agendamento de consulta',
};

/** Rótulo amigável só pros campos mais comuns — o resto aparece com o próprio nome. */
const ROTULO_CAMPO: Record<string, string> = {
  identificador: 'CPF, RG ou celular',
  nomeCompleto: 'Nome completo',
  cpf: 'CPF',
  rg: 'RG',
  celular: 'Celular',
  dataNascimento: 'Data de nascimento',
  endereco: 'Endereço',
  email: 'E-mail',
  aceitaWhatsapp: 'Aceita WhatsApp',
  data: 'Data desejada',
  horario: 'Horário desejado',
  motivo: 'Motivo',
  ehEmergencia: 'É emergência',
};

function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '(em branco)';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (typeof valor === 'object') return '(respostas detalhadas — confira na ficha da paciente depois de importar)';
  return String(valor);
}

function PreVisualizacaoCard({ preVisualizacao }: { preVisualizacao: PreVisualizacaoImportacaoEmail }) {
  const campos = Object.entries(preVisualizacao.dados).filter(([chave]) => chave !== 'respostas');
  const temRespostasAnamnese = 'respostas' in preVisualizacao.dados;
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-neutral-700">{ROTULO_TIPO[preVisualizacao.tipo]}</h2>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        {campos.map(([chave, valor]) => (
          <div key={chave}>
            <dt className="text-xs text-neutral-500">{ROTULO_CAMPO[chave] ?? chave}</dt>
            <dd className="text-neutral-800">{formatarValor(valor)}</dd>
          </div>
        ))}
      </dl>
      {temRespostasAnamnese && (
        <p className="text-xs text-neutral-500">
          As respostas da anamnese vieram completas — depois de importar, reveja e ajuste normalmente na aba Anamnese
          da paciente, do mesmo jeito de sempre.
        </p>
      )}
    </Card>
  );
}

/**
 * Tela "Google Forms por e-mail" (Etapa 53) — caminho alternativo ao
 * webhook direto enquanto o servidor da clínica não tem endereço
 * alcançável da internet (ver `docs/google-forms-email-comparacao.md`
 * e `integracao-google-forms/README.md`). Quando o envio direto falha,
 * o Apps Script manda um e-mail com um bloco de dados; esta tela deixa
 * colar esse texto, conferir o que foi entendido (sem gravar nada), e
 * só então importar de verdade. Nunca decide sozinha se os dados são
 * válidos — isso é sempre o servidor, com a MESMA regra do webhook.
 */
export function GoogleFormsEmailPage() {
  const container = useContainer();
  const { status: statusSincronizacao } = useStatusSincronizacaoGoogleSheets();

  const [texto, setTexto] = useState('');
  const [preVisualizacao, setPreVisualizacao] = useState<PreVisualizacaoImportacaoEmail | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [sucesso, setSucesso] = useState<{ jaImportadoAntes: boolean; jaImportadoPorOutroCaminho: boolean } | null>(
    null,
  );

  async function analisar() {
    setErro(null);
    setSucesso(null);
    setPreVisualizacao(null);
    setAnalisando(true);
    try {
      const resultado = await container.googleFormsEmail.analisar.executar(texto);
      setPreVisualizacao(resultado);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível analisar este e-mail.');
    } finally {
      setAnalisando(false);
    }
  }

  async function importar() {
    setErro(null);
    setImportando(true);
    try {
      const resultado = await container.googleFormsEmail.importar.executar(texto);
      setSucesso(resultado);
      setPreVisualizacao(null);
      setTexto('');
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível importar este e-mail.');
    } finally {
      setImportando(false);
    }
  }

  function limpar() {
    setTexto('');
    setPreVisualizacao(null);
    setErro(null);
    setSucesso(null);
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Link
          to="/configuracoes"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar
        </Link>
      </div>
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-neutral-900">
          <Mail className="h-5 w-5" aria-hidden="true" /> Google Forms por e-mail
        </h1>
        <p className="text-sm text-neutral-600">
          Enquanto o sistema não tem um endereço acessível pela internet, uma resposta de Google Forms que não chegou
          sozinha é mandada pra sua caixa de e-mail. O sistema não lê essa caixa sozinho — abra o e-mail, copie o
          texto e cole abaixo. Nada é gravado até você clicar em "Importar".
        </p>
      </div>

      {statusSincronizacao?.configurado && (
        <Alert tone="brand" title="Este caminho agora é só um reforço">
          A sincronização automática por planilha já está ativa e cuida da maioria das respostas sozinha. Use esta
          tela só quando ela estiver falhando (confira em Configurações) ou pra uma resposta específica que não
          apareceu — colar aqui uma resposta que a sincronização já importou não duplica nada, o sistema avisa e
          recusa com segurança.
        </Alert>
      )}

      <Card className="flex flex-col gap-3">
        <label htmlFor="texto-email-google-forms" className="text-sm font-medium text-neutral-700">
          Texto do e-mail
        </label>
        <Textarea
          id="texto-email-google-forms"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setPreVisualizacao(null);
            setSucesso(null);
          }}
          placeholder='Cole aqui o e-mail inteiro (ou só o trecho entre "===INICIO-DADOS-CLINICA===" e "===FIM-DADOS-CLINICA===").'
          className="min-h-40"
        />
        <p className="text-xs text-neutral-500">
          Pode colar o e-mail inteiro, sem precisar recortar nada — ou, se preferir, só o trecho entre as linhas{' '}
          <span className="whitespace-nowrap">"===INICIO-DADOS-CLINICA==="</span> e{' '}
          <span className="whitespace-nowrap">"===FIM-DADOS-CLINICA==="</span> (essas duas linhas incluídas).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={analisar} loading={analisando} disabled={!texto.trim()} className="gap-2">
            <ClipboardPaste className="h-4 w-4" aria-hidden="true" /> Analisar
          </Button>
          {(texto || preVisualizacao || erro || sucesso) && (
            <Button variant="secondary" onClick={limpar} disabled={analisando || importando}>
              Limpar
            </Button>
          )}
        </div>
      </Card>

      {erro && <Alert tone="danger">{erro}</Alert>}

      {sucesso && (
        <Alert tone="success" title="Importado">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            {sucesso.jaImportadoPorOutroCaminho
              ? 'Esta resposta já tinha entrado sozinha pela sincronização automática — nada foi duplicado.'
              : sucesso.jaImportadoAntes
                ? 'Esta resposta já tinha sido importada antes — nada foi duplicado.'
                : 'Dados gravados no sistema com sucesso.'}
          </span>
        </Alert>
      )}

      {preVisualizacao && (
        <>
          {preVisualizacao.jaImportadoAntes ? (
            <Alert tone="warning">
              {preVisualizacao.jaImportadoPorOutroCaminho
                ? 'Esta resposta já entrou sozinha pela sincronização automática (ou pelo envio direto) — não precisa colar este e-mail. Se importar mesmo assim, o sistema recusa com segurança, sem duplicar.'
                : 'Esta resposta já foi importada antes. Nada foi gravado agora só de analisar — se quiser importar de novo mesmo assim, não tem problema, o sistema não duplica.'}
            </Alert>
          ) : (
            <p className="text-xs text-neutral-500">
              Nada foi gravado ainda — confira os dados abaixo antes de clicar em "Importar".
            </p>
          )}
          <PreVisualizacaoCard preVisualizacao={preVisualizacao} />
          <Button onClick={importar} loading={importando} className="self-start">
            Importar
          </Button>
        </>
      )}
    </div>
  );
}
