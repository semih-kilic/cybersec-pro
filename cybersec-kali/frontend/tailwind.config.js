/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#00ff88',
        secondary: '#00d4ff',
        'dark-bg': '#0a0e27',
        'dark-card': '#151b3d',
        'dark-border': '#2d3a5f',
      }
    },
  },
  plugins: [],
}
