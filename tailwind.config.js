/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'fade-slide-in': 'fadeSlideIn 0.6s ease-out both',
        'nudge': 'nudge 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
