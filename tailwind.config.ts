import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

// Standard shadcn/ui theme wiring: semantic colors come from CSS variables
// defined in src/styles.css so the palette can be tuned in one place.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        card: 'var(--radius-card)',
        dialog: 'var(--radius-dialog)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        raised: 'var(--shadow-raised)',
        dialog: 'var(--shadow-dialog)',
      },
      // headings ride Segoe UI Variable Display on Win11 (optical sizing),
      // classic Segoe UI elsewhere — same sanctioned family either way
      fontFamily: {
        display: ["'Segoe UI Variable Display'", "'Segoe UI'", 'system-ui', 'sans-serif'],
      },
      // the app's type scale; caution — tailwind-merge treats these as text
      // COLORS, so never pass them through cn() next to a text-* color
      fontSize: {
        display: ['30px', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '600' }],
        title: ['21px', { lineHeight: '1.3', fontWeight: '600' }],
        section: ['15px', { lineHeight: '1.4', fontWeight: '600' }],
      },
      // brand spec: 120ms transitions (default ease is already cubic-bezier(.4,0,.2,1))
      transitionDuration: {
        DEFAULT: '120ms',
      },
    },
  },
  plugins: [animate],
} satisfies Config
