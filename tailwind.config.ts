import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 카툰 톤: 짙은 남색 외곽선 + 채도 높은 파랑 바탕 + 노랑 강조 (카봇풍 캐릭터와 어울리게)
        line: "#1b1438",
        ink: {
          950: "#10164a",
          900: "#172064",
          850: "#1c2875",
          800: "#223088",
          700: "#2b3c9e",
          600: "#3a4fb8",
          500: "#5068d0",
        },
        gold: {
          200: "#fff4b8",
          300: "#ffe266",
          400: "#ffd23a",
          500: "#ffbf1f",
          600: "#f59e0b",
          700: "#c2710c",
          800: "#7c4504",
        },
        ark: {
          300: "#a5f3ff",
          400: "#4fe0ff",
          500: "#18b9ec",
        },
        blood: {
          400: "#ff6b72",
          500: "#f43f4e",
          600: "#c81e3a",
        },
        leaf: {
          300: "#b8f58f",
          400: "#7ee35a",
          500: "#4cc23a",
          600: "#2f8f27",
        },
        parchment: {
          50: "#ffffff",
          100: "#f3f6ff",
          300: "#cdd6ff",
          400: "#a5b2ec",
          500: "#7d8bd0",
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
        // 라틴/숫자는 Lilita One, 한글 제목은 Black Han Sans, 본문은 둥근 Jua
        display: ['"Lilita One"', '"Black Han Sans"', '"Jua"', "sans-serif"],
        serif: ['"Jua"', '"Gothic A1"', "sans-serif"],
        sans: ['"Jua"', '"Gothic A1"', '"Apple SD Gothic Neo"', '"Malgun Gothic"', "sans-serif"],
        // 에디터처럼 글이 빽빽한 화면
        plain: ['"Gothic A1"', '"Apple SD Gothic Neo"', '"Malgun Gothic"', "sans-serif"],
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-expo": "cubic-bezier(0.7, 0, 0.84, 0)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        // 들어올 때 살짝 지나쳤다가 제자리로 (통통 튀는 느낌)
        "fade-rise": {
          "0%": { opacity: "0", transform: "translateY(24px) scale(0.96)" },
          "60%": { opacity: "1", transform: "translateY(-4px) scale(1.01)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.5)" },
          "55%": { opacity: "1", transform: "scale(1.08)" },
          "78%": { transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pop-out": {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.8)" },
        },
        "sheet-in": {
          "0%": { transform: "translateY(100%)" },
          "70%": { transform: "translateY(-3%)" },
          "100%": { transform: "translateY(0)" },
        },
        "sheet-out": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(100%)" },
        },
        // 위에서 떨어져 찌그러졌다가 늘어나며 자리 잡음
        summon: {
          "0%": { opacity: "0", transform: "translateY(-28px) scale(0.4)", filter: "brightness(2.2)" },
          "42%": { opacity: "1", transform: "translateY(0) scale(1.22, 0.78)", filter: "brightness(1.6)" },
          "62%": { transform: "translateY(-6px) scale(0.9, 1.12)", filter: "brightness(1.2)" },
          "80%": { transform: "translateY(0) scale(1.05, 0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)", filter: "brightness(1)" },
        },
        shimmer: {
          from: { backgroundPosition: "-160% 0" },
          to: { backgroundPosition: "160% 0" },
        },
        // 주요 버튼이 몇 초마다 한 번씩 통통 튐 (transform과 겹치지 않게 개별 속성 사용)
        nudge: {
          "0%, 66%, 100%": { translate: "0 0", scale: "1 1" },
          "72%": { translate: "0 -7px", scale: "0.95 1.07" },
          "80%": { translate: "0 0", scale: "1.07 0.93" },
          "87%": { translate: "0 -2px", scale: "0.98 1.02" },
          "93%": { translate: "0 0", scale: "1 1" },
        },
        float: {
          "0%, 100%": { translate: "0 0" },
          "50%": { translate: "0 -8px" },
        },
        wiggle: {
          "0%, 100%": { rotate: "0deg" },
          "20%": { rotate: "-8deg" },
          "40%": { rotate: "7deg" },
          "60%": { rotate: "-4deg" },
          "80%": { rotate: "2deg" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0", transform: "scale(0.2) rotate(0deg)" },
          "50%": { opacity: "1", transform: "scale(1) rotate(90deg)" },
        },
        cloud: {
          from: { transform: "translateX(-30vw)" },
          to: { transform: "translateX(130vw)" },
        },
        // 화면 중앙 배너: 튀어나와 흔들리다 멈추고, 위로 빠지며 사라짐
        banner: {
          "0%": { opacity: "0", transform: "scale(0.3) rotate(-6deg)" },
          "10%": { opacity: "1", transform: "scale(1.15) rotate(2deg)" },
          "16%": { transform: "scale(0.94) rotate(-1deg)" },
          "21%": { transform: "scale(1.03) rotate(0deg)" },
          "26%": { transform: "scale(1)" },
          "80%": { opacity: "1", transform: "translateY(0) scale(1)" },
          "100%": { opacity: "0", transform: "translateY(-28px) scale(0.9)" },
        },
        ribbon: {
          "0%": { opacity: "0", transform: "scaleX(0)" },
          "12%": { opacity: "1", transform: "scaleX(1.06)" },
          "18%": { transform: "scaleX(1)" },
          "80%": { opacity: "1", transform: "scaleX(1)" },
          "100%": { opacity: "0", transform: "scaleX(1)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(-18px) scale(0.7)" },
          "60%": { opacity: "1", transform: "translateY(3px) scale(1.06)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shake: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "20%": { transform: "translate(-4px, 2px)" },
          "40%": { transform: "translate(4px, -2px)" },
          "60%": { transform: "translate(-3px, -1px)" },
          "80%": { transform: "translate(2px, 1px)" },
        },
        "hit-flash": {
          "0%": { transform: "scale(1) rotate(0deg)", filter: "brightness(1)" },
          "25%": { transform: "scale(1.25) rotate(-6deg)", filter: "brightness(1.6) saturate(1.4)" },
          "50%": { transform: "scale(0.94) rotate(4deg)" },
          "75%": { transform: "scale(1.04) rotate(-2deg)" },
          "100%": { transform: "scale(1) rotate(0deg)", filter: "brightness(1)" },
        },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
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
        "fade-rise": "fade-rise 520ms cubic-bezier(0.22, 1, 0.36, 1) backwards",
        "fade-in": "fade-in 200ms ease-out backwards",
        "fade-out": "fade-out 160ms ease-in both",
        "pop-in": "pop-in 380ms ease-out backwards",
        "pop-out": "pop-out 140ms ease-in both",
        "sheet-in": "sheet-in 380ms cubic-bezier(0.22, 1, 0.36, 1) backwards",
        "sheet-out": "sheet-out 200ms ease-in both",
        summon: "summon 620ms ease-out backwards",
        shimmer: "shimmer 3.6s linear infinite",
        nudge: "nudge 2.8s ease-in-out infinite",
        float: "float 3.2s ease-in-out infinite",
        wiggle: "wiggle 600ms ease-in-out",
        twinkle: "twinkle 2.4s ease-in-out infinite",
        cloud: "cloud 60s linear infinite",
        banner: "banner 2s ease-out both",
        ribbon: "ribbon 2s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "toast-in": "toast-in 360ms ease-out backwards",
        shake: "shake 320ms ease-in-out",
        "hit-flash": "hit-flash 480ms ease-out",
        "spin-slow": "spin-slow 140s linear infinite",
        rays: "rays 14s linear infinite",
        sweep: "sweep 3.8s cubic-bezier(0.4, 0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
