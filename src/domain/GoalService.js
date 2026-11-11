import { appStorage } from '../core/storage.js';
import { eventBus, APP_EVENTS } from '../core/events.js';
import { calculateTdee } from '../calculator.js';

const TDEE_GOAL_KEY = 'kcal_tracker_tdee_goal';
const TDEE_SETTINGS_KEY = 'kcal_tracker_tdee_settings';

const DEFAULT_SETTINGS = {
  calculationType: 'manual',
  gender: 'male',
  weight: '',
  height: '',
  age: '',
  activityLevel: '1.2',
  objective: '0'
};

/**
 * GoalService - Information Expert for TDEE & Nutrition Goals
 */
export class GoalService {
  constructor(storage = appStorage) {
    this.storage = storage;
  }

  getGoal() {
    const goal = this.storage.get(TDEE_GOAL_KEY, 2000);
    return typeof goal === 'number' ? goal : parseInt(goal, 10) || 2000;
  }

  setGoal(calories) {
    const val = parseInt(calories, 10);
    if (!val || val < 500) return false;
    this.storage.set(TDEE_GOAL_KEY, val);
    eventBus.emit(APP_EVENTS.GOAL_CHANGED, { goal: val, settings: this.getSettings() });
    return true;
  }

  getSettings() {
    return this.storage.get(TDEE_SETTINGS_KEY, DEFAULT_SETTINGS) || DEFAULT_SETTINGS;
  }

  saveSettings(settings) {
    this.storage.set(TDEE_SETTINGS_KEY, settings);
  }

  calculateAndApply({ age, weight, height, activityLevel, objective, isMale }) {
    const calculatedTdee = calculateTdee(age, weight, height, activityLevel, objective, isMale);
    if (calculatedTdee === null) return null;

    const newSettings = {
      calculationType: 'calculated',
      gender: isMale ? 'male' : 'female',
      weight,
      height,
      age,
      activityLevel: activityLevel.toString(),
      objective: objective.toString()
    };

    this.storage.set(TDEE_GOAL_KEY, calculatedTdee);
    this.storage.set(TDEE_SETTINGS_KEY, newSettings);
    eventBus.emit(APP_EVENTS.GOAL_CHANGED, { goal: calculatedTdee, settings: newSettings });

    return calculatedTdee;
  }
}

export const goalService = new GoalService();
