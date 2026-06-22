import ApexCharts from 'apexcharts';

let chartInstance = null;
let lastChartConfig = null;

/**
 * Destroys the current chart instance if it exists.
 */
export function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
    lastChartConfig = null;
  }
}

/**
 * Renders or updates the calorie intake trend chart using ApexCharts.
 * Includes optimization to skip re-render if data hasn't changed.
 * 
 * @param {string} chartContainerSelector - Selector for the chart container.
 * @param {Array} labels - X-axis categories (dates).
 * @param {Array} values - Y-axis data values (calories).
 * @param {number} tdeeGoal - Target daily calorie goal.
 * @param {string} theme - Active color theme ('light'|'dark').
 */
export function renderCalorieChart(chartContainerSelector, labels, values, tdeeGoal, theme) {
  // Create a config signature to detect changes
  const configSignature = JSON.stringify({ labels, values, tdeeGoal, theme });
  
  // Skip re-render if config hasn't changed
  if (lastChartConfig === configSignature && chartInstance) {
    return;
  }
  
  lastChartConfig = configSignature;
  destroyChart();
  
  const chartEl = document.querySelector(chartContainerSelector);
  if (!chartEl) return;

  const style = getComputedStyle(document.documentElement);
  const accentPrimary = style.getPropertyValue('--accent-primary').trim() || '#8b5cf6';
  const textSecondary = style.getPropertyValue('--text-secondary').trim() || '#94a3b8';
  const borderMuted = style.getPropertyValue('--border-muted').trim() || 'rgba(255, 255, 255, 0.08)';
  
  const options = {
    chart: {
      type: 'area',
      height: 320,
      toolbar: { show: false },
      fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      foreColor: textSecondary,
      background: 'transparent',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800
      }
    },
    stroke: {
      curve: 'smooth',
      width: 3,
      colors: [accentPrimary]
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        colorStops: [
          {
            offset: 0,
            color: accentPrimary,
            opacity: 0.4
          },
          {
            offset: 100,
            color: accentPrimary,
            opacity: 0.05
          }
        ]
      }
    },
    series: [{
      name: 'Calories Consumed',
      data: values
    }],
    xaxis: {
      categories: labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: textSecondary,
          fontSize: '11px',
          fontWeight: 500
        }
      }
    },
    yaxis: {
      labels: {
        formatter: (val) => `${Math.round(val)} kcal`,
        style: {
          colors: textSecondary,
          fontSize: '11px',
          fontWeight: 500
        }
      }
    },
    grid: {
      borderColor: borderMuted,
      strokeDashArray: 4,
      padding: {
        top: 10,
        right: 15,
        bottom: 0,
        left: 10
      }
    },
    markers: {
      size: 4,
      colors: [accentPrimary],
      strokeColors: '#ffffff',
      strokeWidth: 2,
      hover: {
        size: 6
      }
    },
    dataLabels: {
      enabled: false
    },
    annotations: {
      yaxis: [{
        y: tdeeGoal,
        borderColor: '#f43f5e',
        borderWidth: 2,
        strokeDashArray: 5,
        label: {
          borderColor: '#f43f5e',
          style: {
            color: '#fff',
            background: '#f43f5e',
            fontWeight: 600,
            fontSize: '10px',
            fontFamily: 'Outfit, sans-serif'
          },
          text: `Target: ${tdeeGoal} kcal`
        }
      }]
    },
    tooltip: {
      theme: theme,
      x: { show: true },
      y: {
        formatter: (val) => `${val} kcal`
      }
    }
  };
  
  chartInstance = new ApexCharts(chartEl, options);
  chartInstance.render();
}
