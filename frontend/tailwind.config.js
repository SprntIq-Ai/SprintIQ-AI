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
        // Admin Color Palette
        admin: {
          primary: '#659287',
          secondary: '#88BDA4',
          accent: '#B1D3B9',
          bg: '#E6F2DD',
          darkBg: '#0f1917'
        },
        // Project Manager Color Palette
        manager: {
          primary: '#FE9EC7',
          secondary: '#F9F6C4',
          accent: '#89D4FF',
          action: '#44ACFF'
        },
        // Developer Color Palette
        developer: {
          primary: '#30AFFF',
          secondary: '#92EEFF',
          accent: '#D8FFC5',
          success: '#C4F7CA'
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
