import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * Claudelance Design Tokens — B41: modern fintech design tokens
 *
 * Token groups:
 *  • colors       → shadcn CSS-var tokens + semantic token colors (cUSD/CELO/USDC)
 *  • typography   → font families + display scale
 *  • spacing      → consistent rhythm scale
 *  • shadows      → glass / glow / premium
 *  • animation    → fade-in, slide-up, shimmer
 *  • borderRadius → consistent rounding
 */

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", md: "2rem" },
      screens: { sm: "640px", md: "768px", lg: "1024px", xl: "1200px" },
    },
    extend: {
      // ── Semantic color tokens (shadcn CSS-var based) ──────────
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
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
          light: "#647084",
          dark:  "#9AA5B8",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          light: "#4F46E5",
          dark:  "#9B8CFF",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // ── Token-specific brand colors ──────────────────────────
        cusd: {
          DEFAULT: "hsl(216 12% 52%)",   // slate-500 equivalent
          light:   "hsl(220 22% 94%)",
          dark:    "hsl(220 14% 18%)",
        },
        celo: {
          DEFAULT: "hsl(48 96% 55%)",    // official CELO yellow
          light:   "hsl(48 100% 90%)",
          dark:    "hsl(40 60% 22%)",
        },
        usdc: {
          DEFAULT: "hsl(219 84% 55%)",   // Circle USDC blue
          light:   "hsl(219 100% 92%)",
          dark:    "hsl(219 60% 18%)",
        },

        // ── B41 color tokens (light + dark pairs) ─────────────────
        bg: {
          light: "#F7F9FC",
          dark:  "#090B12",
        },
        fg: {
          light: "#101522",
          dark:  "#F5F7FB",
        },
        success: {
          light: "#087F5B",
          dark:  "#4ADE80",
        },
        warn: {
          light: "#9A5B00",
          dark:  "#FACC15",
        },
        danger: {
          light: "#C2410C",
          dark:  "#FB7185",
        },
      },

      // ── Typography ───────────────────────────────────────────
      fontFamily: {
        sans:    ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono:    ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-geist-sans)", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
        // B41 7-step type scale (12/14/16/18/22/28/36)
        "scale-1": ["12px", { lineHeight: "16px" }],
        "scale-2": ["14px", { lineHeight: "20px" }],
        "scale-3": ["16px", { lineHeight: "24px" }],
        "scale-4": ["18px", { lineHeight: "28px" }],
        "scale-5": ["22px", { lineHeight: "32px" }],
        "scale-6": ["28px", { lineHeight: "36px" }],
        "scale-7": ["36px", { lineHeight: "44px" }],
      },
      letterSpacing: {
        tightest: "-0.05em",
      },

      // ── Border radius ─────────────────────────────────────────
      borderRadius: {
        sm:   "6px",
        md:   "8px",
        lg:   "12px",
        xl:   "16px",
        "2xl":"24px",  // B41 spec: 2xl is 24px
        "3xl":"28px",
      },

      // ── Shadows ───────────────────────────────────────────────
      boxShadow: {
        glass:          "0 18px 48px -32px rgba(15, 23, 42, 0.42)",
        "glass-strong": "0 28px 80px -44px rgba(15, 23, 42, 0.52)",
        glow:           "0 14px 34px -18px hsl(var(--primary) / 0.65)",
        "glow-sm":      "0 6px 18px -8px  hsl(var(--primary) / 0.45)",
        "glow-celo":    "0 8px 24px -12px hsl(48 96% 55% / 0.55)",
        panel:          "0 1px 3px 0 hsl(220 15% 12% / 0.08), 0 18px 40px -24px hsl(220 15% 12% / 0.12)",
      },

      // ── Keyframes ─────────────────────────────────────────────
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(16px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.7" },
          "50%":       { opacity: "1" },
        },
      },

      // ── Animations ────────────────────────────────────────────
      animation: {
        "fade-in":       "fade-in 600ms ease-out both",
        "slide-up":      "slide-up 500ms ease-out both",
        "slide-up-slow": "slide-up 800ms ease-out both",
        "slide-in-right":"slide-in-right 400ms ease-out both",
        shimmer:         "shimmer 3s linear infinite",
        "pulse-soft":    "pulse-soft 2.4s ease-in-out infinite",
      },

      transitionDuration: {
        DEFAULT: "200ms",
        fast: "120ms",
        normal: "180ms",  // B41: ease-out-quad 180ms default
        slow: "240ms",    // B41: ease-in-out 240ms slow
      },
      transitionTimingFunction: {
        "out-quad": "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        "in-out-smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [animate],
};

export default config;
