import { lerProgressoTutorial, salvarProgressoTutorial } from '../features/tutorial/progresso-tutorial.js';
import { urlEtapaTutorial } from '../features/tutorial/conteudo-tutorial.js';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/card.js';
import { mensagemDeErro } from '../lib/erros.js';
import {
  DADOS_PACIENTE_VAZIOS,
  FormularioDadosPaciente,
  converterParaEntrada,
} from '../features/pacientes/formulario-dados-paciente.js';
import { useContainer } from '../providers/container-provider.js';

export function NovoPacientePage() {
  const container = useContainer();
  const navigate = useNavigate();
  const [parametros] = useSearchParams();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(valores: Parameters<typeof converterParaEntrada>[0]): Promise<void> {
    setCarregando(true);
    setErro(null);
    try {
      const paciente = await container.pacientes.criar.executar(converterParaEntrada(valores));
      let continuar = parametros.get('continuarGuia') === 'primeiro-atendimento';
      const progresso = lerProgressoTutorial();
      if (!continuar && !progresso.primeiroAtendimentoOferecido) {
        // Uma falha ao verificar o guia nunca transforma um cadastro já salvo em erro.
        try {
          const cadastrados = await container.pacientes.listar.executar();
          continuar = cadastrados.length === 1 && cadastrados[0]?.id === paciente.id;
        } catch { /* Cadastro concluído; segue normalmente sem o guia. */ }
      }
      if (continuar) {
        salvarProgressoTutorial({ ...progresso, apresentado: true, primeiroAtendimentoOferecido: true });
        navigate(urlEtapaTutorial('primeiro-atendimento', 0, paciente.id));
      } else navigate(`/pacientes/${paciente.id}`);
    } catch (erroCapturado) {
      setErro(mensagemDeErro(erroCapturado, 'Não foi possível cadastrar o paciente. Tente novamente.'));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Novo paciente</h1>
        <p className="text-sm text-neutral-600">
          Só o nome completo é obrigatório — o restante pode ser completado depois, na ficha clínica.
        </p>
      </div>
      <Card>
        <FormularioDadosPaciente
          valoresIniciais={DADOS_PACIENTE_VAZIOS}
          rotuloSubmit="Cadastrar paciente"
          carregando={carregando}
          erro={erro}
          onSubmit={(valores) => void handleSubmit(valores)}
        />
      </Card>
    </div>
  );
}
