/**
 * StorageService - Pure Fabrication & Dependency Inversion Principle (DIP)
 * Shields domain logic from direct browser localStorage coupling (Protected Variations).
 */
export class StorageService {
  constructor(storage = window.localStorage, prefix = 'kcal_') {
    this.storage = storage;
    this.prefix = prefix;
    this.debounceTimers = new Map();
  }

  _getKey(key) {
    return `${this.prefix}${key}`;
  }

  /**
   * Get an item parsed from JSON with optional fallback
   */
  get(key, defaultValue = null) {
    try {
      const item = this.storage.getItem(this._getKey(key));
      return item !== null ? JSON.parse(item) : defaultValue;
    } catch (err) {
      console.error(`[StorageService] Failed to read key "${key}":`, err);
      return defaultValue;
    }
  }

  /**
   * Set an item serialized to JSON immediately
   */
  set(key, value) {
    try {
      this.storage.setItem(this._getKey(key), JSON.stringify(value));
    } catch (err) {
      console.error(`[StorageService] Failed to write key "${key}":`, err);
    }
  }

  /**
   * Set an item with debouncing to prevent excessive I/O
   */
  setDebounced(key, value, delayMs = 300) {
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }
    const timer = setTimeout(() => {
      this.set(key, value);
      this.debounceTimers.delete(key);
    }, delayMs);
    this.debounceTimers.set(key, timer);
  }

  /**
   * Remove an item
   */
  remove(key) {
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
}

// Default storage instance
export const appStorage = new StorageService(window.localStorage, '');
