/**
 * StorageService - Pure Fabrication & Dependency Inversion Principle (DIP)
 * Shields domain logic from direct browser localStorage coupling (Protected Variations).
 * Includes an in-memory cache to guarantee synchronous consistency during debounced writes
 * and eliminate redundant JSON serialization overhead.
 */
export class StorageService {
  constructor(storage = window.localStorage, prefix = 'kcal_') {
    this.storage = storage;
    this.prefix = prefix;
    this.debounceTimers = new Map();
    this.cache = new Map();
  }

  _getKey(key) {
    return `${this.prefix}${key}`;
  }

  /**
   * Get an item parsed from JSON with optional fallback.
   * Returns from memory cache if available.
   */
  get(key, defaultValue = null) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    try {
      const item = this.storage.getItem(this._getKey(key));
      const parsed = item !== null ? JSON.parse(item) : defaultValue;
      this.cache.set(key, parsed);
      return parsed;
    } catch (err) {
      console.error(`[StorageService] Failed to read key "${key}":`, err);
      return defaultValue;
    }
  }

  /**
   * Set an item serialized to JSON immediately.
   * Updates memory cache synchronously.
   */
  set(key, value) {
    this.cache.set(key, value);
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
      this.debounceTimers.delete(key);
    }
    try {
      this.storage.setItem(this._getKey(key), JSON.stringify(value));
    } catch (err) {
      console.error(`[StorageService] Failed to write key "${key}":`, err);
    }
  }

  /**
   * Set an item with debouncing to prevent excessive I/O.
   * Memory cache is updated immediately so subsequent `get()` calls see new data.
   */
  setDebounced(key, value, delayMs = 300) {
    this.cache.set(key, value);

    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }
    const timer = setTimeout(() => {
      try {
        this.storage.setItem(this._getKey(key), JSON.stringify(value));
      } catch (err) {
        console.error(`[StorageService] Failed to write key "${key}":`, err);
      }
      this.debounceTimers.delete(key);
    }, delayMs);
    this.debounceTimers.set(key, timer);
  }

  /**
   * Remove an item from both memory cache and localStorage.
   */
  remove(key) {
    this.cache.delete(key);
    try {
      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key));
        this.debounceTimers.delete(key);
      }
      this.storage.removeItem(this._getKey(key));
    } catch (err) {
      console.error(`[StorageService] Failed to remove key "${key}":`, err);
    }
  }

  /**
   * Clears the in-memory cache (e.g. after raw external updates or testing).
   */
  clearCache() {
    this.cache.clear();
  }
}

// Default storage instance
export const appStorage = new StorageService(window.localStorage, '');
