import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import type { MensagemWhatsappPreparada } from '../../../application/use-cases/whatsapp.js';
import type { TipoAcaoWhatsapp } from '../../../domain/entities/registro-whatsapp.js';
import { MENSAGEM_INDISPONIBILIDADE_WHATSAPP } from '../../../domain/value-objects/whatsapp.js';
import { Alert } from '../../../../../src/presentation/components/ui/alert.js';
import { buttonClassName } from '../../../../../src/presentation/components/ui/button.js';
import { cn } from '../../../../../src/presentation/lib/cn.js';

/**
 * Botão do MVP manual de WhatsApp (Fase 1). Fluxo, todo local, nada
 * enviado pelo app:
 *   1. `preparar()` → checa consentimento + número; devolve `{ texto, url,
 *      disponibilidade, houveEnvioRecente, tipo, numeroNormalizado }`.
 *   2. Se não liberado, mostra o motivo e para.
 *   3. Se já houve uma ação do mesmo tipo hoje, pede confirmação.
 *   4. Abre o `wa.me` (nova aba) e chama `aoAbrir()` para gravar o
 *      histórico. O texto da mensagem nunca é logado.
 */
export function BotaoWhatsapp({
  preparar,
  aoAbrir,
  rotulo = 'WhatsApp',
  variante = 'link',
  className,
}: {
  preparar: () => Promise<MensagemWhatsappPreparada>;
  aoAbrir: (numeroNormalizado: string, tipo: TipoAcaoWhatsapp) => Promise<void>;
  rotulo?: string;
  variante?: 'link' | 'secondary';
  className?: string;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendenteRepeticao, setPendenteRepeticao] = useState<MensagemWhatsappPreparada | null>(null);

  async function abrir(preparada: MensagemWhatsappPreparada): Promise<void> {
    if (preparada.url) {
      window.open(preparada.url, '_blank', 'noopener,noreferrer');
    }
    if (preparada.numeroNormalizado) {
      await aoAbrir(preparada.numeroNormalizado, preparada.tipo);
    }
    setPendenteRepeticao(null);
  }

  async function clicar(): Promise<void> {
    setOcupado(true);
    setErro(null);
    setPendenteRepeticao(null);
    try {
      const preparada = await preparar();
      if (!preparada.disponibilidade.liberado) {
        setErro(MENSAGEM_INDISPONIBILIDADE_WHATSAPP[preparada.disponibilidade.motivo]);
        return;
      }
      if (preparada.houveEnvioRecente) {
        setPendenteRepeticao(preparada);
        return;
      }
      await abrir(preparada);
    } catch {
      setErro('Não foi possível preparar a mensagem de WhatsApp.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1 self-start">
      <button
        type="button"
        onClick={() => void clicar()}
        disabled={ocupado}
        title="Abre o WhatsApp com a mensagem pronta — você confere e envia. Não inclua dados clínicos."
        className={
          variante === 'secondary'
            ? buttonClassName('secondary', cn('text-sm', className))
            : cn(
                'inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline dark:text-brand-400',
                className,
              )
        }
      >
        <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {rotulo}
      </button>

      {erro && <span className="text-xs text-danger-600 dark:text-danger-500">{erro}</span>}

      {pendenteRepeticao && (
        <Alert tone="warning" className="text-xs">
          <span className="block">
            Já foi preparada uma mensagem deste tipo para este paciente hoje. Preparar outra?
          </span>
          <span className="mt-1 flex gap-3">
            <button
              type="button"
              onClick={() => void abrir(pendenteRepeticao)}
              className="font-medium text-brand-700 hover:underline dark:text-brand-400"
            >
              Preparar mesmo assim
            </button>
            <button
              type="button"
              onClick={() => setPendenteRepeticao(null)}
              className="font-medium text-neutral-600 hover:underline"
            >
              Cancelar
            </button>
          </span>
        </Alert>
      )}
    </span>
  );
}
