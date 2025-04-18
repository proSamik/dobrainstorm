import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          50: '#fff1f0',
          100: '#ffe4e1',
          200: '#ffc9c2',
          300: '#ffa499',
          400: '#ff6d5a',
          500: '#ff4d35',
          600: '#ed3419',
          700: '#c52a15',
          800: '#9e2417',
          900: '#81231a',
        },
        light: {
          background: '#ffffff',
          foreground: '#0f172a',
          muted: '#64748b',
          accent: '#fff1f0',
        },
        dark: {
          background: '#1a1a1a',
          foreground: '#f8fafc',
          muted: '#94a3b8',
          accent: '#2c1c1a',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      typography: (theme: any) => ({
        DEFAULT: {
          css: {
            color: theme('colors.gray.900'),
            maxWidth: 'none',
            hr: { borderColor: theme('colors.gray.200') },
            'strong, b': { color: theme('colors.gray.900') },
            'ol > li::before': { color: theme('colors.gray.500') },
            'ul > li::before': { backgroundColor: theme('colors.gray.500') },
            'h1, h2, h3, h4': { color: theme('colors.gray.900') },
          },
        },
        dark: {
          css: {
            color: theme('colors.gray.300'),
            'strong, b': { color: theme('colors.gray.300') },
            'ol > li::before': { color: theme('colors.gray.400') },
            'ul > li::before': { backgroundColor: theme('colors.gray.400') },
            'h1, h2, h3, h4': { color: theme('colors.gray.100') },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}

export default config;
