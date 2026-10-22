import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 로스트아크 UI 톤: 먹빛 남색 바탕 + 고풍스러운 금색 + 아크(청록) 발광
        ink: {
          950: "#05070b",
          900: "#0a0e16",
          850: "#0e131e",
          800: "#131a28",
          700: "#1b2436",
          600: "#273249",
          500: "#3a4763",
        },
        gold: {
          200: "#fbefc9",
          300: "#f3dc9c",
          400: "#e6c274",
          500: "#cfa24e",
          600: "#a67c32",
          700: "#755624",
          800: "#4a3618",
        },
        ark: {
          300: "#9ff7f2",
          400: "#5ee8e0",
          500: "#2fc9c2",
        },
        blood: {
          400: "#ff6b6b",
          500: "#e5484d",
          600: "#b4232a",
        },
        parchment: {
          50: "#fbf7ee",
          100: "#f1e9d6",
          300: "#cfc5ae",
          400: "#a9a08b",
          500: "#7f7867",
        },
        // 로스트아크 아이템 등급 색
        grade: {
          common: "#b5b5b5",
          uncommon: "#8df901",
          rare: "#00b0fa",
          hero: "#ce43fc",
          legendary: "#f99200",
        },
      },
      fontFamily: {
        // 라틴 제목은 Cinzel, 한글은 Noto Serif KR로 이어짐
        display: ["Cinzel", '"Noto Serif KR"', "serif"],
        serif: ['"Noto Serif KR"', "serif"],
        sans: ['"Gothic A1"', '"Apple SD Gothic Neo"', '"Malgun Gothic"', "sans-serif"],
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-expo": "cubic-bezier(0.7, 0, 0.84, 0)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        "fade-rise": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "pop-in": {
          from: { opacity: "0", transform: "scale(0.94)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pop-out": {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.96)" },
        },
        "sheet-in": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "sheet-out": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(100%)" },
        },
        summon: {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.6)", filter: "brightness(2.4)" },
          "55%": { opacity: "1", transform: "translateY(-3px) scale(1.07)", filter: "brightness(1.5)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)", filter: "brightness(1)" },
        },
        shimmer: {
          from: { backgroundPosition: "-160% 0" },
          to: { backgroundPosition: "160% 0" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(230,194,116,0), 0 8px 24px -8px rgba(207,162,78,0.55)" },
          "50%": { boxShadow: "0 0 26px 2px rgba(230,194,116,0.38), 0 8px 24px -8px rgba(207,162,78,0.55)" },
        },
        "ark-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(94,232,224,0), 0 8px 24px -8px rgba(47,201,194,0.5)" },
          "50%": { boxShadow: "0 0 24px 2px rgba(94,232,224,0.35), 0 8px 24px -8px rgba(47,201,194,0.5)" },
        },
        banner: {
          "0%": { opacity: "0", transform: "scale(1.12)", letterSpacing: "0.55em" },
          "14%": { opacity: "1", transform: "scale(1)", letterSpacing: "0.22em" },
          "78%": { opacity: "1", transform: "scale(1)", letterSpacing: "0.2em" },
          "100%": { opacity: "0", transform: "translateY(-10px) scale(0.98)", letterSpacing: "0.2em" },
        },
        "line-grow": {
          "0%": { transform: "scaleX(0)", opacity: "0" },
          "18%": { transform: "scaleX(1)", opacity: "1" },
          "80%": { transform: "scaleX(1)", opacity: "1" },
          "100%": { transform: "scaleX(1)", opacity: "0" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(-10px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shake: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "20%": { transform: "translate(-4px, 2px)" },
          "40%": { transform: "translate(4px, -2px)" },
          "60%": { transform: "translate(-3px, -1px)" },
          "80%": { transform: "translate(2px, 1px)" },
        },
        "hit-flash": {
          "0%": { transform: "scale(1)", filter: "brightness(1)" },
          "30%": { transform: "scale(1.18)", filter: "brightness(1.8) saturate(1.4)" },
          "100%": { transform: "scale(1)", filter: "brightness(1)" },
        },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        drift: {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(2%, -3%, 0)" },
        },
        "rise-fade": {
          "0%": { opacity: "0", transform: "translateY(0)" },
          "15%": { opacity: "0.9" },
          "100%": { opacity: "0", transform: "translateY(-120px)" },
        },
        rays: {
          from: { transform: "translate(-50%, -50%) rotate(0deg)" },
          to: { transform: "translate(-50%, -50%) rotate(360deg)" },
        },
        sweep: {
          from: { transform: "translateX(-120%) skewX(-18deg)" },
          to: { transform: "translateX(320%) skewX(-18deg)" },
        },
      },
      animation: {
        "fade-rise": "fade-rise 560ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        "fade-in": "fade-in 240ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        "fade-out": "fade-out 180ms cubic-bezier(0.7, 0, 0.84, 0) both",
        "pop-in": "pop-in 220ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        "pop-out": "pop-out 160ms cubic-bezier(0.7, 0, 0.84, 0) both",
        "sheet-in": "sheet-in 320ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        "sheet-out": "sheet-out 200ms cubic-bezier(0.7, 0, 0.84, 0) both",
        summon: "summon 520ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        shimmer: "shimmer 3.6s linear infinite",
        "glow-pulse": "glow-pulse 2.4s ease-in-out infinite",
        "ark-pulse": "ark-pulse 2s ease-in-out infinite",
        banner: "banner 1.9s cubic-bezier(0.16, 1, 0.3, 1) both",
        "line-grow": "line-grow 1.9s cubic-bezier(0.16, 1, 0.3, 1) both",
        "toast-in": "toast-in 260ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        shake: "shake 320ms ease-in-out",
        "hit-flash": "hit-flash 420ms cubic-bezier(0.16, 1, 0.3, 1)",
        "spin-slow": "spin-slow 140s linear infinite",
        drift: "drift 22s ease-in-out infinite",
        "rise-fade": "rise-fade 9s linear infinite",
        rays: "rays 14s linear infinite",
        sweep: "sweep 3.8s cubic-bezier(0.4, 0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
