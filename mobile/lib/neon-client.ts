export interface NeonQueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  command: string;
}

export function parseConnectionString(url: string): {
  host: string; database: string; user: string; password: string; port: number;
} | null {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
    return {
      host: u.hostname, database: u.pathname.replace(/^\//, ""),
      user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
      port: u.port ? parseInt(u.port) : 5432,
    };
  } catch { return null; }
}

export async function neonQuery(
  connectionUrl: string, query: string, params: unknown[] = [],
): Promise<NeonQueryResult> {
  const conn = parseConnectionString(connectionUrl);
  if (!conn) throw new Error("URL de banco de dados inválida.");
  const endpoint = `https://${conn.host}/sql`;
  const authToken = btoa(`${conn.user}:${conn.password}`);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${authToken}`,
      "Neon-Connection-String": connectionUrl,
    },
    body: JSON.stringify({ query, params }),
  });
  if (!res.ok) {
    let errText = "";
    try { errText = await res.text(); } catch {}
    throw new Error(`Erro Neon (${res.status}): ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  return {
    rows: data.rows ?? [],
    rowCount: data.rowCount ?? data.rows?.length ?? 0,
    command: data.command ?? "SELECT",
  };
}

export async function testNeonConnection(connectionUrl: string): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await neonQuery(connectionUrl, "SELECT current_database() as db, now() as ts");
    const db = result.rows[0]?.db ?? "unknown";
    return { ok: true, message: `Conectado ao banco "${db}"` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }
}

export async function initNeonTables(connectionUrl: string): Promise<{ ok: boolean; tables: string[]; error?: string }> {
  const ddl = [
    `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT DEFAULT '',
      area TEXT DEFAULT 'geral', created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ai_history (
      id TEXT PRIMARY KEY, action TEXT NOT NULL, input_preview TEXT,
      result TEXT, model TEXT, provider TEXT, created_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS jurisprudencia (
      id TEXT PRIMARY KEY, termo TEXT NOT NULL, resultado TEXT NOT NULL,
      provider TEXT DEFAULT '', tribunal TEXT DEFAULT '', favorito BOOLEAN DEFAULT false,
      created_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ementas (
      id TEXT PRIMARY KEY, titulo TEXT NOT NULL, ementa TEXT NOT NULL,
      tribunal TEXT DEFAULT '', area TEXT DEFAULT '', numero TEXT DEFAULT '',
      data TEXT DEFAULT '', created_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY, titulo TEXT NOT NULL, descricao TEXT DEFAULT '',
      conteudo TEXT NOT NULL, area TEXT DEFAULT 'geral', tags TEXT DEFAULT '',
      created_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY, value TEXT, updated_at BIGINT NOT NULL
    )`,
  ];
  const tables: string[] = [];
  try {
    for (const stmt of ddl) {
      await neonQuery(connectionUrl, stmt);
      const match = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
      if (match) tables.push(match[1]);
    }
    return { ok: true, tables };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, tables, error };
  }
}

export async function syncDocumentToNeon(connectionUrl: string, doc: {
  id: string; title: string; content: string; area: string; created_at: number; updated_at: number;
}): Promise<void> {
  await neonQuery(
    connectionUrl,
    `INSERT INTO documents (id, title, content, area, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET title=$2, content=$3, area=$4, updated_at=$6`,
    [doc.id, doc.title, doc.content, doc.area, doc.created_at, doc.updated_at],
  );
}

// ── Jurisprudência ────────────────────────────────────────────────────────────

export interface NeonJurisprudencia {
  id: string; termo: string; resultado: string; provider: string;
  tribunal: string; favorito: boolean; created_at: number;
}

export async function saveJurisprudenciaToNeon(
  connectionUrl: string,
  entry: NeonJurisprudencia,
): Promise<void> {
  await neonQuery(
    connectionUrl,
    `INSERT INTO jurisprudencia (id, termo, resultado, provider, tribunal, favorito, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET resultado=$3, provider=$4, tribunal=$5, favorito=$6`,
    [entry.id, entry.termo, entry.resultado, entry.provider, entry.tribunal, entry.favorito, entry.created_at],
  );
}

export async function getJurisprudenciasFromNeon(
  connectionUrl: string, limit = 50,
): Promise<NeonJurisprudencia[]> {
  const result = await neonQuery(
    connectionUrl,
    `SELECT * FROM jurisprudencia ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return result.rows as unknown as NeonJurisprudencia[];
}

export async function deleteJurisprudenciaFromNeon(connectionUrl: string, id: string): Promise<void> {
  await neonQuery(connectionUrl, "DELETE FROM jurisprudencia WHERE id = $1", [id]);
}

// ── Ementas ────────────────────────────────────────────────────────────────────

export interface NeonEmenta {
  id: string; titulo: string; ementa: string; tribunal: string;
  area: string; numero: string; data: string; created_at: number;
}

export async function saveEmentaToNeon(connectionUrl: string, e: NeonEmenta): Promise<void> {
  await neonQuery(
    connectionUrl,
    `INSERT INTO ementas (id, titulo, ementa, tribunal, area, numero, data, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET titulo=$2, ementa=$3, tribunal=$4, area=$5, numero=$6, data=$7`,
    [e.id, e.titulo, e.ementa, e.tribunal, e.area, e.numero, e.data, e.created_at],
  );
}

export async function getEmentasFromNeon(connectionUrl: string, limit = 100): Promise<NeonEmenta[]> {
  const result = await neonQuery(connectionUrl, `SELECT * FROM ementas ORDER BY created_at DESC LIMIT $1`, [limit]);
  return result.rows as unknown as NeonEmenta[];
}

// ── Templates ─────────────────────────────────────────────────────────────────

export interface NeonTemplate {
  id: string; titulo: string; descricao: string; conteudo: string;
  area: string; tags: string; created_at: number;
}

export async function saveTemplateToNeon(connectionUrl: string, t: NeonTemplate): Promise<void> {
  await neonQuery(
    connectionUrl,
    `INSERT INTO templates (id, titulo, descricao, conteudo, area, tags, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET titulo=$2, descricao=$3, conteudo=$4, area=$5, tags=$6`,
    [t.id, t.titulo, t.descricao, t.conteudo, t.area, t.tags, t.created_at],
  );
}

export async function getTemplatesFromNeon(connectionUrl: string, limit = 100): Promise<NeonTemplate[]> {
  const result = await neonQuery(connectionUrl, `SELECT * FROM templates ORDER BY created_at DESC LIMIT $1`, [limit]);
  return result.rows as unknown as NeonTemplate[];
}

// ── Bulk sync helpers ─────────────────────────────────────────────────────────

export async function listNeonTables(connectionUrl: string): Promise<string[]> {
  const result = await neonQuery(
    connectionUrl,
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  return result.rows.map(r => r.tablename as string);
}
