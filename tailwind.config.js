/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#1a1a1a',
        'bg-secondary': '#2d2d2d',
        'accent-primary': '#6366f1',
        'accent-success': '#10b981',
        'text-primary': '#ffffff',
        'text-secondary': '#a0a0a0',
        'border': '#404040',
      },
    },
  },
  plugins: [],
}
