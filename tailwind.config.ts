import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        zen: {
          base: "#FAF9F6",
          lavender: "#D8D2E1",
          sage: "#AEC3B0",
          peach: "#F9E4D4",
          charcoal: "#2D3748",
        }
      },
      keyframes: {
        morph: {
          '0%, 100%': { borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' },
          '50%': { borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%' },
        }
      },
      animation: {
        'liquid-flow': 'morph 8s ease-in-out infinite',
      }
    },
  },
  plugins: [],
};
export default config;
