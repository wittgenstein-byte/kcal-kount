import { appStorage } from './core/storage.js';
import { mealService } from './domain/MealService.js';
import { favoriteService } from './domain/FavoriteService.js';
import { goalService } from './domain/GoalService.js';

/**
 * BackupService - Pure Fabrication for data import and export
 */
export class BackupService {
  constructor(storage = appStorage) {
    this.storage = storage;
  }

  exportData(currentDateStr) {
    const telemetryLog = this.storage.get('scan_telemetry_log', []);

    const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      entries: mealService.getAll(),
      favorites: favoriteService.getAll(),
      tdeeGoal: goalService.getGoal(),
      tdeeSettings: goalService.getSettings(),
      telemetryLog: telemetryLog
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `kcalkount-backup-${currentDateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async importData(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file provided'));

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);

          if (!Array.isArray(data.entries) && !Array.isArray(data.favorites)) {
            throw new Error('Invalid backup file structure.');
          }

          if (data.entries && Array.isArray(data.entries)) {
            mealService.saveAll(data.entries);
          }
          if (data.favorites && Array.isArray(data.favorites)) {
            favoriteService.saveAll(data.favorites);
          }
          if (typeof data.tdeeGoal === 'number' || typeof data.tdeeGoal === 'string') {
            goalService.setGoal(data.tdeeGoal);
          }
          if (data.tdeeSettings) {
            goalService.saveSettings(data.tdeeSettings);
          }

          if (data.telemetryLog && Array.isArray(data.telemetryLog)) {
            this.storage.set('scan_telemetry_log', data.telemetryLog);
          } else {
            this.storage.remove('scan_telemetry_log');
          }

          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}

export const backupService = new BackupService();

// Backward compatible export functions
export function exportBackup(state, getLocalDateString, showToast) {
  backupService.exportData(getLocalDateString());
  if (showToast) showToast('Backup exported successfully!', 'success');
}

export function importBackup(file, state, renderAll, closeModal, showToast) {
  backupService.importData(file)
    .then(() => {
      if (renderAll) renderAll();
      const settingsModal = document.getElementById('settings-modal');
      if (settingsModal && closeModal) closeModal(settingsModal);
      if (showToast) showToast('Data restored successfully!', 'success');
    })
    .catch(err => {
      console.error('Import failed:', err);
      if (showToast) showToast(`Import failed: ${err.message}`, 'warning');
    });
}
