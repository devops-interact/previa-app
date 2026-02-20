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
                    background: '#050505',
                    surface: '#0f0f0f',
                    'surface-hover': '#171717',
                    'primary-light': '#1a1a1a',
                    border: '#27272a',
                    accent: '#71717a',
                    'accent-glow': '#a1a1aa',
                    muted: '#52525b',
                    ink: '#e4e4e7',
                    navy: '#71717a',
                    danger: '#ef4444',
                    warning: '#f59e0b',
                    success: '#71717a',
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
