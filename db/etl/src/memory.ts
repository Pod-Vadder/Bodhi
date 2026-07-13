import type { IdMapPort, RunLogEntry, RunLogPort } from './framework';

export class InMemoryIdMap implements IdMapPort {
  private readonly map = new Map<string, string>();

  async get(entity: string, legacyId: number): Promise<string | null> {
    return this.map.get(`${entity}:${legacyId}`) ?? null;
  }

  async put(entity: string, legacyId: number, newId: string): Promise<void> {
    this.map.set(`${entity}:${legacyId}`, newId);
  }

  get size(): number {
    return this.map.size;
  }
}

export class InMemoryRunLog implements RunLogPort {
  readonly entries: RunLogEntry[] = [];

  async write(entry: RunLogEntry): Promise<void> {
    this.entries.push(entry);
  }
}
