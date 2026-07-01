/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'sans-serif'],
        display: ['var(--font-display)', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          400: '#38bdf8',
          600: '#0284c7',
          800: '#075985',
          900: '#0c4a6e',
        },
        rose: {
          50: '#FAF8F9',
          100: 'rgba(185, 122, 136, 0.15)',
          200: 'rgba(185, 122, 136, 0.25)',
          300: '#d1a3ad',
          400: '#B97A88',
          500: '#a86a77',
          600: '#9f6572',
          700: '#85515d',
          800: '#69414b',
          900: '#4e3139',
          950: '#344B5C', // Teal mapped to deepest shade for contrast
        }
      },
    },
  },
  plugins: [],
}
