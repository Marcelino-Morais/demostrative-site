import { ErroApi } from '../../application/ports/api-client.js';
import type {
  PortaGoogleFormsEmail,
  PreVisualizacaoImportacaoEmail,
  ResultadoImportacaoEmail,
  TipoRespostaGoogleForms,
} from '../../application/ports/porta-google-forms-email.js';

const TIPOS: TipoRespostaGoogleForms[] = ['ficha-inicial', 'anamnese', 'agendamento'];

function ehTipoValido(v: unknown): v is TipoRespostaGoogleForms {
  return typeof v === 'string' && (TIPOS as string[]).includes(v);
}

/** Mesmas mensagens amigáveis que a Dra. Fernanda já vê em situações parecidas no resto do app. */
const MENSAGENS_ERRO: Record<string, string> = {
  'bloco-nao-encontrado':
    'Não encontrei o bloco de dados nesse texto — confira se copiou tudo, das linhas "===INICIO-DADOS-CLINICA===" até "===FIM-DADOS-CLINICA===".',
  'json-invalido': 'O bloco de dados está corrompido — copie o e-mail de novo, sem editar o texto.',
  'tipo-desconhecido': 'Não entendi de qual formulário essa resposta veio — copie o e-mail de novo, sem editar o texto.',
  'id-resposta-ausente': 'Esse bloco de dados está incompleto — copie o e-mail de novo, sem editar o texto.',
  'paciente-nao-encontrado': 'Não foi encontrada nenhuma paciente cadastrada com o CPF/RG/celular informado no formulário.',
  validacao: 'O sistema recusou os dados desse formulário — confira se todos os campos obrigatórios foram preenchidos.',
  'conflito-horario': 'Já existe uma consulta marcada nesse mesmo horário.',
  'dia-bloqueado': 'Este dia está bloqueado na agenda da clínica (feriado, recesso, etc.).',
};

/**
 * Adaptador HTTP da importação de Google Forms por e-mail (Etapa 53).
 * Mesmo molde de `HttpWhatsappAutomatico`/`HttpNucleoApi`: autenticado
 * com o MESMO Bearer da SPA (nunca o token dedicado do Google Forms —
 * quem chama aqui é a Dra. Fernanda pela própria tela, não o Google).
 */
export class HttpGoogleFormsEmail implements PortaGoogleFormsEmail {
  private readonly base: string;
  private readonly token: string;

  constructor(baseUrl: string, tokenApi: string) {
    this.base = baseUrl.replace(/\/$/, '');
    this.token = tokenApi;
  }

  private async chamar(textoEmail: string, dryRun: boolean): Promise<Response> {
    try {
      return await fetch(`${this.base}/api/integracoes/google-forms/importar-email`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ textoEmail, dryRun }),
      });
    } catch {
      throw new ErroApi('Sem conexão com o servidor da clínica.', 0);
    }
  }

  private async falhar(r: Response): Promise<never> {
    let codigo: string | undefined;
    try {
      const c = (await r.json()) as { erro?: { codigo?: string } };
      codigo = c.erro?.codigo;
    } catch {
      /* corpo não-JSON */
    }
    const msg = (codigo && MENSAGENS_ERRO[codigo]) || `Erro ${r.status} ao processar o e-mail.`;
    throw new ErroApi(msg, r.status, codigo);
  }

  async analisar(textoEmail: string): Promise<PreVisualizacaoImportacaoEmail> {
    const r = await this.chamar(textoEmail, true);
    if (!r.ok) return this.falhar(r);
    const corpo = (await r.json()) as Record<string, unknown>;
    if (!ehTipoValido(corpo.tipo) || typeof corpo.idResposta !== 'string') {
      throw new ErroApi('Resposta inesperada do servidor ao analisar o e-mail.', r.status);
    }
    const dados = corpo.dados && typeof corpo.dados === 'object' && !Array.isArray(corpo.dados) ? (corpo.dados as Record<string, unknown>) : {};
    return {
      tipo: corpo.tipo,
      idResposta: corpo.idResposta,
      jaImportadoAntes: corpo.jaImportadoAntes === true,
      jaImportadoPorOutroCaminho: corpo.jaImportadoPorOutroCaminho === true,
      dados,
    };
  }

  async importar(textoEmail: string): Promise<ResultadoImportacaoEmail> {
    const r = await this.chamar(textoEmail, false);
    if (!r.ok) return this.falhar(r);
    // Sucesso de anamnese não devolve corpo (204) — só o status 2xx já
    // confirma que gravou; `jaImportadoAntes` só existe no atalho de
    // deduplicação (200 com corpo), nunca precisa dele pra saber que
    // deu certo.
    const corpo = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    return {
      jaImportadoAntes: corpo?.jaImportadoAntes === true,
      jaImportadoPorOutroCaminho: corpo?.jaImportadoPorOutroCaminho === true,
    };
  }
}
