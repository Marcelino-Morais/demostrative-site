import { CONFIGURACAO_CLINICA } from '../../../infrastructure/bootstrap/configuracao-clinica.js';
import { formatarDataHoraIso } from '../../lib/formatadores.js';
import { useEnderecoClinica } from '../../lib/usar-endereco-clinica.js';

/**
 * Cabeçalho que só aparece na impressão (`print:flex`, oculto em tela)
 * — sem ele o papel perderia a identidade da clínica/profissional
 * junto com a sidebar/topbar escondidas por `.no-print`. Reaproveitado
 * pela Ficha Clínica e pela Agenda.
 *
 * `cpf`/`rg` (opcionais, só fazem sentido no contexto de um paciente —
 * a Agenda não passa nenhum dos dois) aparecem por extenso no papel:
 * o nome sozinho não é suficiente pra identificar o paciente com
 * segurança num documento clínico impresso (Etapa 38).
 */
export function CabecalhoImpressao({
  subtitulo,
  cpf,
  rg,
}: {
  subtitulo?: string;
  cpf?: string | null;
  rg?: string | null;
}) {
  const endereco = useEnderecoClinica();
  return (
    <div className="hidden print:mb-2 print:flex print:flex-col print:gap-0.5 print:border-b print:border-neutral-300 print:pb-2">
      <img src={`${import.meta.env.BASE_URL}logo-dente.png`} alt="Logo do consultório" className="mb-2 h-12 w-12 object-contain" />
      <p className="text-sm font-semibold text-neutral-900">{CONFIGURACAO_CLINICA.nomeClinica}</p>
      <p className="text-xs text-neutral-600">
        {CONFIGURACAO_CLINICA.nomeProfissional} · {CONFIGURACAO_CLINICA.registroProfissional}
      </p>
      {endereco && <p className="text-xs text-neutral-500">{endereco}</p>}
      {subtitulo && <p className="text-xs font-medium text-neutral-700">{subtitulo}</p>}
      {(cpf || rg) && (
        <p className="text-xs text-neutral-600">
          {cpf && <span>CPF: {cpf}</span>}
          {cpf && rg && ' · '}
          {rg && <span>RG: {rg}</span>}
        </p>
      )}
      <p className="text-xs text-neutral-500">Impresso em {formatarDataHoraIso(new Date().toISOString())}</p>
    </div>
  );
}
