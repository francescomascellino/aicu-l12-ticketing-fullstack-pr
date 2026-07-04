# Patch FE urgencyLabel (visualizzazione)

Piano per validare la visualizzazione FE di `urgencyLabel` ricevuto dal server. Nessuna modifica al codice in questa fase.

## Premessa

La logica di rendering in `src/main.js:42-64` mostra gia' il `urgencyLabel` ritornato dal server. Il piano definisce **come** validare questa visualizzazione, non a modificarla.

Vincoli da `AGENTS.md`:

- Non calcolare `urgencyLabel` in `src/main.js` — il client mostra solo cio' che il server ritorna.
- Mantenere lo stile dark dashboard esistente.
- Copy in italiano.
- Nessuna nuova feature oltre la visualizzazione del dato gia' presente nella risposta API.

## File da toccare

Nessuno. Il piano e' una checklist di verifica.

## Logica di rendering attesa

`src/main.js:55`:

```js
<td><span class="server-value ${ticket.urgencyLabel ? "is-ready" : ""}">${ticket.urgencyLabel || "da calcolare"}</span></td>
```

Comportamento:

- Valore dal server valorizzato -> cella mostra la stringa e applica la classe `is-ready`.
- Valore `null` (record seed + record creati con stub pre-patch) -> cella mostra il placeholder `da calcolare`.

Nessuna ricalcolazione lato client.

## Test manuali consigliati (senza DevTools MCP)

Prerequisito: `pnpm dev` attivo su `http://127.0.0.1:4173`.

### M1 — Submit e lettura in tabella

1. Aprire `http://127.0.0.1:4173/` nel browser.
2. Compilare il form: `title="M1"`, `customer="Cliente"`, `priority="alta"`, `sourceChannel="telefono"`.
3. Cliccare "Salva ticket".
4. Atteso: il ticket compare in tabella, colonna "Urgency label" = `intervento rapido`.
5. Ripetere per `alta+email`, `alta+chat`, `normale+telefono`, `normale+email`, `normale+chat`, `bassa+telefono`, `bassa+email`, `bassa+chat`. Atteso: colonna = stringa corrispondente secondo `AGENTS.md`.

### M2 — Placeholder per record null

1. Con la tabella caricata, individuare i record seed (`TCK-10482`, `TCK-10481`) o qualunque ticket con `urgencyLabel` nullo (verificabile in `response-preview`).
2. Atteso: la cella mostra il testo `da calcolare`, distinto dai record valorizzati.

### M3 — Curl di confronto

1. Eseguire `curl -s http://127.0.0.1:4173/api/tickets | jq '.tickets[] | {id, urgencyLabel}'`.
2. Confrontare manualmente l'output con la tabella del browser aperto in M1.
3. Atteso: match 1:1 (la UI non aggiunge/toglie testo rispetto all'API).

### M4 — Network tab

1. Aprire i DevTools del browser, tab Network.
2. Filtrare su `tickets`.
3. Submit di un nuovo ticket.
4. Atteso: una `POST /api/tickets` con `201` e body che include `urgencyLabel` corretto; segue una `GET /api/tickets` con la lista aggiornata.

### M5 — Placeholder del form ("Campo calcolato dal server")

1. Compilare il form con combinazioni diverse (senza submit).
2. Atteso: il riepilogo `urgencyLabel: da calcolare` resta statico, a conferma che il client non ricalcola.

## Test consigliati tramite Chrome DevTools MCP

Prerequisito: server attivo, `chrome-devtools_new_page` su `http://127.0.0.1:4173/`.

### D1 — Match 1:1 API <-> tabella

`chrome-devtools_evaluate_script`:

```js
async () => {
  const res = await fetch("/api/tickets");
  const data = await res.json();
  const api = data.tickets.map(t => ({ id: t.id, urgencyLabel: t.urgencyLabel }));
  const ui = Array.from(document.querySelectorAll("#ticket-table-body tr")).map(tr => {
    const id = tr.querySelector(".ticket-id")?.textContent?.replace("#", "").trim();
    const cell = tr.children[5]?.textContent?.trim();
    return { id, urgencyLabel: cell };
  });
  return { api, ui, countApi: api.length, countUi: ui.length };
}
```

Atteso: `api` e `ui` allineate, `countApi === countUi`. Per ogni `id`, il `urgencyLabel` di `ui` coincide con quello di `api` (a meno del placeholder `da calcolare` per i null, atteso e accettato).

### D2 — Placeholder uniforme per i null

`chrome-devtools_evaluate_script`:

```js
async () => {
  const res = await fetch("/api/tickets");
  const data = await res.json();
  const nulls = data.tickets.filter(t => t.urgencyLabel === null).map(t => t.id);
  const rows = Array.from(document.querySelectorAll("#ticket-table-body tr"));
  const mismatches = nulls.filter(id => {
    const row = rows.find(r => r.querySelector(".ticket-id")?.textContent?.includes(id));
    return row && row.children[5].textContent.trim() !== "da calcolare";
  });
  return { nullCount: nulls.length, mismatches };
}
```

Atteso: `mismatches` vuoto.

### D3 — Submit via form + lettura cella

1. `chrome-devtools_fill_form` con `title="D3"`, `customer="D3"`, `priority="alta"`, `sourceChannel="telefono"`.
2. `chrome-devtools_click` su "Salva ticket".
3. `chrome-devtools_evaluate_script` (con piccolo delay per consentire il reload):

```js
async () => {
  await new Promise(r => setTimeout(r, 800));
  const res = await fetch("/api/tickets");
  const data = await res.json();
  const t = data.tickets.find(x => x.title === "D3");
  const row = Array.from(document.querySelectorAll("#ticket-table-body tr"))
    .find(r => r.querySelector(".ticket-id")?.textContent?.includes(t.id));
  return { apiUrgency: t.urgencyLabel, uiUrgency: row?.children[5]?.textContent?.trim() };
}
```

Atteso: `apiUrgency === uiUrgency === "intervento rapido"`.

### D4 — Conferma nessuna ricalcolazione client

`chrome-devtools_evaluate_script`:

```js
() => {
  const hasCalc = typeof window.computeUrgencyLabel === "function"
    || typeof window.urgencyLabelFor === "function";
  const preview = document.querySelector("#server-field-preview")?.textContent?.trim();
  return { hasCalc, preview };
}
```

Atteso: `hasCalc === false`, `preview` contiene `urgencyLabel` (statica, non dipende dai valori del form).

### D5 — Evidenza visiva

1. `chrome-devtools_take_screenshot` full-page dopo D3.
2. Verifica visiva: la riga del ticket D3 mostra `intervento rapido` nella colonna "Urgency label"; le righe con `null` mostrano `da calcolare`.

## Criteri di accettazione complessivi

- Match 1:1 tra `GET /api/tickets` e tabella FE (placeholder `da calcolare` ammesso per i record con `urgencyLabel === null`).
- Nessuna funzione di calcolo `urgencyLabel` esposta dal client.
- `server-field-preview` statico, non ricalcolato sui valori del form.

## Cosa NON fare in questa fase

- Non modificare `src/main.js`, `src/styles.css`, `index.html`.
- Non ricalcolare `urgencyLabel` lato client.
- Non eseguire i test elencati (questa fase e' solo di pianificazione).
