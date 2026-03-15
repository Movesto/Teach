/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // 'class' means dark: variants activate when <html> has the .dark class
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}