import { useState } from 'react';
import { CalendarClock, FileHeart, Search, ShieldCheck } from 'lucide-react';
import { CONFIGURACAO_API } from '../../infrastructure/bootstrap/configuracao-api.js';
import { CONFIGURACAO_CLINICA } from '../../infrastructure/bootstrap/configuracao-clinica.js';
import { Alert } from '../components/ui/alert.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Checkbox } from '../components/ui/checkbox.js';
import { Field } from '../components/ui/field.js';
import { Input } from '../components/ui/input.js';
import { formatarCpf, formatarRg, formatarTelefone } from '../lib/formatadores.js';

type Resultado =
  | { ok: true; primeiroNomePaciente: string; caminhos: { anamnese: string; agendamento: string } }
  | { ok: false; motivo: 'nao-encontrado' };

type Estado =
  | { fase: 'inicio' }
  | { fase: 'carregando' }
  | { fase: 'encontrado'; nome: string; anamnese: string; agendamento: string }
  | { fase: 'cadastro' }
  | { fase: 'erro' };

interface CadastroPublico {
  nomeCompleto: string;
  dataNascimento: string;
  cpf: string;
  rg: string;
  celular: string;
  email: string;
  endereco: string;
  aceitaWhatsapp: boolean;
}

const cadastroInicial: CadastroPublico = {
  nomeCompleto: '',
  dataNascimento: '',
  cpf: '',
  rg: '',
  celular: '',
  email: '',
  endereco: '',
  aceitaWhatsapp: false,
};

async function identificarPaciente(identificador: string): Promise<Resultado> {
  const resposta = await fetch(`${CONFIGURACAO_API.baseUrl.replace(/\/$/, '')}/publico/link-universal/identificar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identificador }),
  });
  if (!resposta.ok) throw new Error('falha-link-universal');
  return (await resposta.json()) as Resultado;
}

async function cadastrarPaciente(valores: CadastroPublico): Promise<Extract<Resultado, { ok: true }>> {
  const resposta = await fetch(`${CONFIGURACAO_API.baseUrl.replace(/\/$/, '')}/publico/link-universal/cadastrar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      nomeCompleto: valores.nomeCompleto,
      dataNascimento: valores.dataNascimento || null,
      cpf: valores.cpf || null,
      rg: valores.rg || null,
      celular: valores.celular || null,
      email: valores.email || null,
      endereco: valores.endereco || null,
      aceitaWhatsapp: valores.aceitaWhatsapp,
    }),
  });
  if (!resposta.ok) throw new Error('falha-cadastro-link-universal');
  return (await resposta.json()) as Extract<Resultado, { ok: true }>;
}

export function LinkUniversalPage() {
  const [identificador, setIdentificador] = useState('');
  const [cadastro, setCadastro] = useState<CadastroPublico>(cadastroInicial);
  const [estado, setEstado] = useState<Estado>({ fase: 'inicio' });

  async function enviar(): Promise<void> {
    setEstado({ fase: 'carregando' });
    try {
      const resultado = await identificarPaciente(identificador);
      if (!resultado.ok) {
        const digitos = identificador.replace(/\D/g, '');
        setCadastro((atual) => ({
          ...atual,
          cpf: digitos.length === 11 ? formatarCpf(identificador) : atual.cpf,
          celular: digitos.length === 10 || digitos.length === 11 ? formatarTelefone(identificador) : atual.celular,
          rg: digitos.length !== 10 && digitos.length !== 11 ? formatarRg(identificador) : atual.rg,
        }));
        setEstado({ fase: 'cadastro' });
        return;
      }
      setEstado({
        fase: 'encontrado',
        nome: resultado.primeiroNomePaciente || 'tudo bem',
        anamnese: resultado.caminhos.anamnese,
        agendamento: resultado.caminhos.agendamento,
      });
    } catch {
      setEstado({ fase: 'erro' });
    }
  }

  async function enviarCadastro(): Promise<void> {
    setEstado({ fase: 'carregando' });
    try {
      const resultado = await cadastrarPaciente(cadastro);
      setEstado({
        fase: 'encontrado',
        nome: resultado.primeiroNomePaciente || 'tudo bem',
        anamnese: resultado.caminhos.anamnese,
        agendamento: resultado.caminhos.agendamento,
      });
    } catch {
      setEstado({ fase: 'erro' });
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1 border-b border-neutral-200 pb-3">
        <p className="text-sm font-semibold text-brand-800 dark:text-brand-300">{CONFIGURACAO_CLINICA.nomeClinica}</p>
        <p className="text-xs text-neutral-500">
          {CONFIGURACAO_CLINICA.nomeProfissional} · {CONFIGURACAO_CLINICA.registroProfissional}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <div>
          <p className="text-sm text-neutral-500">Atendimento online</p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Acesse sua ficha</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Digite seu CPF, RG ou celular cadastrado para responder a anamnese ou agendar uma consulta.
          </p>
        </div>

        <Card className="flex flex-col gap-3">
          <Field label="CPF, RG ou celular">
            <Input
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              placeholder="Ex.: 123.456.789-00 ou (34) 99999-8888"
              autoComplete="off"
            />
          </Field>
          <Button onClick={() => void enviar()} loading={estado.fase === 'carregando'} disabled={identificador.trim().length < 8}>
            <Search className="h-4 w-4" aria-hidden="true" /> Continuar
          </Button>
          <p className="text-xs text-neutral-500">
            Por segurança, a página não mostra lista de pacientes. Se não encontrar seu cadastro, fale com o consultório.
          </p>
        </Card>
      </section>

      {estado.fase === 'cadastro' && (
        <Card className="flex flex-col gap-3">
          <Alert tone="warning" title="Ainda não encontramos seu cadastro">
            Preencha sua ficha inicial abaixo. Depois disso você poderá responder a anamnese ou agendar uma consulta.
          </Alert>
          <Field label="Nome completo" required>
            <Input
              value={cadastro.nomeCompleto}
              onChange={(e) => setCadastro((atual) => ({ ...atual, nomeCompleto: e.target.value }))}
              placeholder="Seu nome completo"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Data de nascimento">
              <Input
                type="date"
                value={cadastro.dataNascimento}
                onChange={(e) => setCadastro((atual) => ({ ...atual, dataNascimento: e.target.value }))}
              />
            </Field>
            <Field label="CPF">
              <Input
                value={cadastro.cpf}
                onChange={(e) => setCadastro((atual) => ({ ...atual, cpf: formatarCpf(e.target.value) }))}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </Field>
            <Field label="RG">
              <Input
                value={cadastro.rg}
                onChange={(e) => setCadastro((atual) => ({ ...atual, rg: formatarRg(e.target.value) }))}
              />
            </Field>
            <Field label="Celular">
              <Input
                type="tel"
                value={cadastro.celular}
                onChange={(e) => setCadastro((atual) => ({ ...atual, celular: formatarTelefone(e.target.value) }))}
                placeholder="(34) 99999-9999"
              />
            </Field>
            <Field label="E-mail">
              <Input
                type="email"
                value={cadastro.email}
                onChange={(e) => setCadastro((atual) => ({ ...atual, email: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Endereço">
            <Input
              value={cadastro.endereco}
              onChange={(e) => setCadastro((atual) => ({ ...atual, endereco: e.target.value }))}
            />
          </Field>
          <Checkbox
            id="cadastro-publico-aceita-whatsapp"
            label="Aceito receber confirmação e lembrete de consulta pelo WhatsApp (nunca com dado clínico)."
            checked={cadastro.aceitaWhatsapp}
            onChange={(e) => setCadastro((atual) => ({ ...atual, aceitaWhatsapp: e.target.checked }))}
          />
          <Button
            onClick={() => void enviarCadastro()}
            disabled={!cadastro.nomeCompleto.trim() || (!cadastro.cpf.trim() && !cadastro.rg.trim() && !cadastro.celular.trim())}
          >
            Criar ficha e continuar
          </Button>
          <p className="text-xs text-neutral-500">
            Informe pelo menos CPF, RG ou celular para evitar duplicidade no cadastro. Deixar a caixa de WhatsApp
            desmarcada não impede o cadastro — você pode autorizar depois, com o consultório.
          </p>
        </Card>
      )}

      {estado.fase === 'erro' && (
        <Alert tone="danger" title="Não foi possível consultar agora">
          Verifique sua conexão e tente novamente. Se persistir, fale com o consultório.
        </Alert>
      )}

      {estado.fase === 'encontrado' && (
        <Card className="flex flex-col gap-3">
          <Alert tone="success" title={`Olá, ${estado.nome}!`}>
            Encontramos seu cadastro. Escolha o que deseja fazer agora.
          </Alert>
          <div className="grid gap-2 sm:grid-cols-2">
            <a href={estado.anamnese} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              <FileHeart className="h-4 w-4" aria-hidden="true" /> Responder anamnese
            </a>
            <a href={estado.agendamento} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
              <CalendarClock className="h-4 w-4" aria-hidden="true" /> Agendar consulta
            </a>
          </div>
        </Card>
      )}

      <footer className="mt-auto flex items-center gap-1.5 pt-4 text-xs text-neutral-400">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Link do consultório — seus dados não aparecem para outras pessoas.
      </footer>
    </div>
  );
}
