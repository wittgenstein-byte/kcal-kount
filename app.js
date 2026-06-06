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

import { calculateTdee } from './src/calculator.js';
import { exportBackup, importBackup } from './src/backup.js';

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

function renderAll() {
  renderTdeeInputs();
  renderDailyLog();
  renderFavorites();
  updateSummaryMetrics();
  if (state.activeView === 'analytics') {
    renderAnalyticsView();
  }
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

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      openModal(settingsModal);
      renderTdeeInputs();
      loadAiSettingsIntoForm();
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
      viewDashboardBtn.classList.add('active');
      viewAnalyticsBtn.classList.remove('active');
      dashboardView.classList.remove('hidden');
      analyticsView.classList.add('hidden');
    });

    viewAnalyticsBtn.addEventListener('click', () => {
      state.activeView = 'analytics';
      viewAnalyticsBtn.classList.add('active');
      viewDashboardBtn.classList.remove('active');
      analyticsView.classList.remove('hidden');
      dashboardView.classList.add('hidden');
      renderAnalyticsView();
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
        importBackup(e.target.files[0], state, renderAll, closeModal, showToast);
        e.target.value = '';
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

  // Camera / AI Scan FAB
  const scanFab = document.getElementById('scan-fab');
  if (scanFab) scanFab.addEventListener('click', () => openCameraModal());

  // Camera modal controls
  const closeCameraBtn = document.getElementById('close-camera-modal');
  const captureBtn = document.getElementById('capture-btn');
  const retakeBtn = document.getElementById('retake-btn');
  const scanConfirmBtn = document.getElementById('scan-confirm-btn');
  const cameraModal = document.getElementById('camera-modal');

  if (closeCameraBtn) closeCameraBtn.addEventListener('click', () => closeCameraModal());
  if (captureBtn) captureBtn.addEventListener('click', () => captureFrame());
  if (retakeBtn) retakeBtn.addEventListener('click', () => retakePhoto());
  if (scanConfirmBtn) scanConfirmBtn.addEventListener('click', () => confirmAndScan());
  if (cameraModal) {
    cameraModal.addEventListener('click', (e) => {
      if (e.target === cameraModal) closeCameraModal();
    });
  }

  // Save AI Settings button
  const saveAiBtn = document.getElementById('save-ai-settings-btn');
  if (saveAiBtn) {
    saveAiBtn.addEventListener('click', () => {
      const keyVal = document.getElementById('settings-api-key').value.trim();
      const modelVal = document.getElementById('settings-model-name').value.trim();
      state.apiKey = keyVal;
      state.modelName = modelVal || 'gemini-3.5-flash';
      saveAiSettings();
      showToast('AI settings saved!', 'success');
    });
  }
}

// AI SETTINGS HELPERS
function loadAiSettingsIntoForm() {
  const keyInput = document.getElementById('settings-api-key');
  const modelInput = document.getElementById('settings-model-name');
  if (keyInput) keyInput.value = state.apiKey || '';
  if (modelInput) modelInput.value = state.modelName || 'gemini-3.5-flash';
}

// ============================================================
// CAMERA MODULE
// ============================================================
let _cameraStream = null;
let _capturedBase64 = null;

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function openCameraModal() {
  const modal = document.getElementById('camera-modal');
  const video = document.getElementById('camera-video');
  if (!modal || !video) return;

  // Show step 1, hide others
  showCameraStep('preview');
  _capturedBase64 = null;
  closeModal(modal);
  modal.classList.remove('hidden');

  try {
    _cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = _cameraStream;
  } catch (err) {
    showToast('Camera access denied or unavailable.', 'warning');
    closeModal(modal);
    stopCameraStream();
  }
}

function closeCameraModal() {
  const modal = document.getElementById('camera-modal');
  if (modal) closeModal(modal);
  stopCameraStream();
  _capturedBase64 = null;
}

function stopCameraStream() {
  if (_cameraStream) {
    _cameraStream.getTracks().forEach(t => t.stop());
    _cameraStream = null;
  }
  const video = document.getElementById('camera-video');
  if (video) video.srcObject = null;
}

function showCameraStep(step) {
  // step: 'preview' | 'confirm' | 'loading'
  ['preview', 'confirm', 'loading'].forEach(s => {
    const el = document.getElementById(`camera-step-${s}`);
    if (el) el.classList.toggle('hidden', s !== step);
  });
}

function captureFrame() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  if (!video || !canvas) return;

  // Compress: cap at 800x600, JPEG 80%
  const MAX_W = 800;
  const MAX_H = 600;
  let w = video.videoWidth || 640;
  let h = video.videoHeight || 480;
  const ratio = Math.min(MAX_W / w, MAX_H / h, 1);
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  _capturedBase64 = canvas.toDataURL('image/jpeg', 0.8);

  showCameraStep('confirm');
  stopCameraStream();
}

function retakePhoto() {
  _capturedBase64 = null;
  showCameraStep('preview');

  const video = document.getElementById('camera-video');
  if (video) {
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    }).then(stream => {
      _cameraStream = stream;
      video.srcObject = stream;
    }).catch(() => showToast('Camera restart failed.', 'warning'));
  }
}

async function confirmAndScan() {
  if (!_capturedBase64) return;

  if (!state.apiKey) {
    showToast('No API key set. Go to Settings → AI Food Scanner.', 'warning');
    return;
  }

  showCameraStep('loading');

  try {
    const result = await analyzeFood(_capturedBase64);

    // Save image to localStorage keyed by menu + today's date
    const slug = slugify(result.menu || 'food');
    const dateKey = state.currentDate;
    try {
      localStorage.setItem(`scan_${slug}_${dateKey}`, _capturedBase64);
    } catch (storageErr) {
      console.warn('Could not save image to localStorage (quota?):', storageErr);
    }

    // Close camera modal, open meal modal pre-filled
    closeCameraModal();
    prefillMealModalFromScan(result);

  } catch (err) {
    showToast(`AI scan failed: ${err.message}`, 'warning');
    showCameraStep('confirm'); // Go back to confirm so user can retry
  }
}

async function analyzeFood(base64DataUrl) {
  const apiUrl = 'https://gen.ai.kku.ac.th/api/v1/chat/completions';
  const model = state.modelName || 'gemini-3.5-flash';

  // Strip the data URL prefix for the API
  const base64Image = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');

  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You are an expert nutritionist and fitness trainer. Analyze food images accurately.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64Image}` }
          },
          {
            type: 'text',
            text: 'Analyze the food shown in this image. Respond ONLY with a JSON object in this exact format, no explanation or extra text:\n{\n  "menu": "<food name in English>",\n  "protein_g": <number>,\n  "fat_g": <number>,\n  "carb_g": <number>,\n  "kcal": <number>\n}'
          }
        ]
      }
    ],
    max_tokens: 512,
    temperature: 0.2
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[AI Scan] API error response:', errText);
    throw new Error(`API error ${response.status}: ${errText.slice(0, 120)}`);
  }

  const data = await response.json();
  console.log('[AI Scan] Full API response:', JSON.stringify(data, null, 2));

  const rawContent = data?.choices?.[0]?.message?.content || '';
  console.log('[AI Scan] Raw content:', rawContent);

  // Try multiple strategies to extract JSON from the response
  let parsed = null;

  // Strategy 1: Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      parsed = JSON.parse(fenceMatch[1].trim());
      console.log('[AI Scan] Parsed via markdown fence strategy');
    } catch (e) { /* try next */ }
  }

  // Strategy 2: Find first { ... } block (greedy)
  if (!parsed) {
    const braceMatch = rawContent.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        parsed = JSON.parse(braceMatch[0]);
        console.log('[AI Scan] Parsed via brace extraction strategy');
      } catch (e) { /* try next */ }
    }
  }

  // Strategy 3: The entire content might be valid JSON
  if (!parsed) {
    try {
      parsed = JSON.parse(rawContent.trim());
      console.log('[AI Scan] Parsed entire content as JSON');
    } catch (e) { /* give up */ }
  }

  if (!parsed) {
    console.error('[AI Scan] Could not parse response. Raw:', rawContent);
    throw new Error(`Could not parse AI response. Raw: "${rawContent.slice(0, 200)}"`);
  }

  return {
    menu: parsed.menu || 'Unknown food',
    protein: Math.round(parsed.protein_g ?? 0),
    fat: Math.round(parsed.fat_g ?? 0),
    carb: Math.round(parsed.carb_g ?? 0),
    kcal: Math.round(parsed.kcal ?? 0)
  };
}

function prefillMealModalFromScan(result) {
  const mealModal = document.getElementById('meal-modal');
  document.getElementById('meal-modal-title').textContent = '\u2728 AI Scanned Meal';
  document.getElementById('meal-id-input').value = '';
  document.getElementById('meal-name-input').value = result.menu;
  document.getElementById('meal-calories-input').value = result.kcal;
  document.getElementById('meal-date-input').value = state.currentDate;
  document.getElementById('save-meal-btn').textContent = 'Log Entry';

  // Hidden macro fields
  document.getElementById('meal-protein-input').value = result.protein;
  document.getElementById('meal-fat-input').value = result.fat;
  document.getElementById('meal-carb-input').value = result.carb;
  document.getElementById('meal-ai-scanned').value = '1';

  // Show macro preview
  const macroPreview = document.getElementById('meal-macro-preview');
  if (macroPreview) macroPreview.classList.remove('hidden');
  document.getElementById('preview-protein').textContent = result.protein;
  document.getElementById('preview-fat').textContent = result.fat;
  document.getElementById('preview-carb').textContent = result.carb;

  openModal(mealModal);
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
  const mealModal = document.getElementById('meal-modal');
  document.getElementById('meal-modal-title').textContent = 'Log Meal Entry';
  document.getElementById('meal-id-input').value = '';
  document.getElementById('meal-name-input').value = '';
  document.getElementById('meal-calories-input').value = '';
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
  const mealModal = document.getElementById('meal-modal');
  document.getElementById('meal-modal-title').textContent = 'Edit Meal Entry';
  document.getElementById('meal-id-input').value = entry.id;
  document.getElementById('meal-name-input').value = entry.name;
  document.getElementById('meal-calories-input').value = entry.calories;
  document.getElementById('meal-date-input').value = entry.date;
  document.getElementById('save-meal-btn').textContent = 'Update Entry';

  // Clear macro fields (edit doesn't show macro preview)
  document.getElementById('meal-protein-input').value = '';
  document.getElementById('meal-fat-input').value = '';
  document.getElementById('meal-carb-input').value = '';
  document.getElementById('meal-ai-scanned').value = '';
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
      state.entries[index].name = name;
      state.entries[index].calories = calories;
      state.entries[index].date = date;
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
    state.entries.splice(index, 1);
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
