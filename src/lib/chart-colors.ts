// Tailwind color values used for chart segments per financial category.
// The onboarding list dots and the dashboard donut chart both source their
// colors from this palette so they stay in sync.

export const CATEGORY_COLORS = {
  // Single value — cash is always one segment
  cash: '#7dd3fc', // sky-300

  investments: [
    '#14b8a6', // teal-500
    '#0d9488', // teal-600
    '#0f766e', // teal-700
    '#115e59', // teal-800
    '#134e4a', // teal-900
  ],

  tangibleAssets: [
    '#7c3aed', // violet-600
    '#6d28d9', // violet-700
    '#5b21b6', // violet-800
    '#4c1d95', // violet-900
    '#8b5cf6', // violet-500
  ],

  liabilities: [
    '#f87171', // red-400
    '#ef4444', // red-500
    '#dc2626', // red-600
    '#b91c1c', // red-700
    '#991b1b', // red-800
  ],
}

// Shades for lines drawn over the chart's bars: darker than the bars on a
// light background, lighter on a dark one, so a line stands out from the bars
// of its own category in either theme.
export const LINE_COLORS = {
  cash: { light: '#0284c7', dark: CATEGORY_COLORS.cash }, // sky-600, sky-300
  investments: { light: CATEGORY_COLORS.investments[2], dark: '#2dd4bf' }, // teal-700, teal-400
  tangibleAssets: { light: CATEGORY_COLORS.tangibleAssets[3], dark: '#a78bfa' }, // violet-900, violet-400
  liabilities: { light: CATEGORY_COLORS.liabilities[2], dark: CATEGORY_COLORS.liabilities[0] }, // red-600, red-400
}
