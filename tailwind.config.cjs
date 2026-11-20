/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "Epilogue", "sans-serif"],
        heading: ["var(--font-heading)", "Epilogue", "sans-serif"],
      },
      colors: {
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--color-primary) / <alpha-value>)",
          hover: "rgb(var(--color-brand-deep) / <alpha-value>)",
        },
        "brand-deep": "rgb(var(--color-brand-deep) / <alpha-value>)",
        secondary: "rgb(var(--color-secondary) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        destructive: "rgb(var(--color-destructive) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        "border-strong": "rgb(var(--color-border-strong) / <alpha-value>)",
      },
      boxShadow: {
        soft: "0 10px 30px -20px rgba(15, 23, 42, 0.2)",
      },
    },
  },
  plugins: [],
};
