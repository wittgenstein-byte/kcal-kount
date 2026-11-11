import { appStorage } from '../core/storage.js';
import { eventBus, APP_EVENTS } from '../core/events.js';

const STORAGE_KEY = 'kcal_tracker_favorites';

const DEFAULT_FAVORITES = [
  { id: 'fav-1', name: 'Greek Yogurt with Honey', calories: 220, mealType: 'breakfast' },
  { id: 'fav-2', name: 'Grilled Chicken Salad', calories: 450, mealType: 'lunch' },
  { id: 'fav-3', name: 'Baked Salmon & Broccoli', calories: 550, mealType: 'dinner' },
  { id: 'fav-4', name: 'Whey Protein Shake', calories: 180, mealType: 'snack' },
  { id: 'fav-5', name: 'Handful of Mixed Almonds', calories: 160, mealType: 'snack' }
];

/**
 * FavoriteService - Information Expert on saved favourite meals
 */
export class FavoriteService {
  constructor(storage = appStorage) {
    this.storage = storage;
  }

  getAll() {
    const list = this.storage.get(STORAGE_KEY, null);
    if (!list) {
      this.storage.set(STORAGE_KEY, DEFAULT_FAVORITES);
      return DEFAULT_FAVORITES;
    }
    return list;
  }

  saveAll(favorites) {
    this.storage.setDebounced(STORAGE_KEY, favorites, 300);
    eventBus.emit(APP_EVENTS.FAVORITES_CHANGED, favorites);
  }

  isDuplicate(name, calories) {
    const favorites = this.getAll();
    return favorites.some(fav =>
      fav.name.toLowerCase() === name.toLowerCase() &&
      parseInt(fav.calories, 10) === parseInt(calories, 10)
    );
  }

  addFavorite(name, calories, mealType = '') {
    if (this.isDuplicate(name, calories)) {
      return { success: false, reason: 'duplicate' };
    }

    const newFav = {
      id: 'fav-' + Date.now(),
      name: name.trim(),
      calories: parseInt(calories, 10),
      mealType: mealType || ''
    };

    const favorites = this.getAll();
    favorites.push(newFav);
    this.saveAll(favorites);
    return { success: true, item: newFav };
  }

  removeFavorite(id) {
    const favorites = this.getAll();
    const index = favorites.findIndex(f => f.id === id);
    if (index === -1) return null;

    const [deleted] = favorites.splice(index, 1);
    this.saveAll(favorites);
    return deleted;
  }

  toggleFavoriteFromMeal(meal) {
    const favorites = this.getAll();
    const existingIndex = favorites.findIndex(f =>
      f.name.toLowerCase() === meal.name.toLowerCase() &&
      parseInt(f.calories, 10) === parseInt(meal.calories, 10)
    );

    if (existingIndex !== -1) {
      const [removed] = favorites.splice(existingIndex, 1);
      this.saveAll(favorites);
      return { added: false, item: removed };
    } else {
      const newFav = {
        id: 'fav-' + Date.now(),
        name: meal.name,
        calories: parseInt(meal.calories, 10),
        mealType: meal.mealType || ''
      };
      favorites.push(newFav);
      this.saveAll(favorites);
      return { added: true, item: newFav };
    }
  }
}

export const favoriteService = new FavoriteService();
