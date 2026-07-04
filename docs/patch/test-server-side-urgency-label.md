# Test report — server-side urgencyLabel

Report dei test eseguiti sull'implementazione server-side di `urgencyLabel` in `server/index.js`, eseguiti tramite Chrome DevTools MCP contro il dev server `pnpm dev` su `http://127.0.0.1:4173`.

Data run: 2026-07-04 12:15 circa.
Build: dopo restart del processo Node con la patch `docs/patch/patch-server-side-urgencyLabel.md` applicata.

## Ambiente

- Server: `node server/index.js` (PID riavviato dopo l'applicazione della patch).
- DB: `data/tickets.sqlite` esistente, record di seed invariati.
- Browser: Chrome DevTools MCP, pagina `http://127.0.0.1:4173/`.
- Helper API: `fetch("/api/tickets", ...)` eseguito da `evaluate_script` nella pagina caricata.

## Test 1 — 9 combinazioni valide (priority x sourceChannel)

Eseguito `POST /api/tickets` per ognuna delle 9 combinazioni. Atteso: `201` con `ticket.urgencyLabel` valorizzato secondo la regola canonica in `AGENTS.md`.

| priority | sourceChannel | status | urgencyLabel (effettivo) | urgencyLabel (atteso) | Esito |
| --- | --- | --- | --- | --- | --- |
| alta | telefono | 201 | `intervento rapido` | `intervento rapido` | PASS |
| alta | email | 201 | `prioritario` | `prioritario` | PASS |
| alta | chat | 201 | `prioritario` | `prioritario` | PASS |
| normale | telefono | 201 | `da gestire` | `da gestire` | PASS |
| normale | email | 201 | `standard` | `standard` | PASS |
| normale | chat | 201 | `da gestire` | `da gestire` | PASS |
| bassa | telefono | 201 | `monitorare` | `monitorare` | PASS |
| bassa | email | 201 | `monitorare` | `monitorare` | PASS |
| bassa | chat | 201 | `monitorare` | `monitorare` | PASS |

**9/9 PASS** — `match: true` su tutti i casi.

## Test 2 — Casi di errore di validazione

Eseguito `POST /api/tickets` con input non validi. Atteso: `400` con `fieldErrors` per il campo coinvolto.

| Caso | status | fieldErrors | Esito |
| --- | --- | --- | --- |
| `priority: "immediata"`, `sourceChannel: "telefono"` | 400 | `{ "priority": "Priorita' non valida." }` | PASS |
| `priority: "alta"`, `sourceChannel: "whatsapp"` | 400 | `{ "sourceChannel": "Canale non valido." }` | PASS |
| `priority: "alta"`, `sourceChannel: "fax"` | 400 | `{ "sourceChannel": "Canale non valido." }` | PASS |
| `priority: "immediata"`, `sourceChannel: "whatsapp"` | 400 | `{ "priority": "Priorita' non valida.", "sourceChannel": "Canale non valido." }` | PASS |

**4/4 PASS** — il caso `whatsapp` (preservato per `AGENTS.md`) produce correttamente `400 fieldErrors.sourceChannel`; il caso combinato accumula entrambi gli errori.

Tutte le risposte `400` includono il payload standard:

```json
{ "message": "Controlla i campi del ticket.", "fieldErrors": { ... } }
```

## Test 3 — End-to-end via UI form

Compilazione del form e submit tramite il bottone "Salva ticket".

- Campi inseriti: `title="UI form test"`, `customer="ClienteForm"`, `priority="alta"`, `sourceChannel="telefono"`.
- Submit cliccato (`uid` del bottone `Salva ticket`).
- Ticket creato lato server: `TCK-14670`.
- Verifica via `GET /api/tickets`: `urgencyLabel: "intervento rapido"`.

**PASS** — la pipeline form -> client `fetch` -> server `POST` -> `computeUrgencyLabel` -> DB -> `GET` ritorna il valore corretto.

## Stato database post-test

Conteggio ticket nel DB dopo la sessione di test:

| urgencyLabel | Conteggio |
| --- | --- |
| `monitorare` | 3 |
| `da gestire` | 2 |
| `standard` | 1 |
| `prioritario` | 2 |
| `intervento rapido` | 1 |
| `null` (record seed + record creati con stub pre-patch) | 12 |
| **Totale** | **21** |

I 9 ticket con label valorizzata sono quelli creati dopo il restart del server con la patch; la distribuzione rispetta esattamente le 9 combinazioni attese.

## Sintesi

- `computeUrgencyLabel`: 9/9 casi corretti.
- `validateTicketInput` (campo `sourceChannel`): 4/4 errori corretti.
- End-to-end UI: 1/1 submit andato a buon fine con label calcolata dal server.
- Nessuna regressione sui check preesistenti (`title`, `customer`, `priority`).
- Visualizzazione FE del dato: fuori scope per questa sessione, come da indicazione.
