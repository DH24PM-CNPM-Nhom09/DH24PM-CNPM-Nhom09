/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/app/**/*.{js,ts,jsx,tsx}", "./src/components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Be Vietnam Pro'", "system-ui", "sans-serif"],
      },
      colors: {
        navy: {
          900: "#142B4D",
          800: "#1B3A66",
          700: "#20477A",
          50: "#EEF2F8",
        },
        accent: {
          DEFAULT: "#E8734A",
          dark: "#C85A33",
          50: "#FDEEE7",
        },
        success: { DEFAULT: "#16A34A", 50: "#EAF7EE" },
        warning: { DEFAULT: "#D97706", 50: "#FEF3E2" },
        danger: { DEFAULT: "#DC2626", 50: "#FDECEC" },
        info: { DEFAULT: "#2563EB", 50: "#EAF1FE" },
        gray: {
          25: "#FCFCFD",
          50: "#F7F8FA",
          100: "#F1F3F6",
          200: "#E3E7ED",
          300: "#CBD2DC",
          400: "#9AA4B2",
          500: "#69738A",
          600: "#4B5468",
          700: "#333B4D",
          900: "#12151C",
        },
      },
      borderRadius: {
        input: "10px",
        card: "14px",
      },
    },
  },
  plugins: [],
};
