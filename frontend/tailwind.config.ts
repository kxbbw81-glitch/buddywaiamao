import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#185fa5',
        ink: '#1f2937',
        muted: '#6b7280',
        line: '#e5e7eb',
        active: '#e6f1fb',
      },
      borderRadius: {
        xl: '12px',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 18px 45px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
}

export default config
