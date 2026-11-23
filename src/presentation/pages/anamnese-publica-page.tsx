import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import type { SalvarAnamneseInput } from '../../domain/entities/anamnese.js';
import { anamneseFoiAlterada, criarAnamneseEmBranco } from '../../domain/entities/anamnese.js';
import { ErroDominio } from '../../domain/types.js';
import { ErroApi } from '../../application/ports/api-client.js';
import { CONFIGURACAO_CLINICA } from '../../infrastructure/bootstrap/configuracao-clinica.js';
import { Alert } from '../components/ui/alert.js';
import { Spinner } from '../components/ui/spinner.js';
import { FormularioAnamnese } from '../features/anamnese/formulario-anamnese.js';
import { useContainer } from '../providers/container-provider.js';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'recusado'; titulo: string; texto: string }
  | { fase: 'ja-respondido'; nome: string }
  | { fase: 'formulario'; nome: string; valoresIniciais: SalvarAnamneseInput }
  | { fase: 'enviado'; nome: string };

const RECUSA: Record<string, { titulo: string; texto: string }> = {
  'nao-encontrado': {
    titulo: 'Link inválido',
    texto: 'Este link de anamnese não foi reconhecido. Peça um link novo ao consultório.',
  },
  revogado: {
    titulo: 'Link cancelado',
    texto: 'Este link foi cancelado pelo consultório. Peça um link novo.',
  },
  expirado: {
    titulo: 'Link expirado',
    texto: 'Este link passou da validade. Peça um link novo ao consultório.',
  },
};

/**
 * Página pública da anamnese (Etapa 16) — aberta pelo link próprio do
 * paciente, FORA do sistema profissional (sem menu, sem outras fichas,
 * sem dados cadastrais). Só resolve o token, mostra o primeiro nome
 * para dar confiança, e o formulário. Toda a regra (token válido? de
 * quem?) vem dos casos de uso — `anamneseRemota.*` no modo
 * compartilhado (Etapa 18, servidor de `server/`) ou `linkAnamnese.*`
 * no modo local (protótipo, só o mesmo navegador).
 */
export function AnamnesePublicaPage() {
  const { token } = useParams<{ token: string }>();
  const container = useContainer();
  const remoto = container.sincronizacaoAnamnese;
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const sujoRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setEstado({ fase: 'recusado', ...RECUSA['nao-encontrado']! });
      return;
    }
    let cancelado = false;

    /** Trata a parte comum (recusa / já respondido); devolve o primeiro nome quando dá para preencher. */
    const aplicarComum = (
      r: { ok: false; motivo: string } | { ok: true; primeiroNomePaciente: string; podeResponder: boolean },
    ): string | null => {
      if (!r.ok) {
        setEstado({ fase: 'recusado', ...(RECUSA[r.motivo] ?? RECUSA['nao-encontrado']!) });
        return null;
      }
      if (!r.podeResponder) {
        setEstado({ fase: 'ja-respondido', nome: r.primeiroNomePaciente });
        return null;
      }
      return r.primeiroNomePaciente;
    };

    async function carregar(): Promise<void> {
      if (remoto) {
        const r = await container.anamneseRemota.abrirPublica.executar(token!);
        if (cancelado) return;
        const nome = aplicarComum(r);
        // O modo remoto não devolve template — a página monta o formulário em branco.
        if (nome !== null) setEstado({ fase: 'formulario', nome, valoresIniciais: criarAnamneseEmBranco('') });
      } else {
        const r = await container.linkAnamnese.abrirPorToken.executar(token!);
        if (cancelado) return;
        const nome = aplicarComum(r);
        if (nome !== null) setEstado({ fase: 'formulario', nome, valoresIniciais: r.ok ? r.valoresIniciais : criarAnamneseEmBranco('') });
      }
    }

    carregar().catch(() => {
      if (!cancelado) setEstado({ fase: 'recusado', ...RECUSA['nao-encontrado']! });
    });
    return () => {
      cancelado = true;
    };
  }, [container, token, remoto]);

  // Aviso do navegador se o paciente tentar sair com o formulário começado.
  useEffect(() => {
    function aoSair(evento: BeforeUnloadEvent): void {
      if (!sujoRef.current) return;
      evento.preventDefault();
      evento.returnValue = '';
    }
    window.addEventListener('beforeunload', aoSair);
    return () => window.removeEventListener('beforeunload', aoSair);
  }, []);

  const registrarMudanca = useCallback(
    (valores: SalvarAnamneseInput) => {
      if (estado.fase !== 'formulario') return;
      sujoRef.current = anamneseFoiAlterada(estado.valoresIniciais, valores);
    },
    [estado],
  );

  async function enviar(valores: SalvarAnamneseInput): Promise<void> {
    if (!token) return;
    setEnviando(true);
    setErroEnvio(null);
    try {
      if (remoto) await container.anamneseRemota.submeterPublica.executar(token, valores);
      else await container.linkAnamnese.submeterPorToken.executar(token, valores);
      sujoRef.current = false;
      setEstado((atual) => ({ fase: 'enviado', nome: atual.fase === 'formulario' ? atual.nome : '' }));
    } catch (erro) {
      // Link revogado/expirado/já respondido entre abrir e enviar → recusa clara.
      if (erro instanceof ErroApi && erro.status === 409) {
        setEstado({
          fase: 'recusado',
          ...(RECUSA[erro.codigo ?? ''] ?? {
            titulo: 'Link indisponível',
            texto: 'Este link não aceita mais respostas. Peça um link novo ao consultório.',
          }),
        });
        return;
      }
      setErroEnvio(
        erro instanceof ErroDominio
          ? erro.message
          : 'Não foi possível enviar suas respostas. Verifique sua conexão e tente de novo.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1 border-b border-neutral-200 pb-3">
        <p className="text-sm font-semibold text-brand-800 dark:text-brand-300">{CONFIGURACAO_CLINICA.nomeClinica}</p>
        <p className="text-xs text-neutral-500">
          {CONFIGURACAO_CLINICA.nomeProfissional} · {CONFIGURACAO_CLINICA.registroProfissional}
        </p>
      </header>

      {estado.fase === 'carregando' && (
        <div className="flex justify-center py-16">
          <Spinner label="Abrindo sua ficha…" />
        </div>
      )}

      {estado.fase === 'recusado' && (
        <Alert tone="danger" title={estado.titulo}>
          {estado.texto}
        </Alert>
      )}

      {estado.fase === 'ja-respondido' && (
        <Alert tone="success" title={`Obrigado, ${estado.nome}!`}>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Já recebemos suas respostas. Não é preciso enviar de novo — a Dra. Fernanda vai revisar antes da consulta.</span>
          </div>
        </Alert>
      )}

      {estado.fase === 'enviado' && (
        <Alert tone="success" title={estado.nome ? `Recebido, ${estado.nome}!` : 'Recebido!'}>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Suas respostas foram enviadas para o consultório. Você já pode fechar esta página.</span>
          </div>
        </Alert>
      )}

      {estado.fase === 'formulario' && (
        <>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Anamnese — histórico de saúde</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Olá, <span className="font-medium text-neutral-900">{estado.nome}</span>. Responda com calma; leva poucos
              minutos. Nada é obrigatório, mas quanto mais completo, melhor para o seu atendimento.
            </p>
          </div>
          <p className="flex items-start gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Suas respostas vão direto para a ficha da Dra. Fernanda e não são compartilhadas com mais ninguém.
          </p>
          {erroEnvio && <Alert tone="danger">{erroEnvio}</Alert>}
          <FormularioAnamnese
            valoresIniciais={estado.valoresIniciais}
            nomePaciente={estado.nome}
            carregando={enviando}
            rotuloSalvar="Enviar minhas respostas"
            mostrarPontosDeAtencao={false}
            onSalvar={(valores) => void enviar(valores)}
            onAlterar={registrarMudanca}
          />
        </>
      )}

      <footer className="mt-auto flex items-center gap-1.5 pt-4 text-xs text-neutral-400">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Página segura do consultório — você só vê a sua própria anamnese.
      </footer>
    </div>
  );
}
