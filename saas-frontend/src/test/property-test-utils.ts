/**
 * 🐉 Property Test Utilities
 * Utilities and generators for property-based testing of the Kali Dragon Landing Page
 */

import { cyberpunkTheme } from '../config/cyberpunk-theme';
import type { ThemeVariant } from '../types/theme';

/**
 * Property test configuration
 */
export const PROPERTY_TEST_CONFIG = {
  iterations: 100,
  timeout: 5000,
} as const;

/**
 * Viewport size generator for responsive testing
 */
export const generateViewportSizes = (): number[] => [
  320,  // Mobile minimum
  375,  // iPhone SE
  414,  // iPhone Pro Max
  768,  // Tablet
  1024, // Desktop
  1440, // Wide desktop
  1920, // Full HD
];

/**
 * Theme variant generator
 */
export const generateThemeVariants = (): ThemeVariant[] => [
  'default',
  'high-contrast',
  'reduced-motion',
];

/**
 * Component selector generator - generates CSS selectors for different page components
 */
export const generateComponentSelectors = (): string[] => [
  // Navigation components
  'nav',
  '[role="navigation"]',
  '.cyberpunk-theme nav',
  
  // Hero section components
  'section:first-of-type',
  '.hero-section',
  'h1',
  '.glitch-text',
  
  // Feature cards
  '.card-cyberpunk',
  '[data-testid="feature-card"]',
  
  // Buttons and interactive elements
  'button',
  'a[href]',
  '.btn-neon-green',
  '.btn-neon-red',
  
  // Footer components
  'footer',
  
  // Text elements
  'p',
  'span',
  'div[class*="text-"]',
  
  // Terminal elements
  '.font-terminal',
  '[class*="terminal"]',
  
  // Neon elements
  '[class*="neon"]',
  '.text-neon-green',
  '.text-neon-red',
  '.text-neon-cyan',
];

/**
 * CSS property generator for theme validation
 */
export const generateCSSProperties = (): string[] => [
  'background-color',
  'color',
  'border-color',
  'font-family',
  'box-shadow',
  'text-shadow',
];

/**
 * Expected cyberpunk colors from the theme
 */
export const CYBERPUNK_COLORS = {
  backgrounds: [
    cyberpunkTheme.colors.background.primary,
    cyberpunkTheme.colors.background.secondary,
    cyberpunkTheme.colors.background.tertiary,
    cyberpunkTheme.colors.background.terminal,
  ],
  texts: [
    cyberpunkTheme.colors.text.primary,
    cyberpunkTheme.colors.text.secondary,
    cyberpunkTheme.colors.text.muted,
    cyberpunkTheme.colors.text.terminal,
    cyberpunkTheme.colors.text.terminalPrompt,
  ],
  neons: [
    cyberpunkTheme.colors.neon.green,
    cyberpunkTheme.colors.neon.greenDim,
    cyberpunkTheme.colors.neon.greenBright,
    cyberpunkTheme.colors.neon.red,
    cyberpunkTheme.colors.neon.redDim,
    cyberpunkTheme.colors.neon.cyan,
    cyberpunkTheme.colors.neon.purple,
  ],
  borders: [
    cyberpunkTheme.colors.border.primary,
    cyberpunkTheme.colors.border.secondary,
    cyberpunkTheme.colors.border.neon,
    cyberpunkTheme.colors.border.terminal,
  ],
} as const;

/**
 * Expected cyberpunk fonts from the theme
 */
export const CYBERPUNK_FONTS = {
  primary: cyberpunkTheme.typography.fonts.primary,
  terminal: cyberpunkTheme.typography.fonts.terminal,
  heading: cyberpunkTheme.typography.fonts.heading,
} as const;

/**
 * Forbidden colors (old blue theme colors that should not appear)
 */
export const FORBIDDEN_COLORS = [
  '#3b82f6', // blue-500
  '#1d4ed8', // blue-700
  '#1e40af', // blue-800
  '#1e3a8a', // blue-900
  '#60a5fa', // blue-400
  '#93c5fd', // blue-300
  '#dbeafe', // blue-100
  'rgb(59, 130, 246)', // blue-500 in rgb
  'rgb(29, 78, 216)',  // blue-700 in rgb
] as const;

/**
 * Utility function to normalize color values for comparison
 */
export const normalizeColor = (color: string): string => {
  // Create a temporary element to get computed color
  const temp = document.createElement('div');
  temp.style.color = color;
  document.body.appendChild(temp);
  const computedColor = window.getComputedStyle(temp).color;
  document.body.removeChild(temp);
  return computedColor;
};

/**
 * Check if a color is in the cyberpunk palette
 */
export const isValidCyberpunkColor = (color: string): boolean => {
  const normalizedColor = normalizeColor(color);
  
  // Check if it's transparent or inherit
  if (color === 'transparent' || color === 'inherit' || color === 'initial' || color === 'unset') {
    return true;
  }
  
  // Check against all valid cyberpunk colors
  const allValidColors = [
    ...CYBERPUNK_COLORS.backgrounds,
    ...CYBERPUNK_COLORS.texts,
    ...CYBERPUNK_COLORS.neons,
    ...CYBERPUNK_COLORS.borders,
  ];
  
  return allValidColors.some(validColor => {
    const normalizedValidColor = normalizeColor(validColor);
    return normalizedColor === normalizedValidColor;
  });
};

/**
 * Check if a color is forbidden (old blue theme)
 */
export const isForbiddenColor = (color: string): boolean => {
  const normalizedColor = normalizeColor(color);
  
  return FORBIDDEN_COLORS.some(forbiddenColor => {
    const normalizedForbiddenColor = normalizeColor(forbiddenColor);
    return normalizedColor === normalizedForbiddenColor;
  });
};

/**
 * Check if a font family is valid for cyberpunk theme
 */
export const isValidCyberpunkFont = (fontFamily: string): boolean => {
  const normalizedFont = fontFamily.toLowerCase().replace(/['"]/g, '');
  
  // Check against cyberpunk fonts
  const validFonts = Object.values(CYBERPUNK_FONTS).map(font => 
    font.toLowerCase().replace(/['"]/g, '')
  );
  
  return validFonts.some(validFont => normalizedFont.includes(validFont.split(',')[0].trim()));
};

/**
 * Generate random combinations for property testing
 */
export const generateRandomCombination = () => {
  const viewportSizes = generateViewportSizes();
  const themeVariants = generateThemeVariants();
  const componentSelectors = generateComponentSelectors();
  
  return {
    viewportWidth: viewportSizes[Math.floor(Math.random() * viewportSizes.length)],
    themeVariant: themeVariants[Math.floor(Math.random() * themeVariants.length)],
    componentSelector: componentSelectors[Math.floor(Math.random() * componentSelectors.length)],
  };
};

/**
 * Dragon graphics elements that should be present
 */
export const DRAGON_ELEMENTS = [
  '.dragon-silhouette',
  '.dragon-bg',
  '[class*="dragon"]',
] as const;

/**
 * Terminal elements that should have consistent styling
 */
export const TERMINAL_ELEMENTS = [
  '.font-terminal',
  '[class*="terminal"]',
  '.text-neon-red', // Terminal prompts
  '.text-neon-green', // Terminal text
] as const;

/**
 * Interactive elements that should have hover effects
 */
export const INTERACTIVE_ELEMENTS = [
  'button',
  'a[href]',
  '[role="button"]',
  '.cyberpunk-button',
  '.btn-neon-green',
  '.btn-neon-red',
] as const;