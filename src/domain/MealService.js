import { appStorage } from '../core/storage.js';
import { eventBus, APP_EVENTS } from '../core/events.js';

const STORAGE_KEY = 'kcal_tracker_entries';

/**
 * MealService - Information Expert & Creator pattern
 * Responsible for creating, querying, updating, and aggregating meals.
 */
export class MealService {
  constructor(storage = appStorage) {
    this.storage = storage;
  }

  getAll() {
    return this.storage.get(STORAGE_KEY, []) || [];
  }

  saveAll(entries) {
    this.storage.setDebounced(STORAGE_KEY, entries, 300);
    eventBus.emit(APP_EVENTS.MEALS_CHANGED, entries);
  }

  getEntriesByDate(date) {
    const entries = this.getAll();
    return entries.filter(e => e.date === date);
  }

  getDailyMetrics(date) {
    const dailyEntries = this.getEntriesByDate(date);
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;

    dailyEntries.forEach(item => {
      totalCalories += Number(item.calories || 0);
      if (item.protein) totalProtein += Number(item.protein);
      if (item.fat) totalFat += Number(item.fat);
      if (item.carb) totalCarbs += Number(item.carb);
    });

    return {
      entries: dailyEntries,
      totalCalories,
      totalProtein: Math.round(totalProtein),
      totalFat: Math.round(totalFat),
      totalCarbs: Math.round(totalCarbs),
      count: dailyEntries.length
    };
  }

  /**
   * Creator pattern: Encapsulates creation of a valid MealEntry
   */
  createEntry(payload) {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const newEntry = {
      id: 'meal-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      name: payload.name.trim(),
      calories: parseInt(payload.calories, 10),
      mealType: payload.mealType || '',
      date: payload.date,
      time: payload.time || timeString,
      aiScanned: Boolean(payload.aiScanned),
      protein: payload.protein !== undefined && payload.protein !== null && payload.protein !== '' ? parseFloat(payload.protein) : null,
      fat: payload.fat !== undefined && payload.fat !== null && payload.fat !== '' ? parseFloat(payload.fat) : null,
      carb: payload.carb !== undefined && payload.carb !== null && payload.carb !== '' ? parseFloat(payload.carb) : null,
      image: payload.image || ''
    };

    const entries = this.getAll();
    entries.push(newEntry);
    this.saveAll(entries);
    return newEntry;
  }

  updateEntry(id, payload) {
    const entries = this.getAll();
    const index = entries.findIndex(e => e.id === id);
    if (index === -1) return null;

    const existing = entries[index];
    const updated = {
      ...existing,
      name: payload.name !== undefined ? payload.name.trim() : existing.name,
      calories: payload.calories !== undefined ? parseInt(payload.calories, 10) : existing.calories,
      date: payload.date !== undefined ? payload.date : existing.date,
      protein: payload.protein !== undefined && payload.protein !== null && payload.protein !== '' ? parseFloat(payload.protein) : (payload.protein === null ? null : existing.protein),
      fat: payload.fat !== undefined && payload.fat !== null && payload.fat !== '' ? parseFloat(payload.fat) : (payload.fat === null ? null : existing.fat),
      carb: payload.carb !== undefined && payload.carb !== null && payload.carb !== '' ? parseFloat(payload.carb) : (payload.carb === null ? null : existing.carb),
      aiScanned: payload.aiScanned !== undefined ? Boolean(payload.aiScanned) : existing.aiScanned,
      image: payload.image !== undefined ? payload.image : existing.image
    };

    entries[index] = updated;
    this.saveAll(entries);
    return updated;
  }

  deleteEntry(id) {
    const entries = this.getAll();
    const index = entries.findIndex(e => e.id === id);
    if (index === -1) return null;

    const [deleted] = entries.splice(index, 1);
    this.saveAll(entries);
    return deleted;
  }
}

export const mealService = new MealService();
