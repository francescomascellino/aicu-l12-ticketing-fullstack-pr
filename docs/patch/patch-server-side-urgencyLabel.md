# Patch server-side urgencyLabel

Piano per implementare `priority + sourceChannel -> urgencyLabel` lato server, come da regola canonica in `AGENTS.md`.

## File toccato (1 solo)

**`server/index.js`**

Non vengono modificati:

- `index.html`, `src/main.js`, `src/styles.css` — UI fuori scope, gia' predisposta a mostrare `urgencyLabel`.
- `data/tickets.sqlite`, schema DB, seed — invariati.
- `package.json` — invariato.

## Modifiche in `server/index.js`

### 1) `computeUrgencyLabel(priority, sourceChannel)` — `server/index.js:84-88`

Sostituzione dello stub che oggi restituisce `null`.

```js
function computeUrgencyLabel(priority, sourceChannel) {
  if (priority === "alta" && sourceChannel === "telefono") return "intervento rapido";
  if (priority === "alta") return "prioritario";
  if (priority === "normale" && sourceChannel === "email") return "standard";
  if (priority === "normale") return "da gestire";
  return "monitorare";
}
```

Regola coperta nei 9 casi previsti da `AGENTS.md`:

| priority | sourceChannel | urgencyLabel |
| --- | --- | --- |
| alta | telefono | intervento rapido |
| alta | email | prioritario |
| alta | chat | prioritario |
| normale | telefono | da gestire |
| normale | email | standard |
| normale | chat | da gestire |
| bassa | telefono | monitorare |
| bassa | email | monitorare |
| bassa | chat | monitorare |

Logica compatta:

```
alta + telefono -> intervento rapido
alta + altro    -> prioritario
normale + email -> standard
normale + altro -> da gestire
bassa + *       -> monitorare
```

Il ramo finale `return "monitorare"` copre il solo caso `priority === "bassa"`, perche' `priority` e' gia' validato a monte in `validateTicketInput`. In ogni caso la funzione riceve input validati.

### 2) `validateTicketInput(input)` — `server/index.js:105-107`

Aggiunta del check su `sourceChannel` al posto del commento TODO, subito dopo il check su `priority`:

```js
if (!validSourceChannels.includes(input.sourceChannel)) {
  fieldErrors.sourceChannel = "Canale non valido.";
}
```

`validSourceChannels = ["email", "telefono", "chat"]` e' gia' definito a `server/index.js:14`. Il check cattura anche `whatsapp` (caso invalido da preservare per `AGENTS.md`) e qualunque altro valore non ammesso.

## Perche' solo questi due punti

- `createTicket` a `server/index.js:135` chiama gia' `computeUrgencyLabel` e a `:146` persiste `urgency_label`: nessuna modifica.
- `listTickets` a `server/index.js:121-122` ritorna gia' `urgencyLabel` con l'alias SQL: nessuna modifica.
- Lo schema DB ha gia' la colonna `urgency_label` (`server/index.js:28`).
- I record di seed mantengono `urgency_label = null` e vengono valorizzati solo per i nuovi ticket (placeholder "da calcolare" gia' gestito in `src/main.js:55`).

## Verifica post-edit

1. `pnpm check` — sintassi di `server/index.js` e `src/main.js`.
2. `pnpm dev` + curl manuali:

   ```bash
   # Caso valido -> 201, urgencyLabel valorizzato
   curl -s -X POST http://127.0.0.1:4173/api/tickets \
     -H "content-type: application/json" \
     -d '{"title":"Test","customer":"Cliente","description":"","priority":"alta","sourceChannel":"telefono"}' | jq .

   # Priority invalida -> 400 fieldErrors.priority
   curl -s -X POST http://127.0.0.1:4173/api/tickets \
     -H "content-type: application/json" \
     -d '{"title":"Test","customer":"Cliente","description":"","priority":"immediata","sourceChannel":"telefono"}' | jq .

   # SourceChannel invalido -> 400 fieldErrors.sourceChannel
   curl -s -X POST http://127.0.0.1:4173/api/tickets \
     -H "content-type: application/json" \
     -d '{"title":"Test","customer":"Cliente","description":"","priority":"alta","sourceChannel":"whatsapp"}' | jq .

   # GET elenco ticket
   curl -s http://127.0.0.1:4173/api/tickets | jq '.tickets[] | {id, urgencyLabel}'
   ```

3. Sanity check sui 9 casi: `alta+telefono -> "intervento rapido"`, `alta+email -> "prioritario"`, `alta+chat -> "prioritario"`, `normale+telefono -> "da gestire"`, `normale+chat -> "da gestire"`, `normale+email -> "standard"`, `bassa+telefono -> "monitorare"`, `bassa+email -> "monitorare"`, `bassa+chat -> "monitorare"`.
