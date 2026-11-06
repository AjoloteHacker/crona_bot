import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'crona.db');
const db = new DatabaseSync(dbPath);

// Inicializar tablas con WAL para alto rendimiento
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    souls INTEGER DEFAULT 100,
    bank INTEGER DEFAULT 0,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    rep INTEGER DEFAULT 0,
    bio TEXT DEFAULT '«No sé cómo lidiar con esto...» — Usuario de Shibusen',
    title TEXT DEFAULT '🌱 Estudiante de Shibusen',
    married_to TEXT DEFAULT NULL,
    married_at INTEGER DEFAULT NULL,
    last_daily INTEGER DEFAULT 0,
    last_work INTEGER DEFAULT 0,
    last_hunt INTEGER DEFAULT 0,
    last_rep INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS inventory (
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    PRIMARY KEY (user_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS interactions (
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    action TEXT NOT NULL,
    count INTEGER DEFAULT 0,
    PRIMARY KEY (from_id, to_id, action)
  );

  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    prefix TEXT DEFAULT 'c!',
    level_announcements INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

export interface UserData {
  id: string;
  souls: number;
  bank: number;
  xp: number;
  level: number;
  rep: number;
  bio: string;
  title: string;
  married_to: string | null;
  married_at: number | null;
  last_daily: number;
  last_work: number;
  last_hunt: number;
  last_rep: number;
}

export function getUser(userId: string): UserData {
  const getStmt = db.prepare('SELECT * FROM users WHERE id = ?');
  let user = getStmt.get(userId) as unknown as UserData | undefined;

  if (!user) {
    const insertStmt = db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)');
    insertStmt.run(userId);
    user = getStmt.get(userId) as unknown as UserData;
  }

  return user;
}

export function updateSouls(userId: string, deltaSouls: number, deltaBank = 0): UserData {
  getUser(userId);
  const stmt = db.prepare(
    'UPDATE users SET souls = MAX(0, souls + ?), bank = MAX(0, bank + ?) WHERE id = ?'
  );
  stmt.run(deltaSouls, deltaBank, userId);
  return getUser(userId);
}

export function setCooldownTimestamp(
  userId: string,
  field: 'last_daily' | 'last_work' | 'last_hunt' | 'last_rep',
  timestamp: number
): void {
  getUser(userId);
  const stmt = db.prepare(`UPDATE users SET ${field} = ? WHERE id = ?`);
  stmt.run(timestamp, userId);
}

export function xpNeededForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.35));
}

export function addXp(userId: string, amount: number): { leveledUp: boolean; newLevel: number; user: UserData } {
  const user = getUser(userId);
  let newXp = user.xp + amount;
  let newLevel = user.level;
  let leveledUp = false;

  while (newXp >= xpNeededForLevel(newLevel)) {
    newXp -= xpNeededForLevel(newLevel);
    newLevel++;
    leveledUp = true;
  }

  // Recompensa de almas por subir de nivel
  const bonusSouls = leveledUp ? newLevel * 75 : 0;

  const stmt = db.prepare(
    'UPDATE users SET xp = ?, level = ?, souls = souls + ? WHERE id = ?'
  );
  stmt.run(newXp, newLevel, bonusSouls, userId);

  return {
    leveledUp,
    newLevel,
    user: getUser(userId),
  };
}

export function addRep(userId: string): number {
  const user = getUser(userId);
  const newRep = user.rep + 1;
  db.prepare('UPDATE users SET rep = ? WHERE id = ?').run(newRep, userId);
  return newRep;
}

export function setBio(userId: string, bio: string): void {
  getUser(userId);
  db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio, userId);
}

export function setTitle(userId: string, title: string): void {
  getUser(userId);
  db.prepare('UPDATE users SET title = ? WHERE id = ?').run(title, userId);
}

export function marryUsers(userA: string, userB: string): void {
  getUser(userA);
  getUser(userB);
  const now = Date.now();
  const stmt = db.prepare('UPDATE users SET married_to = ?, married_at = ? WHERE id = ?');
  stmt.run(userB, now, userA);
  stmt.run(userA, now, userB);
}

export function divorceUsers(userId: string): string | null {
  const user = getUser(userId);
  if (!user.married_to) return null;
  const partnerId = user.married_to;

  const stmt = db.prepare('UPDATE users SET married_to = NULL, married_at = NULL WHERE id = ?');
  stmt.run(userId);
  stmt.run(partnerId);
  return partnerId;
}

export function incrementInteraction(fromId: string, toId: string, action: string): number {
  const existing = db
    .prepare('SELECT count FROM interactions WHERE from_id = ? AND to_id = ? AND action = ?')
    .get(fromId, toId, action) as { count: number } | undefined;

  if (!existing) {
    db.prepare('INSERT INTO interactions (from_id, to_id, action, count) VALUES (?, ?, ?, 1)').run(
      fromId,
      toId,
      action
    );
    return 1;
  } else {
    const next = existing.count + 1;
    db.prepare(
      'UPDATE interactions SET count = ? WHERE from_id = ? AND to_id = ? AND action = ?'
    ).run(next, fromId, toId, action);
    return next;
  }
}

export function getInventory(userId: string): { item_id: string; quantity: number }[] {
  return db
    .prepare('SELECT item_id, quantity FROM inventory WHERE user_id = ? AND quantity > 0')
    .all(userId) as unknown as { item_id: string; quantity: number }[];
}

export function getItemQuantity(userId: string, itemId: string): number {
  const row = db
    .prepare('SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?')
    .get(userId, itemId) as { quantity: number } | undefined;
  return row ? row.quantity : 0;
}

export function addInventoryItem(userId: string, itemId: string, delta = 1): void {
  const current = getItemQuantity(userId, itemId);
  if (current === 0 && delta > 0) {
    db.prepare('INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)').run(
      userId,
      itemId,
      delta
    );
  } else {
    const next = Math.max(0, current + delta);
    db.prepare('UPDATE inventory SET quantity = ? WHERE user_id = ? AND item_id = ?').run(
      next,
      userId,
      itemId
    );
  }
}

export function getTopUsersBySouls(limit = 10): UserData[] {
  return db
    .prepare('SELECT * FROM users ORDER BY (souls + bank) DESC LIMIT ?')
    .all(limit) as unknown as UserData[];
}

export function getTopUsersByLevel(limit = 10): UserData[] {
  return db
    .prepare('SELECT * FROM users ORDER BY level DESC, xp DESC LIMIT ?')
    .all(limit) as unknown as UserData[];
}

export function getUserRank(userId: string): number {
  getUser(userId);
  const rows = db
    .prepare('SELECT id FROM users ORDER BY level DESC, xp DESC')
    .all() as unknown as { id: string }[];
  const idx = rows.findIndex((r) => r.id === userId);
  return idx === -1 ? rows.length : idx + 1;
}

export function getGuildPrefix(guildId: string | null): string {
  const defaultPrefix = process.env.DEFAULT_PREFIX || 'c!';
  if (!guildId) return defaultPrefix;
  const row = db
    .prepare('SELECT prefix FROM guild_settings WHERE guild_id = ?')
    .get(guildId) as { prefix: string } | undefined;
  return row ? row.prefix : defaultPrefix;
}

export function setGuildPrefix(guildId: string, prefix: string): void {
  const existing = db
    .prepare('SELECT guild_id FROM guild_settings WHERE guild_id = ?')
    .get(guildId);
  if (!existing) {
    db.prepare('INSERT INTO guild_settings (guild_id, prefix) VALUES (?, ?)').run(guildId, prefix);
  } else {
    db.prepare('UPDATE guild_settings SET prefix = ? WHERE guild_id = ?').run(prefix, guildId);
  }
}

export interface WarningRecord {
  id: number;
  guild_id: string;
  user_id: string;
  moderator_id: string;
  reason: string;
  created_at: number;
}

export function addWarning(
  guildId: string,
  userId: string,
  moderatorId: string,
  reason: string
): WarningRecord[] {
  db.prepare(
    'INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(guildId, userId, moderatorId, reason, Date.now());
  return getWarnings(guildId, userId);
}

export function getWarnings(guildId: string, userId: string): WarningRecord[] {
  return db
    .prepare('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC')
    .all(guildId, userId) as unknown as WarningRecord[];
}
