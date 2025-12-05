/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        // Breakpoints fra Oslo kommune Punkt designsystem
        // https://punkt.oslo.kommune.no/latest/grunnleggende/ressurser/breakpoints/
        'phablet': '576px',     // 36rem - mobile → phablet
        'tablet': '768px',      // 48rem - phablet → tablet (MOBIL/DESKTOP BREAKPOINT)
        'tablet-big': '1024px', // 64rem - tablet → tablet-big
        'laptop': '1280px',     // 80rem - tablet-big → laptop
        'desktop': '1600px',    // 100rem - laptop → desktop
      },
    },
  },
  plugins: [],
};
