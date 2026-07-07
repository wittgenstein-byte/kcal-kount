import { saveEntries, saveFavorites, saveTdeeGoal, saveTdeeSettings } from './state.js';

/**
 * Handles exporting all user data to a downloadable JSON file.
 * 
 * @param {object} state - Application state.
 * @param {function} getLocalDateString - Helper to get local date string.
 * @param {function} showToast - Toast notification function.
 */
export function exportBackup(state, getLocalDateString, showToast) {
  let telemetryLog = [];
  try {
    const rawLog = localStorage.getItem('scan_telemetry_log');
    if (rawLog) telemetryLog = JSON.parse(rawLog);
  } catch (err) {
    console.error('Error reading telemetry log for backup export:', err);
  }

  const backupData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    entries: state.entries,
    favorites: state.favorites,
    tdeeGoal: state.tdeeGoal,
    tdeeSettings: state.tdeeSettings,
    telemetryLog: telemetryLog
  };
  
  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `kcalkount-backup-${getLocalDateString()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('Backup exported successfully!', 'success');
}

/**
 * Handles uploading and restoring data from a JSON backup file.
 * 
 * @param {File} file - Selected backup file.
 * @param {object} state - Application state to overwrite.
 * @param {function} renderAll - Callback to update all views.
 * @param {function} closeModal - Callback to close modal windows.
 * @param {function} showToast - Toast notification function.
 */
export function importBackup(file, state, renderAll, closeModal, showToast) {
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      
      // Simple validation
      if (!Array.isArray(data.entries) && !Array.isArray(data.favorites)) {
        throw new Error('Invalid backup file structure.');
      }
      
      if (data.entries) state.entries = data.entries;
      if (data.favorites) state.favorites = data.favorites;
      if (typeof data.tdeeGoal === 'number') state.tdeeGoal = data.tdeeGoal;
      if (data.tdeeSettings) state.tdeeSettings = data.tdeeSettings;
      
      if (data.telemetryLog && Array.isArray(data.telemetryLog)) {
        localStorage.setItem('scan_telemetry_log', JSON.stringify(data.telemetryLog));
      } else {
        // If importing a backup that doesn't have telemetry, clear it or leave it as-is?
        // Let's clear it to keep data sync with backup file.
        localStorage.removeItem('scan_telemetry_log');
      }
      
      // Save state
      saveEntries();
      saveFavorites();
      saveTdeeGoal();
      saveTdeeSettings();
      
      // Render
      renderAll();
      
      showToast('Backup restored successfully!', 'success');
      
      // Close settings modal
      const settingsModal = document.getElementById('settings-modal');
      if (settingsModal) closeModal(settingsModal);
    } catch (err) {
      console.error('Error importing backup:', err);
      showToast('Failed to parse backup. Ensure it is a valid KcalKount JSON file.', 'warning');
    }
  };
  reader.readAsText(file);
}
