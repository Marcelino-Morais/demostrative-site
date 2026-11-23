import { useId, useState, type FormEvent } from 'react';
import type { AtualizarPacienteInput, NovoPacienteInput } from '../../../domain/entities/paciente.js';
import { Button } from '../../components/ui/button.js';
import { Field } from '../../components/ui/field.js';
import { Input, Select } from '../../components/ui/input.js';
import { formatarCpf, formatarRg, formatarTelefone } from '../../lib/formatadores.js';
import { useRegistrarEdicaoPendente } from '../../providers/edicao-pendente-provider.js';

export interface DadosPacienteFormValues {
  nomeCompleto: string;
  dataNascimento: string;
  estadoCivil: string;
  cpf: string;
  rg: string;
  endereco: string;
  email: string;
  celular: string;
  indicadoPor: string;
}

export const DADOS_PACIENTE_VAZIOS: DadosPacienteFormValues = {
  nomeCompleto: '',
  dataNascimento: '',
  estadoCivil: '',
  cpf: '',
  rg: '',
  endereco: '',
  email: '',
  celular: '',
  indicadoPor: '',
};

export function converterParaEntrada(
  valores: DadosPacienteFormValues,
): NovoPacienteInput & AtualizarPacienteInput {
  return {
    nomeCompleto: valores.nomeCompleto,
    dataNascimento: valores.dataNascimento || null,
    estadoCivil: valores.estadoCivil || null,
    cpf: valores.cpf || null,
    rg: valores.rg || null,
    endereco: valores.endereco || null,
    email: valores.email || null,
    celular: valores.celular || null,
    indicadoPor: valores.indicadoPor || null,
  };
}

export interface FormularioDadosPacienteProps {
  valoresIniciais: DadosPacienteFormValues;
  rotuloSubmit: string;
  carregando?: boolean;
  erro?: string | null;
  onSubmit: (valores: DadosPacienteFormValues) => void;
}

/**
 * Ficha Clínica secção "Identificação" (docx original) — só o nome é
 * obrigatório; o resto pode ser completado depois sem travar o
 * cadastro (mesma regra já garantida pelo domínio, `Paciente.criar`).
 *
 * Sem aviso de "sair sem salvar" de propósito (revisão de segurança
 * operacional, Etapa 47): é um formulário curto, de campos objetivos
 * (nome, CPF, telefone…), que leva menos de um minuto para redigitar
 * se alguém sair sem salvar — diferente da Anamnese e da Evolução
 * clínica (texto livre, mais longo, sem volta fácil), que por isso
 * têm um aviso antes de sair sem salvar. Isso é só sobre o aviso ao
 * sair — registrar no `EdicaoPendenteProvider` é separado.
 */
export function FormularioDadosPaciente({
  valoresIniciais,
  rotuloSubmit,
  carregando = false,
  erro,
  onSubmit,
}: FormularioDadosPacienteProps) {
  const [valores, setValores] = useState<DadosPacienteFormValues>(valoresIniciais);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const sujo = (Object.keys(DADOS_PACIENTE_VAZIOS) as (keyof DadosPacienteFormValues)[]).some(
    (campo) => valores[campo] !== valoresIniciais[campo],
  );
  useRegistrarEdicaoPendente(useId(), sujo);

  function atualizarCampo<K extends keyof DadosPacienteFormValues>(campo: K, valor: string): void {
    setValores((atual) => ({ ...atual, [campo]: valor }));
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!valores.nomeCompleto.trim()) {
      setErroNome('Nome completo é obrigatório.');
      return;
    }
    setErroNome(null);
    onSubmit(valores);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {erro && (
        <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800 dark:border-danger-800 dark:bg-danger-900/40 dark:text-danger-300">
          {erro}
        </p>
      )}
      <Field label="Nome completo" required error={erroNome ?? undefined}>
        <Input
          value={valores.nomeCompleto}
          onChange={(e) => atualizarCampo('nomeCompleto', e.target.value)}
          invalid={Boolean(erroNome)}
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Data de nascimento">
          <Input
            type="date"
            value={valores.dataNascimento}
            onChange={(e) => atualizarCampo('dataNascimento', e.target.value)}
          />
        </Field>
        <Field label="Estado civil">
          <Select
            value={valores.estadoCivil}
            onChange={(e) => atualizarCampo('estadoCivil', e.target.value)}
          >
            <option value="">Não informado</option>
            {['Solteiro(a)','Casado(a)','Viúvo(a)','Divorciado(a)','Separado(a)'].map(opcao=><option key={opcao} value={opcao}>{opcao}</option>)}
            {valores.estadoCivil&&!['Solteiro(a)','Casado(a)','Viúvo(a)','Divorciado(a)','Separado(a)'].includes(valores.estadoCivil)&&<option value={valores.estadoCivil}>{valores.estadoCivil}</option>}
          </Select>
        </Field>
        <Field label="CPF">
          <Input
            value={valores.cpf}
            onChange={(e) => atualizarCampo('cpf', formatarCpf(e.target.value))}
            placeholder="000.000.000-00"
            inputMode="numeric"
          />
        </Field>
        <Field label="RG">
          <Input value={valores.rg} onChange={(e) => atualizarCampo('rg', formatarRg(e.target.value))} />
        </Field>
        <Field label="Celular">
          <Input
            type="tel"
            value={valores.celular}
            onChange={(e) => atualizarCampo('celular', formatarTelefone(e.target.value))}
            placeholder="(34) 99999-9999"
          />
        </Field>
        <Field label="E-mail">
          <Input type="email" value={valores.email} onChange={(e) => atualizarCampo('email', e.target.value)} />
        </Field>
        <Field label="Indicado por">
          <Input value={valores.indicadoPor} onChange={(e) => atualizarCampo('indicadoPor', e.target.value)} />
        </Field>
      </div>
      <Field label="Endereço" className="sm:col-span-2">
        <Input value={valores.endereco} onChange={(e) => atualizarCampo('endereco', e.target.value)} />
      </Field>
      <Button type="submit" loading={carregando} className="no-print self-start">
        {rotuloSubmit}
      </Button>
    </form>
  );
}
