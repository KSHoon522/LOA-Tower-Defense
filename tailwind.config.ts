import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        grade: {
          common: "#9ca3af",
          uncommon: "#4ade80",
          rare: "#38bdf8",
          hero: "#c084fc",
          legendary: "#fb923c",
          esther: "#22d3ee",
        },
      },
    },
  },
  plugins: [],
};

export default config;
