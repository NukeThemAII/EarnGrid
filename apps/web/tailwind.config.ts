import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        mist: "#e0f2fe",
        teal: "#0ea5e9",
        sand: "#f5f5f4"
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        body: ["'Space Grotesk'", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 20px 60px rgba(15, 23, 42, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
