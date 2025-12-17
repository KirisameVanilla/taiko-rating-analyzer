/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'apple-blue': '#007AFF',
        'apple-gray': '#8E8E93',
        'apple-bg': '#F5F5F7',
        'apple-dark-bg': '#1C1C1E',
        'nav-primary': 'rgba(255, 255, 255, 0.7)',
        'nav-secondary': '#F2F2F7',
        'nav-active': '#007AFF',
        'nav-text': '#1D1D1F',
        'primary': '#007AFF',
        'primary-dark': '#0056b3',
      },
      borderRadius: {
        'apple': '20px',
        'apple-lg': '32px',
      },
      animation: {
        pulse: 'pulse 2s ease-in-out infinite',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        }
      }
    },
  },
  plugins: [],
}
