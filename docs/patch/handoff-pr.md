# Handoff PR — L12 urgencyLabel server-side

## Titolo PR

`feat(L12): compute urgencyLabel server-side + validate sourceChannel`

## Summary

Implementa la regola `priority + sourceChannel -> urgencyLabel` lato server, come da `AGENTS.md` (9 combinazioni). Aggiunge la validazione di `sourceChannel` in `validateTicketInput` per produrre `400 fieldErrors.sourceChannel` su valori non ammessi (es. `whatsapp`).

Nessuna modifica alla UI, al DB schema, al seed, alle dipendenze o ad altre aree fuori scope.

## Scope

In scope (come da `AGENTS.md` Boundaries e `docs/patch/patch-server-side-urgencyLabel.md`):

- `computeUrgencyLabel(priority, sourceChannel)` — calcolo server-side.
- `validateTicketInput(input)` — validazione `sourceChannel`.

Out of scope (esplicitamente escluso):

- UI / `src/main.js` / `src/styles.css` / `index.html`.
- `responseDueAt`, auth, assignments, notifications, duplicate detection, analytics, filtri avanzati, test suite completo.
- `normalizeTicketInput` (gia' scarta i campi server-only).
- `createdByOperatorId`.

## Files changed

| File | Modifica |
|---|---|
| `server/index.js` | `computeUrgencyLabel` da stub a implementazione; aggiunto check `sourceChannel` in `validateTicketInput` |
| `docs/patch/test-server-side-urgency-label.md` | Report test eseguiti via Chrome DevTools MCP |
| `docs/patch/patch-server-side-urgencyLabel.md` | Piano della patch |
| `docs/patch/patch-fe-urgencyLabel.md` | Piano verifica FE (no modifiche, solo checklist) |
| `docs/backend-rules.md` | Allineamento header L11 -> L12 |
| `docs/payload-cases.md` | Nota in calce sul "Caso Valido" incompleto |

## Mapping implementato (in `computeUrgencyLabel`)

```
alta + telefono -> "intervento rapido"
alta + altro    -> "prioritario"
normale + email -> "standard"
normale + altro -> "da gestire"
bassa + *       -> "monitorare"
```

Copre i 9 casi previsti da `AGENTS.md`. La regola vive solo nel server; nessuna duplicazione client.

## Test eseguiti (riepilogo da `docs/patch/test-server-side-urgency-label.md`)

- 9/9 combinazioni valide via `POST /api/tickets` con `fetch` da Chrome MCP: status `201`, `urgencyLabel` corretto.
- 4/4 casi invalidi: `priority="immediata"` -> 400 `fieldErrors.priority`; `sourceChannel="whatsapp"` -> 400 `fieldErrors.sourceChannel`; `sourceChannel="fax"` -> 400 `fieldErrors.sourceChannel`; entrambi invalidi -> 400 con entrambi gli errori.
- 1/1 end-to-end via form UI: submit `alta + telefono` -> ticket creato con `urgencyLabel: "intervento rapido"`.
- DB post-test: 21 ticket, di cui 9 con `urgencyLabel` valorizzato e distribuiti correttamente sui 5 valori distinti.
- 3/3 `sourceChannel` vuoto/mancante (omesso, stringa vuota, `null` esplicito) -> tutti `400` con `fieldErrors.sourceChannel: "Canale non valido."`.
- 32/32 `computeUrgencyLabel` con `priority` fuori da `{alta, normale}` (9 valori anomali x 4 `sourceChannel`): tutti ritornano `"monitorare"` come default. Caso `"ALTA"` (maiuscolo) conferma check case-sensitive.
- **`sourceChannel` vuoto o mancante** — eseguito via `curl.exe` su `http://127.0.0.1:4173`. Risultato: tutti e 3 i casi (omesso / `""` / `null`) ritornano `400` con `fieldErrors.sourceChannel = "Canale non valido."`. `normalizeTicketInput` normalizza i tre casi a `""`, e `validSourceChannels.includes("") === false` produce l'errore atteso.

- **`computeUrgencyLabel` con `priority` fuori da `{alta, normale, bassa}`** — eseguito via script Node standalone (`%TEMP%/test-urgency-fn.mjs`) che re-implementa la funzione, dato che non e' esportata. Risultato: la funzione ritorna `"monitorare"` come default per qualunque `priority` non in `{alta, normale}`. Casi testati: `"urgente"`, `"critical"`, `""`, `null`, `undefined`, `"ALTA"` (case-sensitive), `42` (number), `{}` (object), `[]` (array), ciascuno combinato con `email`/`telefono`/`chat`/`whatsapp` (32 combinazioni totali). Tutte ritornano `"monitorare"`. **PASS** — comportamento deterministico e accettabile: in produzione non si raggiunge questo ramo perche' `validateTicketInput` rifiuta `priority` non valida prima della chiamata. Decisione: il default `"monitorare"` resta implicito (nessun sentinel `null`); documentato in nota di review.

- **`pnpm check`** — eseguito. Output: `node --check server/index.js && node --check src/main.js` (entrambi passano). Unica nota: warning preesistente `Unsupported engine: wanted: {"node":">=26"} (current: {"node":"v24.17.0"})`, non bloccante e non causato dalla patch.

## Note di review

- Commenti permanenti rimossi: `// Non calcolare questo valore nel client.` e `// Il valore whatsapp deve produrre fieldErrors.sourceChannel.` erano adiacenti ai `TODO` rimasti e sono stati cancellati. I vincoli equivalenti sono documentati in `AGENTS.md`, `docs/backend-rules.md` e `docs/patch/test-server-side-urgency-label.md`. Nessuna azione richiesta, ma il reviewer potrebbe chiederne il ripristino come commenti inline.
- Record seed mantengono `urgency_label = null` (comportamento preesistente, accettato dal piano). La UI mostra `da calcolare` come placeholder, gestito da `src/main.js:55`.
- Il diff totale su `server/index.js` e' di +8/-5 righe, conforme al principio "small, file-by-file patches" di `AGENTS.md`.
- `computeUrgencyLabel` ha un fallback implicito `return "monitorare"` per priorita' non riconosciute. Questo fallback non e' raggiungibile dal flusso HTTP (la validazione precede la chiamata) ed e' stato testato direttamente; viene mantenuto come default esplicito nel ramo finale della funzione. Nessuna azione richiesta.

## Acceptance criteria

- `pnpm check` passa.
- `POST /api/tickets` con le 9 combinazioni valide ritorna `201` e il `urgencyLabel` atteso.
- `POST /api/tickets` con `sourceChannel` non in `{email, telefono, chat}` ritorna `400` con `fieldErrors.sourceChannel`.
- `GET /api/tickets` ritorna i ticket con `urgencyLabel` valorizzato per i record creati dopo questa patch.
- Nessuna regressione sui check preesistenti (`title`, `customer`, `priority`).

## How to test locally

```bash
pnpm install
pnpm check
pnpm dev   # server su http://127.0.0.1:4173

# Caso valido
curl -s -X POST http://127.0.0.1:4173/api/tickets \
  -H "content-type: application/json" \
  -d '{"title":"Smoke","customer":"Cliente","description":"","priority":"alta","sourceChannel":"telefono"}' | jq .

# sourceChannel non valido
curl -s -X POST http://127.0.0.1:4173/api/tickets \
  -H "content-type: application/json" \
  -d '{"title":"Smoke","customer":"Cliente","description":"","priority":"alta","sourceChannel":"whatsapp"}' | jq .

# GET elenco
curl -s http://127.0.0.1:4173/api/tickets | jq '.tickets[] | {id, priority, sourceChannel, urgencyLabel}'
```

Aprire `http://127.0.0.1:4173/` per il check visivo in dashboard.

## Related

- Plan: `docs/patch/patch-server-side-urgencyLabel.md`.
- Test report: `docs/patch/test-server-side-urgency-label.md`.
- FE plan: `docs/patch/patch-fe-urgencyLabel.md`.
- Spec canonica: `AGENTS.md`, `docs/backend-rules.md`.
