import type { Config } from "tailwindcss"

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                previa: {
                    background: '#fafafa',
                    surface: '#f4f4f5',
                    'surface-hover': '#e4e4e7',
                    'primary-light': '#fafafa',
                    border: '#d4d4d8',
                    accent: '#52525b',
                    'accent-glow': '#71717a',
                    muted: '#71717a',
                    ink: '#18181b',
                    navy: '#52525b',
                    danger: '#ef4444',
                    warning: '#f59e0b',
                    success: '#52525b',
                },
            },
            fontFamily: {
                sans: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
                mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
            },
            spacing: {
                'gutter': 'var(--gutter, 1rem)',
                'section': 'var(--section-gap, 1.5rem)',
            },
            maxWidth: {
                'app': 'min(100%, 90rem)',
                'content': 'min(100%, 75rem)',
            },
            screens: {
                'xs': '375px',
            },
            borderRadius: {
                'none': '0',
                'sm': '2px',
                DEFAULT: '2px',
                'md': '2px',
                'lg': '2px',
                'xl': '2px',
                '2xl': '2px',
                '3xl': '2px',
                'full': '9999px',
            },
        },
    },
    plugins: [],
}

export default config
