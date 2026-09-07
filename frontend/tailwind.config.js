/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sea: {
          50:  "#f0faf8",
          100: "#d0f0ea",
          200: "#a1e1d5",
          300: "#6dcaba",
          400: "#3aafa0",
          500: "#1b7a6b",
          600: "#0f6b5c",
          700: "#0c5749",
          800: "#094538",
          900: "#063328",
        },
        lavender: {
          50:  "#f5f3ff",
          100: "#ede8ff",
          200: "#d5ccf5",
          300: "#b7a9e0",
          400: "#9e8fd9",
          500: "#8470cc",
          600: "#6b57b8",
          700: "#54439a",
          800: "#3e307c",
          900: "#2a2060",
        },
        terra: {
          50:  "#fdf4f0",
          100: "#fae3d8",
          200: "#f5c4a8",
          300: "#ed9e78",
          400: "#df7a50",
          500: "#c95f35",
          600: "#a84a29",
          700: "#86391f",
          800: "#652b17",
          900: "#491e10",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "IBM Plex Mono", "monospace"],
      },
      backgroundColor: {
        canvas: "#FAFAF8",
      },
      borderColor: {
        hairline: "#E5E5E0",
      },
    },
  },
  plugins: [],
};
