/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        blush: {
          50: '#fff7f8',
          100: '#ffe9ed',
          200: '#fecdd5',
          500: '#e8798f',
          600: '#d95d76',
        },
      },
    },
  },
  plugins: [],
};
