import tailwindcssForms from "@tailwindcss/forms";
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class", "[data-theme='dark']"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        canvas: "hsl(var(--bg-canvas))",
        surface: {
          DEFAULT: "hsl(var(--bg-surface))",
          raised: "hsl(var(--bg-surface-raised))",
          sunken: "hsl(var(--bg-sunken))",
        },
        ink: {
          DEFAULT: "hsl(var(--text-primary))",
          soft: "hsl(var(--text-secondary))",
          mute: "hsl(var(--text-tertiary))",
          disabled: "hsl(var(--text-disabled))",
        },
        action: {
          DEFAULT: "hsl(var(--action-primary))",
          hover: "hsl(var(--action-primary-hover))",
          pressed: "hsl(var(--action-primary-pressed))",
          soft: "hsl(var(--action-secondary))",
          on: "hsl(var(--action-on-accent))",
        },
        urgency: {
          calm: "hsl(var(--urgency-calm))",
          soon: "hsl(var(--urgency-soon))",
          today: "hsl(var(--urgency-today))",
          now: "hsl(var(--urgency-now))",
          critical: "hsl(var(--urgency-critical))",
          "overdue-soft": "hsl(var(--urgency-overdue-soft))",
        },
        state: {
          complete: "hsl(var(--state-complete))",
          "in-progress": "hsl(var(--state-in-progress))",
          blocked: "hsl(var(--state-blocked))",
          scheduled: "hsl(var(--state-scheduled))",
          captured: "hsl(var(--state-captured))",
        },
        dom: {
          sage: "hsl(var(--dom-sage))",
          "sage-soft": "hsl(var(--dom-sage-soft))",
          dust: "hsl(var(--dom-dust))",
          "dust-soft": "hsl(var(--dom-dust-soft))",
          clay: "hsl(var(--dom-clay))",
          "dom-clay-soft": "hsl(var(--dom-clay-soft))",
          plum: "hsl(var(--dom-plum))",
          "plum-soft": "hsl(var(--dom-plum-soft))",
          mustard: "hsl(var(--dom-mustard))",
          "mustard-soft": "hsl(var(--dom-mustard-soft))",
          slate: "hsl(var(--dom-slate))",
          "slate-soft": "hsl(var(--dom-slate-soft))",
        },
        // GoneSquirrel woodsy palette — energy/state by task type
        forest: "hsl(var(--accent-forest))",
        honey: "hsl(var(--accent-honey))",
        moss: "hsl(var(--accent-moss))",
        acorn: "hsl(var(--accent-acorn))",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Menlo", "monospace"],
        brand: ["var(--font-brand)", "Nunito", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-xl": [
          "4rem",
          {
            lineHeight: "4.5rem",
            letterSpacing: "-0.02em",
            fontWeight: "400",
          },
        ],
        display: [
          "2.5rem",
          {
            lineHeight: "3rem",
            letterSpacing: "-0.018em",
            fontWeight: "400",
          },
        ],
        "display-sm": [
          "1.75rem",
          {
            lineHeight: "2.25rem",
            letterSpacing: "-0.014em",
            fontWeight: "500",
          },
        ],
        h2: [
          "1.375rem",
          {
            lineHeight: "1.875rem",
            letterSpacing: "-0.008em",
            fontWeight: "600",
          },
        ],
        body: [
          "1rem",
          {
            lineHeight: "1.625rem",
            fontWeight: "500",
          },
        ],
        "body-sm": [
          "0.875rem",
          {
            lineHeight: "1.375rem",
            fontWeight: "500",
          },
        ],
        meta: [
          "0.75rem",
          {
            lineHeight: "1rem",
            letterSpacing: "0.06em",
            fontWeight: "600",
          },
        ],
        mono: [
          "0.8125rem",
          {
            lineHeight: "1.25rem",
            fontWeight: "500",
          },
        ],
      },
      spacing: {
        section: "2rem",
        block: "1.5rem",
        gutter: "1rem",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        raised: "var(--shadow-raised)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 10px)",
      },
    },
  },
  plugins: [tailwindcssAnimate, tailwindcssForms],
};

export default config;
