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
                    background: '#000000',
                    surface: '#1D1D1D',
                    'surface-hover': '#252525',
                    'primary-light': '#2A293F',
                    border: '#2A293F',
                    accent: '#06D6A0',
                    'accent-glow': '#33E4B8',
                    muted: '#6b7280',
                    ink: '#DDDDDD',
                    navy: '#06D6A0',
                    danger: '#ef4444',
                    warning: '#f59e0b',
                    success: '#06D6A0',
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
        },
    },
    plugins: [],
}

export default config
