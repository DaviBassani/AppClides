# Plano de Implementação — Otimização de Bundle do Euclides Web

> Documento de implementação para agentes executor. Branch base: `dev` → criar `perf/bundle-optimization`.
> Contexto: análise via vite-bundle-visualizer revelou **1.4 MB de JS não-gzip no chunk inicial**, sendo ~800 KB código morto nunca executado. Todas as mudanças abaixo são **funcional e visualmente idênticas** — apenas alteram *quando* os bytes chegam.

## Baseline medido (antes)

| Pacote | KB (não-gzip) | Status |
|---|---|---|
| katex | 595.7 | carregado no boot, usado só no chat |
| react-dom | 548.2 | necessário |
| @supabase/auth-js | 397.0 | **morto** — o app não usa auth |
| app code | 160.6 | necessário |
| @supabase/storage-js | 110.8 | **morto** |
| @supabase/postgrest-js | 108.3 | **morto** |
| micromark + mdast + remark/rehype (markdown pipeline) | ~260 | usado só no chat |
| @supabase/realtime-js + phoenix | 92.1 | necessário |
| lucide-react | 20.7 | necessário (bem tree-shaken) |

**Alvo:** chunk inicial ≤ 900 KB não-gzip (~50% de redução), sem regressão de comportamento.

## Constraints globais (obrigatórias)

1. **Nenhuma mudança visual ou funcional.** E2Es existentes em `/tmp/kilo/` devem continuar passando (menu, tutorial, sharebar, collab).
2. **CSP estrita em vigor** (`vercel.json`): nada de CDN, imports remotos, ou assets externos. Chunks são locais.
3. **TypeScript strict** deve continuar limpo (`npm run typecheck`).
4. **Não tocar em** `services/collabProtocol.ts` (contrato de validação), `api/`, nem tests existentes exceto onde indicado.
5. Commits pequenos, um por fase, mensagens em Conventional Commits em inglês, **sem push**.

---

## P1 — Trocar supabase-js completo por @supabase/realtime-js direto

**Problema:** `services/collab.ts` importa `createClient` de `@supabase/supabase-js`, que arrasta auth-js (397 KB), storage-js (110 KB) e postgrest-js (108 KB) para o bundle — tudo código morto, pois o app só usa canais Realtime (broadcast/presence).

**Arquivos:**
- `services/collab.ts` — único ponto de integração (_singleton `getClient()` na linha ~139)
- `package.json` — trocar dependência

**Implementação:**

1. `npm uninstall @supabase/supabase-js` e `npm install @supabase/realtime-js` (versão já transitiva do supabase-js 2.x — conferir compatibilidade de API).

2. Em `services/collab.ts`, substituir o cliente:

```typescript
// ANTES
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
// ...
sharedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DEPOIS
import { RealtimeClient } from '@supabase/realtime-js';
// ...
const client = new RealtimeClient(SUPABASE_URL.replace(/^https?/, 'ws') , {
  params: { apikey: SUPABASE_ANON_KEY, eventsPerSecond: 30 }
});
client.connect(); // realtime-js requer connect() explícito
sharedClient = client;
```

   **Atenção — adaptações de API obrigatórias ao migrar de supabase-js para realtime-js puro:**
   - `client.channel('room:X', { config: {...} })` → `client.channel('room:X', { config: {...} })` (mesma assinatura, mas o canal retornou é de realtime-js; `channel.track()`, `channel.untrack()`, `channel.send()`, `channel.presenceState()`, `client.removeChannel()` existem e mantêm semântica)
   - `subscribe(callback)` recebe `SubscribedState` com nomes diferentes: em supabase-js o callback recebe `'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED' | 'JOINED'`; **em realtime-js puro o status é `'ok' | 'error' | 'timeout'`** no evento `phx_reply`. Mapear: usar `channel.onStateChange` (se disponível na versão) ou converter o callback — verificar a versão instalada e adaptar `services/collab.ts` linha ~110 (o `.subscribe(async status => {...})`). O teste existente `services/collab.test.ts` usa `client.channelInstance.emitStatus('SUBSCRIBED')` — atualizar a fake para o novo contrato e os nomes de status esperados pelo hook (`hooks/useCollab.ts` trata `SUBSCRIBED`/`CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`).
   - **Manter o tipo público `CollabStatus` e os eventos da interface `CollabEvents` inalterados** — o hook e a UI não podem saber da troca.
   - Presence key/config: supabase-js injeta `apikey` nos query params; com RealtimeClient direto passar `params: { apikey }` explicitamente.

3. **Verificação:** `rg "supabase-js" package.json package-lock.json` não deve retornar dependência; `node -e "require('@supabase/realtime-js/package.json')"`.
4. **Regressão obrigatória:** rodar E2E de colaboração (`/tmp/kilo/collab-convergence-e2e.js` e `/tmp/kilo/collab-budget-e2e.js`) — a conexão realtime real precisa funcionar com a mesma anon key.
5. **Expectativa de economia:** ~700 KB (auth + storage + postgrest fora).

**Risco:** alto (transporte de rede real). Mitigação: os testes existentes de traffic budget + os E2Es de colaboração cobrem o caminho crítico; testar manualmente o share/link antes de commitar.

---

## P2 — Chat + KaTeX lazy (React.lazy + Suspense)

**Problema:** `components/Chat.tsx` importa `react-markdown`, `remark-math`, `rehype-katex` — e o `index.tsx` importa `katex/dist/katex.min.css` estaticamente. Resultado: ~600 KB no chunk inicial para uma UI que abre sob demanda.

**Arquivos:**
- `components/Chat.tsx` — tornar-se-á chunk separado (lazy)
- `components/canvas/...` — sem mudança
- `App.tsx` — trocar import estático do Chat por `React.lazy` + `Suspense` com fallback visual igual ao estado atual (mesmo header/botão)
- `index.tsx` — mover `import 'katex/dist/katex.min.css'` para dentro do chunk do Chat (CSS importado pelo módulo lazy entra no chunk dele automaticamente)

**Implementação:**

```tsx
// App.tsx — topo
const Chat = React.lazy(() =>
  import('./components/Chat').then(module => ({ default: module.Chat }))
);

// No local atual de <Chat .../>:
{isChatOpen && (
  <Suspense fallback={<div className="absolute inset-y-0 right-0 z-30 w-full max-w-md bg-white/95 backdrop-blur-md border-l border-slate-200" />}>
    <Chat ...props atuais />
  </Suspense>
)}
```

- O fallback deve ser um **placeholder de mesma forma/posição** que o painel (para não pular layout durante o fetch do chunk — que em localhost é instantâneo, mas em rede real leva ~200ms).
- Verificar que `Chat.tsx` não é importado estaticamente por nenhum outro módulo: `rg -l "components/Chat" --type ts --type tsx | grep -v App.tsx | grep -v Chat.tsx` deve retornar vazio.
- Manter `isChatOpen`/`setIsChatOpen` exatamente como estão (lazy não muda o ciclo).

**Verificação:** build deve mostrar um chunk `Chat-*.js` separado (com katex dentro); `rg "katex" dist/assets/index-*.js` deve retornar vazio; abrir o chat manualmente no E2E e conferir que o markdown/LaTeX renderiza.

**Expectativa de economia:** ~600 KB fora do chunk inicial.

---

## P3 — manualChunks para cache estável de vendor

**Problema:** um único chunk significa que qualquer mudança no app invalida o cache do vendor inteiro.

**Arquivos:** apenas `vite.config.ts`.

**Implementação:**

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks(id: string) {
        if (!id.includes('node_modules')) return;
        if (id.includes('lucide-react')) return 'icons';
        return 'vendor'; // react-dom, realtime, etc.
      }
    }
  }
}
```

- **Não** colocar katex/chat aqui (já separados pelo lazy do P2 — manualChunks explícito *quebraria* o lazy).
- Verificar que o app funciona com os chunks servidos (build + preview + E2E menu).

**Expectativa:** melhor cache de longo prazo; mesmo peso total.

---

## P4 — Medição e documentação

1. Rodar build com `--sourcemap`, medir com o mesmo script de agregação por pacote usado no diagnóstico (salvar antes/depois em comentário do commit).
2. Atualizar `ARCHITECTURE.md` com uma seção "Bundle & performance policy": chunks por feature, formato .euclid, limites de payload já implementados.
3. Adicionar ao CI (`package.json` script `analyze`): `vite build --sourcemap && vite-bundle-visualizer` para medições futuras.

---

## Ordem de execução e gates por fase

| Passo | Gate | E2E requerido |
|---|---|---|
| P1 | `npm run check` + E2E collab (convergence + budget) | Sim — conexão real Supabase |
| P2 | `npm run check` + E2E chat abrindo + LaTeX renderizando | Abrir chat e verificar render |
| P3 | `npm run check` + smoke E2E | — |
| P4 | documentação + medição final | — |

**Critério de sucesso global:** chunk inicial ≤ 900 KB não-gzip, todas as E2Es verdes, zero mudança visual. Se qualquer E2E falhar, **parar e reportar** em vez de "consertar" com hacks.

## Antipadrões proibidos

- Não usar dynamic import dentro de hooks para contornar circularidade (resolver a dependência real).
- Não remover a validação `parseBoardState`/`parseEuclidFileText` para "economizar bundle" (os validadores ficam no core, que já é pequeno).
- Não introduzir CDN (CSP bloqueia por design).