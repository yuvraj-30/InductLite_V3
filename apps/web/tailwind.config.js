/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ["var(--font-body)", "Manrope", "sans-serif"],
        display: ["var(--font-display)", "Space Grotesk", "sans-serif"],
      },
      borderRadius: {
        panel: "1.15rem",
        control: "0.85rem",
      },
      boxShadow: {
        glass: "var(--shadow-soft)",
        float: "var(--shadow-float)",
      },
      colors: {
        ink: "var(--text-primary)",
        mist: "var(--text-secondary)",
        cyber: {
          primary: "var(--accent-primary)",
          glow: "var(--accent-cyber)",
          neon: "var(--accent-neon)",
        },
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        construction: {
          orange: "#f97316",
          yellow: "#fbbf24",
          slate: "#475569",
        },
      },
    },
  },
  plugins: [],
};
