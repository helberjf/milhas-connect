import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

export function createInitialState() {
  return {
    schemaVersion: 1,
    settings: { milePrices: { latam: 26, smiles: 15, azul: 15 } },
    jobs: [],
    monitors: [],
    notifications: [],
    robot: { id: null, lastSeenAt: null, currentJobId: null, version: null },
    idempotency: {},
    authAttempts: {},
  };
}

const clone = (value) => structuredClone(value);

function serialize(queue, operation) {
  const result = queue.tail.then(operation);
  // A rejected operation must not poison later transactions.
  queue.tail = result.then(() => undefined, () => undefined);
  return result;
}

export class MemoryStore {
  mode = 'local';
  #state;
  #queue = { tail: Promise.resolve() };

  constructor(initial = createInitialState()) {
    this.#state = clone(initial);
  }

  async read() {
    return serialize(this.#queue, () => clone(this.#state));
  }

  async transact(mutator) {
    return serialize(this.#queue, async () => {
      const draft = clone(this.#state);
      const result = await mutator(draft);
      this.#state = clone(draft);
      return result;
    });
  }
}

// Shared by instances in this process; production uses database CAS across hosts.
const fileQueues = new Map();

export class FileStore {
  mode = 'local';
  #file;
  #initial;
  #queue;

  constructor(filePath, initial = createInitialState()) {
    this.#file = path.resolve(filePath);
    this.#initial = clone(initial);
    if (!fileQueues.has(this.#file)) fileQueues.set(this.#file, { tail: Promise.resolve() });
    this.#queue = fileQueues.get(this.#file);
  }

  async #load() {
    try {
      return JSON.parse(await readFile(this.#file, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return clone(this.#initial);
      throw error;
    }
  }

  async read() {
    return serialize(this.#queue, () => this.#load());
  }

  async transact(mutator) {
    return serialize(this.#queue, async () => {
      const draft = await this.#load();
      const result = await mutator(draft);
      const document = JSON.stringify(draft);
      const temporaryFile = `${this.#file}.${randomUUID()}.tmp`;
      await mkdir(path.dirname(this.#file), { recursive: true });
      try {
        await writeFile(temporaryFile, document, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        await rename(temporaryFile, this.#file);
      } finally {
        await unlink(temporaryFile).catch((error) => { if (error.code !== 'ENOENT') throw error; });
      }
      return result;
    });
  }
}

const STATE_ID = 'platform';
const MAX_WRITE_ATTEMPTS = 10;

export class PostgresStore {
  mode = 'postgres';
  #query;
  #initialization;

  constructor(connectionString, { query } = {}) {
    if (query) {
      this.#query = query;
    } else {
      try {
        const sql = neon(connectionString);
        this.#query = (text, parameters) => sql.query(text, parameters);
      } catch {
        throw new Error('Database configuration is invalid. Configure DATABASE_URL or POSTGRES_URL.');
      }
    }
  }

  async #initialize() {
    if (!this.#initialization) {
      this.#initialization = (async () => {
        await this.#query('CREATE TABLE IF NOT EXISTS milhas_connect_state (id text PRIMARY KEY, version bigint NOT NULL, data jsonb NOT NULL)', []);
        await this.#query('INSERT INTO milhas_connect_state (id, version, data) VALUES ($1, 0, $2::jsonb) ON CONFLICT (id) DO NOTHING', [STATE_ID, JSON.stringify(createInitialState())]);
      })().catch((error) => {
        this.#initialization = undefined;
        throw error;
      });
    }
    await this.#initialization;
  }

  async #load() {
    await this.#initialize();
    const rows = await this.#query('SELECT version, data FROM milhas_connect_state WHERE id = $1', [STATE_ID]);
    if (!rows[0]) throw new Error('Platform state is unavailable.');
    return { version: rows[0].version, data: clone(rows[0].data) };
  }

  async read() {
    return (await this.#load()).data;
  }

  async transact(mutator) {
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
      const { version, data } = await this.#load();
      const result = await mutator(data);
      const rows = await this.#query('UPDATE milhas_connect_state SET data = $2::jsonb, version = version + 1 WHERE id = $1 AND version = $3 RETURNING version', [STATE_ID, JSON.stringify(data), version]);
      if (rows.length > 0) return result;
    }
    throw new Error('Platform state conflict: concurrent updates exceeded the retry limit. Try again.');
  }
}

export function createStore(env = process.env) {
  const connectionString = env.DATABASE_URL || env.POSTGRES_URL;
  if (connectionString) return new PostgresStore(connectionString);
  if (env.VERCEL || env.NODE_ENV === 'production') {
    throw new Error('Durable platform storage is not configured. Set DATABASE_URL or POSTGRES_URL.');
  }
  return new FileStore(env.PLATFORM_DATA_FILE || path.join(process.cwd(), '.platform-data', 'state.json'));
}
