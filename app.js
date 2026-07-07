import { 
  state, 
  loadLocalStorage, 
  saveEntries, 
  saveFavorites, 
  saveTdeeGoal, 
  saveTdeeSettings, 
  saveAiSettings,
  getLocalDateString 
} from './src/state.js';

import { 
  logScanTelemetry,
  clearTelemetryLog,
  copyTelemetryLogToClipboard,
  getTelemetryLog,
  updateTelemetryOnEdit,
  removeTelemetryOnDelete
} from './src/telemetry.js';

import { calculateTdee } from './src/calculator.js';
import { exportBackup, importBackup } from './src/backup.js';
import { 
  setupCameraListeners, 
  closeCameraModal, 
  loadAiSettingsIntoForm 
} from './src/camera.js';


import { 
  showToast, 
  formatDateFriendly, 
  openModal, 
  closeModal, 
  renderTdeeInputs, 
  renderDailyLog, 
  renderFavorites, 
  updateSummaryMetrics, 
  renderAnalyticsView 
} from './src/ui.js';

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  loadLocalStorage(showToast);
  initTheme();
  setupEventListeners();
  updateDateDisplay();
  renderAll();
});

function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
}

function renderActiveView() {
  const viewDashboardBtn = document.getElementById('view-dashboard-btn');
  const viewAnalyticsBtn = document.getElementById('view-analytics-btn');
  const dashboardView = document.getElementById('dashboard-view');
  const analyticsView = document.getElementById('analytics-view');

  if (viewDashboardBtn && viewAnalyticsBtn && dashboardView && analyticsView) {
    if (state.activeView === 'dashboard') {
      viewDashboardBtn.classList.add('active');
      viewAnalyticsBtn.classList.remove('active');
      dashboardView.classList.remove('hidden');
      analyticsView.classList.add('hidden');
    } else {
      viewAnalyticsBtn.classList.add('active');
      viewDashboardBtn.classList.remove('active');
      analyticsView.classList.remove('hidden');
      dashboardView.classList.add('hidden');
      renderAnalyticsView();
    }
  }
}

function renderAll() {
  renderActiveView();
  renderTdeeInputs();
  renderDailyLog();
  renderFavorites();
  updateSummaryMetrics();
}

function updateDateDisplay() {
  const dateDisplay = document.getElementById('date-display');
  const datePicker = document.getElementById('date-picker');
  
  if (dateDisplay) dateDisplay.textContent = formatDateFriendly(state.currentDate);
  if (datePicker) datePicker.value = state.currentDate;
}

function shiftDate(days) {
  const parts = state.currentDate.split('-');
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  date.setDate(date.getDate() + days);
  state.currentDate = getLocalDateString(date);
  updateDateDisplay();
  renderAll();
  showToast(`View switched to ${formatDateFriendly(state.currentDate)}`, 'info');
}

// EVENT LISTENERS
function setupEventListeners() {
  // Theme Toggle
  const themeToggleBtn = document.getElementById('theme-toggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      initTheme();
      localStorage.setItem('kcal_tracker_theme', state.theme);
      showToast(`Switched to ${state.theme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
      if (state.activeView === 'analytics') {
        setTimeout(renderAnalyticsView, 100);
      }
    });
  }

  // Date Navigation
  const prevDayBtn = document.getElementById('prev-day-btn');
  const nextDayBtn = document.getElementById('next-day-btn');
  const todayBtn = document.getElementById('today-btn');
  const datePickerInput = document.getElementById('date-picker');

  if (prevDayBtn) prevDayBtn.addEventListener('click', () => shiftDate(-1));
  if (nextDayBtn) nextDayBtn.addEventListener('click', () => shiftDate(1));
  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      state.currentDate = getLocalDateString();
      updateDateDisplay();
      renderAll();
      showToast('Jumped to Today', 'info');
    });
  }
  if (datePickerInput) {
    datePickerInput.addEventListener('change', (e) => {
      if (e.target.value) {
        state.currentDate = e.target.value;
        updateDateDisplay();
        renderAll();
        showToast(`View switched to ${formatDateFriendly(state.currentDate)}`, 'info');
      }
    });
  }

  // TDEE Goal Form Toggles
  const toggleManualBtn = document.getElementById('toggle-manual-btn');
  const toggleCalcBtn = document.getElementById('toggle-calc-btn');
  const manualFormWrapper = document.getElementById('manual-goal-form-wrapper');
  const calcFormWrapper = document.getElementById('tdee-calc-form-wrapper');

  if (toggleManualBtn && toggleCalcBtn && manualFormWrapper && calcFormWrapper) {
    toggleManualBtn.addEventListener('click', () => {
      toggleManualBtn.classList.add('active');
      toggleCalcBtn.classList.remove('active');
      manualFormWrapper.classList.remove('hidden');
      calcFormWrapper.classList.add('hidden');
      state.tdeeSettings.calculationType = 'manual';
      saveTdeeSettings();
    });

    toggleCalcBtn.addEventListener('click', () => {
      toggleCalcBtn.classList.add('active');
      toggleManualBtn.classList.remove('active');
      calcFormWrapper.classList.remove('hidden');
      manualFormWrapper.classList.add('hidden');
      state.tdeeSettings.calculationType = 'calculated';
      saveTdeeSettings();
      renderTdeeInputs();
    });
  }

  // Goal Form Submits
  const manualGoalForm = document.getElementById('manual-goal-form');
  if (manualGoalForm) {
    manualGoalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = parseInt(document.getElementById('manual-goal-input').value, 10);
      if (val && val >= 500) {
        state.tdeeGoal = val;
        saveTdeeGoal();
        renderAll();
        showToast(`Goal updated to ${val} kcal!`, 'success');
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) closeModal(settingsModal);
      }
    });
  }

  const tdeeCalcForm = document.getElementById('tdee-calculator-form');
  if (tdeeCalcForm) {
    tdeeCalcForm.addEventListener('submit', (e) => {
      e.preventDefault();
      calculateTdeeFromForm();
    });
  }

  // Settings Modal Toggle
  const settingsBtn = document.getElementById('settings-btn');
  const closeSettingsModal = document.getElementById('close-settings-modal');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const settingsModal = document.getElementById('settings-modal');

  // Settings Modal Tabs Switching
  const settingsTabGoals = document.getElementById('settings-tab-goals');
  const settingsTabSystem = document.getElementById('settings-tab-system');
  const settingsContentGoals = document.getElementById('settings-content-goals');
  const settingsContentSystem = document.getElementById('settings-content-system');

  if (settingsTabGoals && settingsTabSystem && settingsContentGoals && settingsContentSystem) {
    settingsTabGoals.addEventListener('click', () => {
      settingsTabGoals.classList.add('active');
      settingsTabSystem.classList.remove('active');
      settingsContentGoals.classList.remove('hidden');
      settingsContentSystem.classList.add('hidden');
    });

    settingsTabSystem.addEventListener('click', () => {
      settingsTabSystem.classList.add('active');
      settingsTabGoals.classList.remove('active');
      settingsContentSystem.classList.remove('hidden');
      settingsContentGoals.classList.add('hidden');
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      openModal(settingsModal);
      if (settingsTabGoals) settingsTabGoals.click();
      renderTdeeInputs();
      loadAiSettingsIntoForm();
      updateTelemetryCountLabel();
    });
  }
  if (closeSettingsModal) closeSettingsModal.addEventListener('click', () => closeModal(settingsModal));
  if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => closeModal(settingsModal));
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeModal(settingsModal);
    });
  }

  // Meal Modals Interactions
  const addMealFloatingBtn = document.getElementById('add-meal-floating-btn');
  const closeMealModal = document.getElementById('close-meal-modal');
  const cancelMealBtn = document.getElementById('cancel-meal-btn');
  const mealModal = document.getElementById('meal-modal');

  if (addMealFloatingBtn) addMealFloatingBtn.addEventListener('click', () => openMealModalForCreate());
  if (closeMealModal) closeMealModal.addEventListener('click', () => closeModal(mealModal));
  if (cancelMealBtn) cancelMealBtn.addEventListener('click', () => closeModal(mealModal));
  if (mealModal) {
    mealModal.addEventListener('click', (e) => {
      if (e.target === mealModal) closeModal(mealModal);
    });
  }

  const mealForm = document.getElementById('meal-form');
  if (mealForm) {
    mealForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleMealFormSubmit();
    });
  }

  // Favorite Modals Interactions
  const addFavoriteBtn = document.getElementById('add-favorite-btn');
  const closeFavModal = document.getElementById('close-fav-modal');
  const cancelFavBtn = document.getElementById('cancel-fav-btn');
  const favModal = document.getElementById('fav-modal');

  if (addFavoriteBtn) addFavoriteBtn.addEventListener('click', () => openFavModalForCreate());
  if (closeFavModal) closeFavModal.addEventListener('click', () => closeModal(favModal));
  if (cancelFavBtn) cancelFavBtn.addEventListener('click', () => closeModal(favModal));
  if (favModal) {
    favModal.addEventListener('click', (e) => {
      if (e.target === favModal) closeModal(favModal);
    });
  }

  const favForm = document.getElementById('fav-form');
  if (favForm) {
    favForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleFavFormSubmit();
    });
  }

  // Favorite Search
  const favSearchInput = document.getElementById('fav-search');
  if (favSearchInput) {
    favSearchInput.addEventListener('input', () => {
      renderFavorites(favSearchInput.value);
    });
  }

  // Quick Log input listener
  const quickLogInput = document.getElementById('quick-log-input');
  if (quickLogInput) {
    quickLogInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = quickLogInput.value.trim();
        if (!val) return;
        const match = val.match(/^(.*?)\s+(\d+)$/);
        if (!match) {
          showToast("Format: 'Food Name Calories' (e.g. Banana 105)", "warning");
          return;
        }
        const name = match[1].trim();
        const calories = parseInt(match[2], 10);
        if (!name || isNaN(calories) || calories <= 0) {
          showToast("Please enter a valid food name and positive calorie count.", "warning");
          return;
        }

        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        const newEntry = {
          id: 'meal-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          name,
          calories,
          mealType: '',
          date: state.currentDate,
          time: timeString,
          aiScanned: false,
          protein: null,
          fat: null,
          carb: null
        };

        state.entries.push(newEntry);
        saveEntries();
        renderAll();
        showToast(`Logged "${name}" (${calories} kcal)`, 'success');
        quickLogInput.value = '';
      }
    });
  }

  // Close limit warning banner
  const closeWarningBtn = document.getElementById('close-warning-btn');
  if (closeWarningBtn) {
    closeWarningBtn.addEventListener('click', () => {
      document.getElementById('limit-warning').classList.add('hidden');
    });
  }

  // View Switcher Tabs
  const viewDashboardBtn = document.getElementById('view-dashboard-btn');
  const viewAnalyticsBtn = document.getElementById('view-analytics-btn');
  const dashboardView = document.getElementById('dashboard-view');
  const analyticsView = document.getElementById('analytics-view');

  if (viewDashboardBtn && viewAnalyticsBtn && dashboardView && analyticsView) {
    viewDashboardBtn.addEventListener('click', () => {
      state.activeView = 'dashboard';
      renderActiveView();
    });

    viewAnalyticsBtn.addEventListener('click', () => {
      state.activeView = 'analytics';
      renderActiveView();
    });
  }



  // Analytics Range Toggle Buttons
  const range7dBtn = document.getElementById('range-7d-btn');
  const range30dBtn = document.getElementById('range-30d-btn');

  if (range7dBtn && range30dBtn) {
    range7dBtn.addEventListener('click', () => {
      state.analyticsRange = 7;
      range7dBtn.classList.add('active');
      range30dBtn.classList.remove('active');
      renderAnalyticsView();
    });

    range30dBtn.addEventListener('click', () => {
      state.analyticsRange = 30;
      range30dBtn.classList.add('active');
      range7dBtn.classList.remove('active');
      renderAnalyticsView();
    });
  }

  // Data Export & Import Backup
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFileInput = document.getElementById('import-file-input');

  if (exportBtn) {
    exportBtn.addEventListener('click', () => exportBackup(state, getLocalDateString, showToast));
  }

  if (importBtn && importFileInput) {
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        importBackup(e.target.files[0], state, () => {
          renderAll();
          updateTelemetryCountLabel();
        }, closeModal, showToast);
        e.target.value = '';
      }
    });
  }

  // Telemetry Actions Event Listeners
  const copyTelemetryBtn = document.getElementById('copy-telemetry-btn');
  const clearTelemetryBtn = document.getElementById('clear-telemetry-btn');

  if (copyTelemetryBtn) {
    copyTelemetryBtn.addEventListener('click', () => {
      copyTelemetryLogToClipboard(showToast);
    });
  }

  if (clearTelemetryBtn) {
    clearTelemetryBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all telemetry logs?')) {
        clearTelemetryLog();
        updateTelemetryCountLabel();
        showToast('Telemetry logs cleared.', 'info');
      }
    });
  }

  // Global window escape key listener
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(mealModal);
      closeModal(favModal);
      closeModal(settingsModal);
      closeCameraModal();
    }
  });

  // Event delegation on Daily Meal Log (Edit, Delete, Favorite Toggle)
  const mealList = document.getElementById('meal-list');
  if (mealList) {
    mealList.addEventListener('click', (e) => {
      const btnFav = e.target.closest('.btn-fav');
      const btnEdit = e.target.closest('.btn-edit');
      const btnDelete = e.target.closest('.btn-delete');
      
      if (btnFav) {
        const id = btnFav.getAttribute('data-id');
        handleFavoriteToggle(id);
      } else if (btnEdit) {
        const id = btnEdit.getAttribute('data-id');
        const entry = state.entries.find(item => item.id === id);
        if (entry) openMealModalForEdit(entry);
      } else if (btnDelete) {
        const id = btnDelete.getAttribute('data-id');
        deleteMealEntry(id);
      }
    });
  }

  // Event delegation on Favorites List (Add/Log, Delete Favorite)
  const favoritesList = document.getElementById('favorites-list');
  if (favoritesList) {
    favoritesList.addEventListener('click', (e) => {
      const btnAdd = e.target.closest('.fav-add-btn');
      const btnDel = e.target.closest('.fav-del-btn');
      
      if (btnAdd) {
        const id = btnAdd.getAttribute('data-id');
        const favorite = state.favorites.find(item => item.id === id);
        if (favorite) logFavoriteMeal(favorite);
      } else if (btnDel) {
        const id = btnDel.getAttribute('data-id');
        deleteFavoriteItem(id);
      }
    });
  }

  // Camera / AI Scan Setup
  setupCameraListeners();
}

// BMR / TDEE MATH DISPATCHER
function calculateTdeeFromForm() {
  const age = parseInt(document.getElementById('calc-age').value, 10);
  const weight = parseFloat(document.getElementById('calc-weight').value);
  const height = parseFloat(document.getElementById('calc-height').value);
  const activityLevel = parseFloat(document.getElementById('calc-activity').value);
  const objective = parseFloat(document.getElementById('calc-objective').value);
  const isMale = document.getElementById('gender-male').checked;

  const calculatedTdee = calculateTdee(age, weight, height, activityLevel, objective, isMale);
  
  if (calculatedTdee === null) {
    showToast('Please fill out all numeric TDEE values.', 'warning');
    return;
  }

  state.tdeeGoal = calculatedTdee;
  saveTdeeGoal();

  state.tdeeSettings = {
    calculationType: 'calculated',
    gender: isMale ? 'male' : 'female',
    weight,
    height,
    age,
    activityLevel: activityLevel.toString(),
    objective: objective.toString()
  };
  saveTdeeSettings();

  renderAll();
  showToast(`Calculated TDEE: ${calculatedTdee} kcal goal applied!`, 'success');
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal) closeModal(settingsModal);
}

// MEAL LOG CRUD DISPATCHERS
function openMealModalForCreate() {
  state.lastAiGuess = null;
  const mealModal = document.getElementById('meal-modal');
  document.getElementById('meal-modal-title').textContent = 'Log Meal Entry';
  document.getElementById('meal-id-input').value = '';

  // Pre-fill name and calories from consolidated entry bar if present
  const quickLogInputEl = document.getElementById('quick-log-input');
  let prefillName = '';
  let prefillCalories = '';
  if (quickLogInputEl) {
    const rawVal = quickLogInputEl.value.trim();
    if (rawVal) {
      const match = rawVal.match(/^(.*?)\s+(\d+)$/);
      if (match) {
        prefillName = match[1].trim();
        prefillCalories = match[2];
      } else {
        prefillName = rawVal;
      }
    }
  }

  document.getElementById('meal-name-input').value = prefillName;
  document.getElementById('meal-calories-input').value = prefillCalories;
  document.getElementById('meal-date-input').value = state.currentDate;
  document.getElementById('save-meal-btn').textContent = 'Log Entry';

  // Clear macro hidden fields
  document.getElementById('meal-protein-input').value = '';
  document.getElementById('meal-fat-input').value = '';
  document.getElementById('meal-carb-input').value = '';
  document.getElementById('meal-ai-scanned').value = '';
  const macroPreview = document.getElementById('meal-macro-preview');
  if (macroPreview) macroPreview.classList.add('hidden');

  openModal(mealModal);
}

function openMealModalForEdit(entry) {
  state.lastAiGuess = null;
  const mealModal = document.getElementById('meal-modal');
  document.getElementById('meal-modal-title').textContent = 'Edit Meal Entry';
  document.getElementById('meal-id-input').value = entry.id;
  document.getElementById('meal-name-input').value = entry.name;
  document.getElementById('meal-calories-input').value = entry.calories;
  document.getElementById('meal-date-input').value = entry.date;
  document.getElementById('save-meal-btn').textContent = 'Update Entry';

  // Populate macro fields if they exist
  document.getElementById('meal-protein-input').value = entry.protein !== undefined && entry.protein !== null ? entry.protein : '';
  document.getElementById('meal-fat-input').value = entry.fat !== undefined && entry.fat !== null ? entry.fat : '';
  document.getElementById('meal-carb-input').value = entry.carb !== undefined && entry.carb !== null ? entry.carb : '';
  document.getElementById('meal-ai-scanned').value = entry.aiScanned ? '1' : '';
  const macroPreview = document.getElementById('meal-macro-preview');
  if (macroPreview) macroPreview.classList.add('hidden');

  openModal(mealModal);
}

function handleMealFormSubmit() {
  const id = document.getElementById('meal-id-input').value;
  const name = document.getElementById('meal-name-input').value.trim();
  const calories = parseInt(document.getElementById('meal-calories-input').value, 10);
  const date = document.getElementById('meal-date-input').value;

  // Read macro fields (only present for AI-scanned meals)
  const proteinRaw = document.getElementById('meal-protein-input').value;
  const fatRaw = document.getElementById('meal-fat-input').value;
  const carbRaw = document.getElementById('meal-carb-input').value;
  const aiScanned = document.getElementById('meal-ai-scanned').value === '1';

  const protein = proteinRaw !== '' ? parseFloat(proteinRaw) : null;
  const fat = fatRaw !== '' ? parseFloat(fatRaw) : null;
  const carb = carbRaw !== '' ? parseFloat(carbRaw) : null;

  if (!name || isNaN(calories) || !date) {
    showToast('Please enter both a name and valid calories.', 'warning');
    return;
  }

  const mealModal = document.getElementById('meal-modal');

  if (id) {
    // Update Mode
    const index = state.entries.findIndex(e => e.id === id);
    if (index !== -1) {
      const wasAiScanned = state.entries[index].aiScanned;
      state.entries[index].name = name;
      state.entries[index].calories = calories;
      state.entries[index].date = date;
      state.entries[index].protein = protein;
      state.entries[index].fat = fat;
      state.entries[index].carb = carb;
      state.entries[index].aiScanned = aiScanned;

      // Update telemetry log if this meal was AI scanned
      if (wasAiScanned || aiScanned) {
        updateTelemetryOnEdit(id, {
          calories: calories,
          protein: protein,
          fat: fat,
          carbs: carb
        });
      }

      saveEntries();
      renderAll();
      showToast(`Updated entry: "${name}"`, 'success');
    }
  } else {
    // Create Mode
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const newEntry = {
      id: 'meal-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      name,
      calories,
      mealType: '',
      date,
      time: timeString,
      // AI scan fields
      aiScanned: aiScanned || false,
      protein: protein,
      fat: fat,
      carb: carb
    };

    state.entries.push(newEntry);

    // Log AI Scan Telemetry if applicable
    if (aiScanned && state.lastAiGuess) {
      logScanTelemetry(state.lastAiGuess, {
        id: newEntry.id,
        calories: calories,
        protein: protein,
        fat: fat,
        carbs: carb
      });
      state.lastAiGuess = null;
    }

    saveEntries();
    renderAll();
    showToast(`Logged "${name}" (${calories} kcal)`, 'success');
  }

  // Clean up macro preview
  const macroPreview = document.getElementById('meal-macro-preview');
  if (macroPreview) macroPreview.classList.add('hidden');

  closeModal(mealModal);
}

function deleteMealEntry(id) {
  const index = state.entries.findIndex(e => e.id === id);
  if (index !== -1) {
    const name = state.entries[index].name;
    const wasAiScanned = state.entries[index].aiScanned;
    state.entries.splice(index, 1);

    // Remove from telemetry log if applicable
    if (wasAiScanned) {
      removeTelemetryOnDelete(id);
    }

    saveEntries();
    renderAll();
    showToast(`Deleted "${name}"`, 'success');
  }
}

// FAVORITES CRUD DISPATCHERS
function openFavModalForCreate() {
  const favModal = document.getElementById('fav-modal');
  document.getElementById('fav-modal-title').textContent = 'Create Favorite Meal';
  document.getElementById('fav-id-input').value = '';
  document.getElementById('fav-name-input').value = '';
  document.getElementById('fav-calories-input').value = '';

  openModal(favModal);
}

function handleFavFormSubmit() {
  const name = document.getElementById('fav-name-input').value.trim();
  const calories = parseInt(document.getElementById('fav-calories-input').value, 10);

  if (!name || isNaN(calories)) {
    showToast('Please enter both name and calories.', 'warning');
    return;
  }

  const isDuplicate = state.favorites.some(fav => 
    fav.name.toLowerCase() === name.toLowerCase() && 
    parseInt(fav.calories, 10) === calories
  );

  if (isDuplicate) {
    showToast('This item is already in your favorites.', 'info');
    closeModal(document.getElementById('fav-modal'));
    return;
  }

  const newFav = {
    id: 'fav-' + Date.now(),
    name,
    calories,
    mealType: ''
  };

  state.favorites.push(newFav);
  saveFavorites();
  closeModal(document.getElementById('fav-modal'));
  renderAll();
  showToast(`Added "${name}" to Favorites!`, 'success');
}

function deleteFavoriteItem(id) {
  const index = state.favorites.findIndex(item => item.id === id);
  if (index !== -1) {
    const name = state.favorites[index].name;
    state.favorites.splice(index, 1);
    saveFavorites();
    renderAll();
    showToast(`Removed "${name}" from Favorites`, 'success');
  }
}

function logFavoriteMeal(fav) {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const newEntry = {
    id: 'meal-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    name: fav.name,
    calories: fav.calories,
    mealType: '',
    date: state.currentDate,
    time: timeString
  };

  state.entries.push(newEntry);
  saveEntries();
  renderAll();
  showToast(`Logged "${fav.name}" (${fav.calories} kcal)`, 'success');
}

// Toggle Favorite Status from Daily Log Item Click
function handleFavoriteToggle(id) {
  const entry = state.entries.find(e => e.id === id);
  if (!entry) return;

  const existingFavIndex = state.favorites.findIndex(f => 
    f.name.toLowerCase() === entry.name.toLowerCase() && 
    parseInt(f.calories, 10) === parseInt(entry.calories, 10)
  );

  if (existingFavIndex !== -1) {
    // Remove from favorites
    const name = state.favorites[existingFavIndex].name;
    state.favorites.splice(existingFavIndex, 1);
    saveFavorites();
    renderAll();
    showToast(`Removed "${name}" from Favorites`, 'success');
  } else {
    // Add to favorites
    const newFav = {
      id: 'fav-' + Date.now(),
      name: entry.name,
      calories: parseInt(entry.calories, 10),
      mealType: ''
    };
    state.favorites.push(newFav);
    saveFavorites();
    renderAll();
    showToast(`Added "${entry.name}" to Favorites!`, 'success');
  }
}

function updateTelemetryCountLabel() {
  const label = document.getElementById('telemetry-count-label');
  if (label) {
    const logs = getTelemetryLog();
    label.textContent = `${logs.length} / 50 scans logged`;
  }
}
