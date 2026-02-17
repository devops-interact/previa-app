# PREV.IA — Design tokens

## Typography

**Font family:** All UI uses **JetBrains Mono** (headings, body, inputs, tables, Chat).

- [Google Fonts](https://fonts.google.com/specimen/JetBrains+Mono)
- Next.js: `import { JetBrains_Mono } from 'next/font/google'` then pass `className={jetbrainsMono.className}` to `<body>` or use CSS variable in Tailwind.

**Tailwind:** Set as default font in `tailwind.config.ts`:

```js
theme: {
  extend: {
    fontFamily: {
      sans: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
    },
  },
}
```

In root layout (Next.js App Router): `const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });` then `<body className={jetbrainsMono.variable}>` and in globals.css `body { font-family: var(--font-jetbrains-mono), monospace; }`.

---

## Color palette

| Token         | Hex       | Usage                          |
|---------------|-----------|--------------------------------|
| Background    | `#E6EDF9` | Page background                |
| Surface       | `#D7E6F6` | Cards, panels                  |
| Primary light | `#BCD8F9` | Light fills, hover, borders    |
| Accent        | `#ACD0FF` | Links, primary buttons, CTAs   |
| Muted         | `#AABACA` | Secondary text, borders, tags  |
| Ink           | `#261F1A` | Body text, headings           |
| Navy          | `#191B56` | Navbar, footer, brand          |

## Tailwind

Merge `tailwind-previa-colors.js` into your theme:

```js
// frontend/tailwind.config.ts
import previaColors from '../design/tailwind-previa-colors.js';

export default {
  theme: {
    extend: {
      colors: { ...previaColors },
    },
  },
};
```

Or copy the `previa` object into `theme.extend.colors`. Then use: `bg-previa-background`, `text-previa-ink`, `bg-previa-navy`, etc.
