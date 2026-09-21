const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET || "change-this-jwt-secret";
const DATA_DIR = process.env.RCS_DATA_DIR || path.join(__dirname, "data");

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, "rcs.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  logo TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS drivers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  number INTEGER,
  team_id INTEGER,
  points REAL DEFAULT 0,
  wins INTEGER DEFAULT 0,
  podiums INTEGER DEFAULT 0,
  FOREIGN KEY(team_id) REFERENCES teams(id)
);
CREATE TABLE IF NOT EXISTS races (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round INTEGER NOT NULL,
  name TEXT NOT NULL,
  country TEXT DEFAULT '',
  date TEXT DEFAULT '',
  status TEXT DEFAULT 'upcoming'
);
CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id INTEGER NOT NULL,
  driver_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  points REAL DEFAULT 0,
  fastest_lap INTEGER DEFAULT 0,
  FOREIGN KEY(race_id) REFERENCES races(id),
  FOREIGN KEY(driver_id) REFERENCES drivers(id)
);
`);

const admin = db.prepare("SELECT id FROM admins LIMIT 1").get();
if (!admin) {
  const password = process.env.RCS_ADMIN_PASSWORD || "rcs123";
  const hash = bcrypt.hashSync(password, 12);
  db.prepare("INSERT INTO admins(username,password_hash) VALUES(?,?)").run("admin", hash);
  console.log("Administrador inicial criado: usuário=admin");
  if (!process.env.RCS_ADMIN_PASSWORD) {
    console.log("Senha inicial: rcs123 — defina RCS_ADMIN_PASSWORD antes do primeiro deploy.");
  }
}

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Não autorizado" });
  }
}

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// Health check para serviços de hospedagem.
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "RCS Continental Racing Series" });
});

// API
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
  }

  const a = db.prepare("SELECT * FROM admins WHERE username=?").get(username);
  if (!a || !bcrypt.compareSync(password, a.password_hash)) {
    return res.status(401).json({ error: "Usuário ou senha inválidos" });
  }

  const token = jwt.sign(
    { id: a.id, username: a.username },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ token });
});

app.get("/api/dashboard", auth, (req, res) => {
  const teams = db.prepare("SELECT COUNT(*) c FROM teams").get().c;
  const drivers = db.prepare("SELECT COUNT(*) c FROM drivers").get().c;
  const races = db.prepare("SELECT COUNT(*) c FROM races").get().c;
  const results = db.prepare("SELECT COUNT(*) c FROM results").get().c;
  res.json({ teams, drivers, races, results });
});

app.get("/api/public", (req, res) => {
  const drivers = db.prepare(`
    SELECT d.id,d.name,d.number,d.points,d.wins,d.podiums,t.name team
    FROM drivers d LEFT JOIN teams t ON t.id=d.team_id
    ORDER BY d.points DESC,d.wins DESC,d.podiums DESC,d.name
  `).all();

  const teams = db.prepare("SELECT * FROM teams ORDER BY name").all();
  const races = db.prepare("SELECT * FROM races ORDER BY round").all();

  res.json({ drivers, teams, races });
});

app.post("/api/teams", auth, (req, res) => {
  const { name, logo = "" } = req.body || {};
  if (!name) return res.status(400).json({ error: "Nome obrigatório" });

  const r = db.prepare("INSERT INTO teams(name,logo) VALUES(?,?)").run(name, logo);
  res.json({ id: r.lastInsertRowid });
});

app.put("/api/teams/:id", auth, (req, res) => {
  db.prepare("UPDATE teams SET name=?,logo=? WHERE id=?")
    .run(req.body.name, req.body.logo || "", req.params.id);
  res.json({ ok: true });
});

app.delete("/api/teams/:id", auth, (req, res) => {
  db.prepare("DELETE FROM teams WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.post("/api/drivers", auth, (req, res) => {
  const { name, number, team_id } = req.body || {};
  if (!name) return res.status(400).json({ error: "Nome obrigatório" });

  const r = db.prepare(
    "INSERT INTO drivers(name,number,team_id) VALUES(?,?,?)"
  ).run(name, number || null, team_id || null);

  res.json({ id: r.lastInsertRowid });
});

app.put("/api/drivers/:id", auth, (req, res) => {
  db.prepare("UPDATE drivers SET name=?,number=?,team_id=? WHERE id=?")
    .run(req.body.name, req.body.number || null, req.body.team_id || null, req.params.id);
  res.json({ ok: true });
});

app.delete("/api/drivers/:id", auth, (req, res) => {
  db.prepare("DELETE FROM drivers WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.post("/api/races", auth, (req, res) => {
  const { round, name, country, date, status = "upcoming" } = req.body || {};
  if (!round || !name) {
    return res.status(400).json({ error: "Round e nome são obrigatórios" });
  }

  const r = db.prepare(
    "INSERT INTO races(round,name,country,date,status) VALUES(?,?,?,?,?)"
  ).run(round, name, country || "", date || "", status);

  res.json({ id: r.lastInsertRowid });
});

app.put("/api/races/:id", auth, (req, res) => {
  db.prepare(
    "UPDATE races SET round=?,name=?,country=?,date=?,status=? WHERE id=?"
  ).run(
    req.body.round,
    req.body.name,
    req.body.country || "",
    req.body.date || "",
    req.body.status || "upcoming",
    req.params.id
  );
  res.json({ ok: true });
});

app.delete("/api/races/:id", auth, (req, res) => {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM results WHERE race_id=?").run(req.params.id);
    db.prepare("DELETE FROM races WHERE id=?").run(req.params.id);
  });
  tx();
  res.json({ ok: true });
});

app.post("/api/results", auth, (req, res) => {
  const { race_id, driver_id, position, fastest_lap = 0 } = req.body || {};

  if (!race_id || !driver_id || !position) {
    return res.status(400).json({
      error: "Corrida, piloto e posição são obrigatórios"
    });
  }

  const points = {
    1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
    6: 8, 7: 6, 8: 4, 9: 2, 10: 1
  }[Number(position)] || 0;

  const tx = db.transaction(() => {
    db.prepare(
      "INSERT INTO results(race_id,driver_id,position,points,fastest_lap) VALUES(?,?,?,?,?)"
    ).run(race_id, driver_id, position, points, fastest_lap ? 1 : 0);

    db.prepare(
      "UPDATE drivers SET points=points+?, wins=wins+?, podiums=podiums+? WHERE id=?"
    ).run(
      points,
      Number(position) === 1 ? 1 : 0,
      Number(position) <= 3 ? 1 : 0,
      driver_id
    );
  });

  try {
    tx();
    res.json({ ok: true, points });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/results", auth, (req, res) => {
  res.json(db.prepare(`
    SELECT r.id,r.position,r.points,r.fastest_lap,
           ra.round,ra.name race,d.name driver,t.name team
    FROM results r
    JOIN races ra ON ra.id=r.race_id
    JOIN drivers d ON d.id=r.driver_id
    LEFT JOIN teams t ON t.id=d.team_id
    ORDER BY ra.round DESC,r.position
  `).all());
});

// Frontend: servir o site pelo próprio Node.
// Isso evita o erro "Failed to fetch" causado por abrir admin.html via content:// ou file://.
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    return res.sendFile(path.join(__dirname, "public", "index.html"));
  }
  res.status(404).json({ error: "Rota não encontrada" });
});

app.listen(PORT, HOST, () => {
  console.log(`RCS rodando em ${HOST}:${PORT}`);
  console.log(`Banco: ${path.join(DATA_DIR, "rcs.db")}`);
});
