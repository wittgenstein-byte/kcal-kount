import { appStorage } from './core/storage.js';
import { eventBus, APP_EVENTS } from './core/events.js';
import { mealService } from './domain/MealService.js';
import { favoriteService } from './domain/FavoriteService.js';
import { goalService } from './domain/GoalService.js';

// Date helpers needed for state initialization
export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Reactive application state store
 * Encapsulates properties and provides backward compatibility for existing code.
 */
export const state = {
  get entries() {
    return mealService.getAll();
  },
  set entries(val) {
    mealService.saveAll(val);
  },

  get favorites() {
    return favoriteService.getAll();
  },
  set favorites(val) {
    favoriteService.saveAll(val);
  },

  get tdeeGoal() {
    return goalService.getGoal();
  },
  set tdeeGoal(val) {
    goalService.setGoal(val);
  },

  get tdeeSettings() {
    return goalService.getSettings();
  },
  set tdeeSettings(val) {
    goalService.saveSettings(val);
  },

  currentDate: getLocalDateString(),
  theme: 'dark',
  activeView: 'dashboard',
  analyticsRange: 7,
  modelName: 'gemini-3.1-flash-lite',
  lastAiGuess: null
};

// Persistence functions kept for backward-compatible interface
export function saveEntries() {
  mealService.saveAll(state.entries);
}

export function saveFavorites() {
  favoriteService.saveAll(state.favorites);
}

export function saveTdeeGoal() {
  goalService.setGoal(state.tdeeGoal);
}

export function saveTdeeSettings() {
  goalService.saveSettings(state.tdeeSettings);
}

export function saveAiSettings() {
  appStorage.set('kcal_ai_model', state.modelName);
}

export function loadLocalStorage(showToastCallback) {
  try {
    // Theme
    const savedTheme = appStorage.get('kcal_tracker_theme', null);
    if (savedTheme) state.theme = savedTheme;

    // AI Model
    const savedModel = appStorage.get('kcal_ai_model', null);
    if (savedModel) state.modelName = savedModel;

    // Trigger state loaded event
    eventBus.emit(APP_EVENTS.STATE_LOADED, state);
  } catch (err) {
    console.error('Error loading localStorage:', err);
    if (showToastCallback) {
      showToastCallback('Failed to load saved tracker data.', 'warning');
    }
  }
}
