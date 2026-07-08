/**
 * Telemetry logger for AI scan prediction metrics.
 * Tracks the difference between AI predictions and final user-corrected values.
 */

/**
 * Retrieve the current scan telemetry log from localStorage.
 * @returns {Array} List of telemetry events.
 */
export function getTelemetryLog() {
  try {
    const log = localStorage.getItem('scan_telemetry_log');
    return log ? JSON.parse(log) : [];
  } catch (err) {
    console.error('Error parsing scan telemetry log:', err);
    return [];
  }
}

/**
 * Log a telemetry event comparing the original AI guess with the user's saved/corrected values.
 * @param {object} aiGuess - Original AI prediction values.
 * @param {object} userFinalPayload - Final meal payload saved by the user.
 */
export function logScanTelemetry(aiGuess, userFinalPayload) {
  if (!aiGuess || !userFinalPayload) return;

  const telemetryLog = getTelemetryLog();

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
  localStorage.setItem('scan_telemetry_log', JSON.stringify(telemetryLog));

  console.log(`📊 Telemetry logged (${telemetryLog.length}/50):`, event);
}

/**
 * Update a telemetry event when the user edits a saved meal entry.
 * @param {string} mealId - ID of the meal entry that was edited.
 * @param {object} userFinalPayload - Updated meal values.
 */
export function updateTelemetryOnEdit(mealId, userFinalPayload) {
  if (!mealId || !userFinalPayload) return;

  const telemetryLog = getTelemetryLog();
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

    // Recompute deltas
    event.delta = {
      calories: corrCalories - event.predicted.calories,
      protein: corrProtein - event.predicted.protein,
      carbs: corrCarbs - event.predicted.carbs,
      fat: corrFat - event.predicted.fat
    };

    // Update timestamp to show when it was corrected
    event.timestamp = new Date().toISOString();

    localStorage.setItem('scan_telemetry_log', JSON.stringify(telemetryLog));
    console.log('📊 Telemetry updated (edit):', event);
  }
}

/**
 * Remove a telemetry event when the user deletes a meal entry.
 * @param {string} mealId - ID of the meal entry that was deleted.
 */
export function removeTelemetryOnDelete(mealId) {
  if (!mealId) return;

  const telemetryLog = getTelemetryLog();
  const filteredLog = telemetryLog.filter(e => e.mealId !== mealId);

  if (filteredLog.length !== telemetryLog.length) {
    localStorage.setItem('scan_telemetry_log', JSON.stringify(filteredLog));
    console.log(`📊 Telemetry removed (delete mealId: ${mealId})`);
  }
}

/**
 * Clear the scan telemetry log from localStorage.
 */
export function clearTelemetryLog() {
  localStorage.removeItem('scan_telemetry_log');
  console.log('📊 Telemetry log cleared');
}

/**
 * Copy the scan telemetry log as a JSON string to the clipboard.
 * @param {function} showToast - Toast callback to notify the user.
 */
export function copyTelemetryLogToClipboard(showToast) {
  const telemetryLog = getTelemetryLog();
  const text = JSON.stringify(telemetryLog, null, 2);

  navigator.clipboard.writeText(text)
    .then(() => {
      showToast('Telemetry logs copied to clipboard!', 'success');
    })
    .catch(err => {
      console.error('Failed to copy telemetry logs:', err);
      showToast('Failed to copy telemetry logs.', 'warning');
    });
}
