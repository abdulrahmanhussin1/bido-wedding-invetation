/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ivory: '#FAF8F3',
        parchment: '#F4F0E8',
        gold: {
          light: '#EAD9B6',
          DEFAULT: '#C8AD78',
          dark: '#9E824C',
        },
        burgundy: {
          DEFAULT: '#6E2638',
          deep: '#4A1827',
          soft: '#853246',
        },
        dusty: {
          rose: '#B9828E',
          pink: '#D8B5B8',
          cream: '#ECE5D8',
        },
        ink: '#332A29',
        muted: '#7E726D'
      },
      fontFamily: {
        amiri: ['Amiri', 'serif'],
        naskh: ['Noto Naskh Arabic', 'serif'],
        cinzel: ['Cinzel', 'serif'],
        playfair: ['Playfair Display', 'serif'],
        cormorant: ['Cormorant Garamond', 'serif'],
        alex: ['Alex Brush', 'cursive'],
        montserrat: ['Montserrat', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
