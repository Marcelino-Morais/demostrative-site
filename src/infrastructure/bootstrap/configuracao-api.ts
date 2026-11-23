/**
 * Configuração das FATIAS de persistência compartilhada (Etapas 18–20).
 * Só estas fatias falam com o servidor de `server/`; o resto do app
 * continua 100% local.
 *
 * **Ponto único de configuração** — nenhum outro arquivo do app cita
 * `localhost`/porta/token. Os adaptadores (`HttpGateway*`,
 * `HttpSondaBackend`) recebem `baseUrl`/`token` daqui pelo container.
 *
 * Por padrão TUDO está **DESLIGADO** — `npm run dev` roda tudo local,
 * sem regressão e sem erro se o servidor não estiver de pé. Para ligar:
 *
 *   npm start                    # sobe servidor + app já com VITE_API=on
 *   npm run start:lan            # idem, acessível de outro aparelho na rede
 *
 * ou manualmente:
 *
 *   Terminal 1:  npm run server
 *   Terminal 2:  VITE_API=on npm run dev
 *
 * `VITE_API=on` liga TODAS as fatias de uma vez; `VITE_API_ANAMNESE=on`
 * / `VITE_API_ARQUIVOS=on` / `VITE_API_PACIENTES=on` ligam cada uma
 * isolada. `VITE_API_PACIENTES` move **pacientes e agenda** (o núcleo
 * clínico) para o servidor — é a fonte única de verdade do fluxo
 * principal (Etapa 21). `VITE_API_URL` aponta a base (LAN:
 * `http://192.168.x.y:3999`); `VITE_API_TOKEN` tem que bater com
 * `CLINICA_API_TOKEN` do servidor. Os nomes antigos
 * `VITE_API_ANAMNESE_URL` / `_TOKEN` continuam valendo.
 *
 * **`baseUrl` sem `VITE_API_URL` explícito segue a origem da página
 * (Etapa 34).** No modo `clinica`/`clinica:rapido` (Etapa 23), app e
 * API sempre compartilham a mesma porta — um único processo serve os
 * dois. Antes da Etapa 34, o `baseUrl` padrão era o texto fixo
 * `http://localhost:3999`, que só batia por coincidência quando a
 * própria máquina da clínica abria a página; de qualquer outro
 * aparelho na rede (celular, tablet, outro computador), "localhost"
 * aponta pro aparelho errado e nenhum dado carrega. Agora, sem
 * `VITE_API_URL` configurado, o `baseUrl` usa `origemAtual`
 * (normalmente `window.location.origin` — o próprio endereço que o
 * navegador usou pra abrir a página), então o mesmo build funciona
 * em `http://localhost:3999`, em `http://192.168.x.y:3999` ou em
 * qualquer hostname, sem precisar recompilar. O modo de
 * desenvolvimento de duas portas (`npm start`/`npm run start:lan`,
 * app em 5190 e API em 3999) continua funcionando porque
 * `scripts/dev.mjs` **sempre** define `VITE_API_URL` explicitamente
 * — que tem prioridade sobre `origemAtual` e nunca deixa esse
 * fallback ser usado ali (onde a origem da página seria a porta
 * errada).
 */

export interface ConfiguracaoApi {
  baseUrl: string;
  token: string;
  /** Fatia de anamnese pelo link (Etapa 18). */
  anamnese: boolean;
  /** Fatia de arquivos por paciente (Etapa 19). */
  arquivos: boolean;
  /** Núcleo clínico — pacientes e consultas no servidor (Etapa 21). */
  nucleo: boolean;
}

const ligado = (v: string | undefined): boolean => v?.trim().toLowerCase() === 'on';

/**
 * Função pura (testável) que resolve a configuração a partir de um mapa
 * de variáveis de ambiente — `import.meta.env` em produção, um objeto
 * simples nos testes — e, quando nenhuma URL foi configurada
 * explicitamente, do endereço que o navegador usou pra abrir a página
 * (`origemAtual`, normalmente `window.location.origin`; ver docstring
 * do arquivo). `VITE_API_URL`/`VITE_API_ANAMNESE_URL` sempre têm
 * prioridade sobre `origemAtual` quando definidos.
 */
export function resolverConfiguracaoApi(
  env: Record<string, string | undefined>,
  origemAtual?: string,
): ConfiguracaoApi {
  const combinado = ligado(env.VITE_API);
  const urlExplicita = (env.VITE_API_URL ?? env.VITE_API_ANAMNESE_URL)?.trim();
  return {
    baseUrl: urlExplicita || origemAtual || 'http://localhost:3999',
    token: (env.VITE_API_TOKEN ?? env.VITE_API_ANAMNESE_TOKEN)?.trim() || 'dev-anamnese-token',
    anamnese: combinado || ligado(env.VITE_API_ANAMNESE),
    arquivos: combinado || ligado(env.VITE_API_ARQUIVOS),
    nucleo: combinado || ligado(env.VITE_API_PACIENTES),
  };
}

const CONFIG = resolverConfiguracaoApi(
  import.meta.env as Record<string, string | undefined>,
  typeof window !== 'undefined' ? window.location.origin : undefined,
);

export const CONFIGURACAO_API = {
  baseUrl: CONFIG.baseUrl,
  token: CONFIG.token,
  /** `true` quando a fatia de anamnese está ligada (`VITE_API` ou `VITE_API_ANAMNESE`). */
  habilitado: CONFIG.anamnese,
  /** `true` quando a fatia de arquivos está ligada (`VITE_API` ou `VITE_API_ARQUIVOS`). */
  arquivos: CONFIG.arquivos,
  /** `true` quando pacientes+agenda vêm do servidor (`VITE_API` ou `VITE_API_PACIENTES`). */
  nucleo: CONFIG.nucleo,
} as const;
