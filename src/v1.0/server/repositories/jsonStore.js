import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Small JSON-file store with atomic writes and an in-process write queue.
 *
 * The dataset for a demo is tiny, so a JSON file keeps deployment simple and
 * avoids a native SQLite dependency on Replit. The repository layer is the only
 * place that knows about storage; swapping this for SQLite later does not touch
 * the services or the UI.
 */
export class JsonStore {
  constructor(filePath, fallback = []) {
    this.filePath = filePath;
    this.fallback = fallback;
    this.cache = undefined;
    this.queue = Promise.resolve();
  }

  async ensureFile() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.write(structuredClone(this.fallback));
    }
  }

  async read() {
    if (this.cache !== undefined) return structuredClone(this.cache);
    await this.ensureFile();
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.cache = JSON.parse(raw);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.cache = structuredClone(this.fallback);
      } else {
        throw new Error(`Could not read ${this.filePath}: ${error.message}`);
      }
    }
    return structuredClone(this.cache);
  }

  async write(data) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await fs.rename(temporary, this.filePath);
    this.cache = structuredClone(data);
    return data;
  }

  /**
   * Serialise a read-modify-write cycle. The mutator may mutate `data` in place;
   * it is written afterwards. Return value is whatever the mutator returns.
   */
  async update(mutator) {
    const run = this.queue.then(async () => {
      const data = await this.read();
      const result = await mutator(data);
      await this.write(data);
      return result;
    });
    // Keep the queue alive even if one operation fails.
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  invalidate() {
    this.cache = undefined;
  }
}
