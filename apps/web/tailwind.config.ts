import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const fintechColors = {
  bg: { light: "#F7F9FC", dark: "#090B12" },
  fg: { light: "#101522", dark: "#F5F7FB" },
  muted: { light: "#647084", dark: "#9AA5B8" },
  accent: { light: "#4F46E5", dark: "#9B8CFF" },
  success: { light: "#087F5B", dark: "#4ADE80" },
  warn: { light: "#9A5B00", dark: "#FACC15" },
  danger: { light: "#C2410C", dark: "#FB7185" },
} as const;

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
      colors: {
        bg: {
          DEFAULT: fintechColors.bg.light,
          light: fintechColors.bg.light,
          dark: fintechColors.bg.dark,
        },
        fg: {
          DEFAULT: fintechColors.fg.light,
          light: fintechColors.fg.light,
          dark: fintechColors.fg.dark,
        },
        success: {
          DEFAULT: fintechColors.success.light,
          light: fintechColors.success.light,
          dark: fintechColors.success.dark,
        },
        warn: {
          DEFAULT: fintechColors.warn.light,
          light: fintechColors.warn.light,
          dark: fintechColors.warn.dark,
        },
        danger: {
          DEFAULT: fintechColors.danger.light,
          dark: fintechColors.danger.dark,
          light: fintechColors.danger.light,
        },
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
          light: fintechColors.muted.light,
          dark: fintechColors.muted.dark,
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          light: fintechColors.accent.light,
          dark: fintechColors.accent.dark,
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "var(--font-geist-sans)", "sans-serif"],
      },
      
      spacing: {
        "fintech-xs": "2px",
        "fintech-sm": "4px", 
        "fintech-md": "8px",
        "fintech-lg": "16px",
        "fintech-xl": "24px",
        "fintech-2xl": "32px",
        "fintech-3xl": "48px",
      },
      backgroundImage: {
        "gradient-fintech": "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)",
        "gradient-success": "linear-gradient(135deg, #087F5B 0%, #4ADE80 100%)",
        "gradient-warn": "linear-gradient(135deg, #9A5B00 0%, #FACC15 100%)",
        "gradient-glass": "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
        "gradient-glass-dark": "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
      },
      opacity: {
        "glass": "0.08",
        "glass-strong": "0.12",
      },
      fontSize: {
        "scale-1": ["12px", { lineHeight: "16px" }],
        "scale-2": ["14px", { lineHeight: "20px" }],
        "scale-3": ["16px", { lineHeight: "24px" }],
        "scale-4": ["18px", { lineHeight: "28px" }],
        "scale-5": ["22px", { lineHeight: "32px" }],
        "scale-6": ["28px", { lineHeight: "36px" }],
        "scale-7": ["36px", { lineHeight: "44px" }],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "24px",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.08)",
        "glass-strong": "0 16px 48px 0 rgba(31, 38, 135, 0.18)",
        glow: "0 0 32px 0 hsl(var(--primary) / 0.35)",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "fade-in": "fade-in 600ms ease-out",
        float: "float 6s ease-in-out infinite",
      },
      transitionDuration: {
        DEFAULT: "180ms",
        normal: "180ms",
        slow: "240ms",
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
