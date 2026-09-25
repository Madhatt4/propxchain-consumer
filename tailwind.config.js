/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        // PropXchain brand sage (--px-sage* in src/styles/index.css). Mapped to
        // literal hex rather than `hsl(var(--px-sage-light))` like the tokens
        // above: every call site uses opacity modifiers (bg-sage-light/10, etc),
        // and Tailwind can only inject an alpha channel into a CSS-var colour
        // when the var itself is expressed as bare channels (e.g.
        // `var(--x) / <alpha-value>`) — a bare hex-string var like
        // `--px-sage-light: #DAE5DC` can't be parsed that way, so `/10` would
        // silently no-op. Literal hex opts out of the CSS var's dark-mode flip
        // (styles/index.css overrides --px-sage/--px-sage-light under `.dark`),
        // but every current usage already pairs sage-* with an explicit `dark:`
        // variant (emerald/slate) rather than relying on that flip, so nothing
        // observable depends on it.
        sage: {
          DEFAULT: "#84A98C",
          light: "#DAE5DC",
          dark: "#5F8A68",
        },
      },
      fontFamily: {
        fraunces: ['Fraunces', 'Georgia', 'serif'],
        'dm-sans': ['DM Sans', 'sans-serif'],
        'geist-mono': ['Geist Mono', 'ui-monospace', 'monospace'],
        // Semantic aliases used by the marketing landing (match the design reference):
        // display = Fraunces, body = DM Sans, micro = DM Mono, data = Geist Mono.
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['DM Sans', 'sans-serif'],
        micro: ['DM Mono', 'ui-monospace', 'monospace'],
        data: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
