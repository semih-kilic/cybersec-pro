/**
 * 🐉 Cyberpunk Theme Configuration
 * Complete theme configuration object implementing the CyberpunkTheme interface
 */

import type { 
  CyberpunkTheme, 
  AnimationConfig, 
  ResponsiveConfig,
  ThemeVariant 
} from '../types/theme';

/**
 * Default cyberpunk theme configuration
 */
export const cyberpunkTheme: CyberpunkTheme = {
  colors: {
    background: {
      primary: '#0a0a0a',
      secondary: '#1a1a1a',
      tertiary: '#2a2a2a',
      terminal: '#000000',
      overlay: 'rgba(0, 0, 0, 0.8)',
    },
    text: {
      primary: '#ffffff',
      secondary: '#a0a0a0',
      muted: '#666666',
      terminal: '#00ff00',
      terminalPrompt: '#ff0040',
    },
    neon: {
      green: '#00ff00',
      greenDim: '#00cc00',
      greenBright: '#00ff41',
      red: '#ff0040',
      redDim: '#cc0033',
      cyan: '#00ffff',
      purple: '#ff00ff',
    },
    border: {
      primary: '#333333',
      secondary: '#555555',
      neon: '#00ff00',
      terminal: '#00ff00',
    },
  },
  typography: {
    fonts: {
      primary: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      terminal: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
      heading: "'Orbitron', 'Inter', sans-serif",
    },
    sizes: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
      '5xl': '3rem',    // 48px
      '6xl': '3.75rem', // 60px
    },
    weights: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },
  spacing: {
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
    20: '5rem',     // 80px
    24: '6rem',     // 96px
  },
  animations: {
    durations: {
      fast: '0.15s',
      normal: '0.3s',
      slow: '0.6s',
      glitch: '0.1s',
      matrix: '20s',
    },
    timingFunctions: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeBounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
    effects: {
      glitchIntensity: '2px',
      matrixSpeed: '20s',
      neonPulseDuration: '2s',
      terminalCursorBlink: '1s',
    },
  },
  breakpoints: {
    mobile: 320,
    tablet: 768,
    desktop: 1024,
    wide: 1440,
    ultra: 1920,
  },
  dragonGraphics: {
    mobile: 'simplified',
    tablet: 'medium',
    desktop: 'full',
    opacity: 0.1,
  },
  effects: {
    shadows: {
      neonGreen: '0 0 10px #00ff00',
      neonGreenIntense: '0 0 20px #00ff00, 0 0 40px #00ff00',
      neonRed: '0 0 10px #ff0040',
      neonRedIntense: '0 0 20px #ff0040, 0 0 40px #ff0040',
      terminal: '0 0 15px rgba(0, 255, 0, 0.3)',
    },
    glows: {
      intensity: 1,
      blur: 10,
    },
  },
  zIndex: {
    background: -1,
    base: 0,
    content: 10,
    navigation: 100,
    overlay: 1000,
    modal: 10000,
  },
  borderRadius: {
    sm: '0.125rem',   // 2px
    base: '0.25rem',  // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    full: '9999px',   // Full rounded
  },
};

/**
 * Animation configuration for cyberpunk effects
 */
export const animationConfig: AnimationConfig = {
  glitchEffect: {
    duration: 100, // milliseconds
    intensity: 'medium',
    triggerOn: 'hover',
  },
  matrixBackground: {
    speed: 50, // pixels per second
    density: 0.8, // character density
    characters: [
      '0', '1', 'ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ',
      'サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ツ', 'テ', 'ト', 'ナ', 'ニ',
      'ヌ', 'ネ', 'ノ', 'ハ', 'ヒ', 'フ', 'ヘ', 'ホ', 'マ', 'ミ', 'ム', 'メ',
      'モ', 'ヤ', 'ユ', 'ヨ', 'ラ', 'リ', 'ル', 'レ', 'ロ', 'ワ', 'ヲ', 'ン',
    ],
  },
  neonGlow: {
    intensity: 1.5,
    color: '#00ff00',
    blur: 15,
  },
};

/**
 * Responsive configuration for different screen sizes
 */
export const responsiveConfig: ResponsiveConfig = {
  breakpoints: cyberpunkTheme.breakpoints,
  dragonGraphics: cyberpunkTheme.dragonGraphics,
  spacing: {
    mobile: {
      16: '2rem',   // Reduced from 4rem
      20: '3rem',   // Reduced from 5rem
      24: '4rem',   // Reduced from 6rem
    },
    tablet: {
      16: '3rem',   // Slightly reduced
      20: '4rem',
      24: '5rem',
    },
    desktop: {
      // Use default spacing
    },
  },
};

/**
 * Theme variants for different user preferences
 */
export const themeVariants: Record<ThemeVariant, Partial<CyberpunkTheme>> = {
  default: {},
  'high-contrast': {
    colors: {
      ...cyberpunkTheme.colors,
      text: {
        ...cyberpunkTheme.colors.text,
        primary: '#ffffff',
        secondary: '#ffffff',
      },
      background: {
        ...cyberpunkTheme.colors.background,
        primary: '#000000',
        secondary: '#000000',
      },
      neon: {
        ...cyberpunkTheme.colors.neon,
        green: '#00ff00',
        red: '#ff0000',
      },
    },
  },
  'reduced-motion': {
    animations: {
      ...cyberpunkTheme.animations,
      durations: {
        fast: '0s',
        normal: '0s',
        slow: '0s',
        glitch: '0s',
        matrix: '0s',
      },
      effects: {
        ...cyberpunkTheme.animations.effects,
        neonPulseDuration: '0s',
        terminalCursorBlink: '0s',
      },
    },
  },
};

/**
 * CSS custom property mappings
 */
export const cssVariableMap = {
  // Background colors
  '--color-bg-primary': cyberpunkTheme.colors.background.primary,
  '--color-bg-secondary': cyberpunkTheme.colors.background.secondary,
  '--color-bg-tertiary': cyberpunkTheme.colors.background.tertiary,
  '--color-bg-terminal': cyberpunkTheme.colors.background.terminal,
  '--color-bg-overlay': cyberpunkTheme.colors.background.overlay,

  // Text colors
  '--color-text-primary': cyberpunkTheme.colors.text.primary,
  '--color-text-secondary': cyberpunkTheme.colors.text.secondary,
  '--color-text-muted': cyberpunkTheme.colors.text.muted,
  '--color-text-terminal': cyberpunkTheme.colors.text.terminal,
  '--color-text-terminal-prompt': cyberpunkTheme.colors.text.terminalPrompt,

  // Neon colors
  '--color-neon-green': cyberpunkTheme.colors.neon.green,
  '--color-neon-green-dim': cyberpunkTheme.colors.neon.greenDim,
  '--color-neon-green-bright': cyberpunkTheme.colors.neon.greenBright,
  '--color-neon-red': cyberpunkTheme.colors.neon.red,
  '--color-neon-red-dim': cyberpunkTheme.colors.neon.redDim,
  '--color-neon-cyan': cyberpunkTheme.colors.neon.cyan,
  '--color-neon-purple': cyberpunkTheme.colors.neon.purple,

  // Border colors
  '--color-border-primary': cyberpunkTheme.colors.border.primary,
  '--color-border-secondary': cyberpunkTheme.colors.border.secondary,
  '--color-border-neon': cyberpunkTheme.colors.border.neon,
  '--color-border-terminal': cyberpunkTheme.colors.border.terminal,

  // Typography
  '--font-primary': cyberpunkTheme.typography.fonts.primary,
  '--font-terminal': cyberpunkTheme.typography.fonts.terminal,
  '--font-heading': cyberpunkTheme.typography.fonts.heading,

  // Spacing
  '--space-1': cyberpunkTheme.spacing[1],
  '--space-2': cyberpunkTheme.spacing[2],
  '--space-3': cyberpunkTheme.spacing[3],
  '--space-4': cyberpunkTheme.spacing[4],
  '--space-5': cyberpunkTheme.spacing[5],
  '--space-6': cyberpunkTheme.spacing[6],
  '--space-8': cyberpunkTheme.spacing[8],
  '--space-10': cyberpunkTheme.spacing[10],
  '--space-12': cyberpunkTheme.spacing[12],
  '--space-16': cyberpunkTheme.spacing[16],
  '--space-20': cyberpunkTheme.spacing[20],
  '--space-24': cyberpunkTheme.spacing[24],

  // Animation durations
  '--duration-fast': cyberpunkTheme.animations.durations.fast,
  '--duration-normal': cyberpunkTheme.animations.durations.normal,
  '--duration-slow': cyberpunkTheme.animations.durations.slow,
  '--duration-glitch': cyberpunkTheme.animations.durations.glitch,
  '--duration-matrix': cyberpunkTheme.animations.durations.matrix,

  // Effects
  '--shadow-neon-green': cyberpunkTheme.effects.shadows.neonGreen,
  '--shadow-neon-green-intense': cyberpunkTheme.effects.shadows.neonGreenIntense,
  '--shadow-neon-red': cyberpunkTheme.effects.shadows.neonRed,
  '--shadow-neon-red-intense': cyberpunkTheme.effects.shadows.neonRedIntense,
  '--shadow-terminal': cyberpunkTheme.effects.shadows.terminal,

  // Dragon graphics
  '--dragon-opacity': cyberpunkTheme.dragonGraphics.opacity.toString(),

  // Animation effects
  '--glitch-intensity': cyberpunkTheme.animations.effects.glitchIntensity,
  '--matrix-speed': cyberpunkTheme.animations.effects.matrixSpeed,
  '--neon-pulse-duration': cyberpunkTheme.animations.effects.neonPulseDuration,
  '--terminal-cursor-blink': cyberpunkTheme.animations.effects.terminalCursorBlink,
} as const;

/**
 * Utility function to apply theme to an element
 */
export const applyThemeToElement = (element: HTMLElement, variant: ThemeVariant = 'default'): void => {
  // Apply CSS custom properties
  Object.entries(cssVariableMap).forEach(([property, value]) => {
    element.style.setProperty(property, value);
  });

  // Add theme class
  element.classList.add('cyberpunk-theme');
  
  // Add variant-specific classes
  if (variant !== 'default') {
    element.classList.add(`cyberpunk-theme--${variant}`);
  }
};

/**
 * Utility function to remove theme from an element
 */
export const removeThemeFromElement = (element: HTMLElement): void => {
  // Remove CSS custom properties
  Object.keys(cssVariableMap).forEach((property) => {
    element.style.removeProperty(property);
  });

  // Remove theme classes
  element.classList.remove('cyberpunk-theme');
  element.classList.remove('cyberpunk-theme--high-contrast');
  element.classList.remove('cyberpunk-theme--reduced-motion');
};

/**
 * Get responsive breakpoint media queries
 */
export const getMediaQueries = () => ({
  mobile: `(max-width: ${cyberpunkTheme.breakpoints.tablet - 1}px)`,
  tablet: `(min-width: ${cyberpunkTheme.breakpoints.tablet}px) and (max-width: ${cyberpunkTheme.breakpoints.desktop - 1}px)`,
  desktop: `(min-width: ${cyberpunkTheme.breakpoints.desktop}px) and (max-width: ${cyberpunkTheme.breakpoints.wide - 1}px)`,
  wide: `(min-width: ${cyberpunkTheme.breakpoints.wide}px) and (max-width: ${cyberpunkTheme.breakpoints.ultra - 1}px)`,
  ultra: `(min-width: ${cyberpunkTheme.breakpoints.ultra}px)`,
  
  // Utility queries
  mobileAndUp: `(min-width: ${cyberpunkTheme.breakpoints.mobile}px)`,
  tabletAndUp: `(min-width: ${cyberpunkTheme.breakpoints.tablet}px)`,
  desktopAndUp: `(min-width: ${cyberpunkTheme.breakpoints.desktop}px)`,
  wideAndUp: `(min-width: ${cyberpunkTheme.breakpoints.wide}px)`,
});

export default cyberpunkTheme;