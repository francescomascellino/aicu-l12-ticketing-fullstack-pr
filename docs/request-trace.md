# Request Trace - L11

## Feature Studenti

```txt
priority + sourceChannel -> urgencyLabel
```

## Trace

| Step | Cosa entra | Cosa decide il server | Errore possibile | Evidenza attesa |
| --- | --- | --- | --- | --- |
| request | POST `/api/tickets`, body JSON con `title`, `customer`, `description`, `priority`, `sourceChannel` | Legge il body, normalizza i campi via `normalizeTicketInput()` | Body malformato (JSON non valido) → 500 | `input` object normalizzato |
| validation | `input.priority`, `input.sourceChannel` | Controlla `priority` in `validPriorities` e `sourceChannel` in `validSourceChannels` | `priority` non valida → `fieldErrors.priority`; `sourceChannel` non valido → `fieldErrors.sourceChannel` | `400` con `fieldErrors` |
| auth/session | — | Non implementata (fuori scope) | — | — (o `401` se attiva) |
| rule | `priority`, `sourceChannel` (validati) | `computeUrgencyLabel(priority, sourceChannel)` → `urgencyLabel` | Nessuno (input già validato) | `urgencyLabel` calcolato |
| Prisma | Campi ticket + `urgencyLabel` | `INSERT` in tabella `tickets` con `urgency_label` | Errore DB → 500 | Record salvato nel db |
| response | Ticket appena creato | `sendJson(201, { ticket })` con `urgencyLabel` incluso | Errore serializzazione → 500 | `201` + `{ ticket: { ..., urgencyLabel } }` |

## Caso Valido

```txt
priority=alta
sourceChannel=telefono
expected urgencyLabel=intervento rapido
```

## Caso Invalido

### Priority invalida

```txt
field=priority
value=immediata
expected error=400 fieldErrors.priority
```

### SourceChannel invalido

```txt
field=sourceChannel
value=fax
expected error=400 fieldErrors.sourceChannel
```

## File Candidati

| Area | File candidato | Perche' |
| --- | --- | --- |
| UI payload | `src/main.js` | `getFormPayload()` estrae `priority` e `sourceChannel` dal form |
| API route | `server/index.js` | Route `POST /api/tickets` gestisce la creazione ticket |
| validation | `server/index.js` | `validateTicketInput()` convalida `priority` e `sourceChannel` |
| rule | `server/index.js` | `computeUrgencyLabel()` implementa il mapping |
| Prisma/schema | `data/tickets.sqlite` | Tabella `tickets` con colonna `urgency_label` |
| lista/card | `index.html` + `src/main.js` | `renderTickets()` mostra `urgencyLabel` nella tabella |

## Fuori Scope

- Autenticazione (401)
- `createdByOperatorId`
- Modifiche a stili CSS (`src/styles.css`)
- `normalizeTicketInput` (già scarta campi server-only)
- Componenti UI aggiuntivi
