import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

// Los colores de marca viven en el tema; los componentes usan sus tokens.
export const lazoTheme = defineTheme({
  name: 'lazo-orbita-laboratorio',
  extends: neutralTheme,
  typography: {
    body: { family: 'Manrope Variable', fallbacks: 'Manrope, system-ui, sans-serif' },
    heading: { family: 'Manrope Variable', fallbacks: 'Manrope, system-ui, sans-serif' },
  },
  tokens: {
    '--color-accent': ['#345CFF', '#6A8DFF'],
    '--color-text-primary': ['#101828', '#F5F7FB'],
    '--color-text-secondary': ['#52617B', '#A9B6D0'],
    '--color-background-surface': ['#FFFFFF', '#121D33'],
    '--color-background-muted': ['#F5F7FB', '#0D1628'],
    '--color-border': ['#DFE5F0', '#293951'],
    '--color-border-emphasized': ['#ADBBD7', '#50668E'],
  },
  localTokens: {
    '--lazo-blue': '#345CFF',
    '--lazo-sky': '#6A8DFF',
    '--lazo-mint': ['#087F76', '#35D6C1'],
    '--lazo-white': '#FFFFFF',
    '--lazo-canvas': ['#EDF2FB', '#09101E'],
    '--lazo-node': ['#FFFFFF', '#17243D'],
    '--lazo-glow': ['rgba(52,92,255,.09)', 'rgba(52,92,255,.16)'],
    '--lazo-highlight': ['#EAF0FF', '#1B3058'],
    '--lazo-shadow': ['0 0.75rem 1.75rem rgba(28,52,101,.12), inset 0 .0625rem 0 rgba(255,255,255,.9)', '0 1rem 2rem rgba(0,0,0,.28), inset 0 .0625rem 0 rgba(255,255,255,.09)'],
    '--lazo-selection-shadow': ['0 0 0 .1875rem rgba(52,92,255,.12), 0 1rem 2rem rgba(28,52,101,.16)', '0 0 0 .1875rem rgba(106,141,255,.15), 0 1rem 2rem rgba(0,0,0,.35)'],
    '--lazo-stroke': '.0625rem',
    '--lazo-dot': ['#BCC9E0', '#283A58'],
    '--lazo-palette-width': '15.5rem',
    '--lazo-inspector-width': '20rem',
    '--lazo-node-width': '15rem',
    '--lazo-radius': '1rem',
  },
});
