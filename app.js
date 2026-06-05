// STATE MANAGEMENT
let state = {
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
  theme: 'dark'
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  loadLocalStorage();
  initTheme();
  setupEventListeners();
  updateDateDisplay();
  renderAll();
});

// UTILITY FUNCTIONS
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateFriendly(dateStr) {
  const todayStr = getLocalDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';

  const parts = dateStr.split('-');
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  
  return dateObj.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2.5" style="width:18px;height:18px;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'warning') {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" stroke-width="2.5" style="width:18px;height:18px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path></svg>`;
  } else if (type === 'info') {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--color-info)" stroke-width="2.5" style="width:18px;height:18px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.5rem;">
      ${iconSvg}
      <span>${message}</span>
    </div>
  `;
  container.appendChild(toast);

  // Auto-remove toast
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => {
      toast.remove();
    }, 200); // Wait for the 200ms transition to finish
  }, 2000);
}

// LOCAL STORAGE PERSISTENCE
function loadLocalStorage() {
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
  } catch (err) {
    console.error('Error loading localStorage:', err);
    showToast('Failed to load saved tracker data.', 'warning');
  }
}

function saveEntries() {
  localStorage.setItem('kcal_tracker_entries', JSON.stringify(state.entries));
}

function saveFavorites() {
  localStorage.setItem('kcal_tracker_favorites', JSON.stringify(state.favorites));
}

function saveTdeeGoal() {
  localStorage.setItem('kcal_tracker_tdee_goal', state.tdeeGoal.toString());
}

function saveTdeeSettings() {
  localStorage.setItem('kcal_tracker_tdee_settings', JSON.stringify(state.tdeeSettings));
}

// THEME MANAGEMENT
function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
}

function setupEventListeners() {
  // Theme Toggle
  const themeToggleBtn = document.getElementById('theme-toggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      initTheme();
      localStorage.setItem('kcal_tracker_theme', state.theme);
      showToast(`Switched to ${state.theme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
    });
  }

  // Date Navigation
  document.getElementById('prev-day-btn').addEventListener('click', () => shiftDate(-1));
  document.getElementById('next-day-btn').addEventListener('click', () => shiftDate(1));
  document.getElementById('today-btn').addEventListener('click', () => {
    state.currentDate = getLocalDateString();
    updateDateDisplay();
    renderAll();
    showToast('Jumped to Today', 'info');
  });

  const datePickerInput = document.getElementById('date-picker');
  datePickerInput.addEventListener('change', (e) => {
    if (e.target.value) {
      state.currentDate = e.target.value;
      updateDateDisplay();
      renderAll();
      showToast(`View switched to ${formatDateFriendly(state.currentDate)}`, 'info');
    }
  });

  // TDEE Goal Form Toggles
  const toggleManualBtn = document.getElementById('toggle-manual-btn');
  const toggleCalcBtn = document.getElementById('toggle-calc-btn');
  const manualFormWrapper = document.getElementById('manual-goal-form-wrapper');
  const calcFormWrapper = document.getElementById('tdee-calc-form-wrapper');

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
    populateTdeeCalculatorForm();
  });

  // Goal Form Submits
  document.getElementById('manual-goal-form').addEventListener('submit', (e) => {
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

  document.getElementById('tdee-calculator-form').addEventListener('submit', (e) => {
    e.preventDefault();
    calculateTdeeFromForm();
  });

  // Settings Modal Interactions
  const settingsBtn = document.getElementById('settings-btn');
  const closeSettingsModal = document.getElementById('close-settings-modal');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const settingsModal = document.getElementById('settings-modal');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      openModal(settingsModal);
      renderTdeeInputs();
    });
  }
  if (closeSettingsModal) {
    closeSettingsModal.addEventListener('click', () => closeModal(settingsModal));
  }
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => closeModal(settingsModal));
  }
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeModal(settingsModal);
    });
  }

  // Modals Interactions
  const addMealFloatingBtn = document.getElementById('add-meal-floating-btn');
  const closeMealModal = document.getElementById('close-meal-modal');
  const cancelMealBtn = document.getElementById('cancel-meal-btn');
  const mealModal = document.getElementById('meal-modal');

  addMealFloatingBtn.addEventListener('click', () => openMealModalForCreate());
  closeMealModal.addEventListener('click', () => closeModal(mealModal));
  cancelMealBtn.addEventListener('click', () => closeModal(mealModal));
  
  // Close modal on escape press or clicking outside card
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(mealModal);
      closeModal(document.getElementById('fav-modal'));
      if (settingsModal) closeModal(settingsModal);
    }
  });

  mealModal.addEventListener('click', (e) => {
    if (e.target === mealModal) closeModal(mealModal);
  });

  document.getElementById('meal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handleMealFormSubmit();
  });

  // Favorite Modal
  const addFavoriteBtn = document.getElementById('add-favorite-btn');
  const closeFavModal = document.getElementById('close-fav-modal');
  const cancelFavBtn = document.getElementById('cancel-fav-btn');
  const favModal = document.getElementById('fav-modal');

  addFavoriteBtn.addEventListener('click', () => openFavModalForCreate());
  closeFavModal.addEventListener('click', () => closeModal(favModal));
  cancelFavBtn.addEventListener('click', () => closeModal(favModal));
  favModal.addEventListener('click', (e) => {
    if (e.target === favModal) closeModal(favModal);
  });

  document.getElementById('fav-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handleFavFormSubmit();
  });

  // Favorite Search
  const favSearchInput = document.getElementById('fav-search');
  favSearchInput.addEventListener('input', () => {
    renderFavorites(favSearchInput.value);
  });

  // Close limit warning banner
  document.getElementById('close-warning-btn').addEventListener('click', () => {
    document.getElementById('limit-warning').classList.add('hidden');
  });
}

// DATE LOGIC
function shiftDate(days) {
  const parts = state.currentDate.split('-');
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  date.setDate(date.getDate() + days);
  state.currentDate = getLocalDateString(date);
  updateDateDisplay();
  renderAll();
  showToast(`View switched to ${formatDateFriendly(state.currentDate)}`, 'info');
}

function updateDateDisplay() {
  const dateDisplay = document.getElementById('date-display');
  const datePicker = document.getElementById('date-picker');
  
  dateDisplay.textContent = formatDateFriendly(state.currentDate);
  datePicker.value = state.currentDate;
}

// RENDERING LOGIC
function renderAll() {
  renderTdeeInputs();
  renderDailyLog();
  renderFavorites();
  updateSummaryMetrics();
}

function renderTdeeInputs() {
  document.getElementById('manual-goal-input').value = state.tdeeGoal;
  document.getElementById('goal-display').textContent = state.tdeeGoal.toLocaleString();

  // Highlight correct tab
  const toggleManualBtn = document.getElementById('toggle-manual-btn');
  const toggleCalcBtn = document.getElementById('toggle-calc-btn');
  const manualFormWrapper = document.getElementById('manual-goal-form-wrapper');
  const calcFormWrapper = document.getElementById('tdee-calc-form-wrapper');

  if (state.tdeeSettings.calculationType === 'calculated') {
    toggleCalcBtn.classList.add('active');
    toggleManualBtn.classList.remove('active');
    calcFormWrapper.classList.remove('hidden');
    manualFormWrapper.classList.add('hidden');
    populateTdeeCalculatorForm();
  } else {
    toggleManualBtn.classList.add('active');
    toggleCalcBtn.classList.remove('active');
    manualFormWrapper.classList.remove('hidden');
    calcFormWrapper.classList.add('hidden');
  }
}

function populateTdeeCalculatorForm() {
  const settings = state.tdeeSettings;
  if (settings.gender === 'female') {
    document.getElementById('gender-female').checked = true;
  } else {
    document.getElementById('gender-male').checked = true;
  }

  if (settings.age) document.getElementById('calc-age').value = settings.age;
  if (settings.weight) document.getElementById('calc-weight').value = settings.weight;
  if (settings.height) document.getElementById('calc-height').value = settings.height;
  if (settings.activityLevel) document.getElementById('calc-activity').value = settings.activityLevel;
  if (settings.objective) document.getElementById('calc-objective').value = settings.objective;
}

function updateSummaryMetrics() {
  const dailyEntries = state.entries.filter(e => e.date === state.currentDate);
  const totalConsumed = dailyEntries.reduce((sum, item) => sum + parseInt(item.calories, 10), 0);
  
  document.getElementById('consumed-display').textContent = totalConsumed.toLocaleString();
  
  const remaining = state.tdeeGoal - totalConsumed;
  const remainingDisplay = document.getElementById('remaining-display');
  
  if (remaining >= 0) {
    remainingDisplay.textContent = remaining.toLocaleString();
    remainingDisplay.className = 'metric-val text-success';
  } else {
    remainingDisplay.textContent = remaining.toLocaleString();
    remainingDisplay.className = 'metric-val text-danger';
  }

  const percentage = state.tdeeGoal > 0 ? Math.round((totalConsumed / state.tdeeGoal) * 100) : 0;
  document.getElementById('percentage-display').textContent = `${percentage}%`;

  // Update SVG Ring
  const circle = document.getElementById('progress-ring-fill');
  const percentFactor = state.tdeeGoal > 0 ? Math.min(totalConsumed / state.tdeeGoal, 1.0) : 0;
  // Circular circumference is 565.48 (2 * pi * r, r=90)
  const strokeOffset = 565.48 - (percentFactor * 565.48);
  circle.style.strokeDashoffset = strokeOffset;

  const progressCard = document.querySelector('.progress-card');
  const limitWarning = document.getElementById('limit-warning');
  const exceededKcalVal = document.getElementById('exceeded-kcal-val');

  if (totalConsumed > state.tdeeGoal) {
    circle.style.stroke = 'var(--color-warning)';
    progressCard.classList.add('exceeded-limit');
    
    // Show limit exceeded banner
    const exceededAmt = totalConsumed - state.tdeeGoal;
    exceededKcalVal.textContent = exceededAmt.toLocaleString();
    limitWarning.classList.remove('hidden');
  } else {
    circle.style.stroke = 'var(--accent-primary)';
    progressCard.classList.remove('exceeded-limit');
    limitWarning.classList.add('hidden');
  }
}

function renderDailyLog() {
  const dailyEntries = state.entries.filter(e => e.date === state.currentDate);
  const listEl = document.getElementById('meal-list');
  listEl.innerHTML = '';

  let totalCalories = 0;

  if (dailyEntries.length === 0) {
    listEl.innerHTML = `<li class="empty-section-placeholder">No foods logged</li>`;
  } else {
    dailyEntries.forEach(item => {
      totalCalories += parseInt(item.calories, 10);

      // Check if item is already in favorites (by name and calories) to style the Heart button
      const isFav = state.favorites.some(f => 
        f.name.toLowerCase() === item.name.toLowerCase() && 
        parseInt(f.calories, 10) === parseInt(item.calories, 10)
      );

      const li = document.createElement('li');
      li.className = 'meal-item';
      li.innerHTML = `
        <div class="item-info">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <span class="item-time">${escapeHtml(item.time || 'Logged')}</span>
        </div>
        <div class="item-kcal-actions">
          <span class="item-kcal-val">${parseInt(item.calories, 10).toLocaleString()} kcal</span>
          <div class="actions-wrapper">
            <button class="icon-btn action-btn btn-fav ${isFav ? 'active' : ''}" data-id="${item.id}" title="${isFav ? 'In Favorites' : 'Add to Favorites'}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            </button>
            <button class="icon-btn action-btn btn-edit" data-id="${item.id}" title="Edit Entry">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
            </button>
            <button class="icon-btn action-btn btn-delete" data-id="${item.id}" title="Delete Entry">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </div>
      `;
      listEl.appendChild(li);
    });
  }

  // Update total sum header
  document.getElementById('meal-kcal-sum').textContent = `${totalCalories.toLocaleString()} kcal`;

  // Attach dynamic item actions
  attachMealItemListeners();
}

function attachMealItemListeners() {
  // Favorites Quick Add (Heart Button)
  document.querySelectorAll('.btn-fav').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      const entry = state.entries.find(item => item.id === id);
      if (entry) {
        toggleMealInFavorites(entry);
      }
    });
  });

  // Edit Button
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      const entry = state.entries.find(item => item.id === id);
      if (entry) {
        openMealModalForEdit(entry);
      }
    });
  });

  // Delete Button
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      deleteMealEntry(id);
    });
  });
}

function renderFavorites(searchQuery = '') {
  const favList = document.getElementById('favorites-list');
  favList.innerHTML = '';

  let filteredFavs = state.favorites;
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredFavs = state.favorites.filter(fav => 
      fav.name.toLowerCase().includes(query)
    );
  }

  if (filteredFavs.length === 0) {
    favList.innerHTML = `<li class="empty-fav-placeholder">No favorites found</li>`;
    return;
  }

  filteredFavs.forEach(fav => {
    const li = document.createElement('li');
    li.className = 'fav-item';
    li.innerHTML = `
      <div class="fav-info-wrapper">
        <span class="fav-name" title="${escapeHtml(fav.name)}">${escapeHtml(fav.name)}</span>
        <div class="fav-meta">
          <span class="fav-kcal">${parseInt(fav.calories, 10).toLocaleString()} kcal</span>
        </div>
      </div>
      <div class="fav-actions">
        <button class="fav-add-btn" data-id="${fav.id}" title="Log this meal for current date">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button class="fav-del-btn" data-id="${fav.id}" title="Remove Favorite">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
        </button>
      </div>
    `;
    favList.appendChild(li);
  });

  // Attach listeners
  document.querySelectorAll('.fav-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      const favorite = state.favorites.find(item => item.id === id);
      if (favorite) {
        logFavoriteMeal(favorite);
      }
    });
  });

  document.querySelectorAll('.fav-del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      deleteFavoriteItem(id);
    });
  });
}

// TDEE CALCULATOR LOGIC
function calculateTdeeFromForm() {
  const age = parseInt(document.getElementById('calc-age').value, 10);
  const weight = parseFloat(document.getElementById('calc-weight').value);
  const height = parseFloat(document.getElementById('calc-height').value);
  const activityLevel = parseFloat(document.getElementById('calc-activity').value);
  const objective = parseFloat(document.getElementById('calc-objective').value);
  const isMale = document.getElementById('gender-male').checked;

  if (isNaN(age) || isNaN(weight) || isNaN(height)) {
    showToast('Please fill out all numeric TDEE values.', 'warning');
    return;
  }

  // Mifflin-St Jeor Equation
  let bmr = 0;
  if (isMale) {
    bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
  } else {
    bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
  }

  const calculatedTdee = Math.round((bmr * activityLevel) + objective);

  // Update TDEE Goal
  state.tdeeGoal = calculatedTdee;
  saveTdeeGoal();

  // Save Settings State
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

  // Render updates
  renderAll();
  showToast(`Calculated TDEE: ${calculatedTdee} kcal goal applied!`, 'success');
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal) closeModal(settingsModal);
}

// MEAL LOG CRUD OPERATIONS
function openMealModalForCreate() {
  const mealModal = document.getElementById('meal-modal');
  document.getElementById('meal-modal-title').textContent = 'Log Meal Entry';
  document.getElementById('meal-id-input').value = '';
  document.getElementById('meal-name-input').value = '';
  document.getElementById('meal-calories-input').value = '';
  document.getElementById('meal-date-input').value = state.currentDate;
  document.getElementById('save-meal-btn').textContent = 'Log Entry';

  openModal(mealModal);
}

function openMealModalForEdit(entry) {
  const mealModal = document.getElementById('meal-modal');
  document.getElementById('meal-modal-title').textContent = 'Edit Meal Entry';
  document.getElementById('meal-id-input').value = entry.id;
  document.getElementById('meal-name-input').value = entry.name;
  document.getElementById('meal-calories-input').value = entry.calories;
  document.getElementById('meal-date-input').value = entry.date;
  document.getElementById('save-meal-btn').textContent = 'Save Changes';

  openModal(mealModal);
}

function handleMealFormSubmit() {
  const id = document.getElementById('meal-id-input').value;
  const name = document.getElementById('meal-name-input').value.trim();
  const calories = parseInt(document.getElementById('meal-calories-input').value, 10);
  const date = document.getElementById('meal-date-input').value;

  if (!name || isNaN(calories) || !date) {
    showToast('Please fill out all required fields.', 'warning');
    return;
  }

  const mealModal = document.getElementById('meal-modal');

  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (id) {
    // Edit Existing
    const index = state.entries.findIndex(item => item.id === id);
    if (index !== -1) {
      state.entries[index] = {
        ...state.entries[index],
        name,
        calories,
        date
      };
      saveEntries();
      showToast(`Updated "${name}"`, 'success');
    }
  } else {
    // Create New
    const newEntry = {
      id: 'meal-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      name,
      calories,
      mealType: '',
      date,
      time: timeString
    };
    state.entries.push(newEntry);
    saveEntries();
    showToast(`Added "${name}" (${calories} kcal)`, 'success');
  }

  closeModal(mealModal);
  renderAll();
}

function deleteMealEntry(id) {
  const index = state.entries.findIndex(item => item.id === id);
  if (index !== -1) {
    const mealName = state.entries[index].name;
    state.entries.splice(index, 1);
    saveEntries();
    renderAll();
    showToast(`Deleted "${mealName}"`, 'success');
  }
}

// FAVORITES MANAGEMENT
function toggleMealInFavorites(entry) {
  const matchIndex = state.favorites.findIndex(fav => 
    fav.name.toLowerCase() === entry.name.toLowerCase() && 
    parseInt(fav.calories, 10) === parseInt(entry.calories, 10)
  );

  if (matchIndex !== -1) {
    // Remove it
    state.favorites.splice(matchIndex, 1);
    saveFavorites();
    renderAll();
    showToast(`Removed "${entry.name}" from favorites`, 'info');
  } else {
    // Add it
    const newFav = {
      id: 'fav-' + Date.now(),
      name: entry.name,
      calories: parseInt(entry.calories, 10),
      mealType: ''
    };
    state.favorites.push(newFav);
    saveFavorites();
    renderAll();
    showToast(`Saved "${entry.name}" to favorites`, 'success');
  }
}

function openFavModalForCreate() {
  const favModal = document.getElementById('fav-modal');
  document.getElementById('fav-modal-title').textContent = 'Create Favorite Meal';
  document.getElementById('fav-id-input').value = '';
  document.getElementById('fav-name-input').value = '';
  document.getElementById('fav-calories-input').value = '';
  document.getElementById('save-fav-btn').textContent = 'Save Favorite';

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

// MODAL WINDOW WRAPPER FUNCTIONS
function openModal(modalEl) {
  modalEl.classList.remove('hidden');
  modalEl.setAttribute('aria-hidden', 'false');
}

function closeModal(modalEl) {
  modalEl.classList.add('hidden');
  modalEl.setAttribute('aria-hidden', 'true');
}

// SECURE ESCAPE HTML TO PREVENT XSS
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
}
