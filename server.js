const http = require("node:http");
const { timingSafeEqual } = require("node:crypto");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 3000);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "";
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";
const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID || "";
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "";
const OFFICE_ADMIN_KEY = process.env.OFFICE_ADMIN_KEY || "";
const HEARTBEAT_TTL_MS = 45000;
const people = new Map();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function send(res, status, data) {
  res.writeHead(status, corsHeaders());
  res.end(JSON.stringify(data));
}

function prunePeople() {
  const staleBefore = Date.now() - HEARTBEAT_TTL_MS;
  for (const [id, person] of people.entries()) {
    if (person.updatedAt < staleBefore) people.delete(id);
  }
}

function currentPeople() {
  prunePeople();
  return Array.from(people.values()).map(({ updatedAt, ...person }) => person);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1000000) reject(new Error("Request too large"));
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function safeText(value, limit) {
  return String(value || "").trim().slice(0, limit);
}

function secretMatches(provided) {
  if (!OFFICE_ADMIN_KEY || !provided) return false;
  const expected = Buffer.from(OFFICE_ADMIN_KEY);
  const actual = Buffer.from(String(provided));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function safeConversation(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-10).map(turn => ({
    role: turn && turn.role === "assistant" ? "Assistant" : "User",
    content: safeText(turn && turn.content, 2500)
  })).filter(turn => turn.content);
}

function structuredRecap(text) {
  const compact = text.replace(/\s+/g, " ").trim();
  const sentences = compact.split(/(?<=[.!?])\s+/).filter(Boolean);
  const decisions = sentences.filter(item => /\b(decided|agreed|approved|move forward|selected)\b/i.test(item));
  const actions = sentences.filter(item => /\b(will|need to|action|todo|follow up|by\s+(monday|tuesday|wednesday|thursday|friday|tomorrow))\b/i.test(item));
  return ["SUMMARY", sentences.slice(0, 2).join(" ") || compact, "", "DECISIONS", ...(decisions.length ? decisions.map(item => "- " + item) : ["- No explicit decisions detected."]), "", "ACTION ITEMS", ...(actions.length ? actions.map(item => "- " + item) : ["- No clear action items detected. Add owner and due-date language."])].join("\n");
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const blocks = Array.isArray(payload.output) ? payload.output : [];
  return blocks.flatMap(item => Array.isArray(item.content) ? item.content : []).filter(content => content.type === "output_text").map(content => content.text).join("\n").trim();
}

async function askModel(instructions, input) {
  if (!OPENAI_API_KEY || !OPENAI_MODEL) return null;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_MODEL, instructions, input, max_output_tokens: 1000 })
  });
  if (!response.ok) throw new Error(`AI service returned ${response.status}`);
  return extractOutputText(await response.json());
}

async function discordRequest(path, options = {}) {
  if (!DISCORD_TOKEN) return null;
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers: { "Authorization": `Bot ${DISCORD_TOKEN}`, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`Discord returned ${response.status}`);
  return response.status === 204 ? {} : response.json();
}

function discordInviteUrl() {
  if (!DISCORD_APPLICATION_ID) return "";
  return `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(DISCORD_APPLICATION_ID)}&scope=bot`;
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "OPTIONS") return send(res, 204, {});

  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, { ok: true, aiConfigured: Boolean(OPENAI_API_KEY && OPENAI_MODEL), discordConfigured: Boolean(DISCORD_TOKEN && DISCORD_APPLICATION_ID) });
  }
  if (req.method === "GET" && url.pathname === "/api/presence") {
    return send(res, 200, { people: currentPeople() });
  }
  if (req.method === "POST" && url.pathname === "/api/presence") {
    const body = await readBody(req);
    const id = safeText(body.id, 80);
    const name = safeText(body.name, 40);
    if (!id || !name) return send(res, 400, { error: "id and name are required" });
    const allowedStatuses = ["available", "focus", "busy"];
    const allowedRooms = [null, "brew", "engineering", "design", "focus"];
    const status = allowedStatuses.includes(body.status) ? body.status : "available";
    const room = allowedRooms.includes(body.room) ? body.room : null;
    people.set(id, { id, name, status, room, activity: safeText(body.activity, 80), updatedAt: Date.now() });
    return send(res, 200, { people: currentPeople() });
  }
  if (req.method === "GET" && url.pathname === "/api/discord/status") {
    let bot = null;
    if (DISCORD_TOKEN) {
      try { bot = await discordRequest("/users/@me"); } catch (_error) { bot = null; }
    }
    return send(res, 200, {
      configured: Boolean(DISCORD_TOKEN && DISCORD_APPLICATION_ID),
      botConnected: Boolean(bot && bot.id),
      botName: bot ? bot.username : "SpringBot",
      inviteUrl: discordInviteUrl(),
      canPost: Boolean(DISCORD_TOKEN && DISCORD_CHANNEL_ID && OFFICE_ADMIN_KEY)
    });
  }
  if (req.method === "POST" && url.pathname === "/api/discord/message") {
    const body = await readBody(req);
    const message = safeText(body.message, 1800);
    if (!DISCORD_TOKEN || !DISCORD_CHANNEL_ID || !OFFICE_ADMIN_KEY) return send(res, 503, { error: "Discord posting is not configured on the backend." });
    if (!secretMatches(body.adminKey)) return send(res, 401, { error: "Incorrect admin posting key." });
    if (!message) return send(res, 400, { error: "Announcement text is required." });
    await discordRequest(`/channels/${encodeURIComponent(DISCORD_CHANNEL_ID)}/messages`, { method: "POST", body: JSON.stringify({ content: message }) });
    return send(res, 200, { ok: true });
  }
  if (req.method === "POST" && url.pathname === "/api/notes") {
    const body = await readBody(req);
    const text = safeText(body.text, 12000);
    if (!text) return send(res, 400, { error: "notes text is required" });
    const aiResult = await askModel("You turn meeting transcripts into accurate office notes. Return plain text sections SUMMARY, DECISIONS, and ACTION ITEMS. Never invent owners or deadlines.", text);
    return send(res, 200, { mode: aiResult ? "ai" : "structured", result: aiResult || structuredRecap(text) });
  }
  if (req.method === "POST" && url.pathname === "/api/chat") {
    const body = await readBody(req);
    const message = safeText(body.message, 3000);
    if (!message) return send(res, 400, { error: "message is required" });
    const turns = safeConversation(body.history);
    const context = body.context || {};
    const workspace = [`Active room: ${safeText(context.room, 80) || "Unknown"}`, `User status: ${safeText(context.status, 40) || "Unknown"}`].join("\n");
    const transcript = turns.length ? turns.map(turn => `${turn.role}: ${turn.content}`).join("\n") : `User: ${message}`;
    const reply = await askModel("You are SpringBot, a capable assistant inside Spring Office. Help users think, draft, brainstorm, prioritize, make agendas, summarize work, and answer open-ended workplace questions. Use workspace context only when relevant. Do not claim to see files, connected accounts, or people beyond the supplied context. Be clear, helpful, and concise unless the user asks for detail.", `WORKSPACE CONTEXT\n${workspace}\n\nCONVERSATION\n${transcript}`);
    return send(res, 200, { mode: reply ? "ai" : "setup", reply: reply || "The assistant backend is connected, but AI is not enabled yet. Add an AI API key and model to the backend service to activate intelligent answers." });
  }
  return send(res, 404, { error: "Not found" });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(error => {
    console.error(error);
    send(res, 500, { error: "Server error" });
  });
});

server.listen(PORT, "0.0.0.0", () => { console.log(`SpringBot backend listening on port ${PORT}`); });
