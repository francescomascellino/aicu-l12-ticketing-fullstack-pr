# Backend Rules - L11

## Valori Validi

### Priority

`"bassa"`, `"normale"`, `"alta"`

### Source Channel

`"email"`, `"telefono"`, `"chat"`

## Mapping

| priority | sourceChannel | urgencyLabel |
| --- | --- | --- |
| alta | telefono | intervento rapido |
| alta | chat | prioritario |
| alta | email | prioritario |
| normale | telefono | da gestire |
| normale | chat | da gestire |
| normale | email | standard |
| bassa | telefono | monitorare |
| bassa | chat | monitorare |
| bassa | email | monitorare |

## Dati Decisi Dal Server

- `urgencyLabel`: calcolato dal server tramite `computeUrgencyLabel(priority, sourceChannel)`
- `createdByOperatorId`: non implementato (fuori scope)
- eventuali default: `status: "aperto"`, `created_at: new Date().toISOString()`

## Dati Inviati Dal Client

- `title`: stringa, almeno 3 caratteri
- `description`: stringa (opzionale)
- `priority`: stringa, uno tra `"bassa"`, `"normale"`, `"alta"`
- `sourceChannel`: stringa, uno tra `"email"`, `"telefono"`, `"chat"`

## Fuori Scope

- Autenticazione (401)
- Modifiche alla UI (`index.html`, `src/main.js`, `src/styles.css`)
- `createdByOperatorId`
- `normalizeTicketInput` (già scarta implicitamente i campi server-only)

## Regola In Forma Di Funzione

```txt
computeUrgencyLabel(priority, sourceChannel) -> urgencyLabel
```

Non duplicare questa regola nel client.
