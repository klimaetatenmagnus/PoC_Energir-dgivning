/**
 * Enkel in-memory cache med TTL for Grunnbok-aggregeringer.
 * Aggregeringsresultatene er tunge (~7s oppbygging) og endrer seg sjelden,
 * så en time cache er fornuftig for å unngå duplikat-arbeid.
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  inFlight?: Promise<T>;
};

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number = 60 * 60 * 1000) {}

  /**
   * Henter verdi fra cache, eller kjører loader og cacher resultatet.
   * Hvis flere kall skjer samtidig for samme key, deler de samme Promise
   * (request coalescing) så vi unngår duplikat-aggregeringer.
   */
  async getOrCompute(key: string, loader: () => Promise<T>): Promise<T> {
    const existing = this.store.get(key);

    if (existing && existing.inFlight) {
      return existing.inFlight;
    }

    if (existing && existing.expiresAt > Date.now()) {
      return existing.value;
    }

    const promise = loader()
      .then((value) => {
        this.store.set(key, {
          value,
          expiresAt: Date.now() + this.ttlMs,
        });
        return value;
      })
      .catch((err) => {
        this.store.delete(key);
        throw err;
      });

    this.store.set(key, {
      value: existing?.value as T,
      expiresAt: existing?.expiresAt ?? 0,
      inFlight: promise,
    });

    return promise;
  }

  clear(): void {
    this.store.clear();
  }

  /** Fjern utgåtte entries (kall periodisk hvis cachen vokser). */
  prune(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store) {
      if (!entry.inFlight && entry.expiresAt < now) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }
}
