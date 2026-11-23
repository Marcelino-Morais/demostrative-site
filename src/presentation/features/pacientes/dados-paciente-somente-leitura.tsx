import { ShieldCheck } from 'lucide-react';
import type { PacienteProps } from '../../../domain/entities/paciente.js';
import { mascararCpf, mascararRg } from '../../../domain/value-objects/documento-mascarado.js';
import { Alert } from '../../components/ui/alert.js';
import { Card } from '../../components/ui/card.js';
import { formatarDataIso } from '../../lib/formatadores.js';
import { useContainer } from '../../providers/container-provider.js';

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-neutral-500">{rotulo}</dt>
      <dd className="text-sm text-neutral-900">{valor || 'Não informado'}</dd>
    </div>
  );
}

/**
 * Dados cadastrais de um paciente JÁ EXISTENTE — SOMENTE LEITURA, de
 * propósito (achado explícito do pedido: nome, nascimento, CPF, RG,
 * contato e endereço não podem ser editados por aqui, nem por
 * administrador nem por superadministrador — só existe um nível de
 * acesso neste sistema hoje, a senha única da clínica, ver
 * `server/acesso.mjs`). A trava de verdade é dupla: o SERVIDOR recusa
 * a alteração mesmo com uma chamada direta à API
 * (`mesclarAtualizacaoPaciente`, `server/index.mjs`), e o caso de uso
 * `AtualizarPaciente` (`application/use-cases/pacientes.ts`) recusa a
 * mesma coisa no app, inclusive no modo 100% local. Esta tela é só a
 * CONSEQUÊNCIA visível dessa trava — não decide nada sozinha.
 *
 * CPF/RG aparecem mascarados: em modo com servidor, o valor que chega
 * aqui JÁ vem mascarado (a resposta comum da API nunca manda o
 * completo); em modo 100% local, mascara aqui mesmo.
 */
export function DadosPacienteSomenteLeitura({ paciente }: { paciente: PacienteProps }) {
  const container = useContainer();
  const cpfExibido = container.sincronizacaoNucleo ? paciente.cpf || 'Não informado' : mascararCpf(paciente.cpf);
  const rgExibido = container.sincronizacaoNucleo ? paciente.rg || 'Não informado' : mascararRg(paciente.rg);

  return (
    <Card className="flex flex-col gap-4">
      <Alert tone="brand">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Dados cadastrais não podem ser editados livremente por aqui. O paciente pode reenviar o Forms para solicitar
            uma atualização, que será conferida pela clínica. CPF e RG aparecem mascarados; o documento completo só fica disponível no fluxo explícito de
            impressão.
          </span>
        </div>
      </Alert>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome completo" valor={paciente.nomeCompleto} />
        <Campo rotulo="Data de nascimento" valor={paciente.dataNascimento ? formatarDataIso(paciente.dataNascimento) : null} />
        <Campo rotulo="Estado civil" valor={paciente.estadoCivil} />
        <Campo rotulo="CPF" valor={cpfExibido} />
        <Campo rotulo="RG" valor={rgExibido} />
        <Campo rotulo="Celular" valor={paciente.celular} />
        <Campo rotulo="E-mail" valor={paciente.email} />
        <Campo rotulo="Indicado por" valor={paciente.indicadoPor} />
        <Campo rotulo="Endereço" valor={paciente.endereco} />
      </dl>
    </Card>
  );
}
