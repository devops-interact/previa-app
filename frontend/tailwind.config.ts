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
                    background: '#0a0a0f',
                    surface: '#111118',
                    'surface-hover': '#1a1a24',
                    'primary-light': '#1e2a3a',
                    border: '#2a2a3a',
                    accent: '#3b82f6',
                    'accent-glow': '#60a5fa',
                    muted: '#6b7280',
                    ink: '#e2e8f0',
                    navy: '#3b82f6',
                    danger: '#ef4444',
                    warning: '#f59e0b',
                    success: '#22c55e',
                },
            },
            fontFamily: {
                sans: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
                mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
            },
        },
    },
    plugins: [],
}

export default config
