// Date helpers needed for state initialization
export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export let state = {
  entries: [],
  favorites: [],
  tdeeGoal: 2000,
  tdeeSettings: {
    calculationType: 'manual',
    gender: 'male',
    weight: '',
    height: '',
    age: '',
    activityLevel: '1.2',
    objective: '0'
  },
  currentDate: getLocalDateString(),
  theme: 'dark',
  activeView: 'dashboard',
  analyticsRange: 7,
  modelName: 'gemini-3.5-flash'
};

// Debounce timer for localStorage saves
let saveDebounceTimer = null;
const SAVE_DEBOUNCE_MS = 300;

export function saveEntries() {
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    localStorage.setItem('kcal_tracker_entries', JSON.stringify(state.entries));
  }, SAVE_DEBOUNCE_MS);
}

export function saveFavorites() {
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    localStorage.setItem('kcal_tracker_favorites', JSON.stringify(state.favorites));
  }, SAVE_DEBOUNCE_MS);
}

export function saveTdeeGoal() {
  localStorage.setItem('kcal_tracker_tdee_goal', state.tdeeGoal.toString());
}

export function saveTdeeSettings() {
  localStorage.setItem('kcal_tracker_tdee_settings', JSON.stringify(state.tdeeSettings));
}

export function saveAiSettings() {
  localStorage.setItem('kcal_ai_model', state.modelName);
}

export function loadLocalStorage(showToastCallback) {
  try {
    const entries = localStorage.getItem('kcal_tracker_entries');
    if (entries) state.entries = JSON.parse(entries);

    const favorites = localStorage.getItem('kcal_tracker_favorites');
    if (favorites) {
      state.favorites = JSON.parse(favorites);
    } else {
      // Seed initial favorites for better user experience
      state.favorites = [
        { id: 'fav-1', name: 'Greek Yogurt with Honey', calories: 220, mealType: 'breakfast' },
        { id: 'fav-2', name: 'Grilled Chicken Salad', calories: 450, mealType: 'lunch' },
        { id: 'fav-3', name: 'Baked Salmon & Broccoli', calories: 550, mealType: 'dinner' },
        { id: 'fav-4', name: 'Whey Protein Shake', calories: 180, mealType: 'snack' },
        { id: 'fav-5', name: 'Handful of Mixed Almonds', calories: 160, mealType: 'snack' }
      ];
      saveFavorites();
    }

    const tdeeGoal = localStorage.getItem('kcal_tracker_tdee_goal');
    if (tdeeGoal) state.tdeeGoal = parseInt(tdeeGoal, 10);

    const tdeeSettings = localStorage.getItem('kcal_tracker_tdee_settings');
    if (tdeeSettings) state.tdeeSettings = JSON.parse(tdeeSettings);

    const theme = localStorage.getItem('kcal_tracker_theme');
    if (theme) state.theme = theme;

    const modelName = localStorage.getItem('kcal_ai_model');
    if (modelName) state.modelName = modelName;
  } catch (err) {
    console.error('Error loading localStorage:', err);
    if (showToastCallback) {
      showToastCallback('Failed to load saved tracker data.', 'warning');
    }
  }
}
