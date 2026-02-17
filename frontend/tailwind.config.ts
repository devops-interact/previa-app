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
                    background: '#F3F6FC', // Lighter, cleaner background
                    surface: '#FFFFFF',    // White surface for cards/sidebar as seen in screenshot
                    'primary-light': '#E8EFFC',
                    accent: '#F3F4F6',     // Subtle gray/white for active states
                    muted: '#94A3B8',      // Slate-400 for muted text
                    ink: '#1E293B',        // Slate-800 for main text
                    navy: '#2563EB',       // Brighter blue for logo (as seen in screenshot)
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
