/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", '[data-theme="high-contrast-dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.25rem",
        lg: "1.75rem",
        xl: "2.25rem",
        "2xl": "2.75rem",
      },
    },
    extend: {
      fontFamily: {
        body: ["var(--font-body)", "Manrope", "sans-serif"],
        display: ["var(--font-display)", "Space Grotesk", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#edf6ff",
          100: "#d7ebff",
          200: "#b4d9ff",
          300: "#82bdff",
          400: "#4e9bff",
          500: "#257ef7",
          600: "#1c68d9",
          700: "#1953ae",
          800: "#1b488d",
          900: "#1c3f72",
        },
        gray: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
        semantic: {
          success: "#0f8a62",
          warning: "#a46105",
          error: "#c7394a",
          info: "#2563eb",
        },
        ink: "var(--text-primary)",
        mist: "var(--text-secondary)",
        surface: {
          base: "var(--bg-base)",
          card: "var(--bg-surface)",
          raised: "var(--bg-surface-strong)",
          glass: "var(--glass-bg)",
        },
        border: {
          soft: "var(--border-soft)",
          strong: "var(--border-strong)",
          glass: "var(--border-glass)",
        },
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        26: "6.5rem",
        30: "7.5rem",
      },
      borderRadius: {
        panel: "1.15rem",
        control: "0.85rem",
        glass: "1.25rem",
      },
      boxShadow: {
        trust: "0 1px 2px rgba(15, 23, 42, 0.08), 0 10px 28px rgba(15, 23, 42, 0.08)",
        glass: "var(--shadow-glass)",
        float: "var(--shadow-float)",
      },
      backdropBlur: {
        glass: "14px",
      },
      fontSize: {
        "display-1": ["2.5rem", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "700" }],
        "display-2": ["2rem", { lineHeight: "1.08", letterSpacing: "-0.025em", fontWeight: "700" }],
        "heading-1": ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        "heading-2": ["1.25rem", { lineHeight: "1.25", letterSpacing: "-0.015em", fontWeight: "650" }],
      },
      transitionTimingFunction: {
        productive: "cubic-bezier(0.2, 0.9, 0.2, 1)",
        snappy: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      transitionDuration: {
        250: "250ms",
        350: "350ms",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
      },
      animation: {
        "fade-up": "fade-up 360ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-soft": "pulse-soft 1.8s ease-in-out infinite",
      },
      gridTemplateColumns: {
        bento: "repeat(12, minmax(0, 1fr))",
      },
    },
  },
  plugins: [],
};
