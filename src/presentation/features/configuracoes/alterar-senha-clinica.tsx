import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Alert } from '../../components/ui/alert.js';
import { Button, buttonClassName } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog.js';
import { Field } from '../../components/ui/field.js';
import { Input } from '../../components/ui/input.js';
import { useStatusAcessoClinica } from '../../lib/usar-acesso-clinica.js';

const MENSAGEM_POR_CODIGO: Record<string, string> = {
  'sessao-clinica-necessaria': 'Sua sessão expirou. Atualize a página e entre novamente antes de trocar a senha.',
  'senha-atual-incorreta': 'Senha atual incorreta.',
  'confirmacao-divergente': 'A nova senha e a confirmação não são iguais.',
  'senha-invalida': 'Use pelo menos 8 caracteres, com letras e números.',
  'senha-nao-configurada': 'Nenhuma senha da clínica configurada ainda.',
};

/**
 * Troca a senha do "modo clínica" (`server/acesso.mjs` — senha local +
 * sessão por cookie, SEPARADA do token de API). Só aparece quando essa
 * senha já existe (`configurado`); nada a trocar antes disso. Depois de
 * uma troca bem-sucedida, o SERVIDOR já invalidou todas as sessões
 * (inclusive esta) — a tela só avisa e manda a pessoa para `/acesso`
 * pra entrar de novo com a senha nova.
 */
export function AlterarSenhaClinica() {
  const { configurado } = useStatusAcessoClinica();
  const [aberto, setAberto] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  if (!configurado) return null;

  function abrir(): void {
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarSenha('');
    setErro(null);
    setSucesso(false);
    setAberto(true);
  }

  async function confirmar(): Promise<void> {
    if (novaSenha !== confirmarSenha) {
      setErro('A nova senha e a confirmação não são iguais.');
      return;
    }
    setErro(null);
    setTrocando(true);
    try {
      const resposta = await fetch('/acesso/alterar-senha', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ senhaAtual, novaSenha, confirmarSenha }),
      });
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => null)) as { erro?: { codigo?: string } } | null;
        const codigo = corpo?.erro?.codigo;
        setErro((codigo && MENSAGEM_POR_CODIGO[codigo]) || 'Não foi possível trocar a senha agora.');
        return;
      }
      setSucesso(true);
      window.setTimeout(() => {
        window.location.href = '/acesso';
      }, 1800);
    } catch {
      setErro('Não foi possível falar com o servidor agora. Tente novamente.');
    } finally {
      setTrocando(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
        <KeyRound className="h-4 w-4" aria-hidden="true" /> Senha da clínica
      </h2>
      <p className="text-sm text-neutral-600">
        A senha usada para bloquear o acesso ao sistema neste computador. Trocar a senha desconecta todas as sessões
        abertas (inclusive esta) — você precisará entrar de novo com a senha nova.
      </p>
      <Button variant="secondary" onClick={abrir} className="self-start">
        Alterar senha
      </Button>

      <Dialog open={aberto} onOpenChange={(v) => !trocando && setAberto(v)}>
        <DialogContent>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <KeyRound className="h-5 w-5 text-brand-600" aria-hidden="true" /> Alterar senha da clínica
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-2 flex flex-col gap-3 text-sm text-neutral-600">
              {sucesso ? (
                <Alert tone="success">Senha alterada. Você será levado(a) para entrar de novo em instantes…</Alert>
              ) : (
                <>
                  <Field label="Senha atual" required>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      value={senhaAtual}
                      onChange={(e) => setSenhaAtual(e.target.value)}
                    />
                  </Field>
                  <Field label="Nova senha" required hint="Pelo menos 8 caracteres, com letras e números.">
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                    />
                  </Field>
                  <Field label="Confirme a nova senha" required>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                    />
                  </Field>
                  {erro && (
                    <p role="alert" className="text-xs text-danger-700">
                      {erro}
                    </p>
                  )}
                </>
              )}
            </div>
          </DialogDescription>
          {!sucesso && (
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose className={buttonClassName('secondary')} disabled={trocando}>
                Cancelar
              </DialogClose>
              <Button onClick={() => void confirmar()} loading={trocando}>
                Trocar senha
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
