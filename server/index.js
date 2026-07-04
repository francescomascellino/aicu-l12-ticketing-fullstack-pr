import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const dataDir = join(rootDir, "data");
const dbPath = join(dataDir, "tickets.sqlite");
const port = Number(process.env.PORT || 4173);

const validPriorities = ["bassa", "normale", "alta"];
const validSourceChannels = ["email", "telefono", "chat"];

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    customer TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL,
    source_channel TEXT NOT NULL,
    urgency_label TEXT,
    status TEXT NOT NULL DEFAULT 'aperto',
    created_at TEXT NOT NULL
  );
`);

seedTickets();

function seedTickets() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM tickets").get().count;

  if (count > 0) {
    return;
  }

  const insert = db.prepare(`
    INSERT INTO tickets (
      id,
      title,
      customer,
      description,
      priority,
      source_channel,
      urgency_label,
      status,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  insert.run(
    "TCK-10482",
    "Impossibile accedere al portale clienti",
    "Alfa S.r.l.",
    "Errore login su account amministrativo.",
    "alta",
    "email",
    null,
    "aperto",
    now
  );

  insert.run(
    "TCK-10481",
    "Errore 500 durante il caricamento",
    "Beta Consulting",
    "Errore intermittente nella pagina fatture.",
    "normale",
    "chat",
    null,
    "in lavorazione",
    now
  );
}

function computeUrgencyLabel(priority, sourceChannel) {
  if (priority === "alta" && sourceChannel === "telefono") return "intervento rapido";
  if (priority === "alta") return "prioritario";
  if (priority === "normale" && sourceChannel === "email") return "standard";
  if (priority === "normale") return "da gestire";
  return "monitorare";
}

function validateTicketInput(input) {
  const fieldErrors = {};

  if (!input.title || input.title.length < 3) {
    fieldErrors.title = "Inserisci un titolo di almeno 3 caratteri.";
  }

  if (!input.customer || input.customer.length < 2) {
    fieldErrors.customer = "Inserisci il nome del cliente.";
  }

  if (!validPriorities.includes(input.priority)) {
    fieldErrors.priority = "Priorita' non valida.";
  }

  if (!validSourceChannels.includes(input.sourceChannel)) {
    fieldErrors.sourceChannel = "Canale non valido.";
  }

  return fieldErrors;
}

function listTickets() {
  return db
    .prepare(
      `
      SELECT
        id,
        title,
        customer,
        description,
        priority,
        source_channel AS sourceChannel,
        urgency_label AS urgencyLabel,
        status,
        created_at AS createdAt
      FROM tickets
      ORDER BY created_at DESC
    `
    )
    .all();
}

function createTicket(input) {
  const id = `TCK-${Math.floor(10000 + Math.random() * 90000)}`;
  const createdAt = new Date().toISOString();
  const urgencyLabel = computeUrgencyLabel(input.priority, input.sourceChannel);

  db.prepare(
    `
      INSERT INTO tickets (
        id,
        title,
        customer,
        description,
        priority,
        source_channel,
        urgency_label,
        status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    id,
    input.title,
    input.customer,
    input.description,
    input.priority,
    input.sourceChannel,
    urgencyLabel,
    "aperto",
    createdAt
  );

  return db
    .prepare(
      `
      SELECT
        id,
        title,
        customer,
        description,
        priority,
        source_channel AS sourceChannel,
        urgency_label AS urgencyLabel,
        status,
        created_at AS createdAt
      FROM tickets
      WHERE id = ?
    `
    )
    .get(id);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function normalizeTicketInput(body) {
  return {
    title: String(body.title || "").trim(),
    customer: String(body.customer || "").trim(),
    description: String(body.description || "").trim(),
    priority: String(body.priority || "").trim(),
    sourceChannel: String(body.sourceChannel || "").trim()
  };
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = resolve(rootDir, `.${requestedPath}`);

  if (!filePath.startsWith(rootDir) || !existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
  };

  response.writeHead(200, {
    "content-type": contentTypes[extname(filePath)] || "application/octet-stream"
  });
  response.end(readFileSync(filePath));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === "GET" && url.pathname === "/api/tickets") {
      sendJson(response, 200, { tickets: listTickets() });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tickets") {
      const body = await readJsonBody(request);
      const input = normalizeTicketInput(body);
      const fieldErrors = validateTicketInput(input);

      if (Object.keys(fieldErrors).length > 0) {
        sendJson(response, 400, {
          message: "Controlla i campi del ticket.",
          fieldErrors
        });
        return;
      }

      sendJson(response, 201, { ticket: createTicket(input) });
      return;
    }

    serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, {
      message: "Errore interno del server.",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`L12 ticketing app ready on http://127.0.0.1:${port}`);
});
