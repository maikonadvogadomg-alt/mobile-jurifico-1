import * as SQLite from "expo-sqlite";

export interface Document {
  id: string;
  title: string;
  content: string;
  area: string;
  created_at: number;
  updated_at: number;
}

export interface AiHistoryEntry {
  id: string;
  action: string;
  input_preview: string;
  result: string;
  model: string;
  provider: string;
  created_at: number;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function getDb(): SQLite.SQLiteDatabase {
  return SQLite.openDatabaseSync("legal_assistant.db");
}

export function initDb(db: SQLite.SQLiteDatabase): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      area TEXT DEFAULT 'geral',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_history (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      input_preview TEXT DEFAULT '',
      result TEXT DEFAULT '',
      model TEXT DEFAULT '',
      provider TEXT DEFAULT '',
      created_at INTEGER NOT NULL
    );
  `);
}

export function getAllDocuments(db: SQLite.SQLiteDatabase): Document[] {
  return db.getAllSync<Document>(
    "SELECT * FROM documents ORDER BY updated_at DESC",
  );
}

export function getDocument(db: SQLite.SQLiteDatabase, id: string): Document | null {
  return db.getFirstSync<Document>("SELECT * FROM documents WHERE id = ?", [id]);
}

export function saveDocument(
  db: SQLite.SQLiteDatabase,
  doc: Partial<Document> & { title: string; content: string },
): Document {
  const now = Date.now();
  if (doc.id) {
    db.runSync(
      "UPDATE documents SET title=?, content=?, area=?, updated_at=? WHERE id=?",
      [doc.title, doc.content, doc.area ?? "geral", now, doc.id],
    );
    return getDocument(db, doc.id)!;
  } else {
    const id = generateId();
    db.runSync(
      "INSERT INTO documents (id, title, content, area, created_at, updated_at) VALUES (?,?,?,?,?,?)",
      [id, doc.title, doc.content, doc.area ?? "geral", now, now],
    );
    return { id, title: doc.title, content: doc.content, area: doc.area ?? "geral", created_at: now, updated_at: now };
  }
}

export function deleteDocument(db: SQLite.SQLiteDatabase, id: string): void {
  db.runSync("DELETE FROM documents WHERE id = ?", [id]);
}

export function getAiHistory(db: SQLite.SQLiteDatabase, limit = 50): AiHistoryEntry[] {
  return db.getAllSync<AiHistoryEntry>(
    "SELECT * FROM ai_history ORDER BY created_at DESC LIMIT ?",
    [limit],
  );
}

export function saveAiHistory(
  db: SQLite.SQLiteDatabase,
  entry: Omit<AiHistoryEntry, "id" | "created_at">,
): void {
  const id = generateId();
  db.runSync(
    "INSERT INTO ai_history (id, action, input_preview, result, model, provider, created_at) VALUES (?,?,?,?,?,?,?)",
    [id, entry.action, entry.input_preview.slice(0, 200), entry.result, entry.model, entry.provider, Date.now()],
  );
}

export function deleteAiHistory(db: SQLite.SQLiteDatabase, id: string): void {
  db.runSync("DELETE FROM ai_history WHERE id = ?", [id]);
}

export function clearAiHistory(db: SQLite.SQLiteDatabase): void {
  db.runSync("DELETE FROM ai_history");
}
