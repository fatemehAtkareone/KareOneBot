/** @type {import('tailwindcss').Config} */
function rgb(varName) {
  return ({ opacityValue }) =>
    opacityValue !== undefined
      ? `rgb(var(${varName}) / ${opacityValue})`
      : `rgb(var(${varName}))`;
}

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        tg: {
          bg: rgb("--tg-bg"),
          text: rgb("--tg-text"),
          hint: rgb("--tg-hint"),
          link: rgb("--tg-link"),
          button: rgb("--tg-button"),
          buttonText: rgb("--tg-button-text"),
          secondaryBg: rgb("--tg-secondary-bg"),
          card: rgb("--tg-card"),
          accent: rgb("--tg-accent"),
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Vazirmatn", "IRANSans", "Tahoma", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)",
      },
      animation: {
        shimmer: "shimmer 1.6s linear infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
