import { state, getLocalDateString } from './state.js';
import { renderCalorieChart } from './chart.js';

// Cache for DOM element lookups to avoid repeated queries
const domCache = new Map();

/**
 * Get element by ID with caching for better performance
 */
function getCachedElement(id) {
  if (!domCache.has(id)) {
    domCache.set(id, document.getElementById(id));
  }
  return domCache.get(id);
}

/**
 * Clear DOM cache (useful when DOM structure changes)
 */
export function clearDomCache() {
  domCache.clear();
}

// SECURE ESCAPE HTML TO PREVENT XSS
export function escapeHtml(str) {
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

// DATE FORMATTING
const dateFormatCache = new Map();

export function formatDateFriendly(dateStr) {
  // Check cache first
  if (dateFormatCache.has(dateStr)) {
    return dateFormatCache.get(dateStr);
  }

  const todayStr = getLocalDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  let result;
  if (dateStr === todayStr) {
    result = 'Today';
  } else if (dateStr === yesterdayStr) {
    result = 'Yesterday';
  } else {
    const parts = dateStr.split('-');
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    
    result = dateObj.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  // Cache the result (limit cache size to prevent memory leaks)
  if (dateFormatCache.size > 100) {
    const firstKey = dateFormatCache.keys().next().value;
    dateFormatCache.delete(firstKey);
  }
  dateFormatCache.set(dateStr, result);

  return result;
}

// TOAST NOTIFICATIONS
export function showToast(message, type = 'success') {
  const container = getCachedElement('toast-container');
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
    }, 200);
  }, 2000);
}

// MODAL WINDOW WRAPPER FUNCTIONS
export function openModal(modalEl) {
  modalEl.classList.remove('hidden');
  modalEl.setAttribute('aria-hidden', 'false');
}

export function closeModal(modalEl) {
  modalEl.classList.add('hidden');
  modalEl.setAttribute('aria-hidden', 'true');
}

// DOM RENDERING
export function renderTdeeInputs() {
  const manualGoalInput = getCachedElement('manual-goal-input');
  const goalDisplay = getCachedElement('target-calories');
  
  if (manualGoalInput) manualGoalInput.value = state.tdeeGoal;
  if (goalDisplay) goalDisplay.textContent = state.tdeeGoal.toLocaleString();

  const toggleManualBtn = getCachedElement('toggle-manual-btn');
  const toggleCalcBtn = getCachedElement('toggle-calc-btn');
  const manualFormWrapper = getCachedElement('manual-goal-form-wrapper');
  const calcFormWrapper = getCachedElement('tdee-calc-form-wrapper');

  if (!toggleManualBtn || !toggleCalcBtn || !manualFormWrapper || !calcFormWrapper) return;

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

export function populateTdeeCalculatorForm() {
  const settings = state.tdeeSettings;
  const genderFemale = getCachedElement('gender-female');
  const genderMale = getCachedElement('gender-male');
  
  if (genderFemale && genderMale) {
    genderFemale.checked = settings.gender === 'female';
    genderMale.checked = settings.gender !== 'female';
  }

  const calcAge = getCachedElement('calc-age');
  const calcWeight = getCachedElement('calc-weight');
  const calcHeight = getCachedElement('calc-height');
  const calcActivity = getCachedElement('calc-activity');
  const calcObjective = getCachedElement('calc-objective');

  if (settings.age && calcAge) calcAge.value = settings.age;
  if (settings.weight && calcWeight) calcWeight.value = settings.weight;
  if (settings.height && calcHeight) calcHeight.value = settings.height;
  if (settings.activityLevel && calcActivity) calcActivity.value = settings.activityLevel;
  if (settings.objective && calcObjective) calcObjective.value = settings.objective;
}

export function renderDailyLog() {
  const dailyEntries = state.entries.filter(e => e.date === state.currentDate);
  const listEl = getCachedElement('meal-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (dailyEntries.length === 0) {
    listEl.innerHTML = `<li class="empty-section-placeholder">No foods logged</li>`;
  } else {
    dailyEntries.forEach(item => {
      // Check if item is already in favorites
      const isFav = state.favorites.some(f => 
        f.name.toLowerCase() === item.name.toLowerCase() && 
        parseInt(f.calories, 10) === parseInt(item.calories, 10)
      );

      // Build macro pills HTML
      let macroPillsHtml = '';
      if (item.protein != null || item.fat != null || item.carb != null) {
        macroPillsHtml = `
          <div class="item-macro-pills">
            <span class="macro-pill macro-pill--protein">P: <strong>${escapeHtml(String(item.protein ?? '--'))}g</strong></span>
            <span class="macro-pill macro-pill--fat">F: <strong>${escapeHtml(String(item.fat ?? '--'))}g</strong></span>
            <span class="macro-pill macro-pill--carb">C: <strong>${escapeHtml(String(item.carb ?? '--'))}g</strong></span>
            ${item.aiScanned ? '<span class="macro-pill macro-pill--ai">\u2728 AI</span>' : ''}
          </div>
        `;
      }

      const li = document.createElement('li');
      li.className = 'meal-item';
      li.innerHTML = `
        <div class="item-info">
          <span class="item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <div class="item-meta">
            <span class="item-time">${escapeHtml(item.time || 'Logged')}</span>
            <span class="item-meta-divider">•</span>
            <span class="item-kcal-val">${parseInt(item.calories, 10).toLocaleString()} kcal</span>
          </div>
          ${macroPillsHtml}
        </div>
        <div class="item-kcal-actions">
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
}

export function renderFavorites(searchQuery = '') {
  const favList = document.getElementById('favorites-list');
  if (!favList) return;
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
}

export function updateSummaryMetrics() {
  const dailyEntries = state.entries.filter(e => e.date === state.currentDate);
  const totalConsumed = dailyEntries.reduce((sum, item) => sum + parseInt(item.calories, 10), 0);
  
  const targetCaloriesEl = document.getElementById('target-calories');
  const foodCaloriesEl = document.getElementById('food-calories');
  const burnCaloriesEl = document.getElementById('burn-calories');
  const caloriesRemainingEl = document.getElementById('calories-remaining');
  const ringLabelEl = document.querySelector('.ring-label');
  const limitWarning = document.getElementById('limit-warning');
  const exceededKcalVal = document.getElementById('exceeded-kcal-val');
  const progressCard = document.querySelector('.progress-card');

  if (targetCaloriesEl) targetCaloriesEl.textContent = state.tdeeGoal.toLocaleString();
  if (foodCaloriesEl) foodCaloriesEl.textContent = totalConsumed.toLocaleString();
  if (burnCaloriesEl) burnCaloriesEl.textContent = '0';

  const remaining = state.tdeeGoal - totalConsumed;
  
  if (caloriesRemainingEl) {
    if (remaining < 0) {
      caloriesRemainingEl.textContent = Math.abs(remaining).toLocaleString();
      caloriesRemainingEl.style.color = 'var(--color-warning)';
      if (ringLabelEl) ringLabelEl.textContent = 'Exceeded';
      
      const exceededAmt = totalConsumed - state.tdeeGoal;
      if (exceededKcalVal) exceededKcalVal.textContent = exceededAmt.toLocaleString();
      if (limitWarning) limitWarning.classList.remove('hidden');
      if (progressCard) progressCard.classList.add('exceeded-limit');
    } else {
      caloriesRemainingEl.textContent = remaining.toLocaleString();
      caloriesRemainingEl.style.color = '';
      if (ringLabelEl) ringLabelEl.textContent = 'Remaining';
      
      if (limitWarning) limitWarning.classList.add('hidden');
      if (progressCard) progressCard.classList.remove('exceeded-limit');
    }
  }

  // Toggle Daily Progress empty state
  const progressEmptyState = document.getElementById('progress-empty-state');
  if (totalConsumed === 0) {
    if (progressEmptyState) progressEmptyState.classList.remove('hidden');
  } else {
    if (progressEmptyState) progressEmptyState.classList.add('hidden');
  }

  const progressRing = document.getElementById('progress-ring-fill');
  if (progressRing) {
    const circumference = 464.95; // radius=74
    const percentFactor = state.tdeeGoal > 0 ? Math.min(totalConsumed / state.tdeeGoal, 1.0) : 0;
    const offset = circumference - (percentFactor * circumference);
    progressRing.style.strokeDashoffset = offset;
    
    if (totalConsumed > state.tdeeGoal) {
      progressRing.style.stroke = 'var(--color-warning)';
    } else {
      progressRing.style.stroke = 'var(--accent-primary)';
    }
  }

  // Calculate consumed macros for the day
  const totalCarb = dailyEntries.reduce((sum, item) => sum + (parseFloat(item.carb) || 0), 0);
  const totalProtein = dailyEntries.reduce((sum, item) => sum + (parseFloat(item.protein) || 0), 0);
  const totalFat = dailyEntries.reduce((sum, item) => sum + (parseFloat(item.fat) || 0), 0);

  // Calculate targets dynamically based on 30% Carb / 40% Protein / 30% Fat split of total daily calorie goal
  const carbTarget = Math.round((state.tdeeGoal * 0.30) / 4);
  const proteinTarget = Math.round((state.tdeeGoal * 0.40) / 4);
  const fatTarget = Math.round((state.tdeeGoal * 0.30) / 9);

  const macroCircumference = 175.93; // 2 * Math.PI * 28

  // Update Carb Ring
  const carbRing = document.getElementById('carb-progress-ring-fill');
  if (carbRing) {
    const carbPercentFactor = carbTarget > 0 ? Math.min(totalCarb / carbTarget, 1.0) : 0;
    const carbOffset = macroCircumference - (carbPercentFactor * macroCircumference);
    carbRing.style.strokeDashoffset = carbOffset;
    if (totalCarb > carbTarget) {
      carbRing.style.stroke = 'var(--color-warning)';
    } else {
      carbRing.style.stroke = 'var(--macro-carb)';
    }
  }
  const carbStatsEl = document.getElementById('carb-stats');
  if (carbStatsEl) {
    carbStatsEl.innerHTML = `<strong>${Math.round(totalCarb)}</strong> / ${carbTarget}g`;
  }

  // Update Protein Ring
  const proteinRing = document.getElementById('protein-progress-ring-fill');
  if (proteinRing) {
    const proteinPercentFactor = proteinTarget > 0 ? Math.min(totalProtein / proteinTarget, 1.0) : 0;
    const proteinOffset = macroCircumference - (proteinPercentFactor * macroCircumference);
    proteinRing.style.strokeDashoffset = proteinOffset;
    if (totalProtein > proteinTarget) {
      proteinRing.style.stroke = 'var(--color-warning)';
    } else {
      proteinRing.style.stroke = 'var(--macro-protein)';
    }
  }
  const proteinStatsEl = document.getElementById('protein-stats');
  if (proteinStatsEl) {
    proteinStatsEl.innerHTML = `<strong>${Math.round(totalProtein)}</strong> / ${proteinTarget}g`;
  }

  // Update Fat Ring
  const fatRing = document.getElementById('fat-progress-ring-fill');
  if (fatRing) {
    const fatPercentFactor = fatTarget > 0 ? Math.min(totalFat / fatTarget, 1.0) : 0;
    const fatOffset = macroCircumference - (fatPercentFactor * macroCircumference);
    fatRing.style.strokeDashoffset = fatOffset;
    if (totalFat > fatTarget) {
      fatRing.style.stroke = 'var(--color-warning)';
    } else {
      fatRing.style.stroke = 'var(--macro-fat)';
    }
  }
  const fatStatsEl = document.getElementById('fat-stats');
  if (fatStatsEl) {
    fatStatsEl.innerHTML = `<strong>${Math.round(totalFat)}</strong> / ${fatTarget}g`;
  }
}

export function renderAnalyticsView() {
  // Synchronize range toggle buttons based on state
  const range7dBtn = document.getElementById('range-7d-btn');
  const range30dBtn = document.getElementById('range-30d-btn');
  if (range7dBtn && range30dBtn) {
    if (state.analyticsRange === 7) {
      range7dBtn.classList.add('active');
      range30dBtn.classList.remove('active');
    } else {
      range30dBtn.classList.add('active');
      range7dBtn.classList.remove('active');
    }
  }

  const dates = [];
  const labels = [];
  const rawDates = [];
  const now = new Date();
  
  for (let i = state.analyticsRange - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dateStr = getLocalDateString(d);
    rawDates.push(dateStr);
    
    // label e.g. "Jun 5"
    const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    labels.push(formatted);
  }
  
  const values = rawDates.map(dateStr => {
    return state.entries
      .filter(e => e.date === dateStr)
      .reduce((sum, item) => sum + parseInt(item.calories, 10), 0);
  });
  
  // Stats
  const activeDays = values.filter(v => v > 0);
  const totalIntake = values.reduce((sum, v) => sum + v, 0);
  
  const avgKcal = activeDays.length > 0 ? Math.round(totalIntake / activeDays.length) : 0;
  
  const compliantDays = rawDates.filter(dateStr => {
    const dayTotal = state.entries
      .filter(e => e.date === dateStr)
      .reduce((sum, item) => sum + parseInt(item.calories, 10), 0);
    return dayTotal > 0 && dayTotal <= state.tdeeGoal;
  }).length;
  
  const compliancePercent = activeDays.length > 0 ? Math.round((compliantDays / activeDays.length) * 100) : 0;
  const maxKcal = activeDays.length > 0 ? Math.max(...activeDays) : 0;
  const minKcal = activeDays.length > 0 ? Math.min(...activeDays) : 0;
  
  document.getElementById('stat-avg-kcal').textContent = avgKcal.toLocaleString();
  document.getElementById('stat-compliance').textContent = `${compliancePercent}%`;
  document.getElementById('stat-max-kcal').textContent = maxKcal.toLocaleString();
  document.getElementById('stat-min-kcal').textContent = minKcal.toLocaleString();

  renderCalorieChart("#analytics-chart", labels, values, state.tdeeGoal, state.theme);
}

export function prefillMealModalFromScan(result) {
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

  // Store original AI guess for telemetry logging
  state.lastAiGuess = {
    calories: result.kcal,
    protein: result.protein,
    fat: result.fat,
    carbs: result.carb
  };

  // Show macro preview
  const macroPreview = document.getElementById('meal-macro-preview');
  if (macroPreview) macroPreview.classList.remove('hidden');
  document.getElementById('preview-protein').textContent = result.protein;
  document.getElementById('preview-fat').textContent = result.fat;
  document.getElementById('preview-carb').textContent = result.carb;

  openModal(mealModal);
}

