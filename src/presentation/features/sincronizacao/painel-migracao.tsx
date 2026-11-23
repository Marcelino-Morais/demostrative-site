import { useCallback, useEffect, useState } from 'react';
import { ArrowUpFromLine, Check } from 'lucide-react';
import type { PlanoMigracaoNucleo } from '../../../application/use-cases/migracao-nucleo.js';
import {
  COLECOES_NUCLEO,
  ROTULO_COLECAO_NUCLEO,
  type ColecaoNucleo,
  type ResultadoMigracaoNucleo,
} from '../../../application/ports/gateway-nucleo.js';
import { Alert } from '../../components/ui/alert.js';
import { Button, buttonClassName } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog.js';
import { Spinner } from '../../components/ui/spinner.js';
import { mensagemDeErro } from '../../lib/erros.js';
import { useContainer } from '../../providers/container-provider.js';
import { useSincronizacao } from '../../providers/sincronizacao-provider.js';

/**
 * Migração manual do NÚCLEO clínico do `localStorage` deste navegador
 * para o servidor da clínica (Etapas 21–22): pacientes, agenda, planos
 * de tratamento, pagamentos, odontograma, evolução, histórico de
 * WhatsApp e o registro de anamnese. Só aparece quando o modo
 * compartilhado do núcleo está ligado. Mostra as contagens ANTES, pede
 * confirmação, e o servidor grava só o que ainda não está lá — nunca
 * sobrescreve, então repetir é seguro. Só chama `container.migracao.*`.
 */
export function PainelMigracao() {
  const container = useContainer();
  const { revalidar } = useSincronizacao();
  const [plano, setPlano] = useState<PlanoMigracaoNucleo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [migrando, setMigrando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoMigracaoNucleo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const planejar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    container.migracao.planejar
      .executar()
      .then(setPlano)
      .catch(() => setErro('Não foi possível verificar os dados a migrar.'))
      .finally(() => setCarregando(false));
  }, [container]);

  useEffect(() => {
    planejar();
  }, [planejar]);

  async function confirmar(): Promise<void> {
    setMigrando(true);
    setErro(null);
    try {
      const r = await container.migracao.migrar.executar();
      setResultado(r);
      setConfirmando(false);
      planejar();
      revalidar();
    } catch (e) {
      setConfirmando(false);
      setErro(mensagemDeErro(e, 'Não foi possível migrar os dados agora.'));
    } finally {
      setMigrando(false);
    }
  }

  const linhasComDados: ColecaoNucleo[] = plano
    ? COLECOES_NUCLEO.filter((c) => plano.local[c] > 0 || (plano.servidor?.[c] ?? 0) > 0)
    : [];

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
        <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" /> Migrar dados para o servidor da clínica
      </h2>

      {carregando && (
        <div className="flex justify-center py-4">
          <Spinner label="Verificando…" />
        </div>
      )}

      {!carregando && plano && !plano.servidorDisponivel && (
        <Alert tone="warning">
          O servidor da clínica não respondeu. Suba o servidor (<code>npm start</code>) e recarregue para migrar.
        </Alert>
      )}

      {!carregando && plano && plano.servidorDisponivel && !plano.temLocalParaMigrar && (
        <p className="text-sm text-neutral-600">
          Nenhum registro guardado só neste navegador — nada a migrar. Tudo o que você cadastrar já vai direto para o
          servidor.
        </p>
      )}

      {!carregando && plano && plano.servidorDisponivel && plano.temLocalParaMigrar && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-600">
            Estes registros estão guardados <strong>neste navegador</strong> e podem ser enviados ao servidor:
          </p>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-neutral-700 sm:grid-cols-2">
            {linhasComDados.map((c) => (
              <li key={c} className="flex justify-between gap-3 border-b border-neutral-100 py-1">
                <span className="capitalize">{ROTULO_COLECAO_NUCLEO[c]}</span>
                <span className="text-neutral-500">
                  aqui {plano.local[c]} · servidor {plano.servidor?.[c] ?? 0}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-500">
            Migrar envia para o servidor os registros que <strong>ainda não estão lá</strong> — nunca sobrescreve nada,
            e repetir é seguro. Os identificadores são preservados, então links de anamnese e arquivos continuam
            apontando para os mesmos pacientes.
          </p>
          <Button onClick={() => setConfirmando(true)} className="self-start">
            Migrar agora
          </Button>
        </div>
      )}

      {resultado && (
        <Alert tone="success">
          <span className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {resultado.gravados} registro(s) enviados ao servidor. {resultado.ignorados} já estavam lá (nada foi
              sobrescrito).
            </span>
          </span>
        </Alert>
      )}

      {erro && <Alert tone="danger">{erro}</Alert>}

      <Dialog open={confirmando} onOpenChange={(aberto) => !aberto && setConfirmando(false)}>
        <DialogContent>
          <DialogTitle className="text-base font-semibold text-neutral-900">Migrar para o servidor da clínica?</DialogTitle>
          <DialogDescription asChild>
            <div className="mt-2 flex flex-col gap-2 text-sm text-neutral-600">
              <p>
                Vão ser enviados os registros deste navegador que ainda não existem no servidor (pacientes, agenda,
                planos, pagamentos, odontograma, evolução, WhatsApp, anamnese). Nada é apagado nem sobrescrito — os
                registros locais continuam onde estão, e passam a ter uma cópia no servidor, que vira a fonte de
                verdade.
              </p>
              <p>Você pode repetir esta ação sem risco: a segunda vez não envia nada de novo.</p>
            </div>
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose className={buttonClassName('secondary')}>Cancelar</DialogClose>
            <Button onClick={() => void confirmar()} loading={migrando}>
              Migrar agora
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
