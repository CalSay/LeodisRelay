import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

let connection: DatabaseSync | undefined;
export function dataRoot(): string { return resolve(process.env.RELAY_DATA_ROOT ?? join(process.cwd(), '.relay-prototype')); }

/** Local operational store and SharePoint issue cache. Network calls never hold a transaction. */
export function database(): DatabaseSync {
  if (connection) return connection;
  const file = join(dataRoot(), 'relay.sqlite');
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS records (
      kind TEXT NOT NULL, id TEXT NOT NULL, project TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '', updated TEXT NOT NULL, data TEXT NOT NULL,
      summary TEXT NOT NULL, PRIMARY KEY(kind,id));
    CREATE INDEX IF NOT EXISTS records_project ON records(kind,project,updated DESC,id);
    CREATE INDEX IF NOT EXISTS records_state ON records(kind,state,updated DESC,id);
    CREATE INDEX IF NOT EXISTS issue_source ON records(json_extract(data,'$.raisedByReport')) WHERE kind='issues';
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
      available INTEGER NOT NULL DEFAULT 0, lease TEXT, error TEXT);
    CREATE INDEX IF NOT EXISTS jobs_ready ON jobs(status,available);
    CREATE TABLE IF NOT EXISTS mutations (id TEXT PRIMARY KEY, report TEXT NOT NULL, receipt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  connection = db;
  try {
    atomic(() => {
      if (db.prepare("SELECT value FROM settings WHERE key='legacy-import'").get()) return;
      for (const kind of ['reports', 'issues', 'sessions']) {
        const legacy = join(dataRoot(), `${kind}.json`);
        if (!existsSync(legacy)) continue;
        const rows = JSON.parse(readFileSync(legacy, 'utf8'))[kind];
        if (!Array.isArray(rows)) throw new Error(`Invalid legacy ${kind} store. Original file preserved.`);
        for (const row of rows) putRecord(kind, row);
      }
      db.prepare("INSERT INTO settings VALUES ('legacy-import','complete')").run();
    });
    atomic(() => {
      if (db.prepare("SELECT value FROM settings WHERE key='snapshot-backfill'").get()) return;
      for (const report of records<any>('reports')) {
        if (report.state === 'submitted' && !getRecord('snapshots',report.id)) {
          putRecord('snapshots',report);
          enqueue('pdf:'+report.id,'pdf',{ reportId:report.id });
        }
      }
      db.prepare("INSERT INTO settings VALUES ('snapshot-backfill','complete')").run();
    });
  } catch (error) { connection = undefined; db.close(); throw error; }
  return db;
}

let depth = 0;
export function atomic<T>(work: () => T): T {
  const db = database();
  if (depth) return work();
  db.exec('BEGIN IMMEDIATE');
  depth++;
  try { const result = work(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
  finally { depth--; }
}

export function getRecord<T>(kind: string, id: string): T | undefined {
  const row = database().prepare('SELECT data FROM records WHERE kind=? AND id=?').get(kind,id);
  return row ? JSON.parse(row.data as string) as T : undefined;
}
export function records<T>(kind: string, project?: string): T[] {
  const sql = project === undefined ? 'SELECT data FROM records WHERE kind=?' : 'SELECT data FROM records WHERE kind=? AND project=?';
  const args = project === undefined ? [kind] : [kind,project];
  return database().prepare(sql).all(...args).map(row => JSON.parse(row.data as string) as T);
}
export function putRecord(kind: string, row: { id: string; [key: string]: any }): void {
  const { observations, events, signature, ...small } = row;
  const summary = kind === 'reports' ? {
    ...small, observationCount: observations?.length ?? 0,
    photoCount: observations?.reduce((n: number, o: any) => n + o.photos.length, 0) ?? 0,
    defectCount: observations?.filter((o: any) => o.type === 'defect' || o.type === 'access').length ?? 0,
  } : small;
  database().prepare(`INSERT INTO records VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(kind,id) DO UPDATE SET project=excluded.project,state=excluded.state,
    updated=excluded.updated,data=excluded.data,summary=excluded.summary`).run(
    kind,row.id,row.projectId ?? '',row.state ?? row.work ?? '',
    row.serverAcknowledgedAt ?? row.lastSavedAt ?? row.raisedAt ?? new Date().toISOString(),JSON.stringify(row),JSON.stringify(summary));
}
export function pageRecords<T>(kind: string, project: string | undefined, offset = 0, limit = 50): { items: T[]; next: number | null } {
  const args = project === undefined ? [kind] : [kind, project];
  const where = project === undefined ? 'kind=?' : 'kind=? AND project=?';
  const rows = database().prepare(`SELECT summary FROM records WHERE ${where} ORDER BY updated DESC,id DESC LIMIT ? OFFSET ?`).all(...args, limit + 1, offset);
  return { items: rows.slice(0,limit).map(row => JSON.parse(row.summary as string) as T), next: rows.length > limit ? offset + limit : null };
}
export function enqueue(id: string, kind: string, payload: unknown): void {
  database().prepare('INSERT OR IGNORE INTO jobs(id,kind,payload) VALUES (?,?,?)').run(id,kind,JSON.stringify(payload));
}
export interface Job { id: string; kind: string; payload: string; attempts: number; lease: string }
export function claimJob(): Job | undefined {
  return atomic(() => {
    const now = Date.now();
    const row = database().prepare("SELECT * FROM jobs WHERE (status='pending' OR status='working') AND available<=? ORDER BY available,id LIMIT 1").get(now);
    if (!row) return;
    const lease = randomUUID();
    database().prepare("UPDATE jobs SET status='working',attempts=attempts+1,lease=?,available=? WHERE id=?").run(lease,now + 300000,row.id!);
    return { id: row.id as string, kind: row.kind as string, payload: row.payload as string, attempts: Number(row.attempts) + 1, lease };
  });
}
export function finishJob(job: Job, error?: string, retryAfterMs = 0): void {
  const state = !error ? 'complete' : job.attempts >= 8 ? 'failed' : 'pending';
  const delay = Math.max(retryAfterMs, Math.min(3600000, 1000 * 2 ** job.attempts));
  database().prepare('UPDATE jobs SET status=?,error=?,available=?,lease=NULL WHERE id=? AND lease=?').run(state,error ?? null,Date.now()+delay,job.id,job.lease);
}
