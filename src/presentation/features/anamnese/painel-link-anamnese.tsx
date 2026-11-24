import { RespostaAnamneseRecebida } from './resposta-anamnese-recebida.js';
import { useState } from 'react';
import { Copy, ExternalLink, Link2 } from 'lucide-react';
import type { Paciente } from '../../../domain/entities/paciente.js';
import { LINK_FORMS_ANAMNESE } from '../../../domain/value-objects/link-forms-anamnese.js';
import { Alert } from '../../components/ui/alert.js';
import { Button, buttonClassName } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Input } from '../../components/ui/input.js';
import { useContainer } from '../../providers/container-provider.js';
import { BotaoWhatsapp } from '../../../../whatsapp-itens/src/presentation/features/whatsapp/botao-whatsapp.js';

export function PainelLinkAnamnese({ paciente,aoImportar,podeAplicar=true }: { paciente: Paciente; aoImportar?: () => void|Promise<void>;podeAplicar?:boolean }) {
  const container = useContainer();
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState(false);
  async function copiar() {
    try { await navigator.clipboard.writeText(LINK_FORMS_ANAMNESE); setCopiado(true); setErro(false); }
    catch { setErro(true); }
  }
  return <><div className="no-print"><RespostaAnamneseRecebida pacienteId={paciente.id} podeAplicar={podeAplicar} aoAplicar={aoImportar}/></div><Card className="no-print flex flex-col gap-3">
    <h2 className="flex items-center gap-2 text-sm font-semibold"><Link2 className="h-4 w-4" aria-hidden="true" />Anamnese pelo paciente</h2>
    <p className="text-sm text-neutral-600">Envie o formulário para o paciente preencher o histórico de saúde. Peça que informe o mesmo CPF, RG ou celular cadastrado na clínica.</p>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input readOnly value={LINK_FORMS_ANAMNESE} aria-label="Link da anamnese" className="text-xs" />
      <Button variant="secondary" onClick={() => void copiar()}><Copy className="h-4 w-4" aria-hidden="true" />{copiado ? 'Copiado!' : 'Copiar'}</Button>
      <a href={LINK_FORMS_ANAMNESE} target="_blank" rel="noopener noreferrer" className={buttonClassName('secondary')}><ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir</a>
    </div>
    {erro && <Alert tone="warning">Não foi possível copiar automaticamente. Selecione e copie o endereço acima.</Alert>}
    <BotaoWhatsapp variante="secondary" rotulo="Enviar link pelo WhatsApp"
      preparar={() => container.whatsapp.prepararLinkAnamnese.executar(paciente.id, window.location.origin, null)}
      aoAbrir={async (numeroNormalizado, tipo) => { await container.whatsapp.registrarAbertura.executar({ pacienteId: paciente.id, numeroNormalizado, tipo }); }} />
    <p className="text-xs text-neutral-500">As respostas dependem da sincronização do Google Forms e da identificação do paciente. Confira a anamnese recebida antes do atendimento.</p>
  </Card></>;
}
