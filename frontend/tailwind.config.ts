import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 24px 70px rgba(37, 99, 235, 0.13)',
        coral: '0 22px 60px rgba(251, 146, 60, .18)',
        mint: '0 22px 60px rgba(16, 185, 129, .15)'
      },
      backgroundImage: {
        premium: 'radial-gradient(circle at 8% 8%, rgba(255,186,214,.55), transparent 26%), radial-gradient(circle at 86% 12%, rgba(186,230,253,.70), transparent 30%), radial-gradient(circle at 50% 90%, rgba(187,247,208,.58), transparent 34%), linear-gradient(135deg, #fff7ed 0%, #fdf2f8 28%, #eff6ff 58%, #ecfdf5 100%)'
      }
    }
  },
  plugins: []
};
export default config;
