import { useRef, useState } from 'react';
import type { ResumoCopiasLocais } from '../../../application/ports/porta-copias-locais.js';
import { Alert } from '../../components/ui/alert.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog.js';
import { useContainer } from '../../providers/container-provider.js';

export function PainelCopiasLocais() {
  const { copiasLocaisPaciente } = useContainer();
  const [resultado, setResultado] = useState<ResumoCopiasLocais | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const trava = useRef(false);
  async function executar(limpar: boolean) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setErro(null);
    try {
      setResultado(await (limpar ? copiasLocaisPaciente.limparIdenticos() : copiasLocaisPaciente.comparar()));
      setConfirmando(false);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível concluir. Nenhum dado foi removido.'); }
    finally { trava.current = false; setOcupado(false); }
  }
  return <Card className="flex flex-col gap-3">
    <h2 className="text-sm font-semibold">Cópias antigas neste navegador</h2>
    <p className="text-sm text-neutral-600">Confira se há cadastros antigos guardados só neste navegador. A comparação não altera nada e não exibe documentos. Esta ferramenta trata apenas as cópias de pacientes, não consultas, rascunhos ou outros arquivos.</p>
    <Button disabled={ocupado} variant="secondary" onClick={() => void executar(false)} className="self-start">{ocupado ? 'Conferindo…' : 'Comparar cópias deste navegador'}</Button>
    {erro && <Alert tone="warning">{erro}</Alert>}
    {resultado && <>
      <p className="text-sm">{resultado.total} cadastro(s) conferido(s): {resultado.identicos} idêntico(s), {resultado.divergentes} diferente(s), {resultado.ausentes} ausente(s) no servidor.</p>
      {Boolean(resultado.divergentes || resultado.ausentes) && <Alert tone="warning">Cadastros diferentes ou ausentes serão preservados neste navegador. Confira a migração com a manutenção antes de decidir qualquer alteração.</Alert>}
      {resultado.removidos !== undefined ? <p className="text-sm">{resultado.removidos} cópia(s) idêntica(s) removida(s). As cópias originais foram preservadas cifradas no servidor. Nenhum cadastro do servidor foi alterado.</p>
        : resultado.identicos > 0 && <Button disabled={ocupado} variant="secondary" onClick={() => setConfirmando(true)} className="self-start">Revisar limpeza das cópias idênticas</Button>}
    </>}
    <Dialog open={confirmando} onOpenChange={aberto => { if (!ocupado) setConfirmando(aberto); }}>
      <DialogContent>
        <DialogTitle>Preservar uma cópia e limpar este navegador?</DialogTitle>
        <DialogDescription>Primeiro será salva e verificada uma cópia cifrada no servidor. Depois, uma nova comparação permitirá remover somente registros completamente idênticos. Dados diferentes ou ausentes nunca serão apagados.</DialogDescription>
        <p className="text-sm">A recuperação da cópia protegida depende da chave de backup da clínica e do auxílio da manutenção. Esta ação não apaga pacientes do servidor.</p>
        {erro && <Alert tone="warning">{erro}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={ocupado} onClick={() => void executar(true)}>Preservar cópia e limpar idênticos</Button>
          <DialogClose asChild><Button variant="secondary" disabled={ocupado}>Cancelar</Button></DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  </Card>;
}
