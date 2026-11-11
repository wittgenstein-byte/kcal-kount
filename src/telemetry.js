import { appStorage } from './core/storage.js';

const TELEMETRY_KEY = 'scan_telemetry_log';
const MAX_TELEMETRY_LOGS = 50;

/**
 * TelemetryService - Tracks accuracy metrics of AI image predictions vs user-verified values
 */
export class TelemetryService {
  constructor(storage = appStorage) {
    this.storage = storage;
  }

  getTelemetryLog() {
    return this.storage.get(TELEMETRY_KEY, []) || [];
  }

  logScanTelemetry(aiGuess, userFinalPayload) {
    if (!aiGuess || !userFinalPayload) return;

    const telemetryLog = this.getTelemetryLog();

    const predCalories = Number(aiGuess.calories ?? 0);
    const predProtein = Number(aiGuess.protein ?? 0);
    const predCarbs = Number(aiGuess.carbs ?? 0);
    const predFat = Number(aiGuess.fat ?? 0);

    const corrCalories = Number(userFinalPayload.calories ?? 0);
    const corrProtein = Number(userFinalPayload.protein ?? 0);
    const corrCarbs = Number(userFinalPayload.carbs ?? 0);
    const corrFat = Number(userFinalPayload.fat ?? 0);

    const event = {
      mealId: userFinalPayload.id || null,
      timestamp: new Date().toISOString(),
      predicted: {
        calories: predCalories,
        protein: predProtein,
        carbs: predCarbs,
        fat: predFat
      },
      corrected: {
        calories: corrCalories,
        protein: corrProtein,
        carbs: corrCarbs,
        fat: corrFat
      },
      delta: {
        calories: corrCalories - predCalories,
        protein: corrProtein - predProtein,
        carbs: corrCarbs - predCarbs,
        fat: corrFat - predFat
      }
    };

    telemetryLog.push(event);

    // Keep only last N logs
    while (telemetryLog.length > MAX_TELEMETRY_LOGS) {
      telemetryLog.shift();
    }

    this.storage.set(TELEMETRY_KEY, telemetryLog);
  }

  updateTelemetryOnEdit(mealId, userFinalPayload) {
    if (!mealId || !userFinalPayload) return;

    const telemetryLog = this.getTelemetryLog();
    const eventIndex = telemetryLog.findIndex(e => e.mealId === mealId);

    if (eventIndex !== -1) {
      const event = telemetryLog[eventIndex];
      const corrCalories = Number(userFinalPayload.calories ?? 0);
      const corrProtein = Number(userFinalPayload.protein ?? 0);
      const corrCarbs = Number(userFinalPayload.carbs ?? 0);
      const corrFat = Number(userFinalPayload.fat ?? 0);

      event.corrected = {
        calories: corrCalories,
        protein: corrProtein,
        carbs: corrCarbs,
        fat: corrFat
      };

      event.delta = {
        calories: corrCalories - event.predicted.calories,
        protein: corrProtein - event.predicted.protein,
        carbs: corrCarbs - event.predicted.carbs,
        fat: corrFat - event.predicted.fat
      };

      this.storage.set(TELEMETRY_KEY, telemetryLog);
    }
  }

  removeTelemetryOnDelete(mealId) {
    if (!mealId) return;
    const telemetryLog = this.getTelemetryLog();
    const filtered = telemetryLog.filter(e => e.mealId !== mealId);
    if (filtered.length !== telemetryLog.length) {
      this.storage.set(TELEMETRY_KEY, filtered);
    }
  }

  clearTelemetryLog() {
    this.storage.remove(TELEMETRY_KEY);
  }

  async copyTelemetryLogToClipboard(showToast) {
    const log = this.getTelemetryLog();
    if (!log.length) {
      if (showToast) showToast('No telemetry logs to copy.', 'info');
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
      if (showToast) showToast(`Copied ${log.length} telemetry logs to clipboard!`, 'success');
    } catch (err) {
      console.error('Failed to copy telemetry to clipboard:', err);
      if (showToast) showToast('Failed to copy to clipboard.', 'warning');
    }
  }
}

export const telemetryService = new TelemetryService();

// Backward compatible functional exports
export const getTelemetryLog = () => telemetryService.getTelemetryLog();
export const logScanTelemetry = (a, b) => telemetryService.logScanTelemetry(a, b);
export const updateTelemetryOnEdit = (a, b) => telemetryService.updateTelemetryOnEdit(a, b);
export const removeTelemetryOnDelete = (a) => telemetryService.removeTelemetryOnDelete(a);
export const clearTelemetryLog = () => telemetryService.clearTelemetryLog();
export const copyTelemetryLogToClipboard = (cb) => telemetryService.copyTelemetryLogToClipboard(cb);
