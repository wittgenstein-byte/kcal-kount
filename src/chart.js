/**
 * Lightweight Native SVG Bar Chart (Zero Dependencies)
 * Replaces heavy external chart libraries (e.g. ApexCharts) with ~2KB of vanilla SVG.
 */

let lastChartConfig = null;

export function destroyChart(chartContainerSelector = '#analytics-chart') {
  const container = typeof chartContainerSelector === 'string'
    ? document.querySelector(chartContainerSelector)
    : chartContainerSelector;
  if (container) {
    container.innerHTML = '';
  }
  lastChartConfig = null;
}

/**
 * Escapes attribute / text strings for safe SVG / HTML interpolation.
 */
function escapeAttr(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Renders or updates the calorie intake trend chart using native SVG.
 * 
 * @param {string} chartContainerSelector - Selector for the chart container.
 * @param {Array<string>} labels - X-axis categories (e.g. ["Jun 5", "Jun 6", ...]).
 * @param {Array<number|null>} values - Y-axis data values (calories).
 * @param {number} tdeeGoal - Target daily calorie goal.
 * @param {string} theme - Active color theme ('light'|'dark').
 */
export function renderCalorieChart(chartContainerSelector, labels, values, tdeeGoal, theme) {
  const configSignature = JSON.stringify({ labels, values, tdeeGoal, theme });
  if (lastChartConfig === configSignature) {
    return;
  }
  lastChartConfig = configSignature;

  const chartEl = document.querySelector(chartContainerSelector);
  if (!chartEl) return;

  const n = (labels && labels.length) || 0;
  if (n === 0) {
    chartEl.innerHTML = '<div class="chart-empty-placeholder">No data available for this range.</div>';
    return;
  }

  // Determine scale maximum
  const validValues = values.filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
  const dataMax = validValues.length > 0 ? Math.max(...validValues) : 0;
  const goalVal = Number(tdeeGoal) || 2000;
  const rawMax = Math.max(dataMax, goalVal, 1000);
  // Round up to a pleasant interval
  const step = rawMax > 3000 ? 1000 : (rawMax > 1500 ? 500 : 250);
  const yMax = Math.ceil((rawMax * 1.15) / step) * step;

  // Chart layout dimensions
  const width = 800;
  const height = 320;
  const padLeft = 68;
  const padRight = 24;
  const padTop = 32;
  const padBottom = 48;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const getY = (val) => padTop + plotHeight - (Math.max(0, val) / yMax) * plotHeight;

  // Gridlines & Y-axis labels (4 horizontal lines)
  const gridLines = [];
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const val = Math.round((yMax / yTicks) * i);
    const y = getY(val);
    gridLines.push(`
      <g class="chart-grid-line">
        <line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${width - padRight}" y2="${y.toFixed(1)}" stroke="var(--border-muted)" stroke-dasharray="4 4" stroke-width="1" />
        <text x="${padLeft - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="var(--text-secondary)" font-size="11" font-weight="500">${val} kcal</text>
      </g>
    `);
  }

  // Target Goal annotation line
  let goalAnnotationSvg = '';
  if (goalVal > 0 && goalVal <= yMax) {
    const goalY = getY(goalVal);
    const labelText = `Target: ${goalVal} kcal`;
    const labelW = 100;
    const labelH = 20;
    const labelX = width - padRight - labelW;
    const labelY = goalY - labelH / 2;
    goalAnnotationSvg = `
      <g class="chart-annotation-goal">
        <line x1="${padLeft}" y1="${goalY.toFixed(1)}" x2="${width - padRight}" y2="${goalY.toFixed(1)}" stroke="#f43f5e" stroke-width="2" stroke-dasharray="5 5" />
        <rect x="${labelX}" y="${labelY.toFixed(1)}" width="${labelW}" height="${labelH}" rx="4" fill="#f43f5e" />
        <text x="${labelX + labelW / 2}" y="${(goalY + 4).toFixed(1)}" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="600">${escapeAttr(labelText)}</text>
      </g>
    `;
  }

  // Calculate Bar widths & positions
  const slotWidth = plotWidth / n;
  const barWidth = Math.max(6, Math.min(32, slotWidth * (n > 14 ? 0.75 : 0.55)));
  const barsSvg = [];
  const xLabelsSvg = [];

  // Determine label step to prevent colliding text on 30-day views
  const labelInterval = n > 14 ? (n > 20 ? 4 : 2) : 1;

  labels.forEach((label, i) => {
    const slotCenterX = padLeft + (i + 0.5) * slotWidth;
    const val = values[i];
    const hasData = typeof val === 'number' && !isNaN(val) && val > 0;
    const barH = hasData ? Math.max(4, (val / yMax) * plotHeight) : 0;
    const barY = padTop + plotHeight - barH;
    const barX = slotCenterX - barWidth / 2;

    if (hasData) {
      barsSvg.push(`
        <rect class="native-chart-bar"
              x="${barX.toFixed(1)}"
              y="${barY.toFixed(1)}"
              width="${barWidth.toFixed(1)}"
              height="${barH.toFixed(1)}"
              rx="6"
              ry="6"
              fill="url(#calorie-bar-gradient)"
              data-index="${i}"
              data-label="${escapeAttr(label)}"
              data-val="${Math.round(val)}" />
      `);
    } else {
      // Small muted indicator for zero / unlogged day
      barsSvg.push(`
        <circle cx="${slotCenterX.toFixed(1)}" cy="${(padTop + plotHeight - 3).toFixed(1)}" r="2" fill="var(--border-muted)"
                data-index="${i}" data-label="${escapeAttr(label)}" data-val="0" class="native-chart-bar-zero" />
      `);
    }

    // X-axis label
    if (i % labelInterval === 0 || i === n - 1) {
      xLabelsSvg.push(`
        <text x="${slotCenterX.toFixed(1)}" y="${(height - 18).toFixed(1)}" text-anchor="middle" fill="var(--text-secondary)" font-size="11" font-weight="500">${escapeAttr(label)}</text>
      `);
    }
  });

  // Construct complete responsive SVG with gradient defs
  const svgHtml = `
    <div class="native-chart-wrapper" style="position:relative;width:100%;height:100%;">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="native-chart-svg" style="width:100%;height:100%;display:block;overflow:visible;">
        <defs>
          <linearGradient id="calorie-bar-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="var(--accent-primary)" stop-opacity="0.9" />
            <stop offset="100%" stop-color="var(--accent-primary)" stop-opacity="0.25" />
          </linearGradient>
        </defs>
        ${gridLines.join('')}
        ${goalAnnotationSvg}
        <g class="chart-bars-group">${barsSvg.join('')}</g>
        <g class="chart-x-labels">${xLabelsSvg.join('')}</g>
      </svg>
      <div class="native-chart-tooltip" style="display:none;position:absolute;pointer-events:none;z-index:15;"></div>
    </div>
  `;

  chartEl.innerHTML = svgHtml;

  // Wire interactive tooltip
  const wrapper = chartEl.querySelector('.native-chart-wrapper');
  const tooltip = chartEl.querySelector('.native-chart-tooltip');
  if (!wrapper || !tooltip) return;

  const showTooltip = (target, clientX, clientY) => {
    const label = target.getAttribute('data-label');
    const val = target.getAttribute('data-val');
    if (!label) return;

    const valNum = parseInt(val, 10);
    const valText = valNum > 0 ? `${valNum.toLocaleString()} kcal` : 'No food logged';

    tooltip.innerHTML = `
      <div class="chart-tip-content">
        <span class="chart-tip-date">${label}</span>
        <span class="chart-tip-val">${valText}</span>
      </div>
    `;
    tooltip.style.display = 'block';

    const rect = wrapper.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const tipW = tooltip.offsetWidth || 110;
    const tipH = tooltip.offsetHeight || 44;

    let left = x - tipW / 2;
    let top = y - tipH - 12;

    if (left < 4) left = 4;
    if (left + tipW > rect.width - 4) left = rect.width - tipW - 4;
    if (top < 4) top = y + 16;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  const hideTooltip = () => {
    tooltip.style.display = 'none';
  };

  wrapper.addEventListener('mousemove', (e) => {
    const target = e.target.closest('[data-val]');
    if (target) {
      showTooltip(target, e.clientX, e.clientY);
    } else {
      hideTooltip();
    }
  });

  wrapper.addEventListener('mouseleave', hideTooltip);

  wrapper.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-val]');
    if (target) {
      showTooltip(target, touch.clientX, touch.clientY);
    } else {
      hideTooltip();
    }
  }, { passive: true });
}
