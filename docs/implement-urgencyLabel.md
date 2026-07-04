# Implementazione urgencyLabel (server-side)

## File da modificare

| File | Modifica |
|---|---|
| `server/index.js` | `computeUrgencyLabel()` — implementare mapping priority + sourceChannel → urgencyLabel |
| `server/index.js` | `validateTicketInput()` — aggiungere validazione per `sourceChannel` |

## File non modificati (fuori scope)

| File | Motivo |
|---|---|
| `index.html` | UI — fuori scope |
| `src/main.js` | Client — fuori scope |
| `src/styles.css` | Stili — fuori scope |
| `server/index.js` — `normalizeTicketInput` | Già scarta implicitamente i campi server-only (`urgencyLabel`, `createdByOperatorId`) tramite estrazione selettiva |

## Mapping urgencyLabel (9 combinazioni)

| Priority | SourceChannel | urgencyLabel |
|---|---|---|
| `alta` | `telefono` | `"intervento rapido"` |
| `alta` | `email` | `"prioritario"` |
| `alta` | `chat` | `"prioritario"` |
| `normale` | `telefono` | `"standard"` |
| `normale` | `email` | `"standard"` |
| `normale` | `chat` | `"standard"` |
| `bassa` | `telefono` | `"monitorare"` |
| `bassa` | `email` | `"monitorare"` |
| `bassa` | `chat` | `"monitorare"` |

Logica compatta:

```
alta + telefono → intervento rapido
alta + altro    → prioritario
normale + *     → standard
bassa + *       → monitorare
```

## Validazione

### sourceChannel (da aggiungere in `validateTicketInput()`)

```
if (!validSourceChannels.includes(input.sourceChannel)) {
  fieldErrors.sourceChannel = "Canale non valido.";
}
```

### Validazione priority (già presente)

Controllo contro l'array `validPriorities`. Se non valida → `fieldErrors.priority`.

## Campi server-only (non accettati dal client)

Il server ignora i campi `urgencyLabel` e `createdByOperatorId` se inviati dal client.  
`normalizeTicketInput()` estrae solo `title`, `customer`, `description`, `priority`, `sourceChannel` — i campi extra vengono scartati automaticamente.

## Test manuali

### Caso valido

```bash
curl -s -X POST http://127.0.0.1:4173/api/tickets \
  -H "content-type: application/json" \
  -d '{"title":"Test","customer":"Cliente","description":"","priority":"alta","sourceChannel":"telefono"}' | jq .
```

Expected: `201`, `urgencyLabel: "intervento rapido"`

### Priority invalida

```bash
curl -s -X POST http://127.0.0.1:4173/api/tickets \
  -H "content-type: application/json" \
  -d '{"title":"Test","customer":"Cliente","description":"","priority":"immediata","sourceChannel":"telefono"}' | jq .
```

Expected: `400`, `fieldErrors.priority`

### SourceChannel invalido

```bash
curl -s -X POST http://127.0.0.1:4173/api/tickets \
  -H "content-type: application/json" \
  -d '{"title":"Test","customer":"Cliente","description":"","priority":"alta","sourceChannel":"fax"}' | jq .
```

Expected: `400`, `fieldErrors.sourceChannel`

### Verifica elenco ticket (GET)

```bash
curl -s http://127.0.0.1:4173/api/tickets | jq '.tickets[] | {id, urgencyLabel}'
```

Expected: ogni ticket deve avere `urgencyLabel` non nullo.
