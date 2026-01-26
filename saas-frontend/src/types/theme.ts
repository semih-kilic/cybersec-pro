/**
 * 🐉 Cyberpunk Theme TypeScript Interfaces
 * Type definitions for the Kali Dragon Landing Page theme system
 */

/**
 * Core color palette for the cyberpunk theme
 */
export interface CyberpunkColors {
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    terminal: string;
    overlay: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    terminal: string;
    terminalPrompt: string;
  };
  neon: {
    green: string;
    greenDim: string;
    greenBright: string;
    red: string;
    redDim: string;
    cyan: string;
    purple: string;
  };
  border: {
    primary: string;
    secondary: string;
    neon: string;
    terminal: string;
  };
}

/**
 * Typography configuration for the cyberpunk theme
 */
export interface CyberpunkTypography {
  fonts: {
    primary: string;
    terminal: string;
    heading: string;
  };
  sizes: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
    '5xl': string;
    '6xl': string;
  };
  weights: {
    light: number;
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
    extrabold: number;
  };
}

/**
 * Spacing system for consistent layout
 */
export interface CyberpunkSpacing {
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
  6: string;
  8: string;
  10: string;
  12: string;
  16: string;
  20: string;
  24: string;
}

/**
 * Animation configuration for cyberpunk effects
 */
export interface CyberpunkAnimations {
  durations: {
    fast: string;
    normal: string;
    slow: string;
    glitch: string;
    matrix: string;
  };
  timingFunctions: {
    easeInOut: string;
    easeOut: string;
    easeIn: string;
    easeBounce: string;
  };
  effects: {
    glitchIntensity: string;
    matrixSpeed: string;
    neonPulseDuration: string;
    terminalCursorBlink: string;
  };
}

/**
 * Responsive breakpoint configuration
 */
export interface ResponsiveBreakpoints {
  mobile: number;
  tablet: number;
  desktop: number;
  wide: number;
  ultra: number;
}

/**
 * Dragon graphics configuration for different screen sizes
 */
export interface DragonGraphicsConfig {
  mobile: 'simplified' | 'hidden';
  tablet: 'medium';
  desktop: 'full';
  opacity: number;
}

/**
 * Shadow and glow effects configuration
 */
export interface CyberpunkEffects {
  shadows: {
    neonGreen: string;
    neonGreenIntense: string;
    neonRed: string;
    neonRedIntense: string;
    terminal: string;
  };
  glows: {
    intensity: number;
    blur: number;
  };
}

/**
 * Complete cyberpunk theme configuration
 */
export interface CyberpunkTheme {
  colors: CyberpunkColors;
  typography: CyberpunkTypography;
  spacing: CyberpunkSpacing;
  animations: CyberpunkAnimations;
  breakpoints: ResponsiveBreakpoints;
  dragonGraphics: DragonGraphicsConfig;
  effects: CyberpunkEffects;
  zIndex: {
    background: number;
    base: number;
    content: number;
    navigation: number;
    overlay: number;
    modal: number;
  };
  borderRadius: {
    sm: string;
    base: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    full: string;
  };
}

/**
 * Theme variant types
 */
export type ThemeVariant = 'default' | 'high-contrast' | 'reduced-motion';

/**
 * Component theme props interface
 */
export interface ThemeProps {
  variant?: ThemeVariant;
  className?: string;
}

/**
 * Animation configuration interface
 */
export interface AnimationConfig {
  glitchEffect: {
    duration: number;
    intensity: 'low' | 'medium' | 'high';
    triggerOn: 'hover' | 'load' | 'scroll';
  };
  matrixBackground: {
    speed: number;
    density: number;
    characters: string[];
  };
  neonGlow: {
    intensity: number;
    color: string;
    blur: number;
  };
}

/**
 * Responsive configuration interface
 */
export interface ResponsiveConfig {
  breakpoints: ResponsiveBreakpoints;
  dragonGraphics: DragonGraphicsConfig;
  spacing: {
    mobile: Partial<CyberpunkSpacing>;
    tablet: Partial<CyberpunkSpacing>;
    desktop: Partial<CyberpunkSpacing>;
  };
}

/**
 * Feature card theme interface
 */
export interface FeatureCardTheme {
  background: string;
  border: string;
  hoverBorder: string;
  textColor: string;
  iconColor: string;
  glowColor: 'green' | 'red' | 'cyan';
  terminalPrompt?: string;
}

/**
 * Navigation theme interface
 */
export interface NavigationTheme {
  background: string;
  border: string;
  textColor: string;
  hoverColor: string;
  logoColor: string;
  variant: 'default' | 'transparent';
}

/**
 * Button theme interface
 */
export interface ButtonTheme {
  variant: 'primary' | 'secondary' | 'terminal' | 'neon';
  size: 'sm' | 'md' | 'lg' | 'xl';
  glowEffect: boolean;
  terminalStyle: boolean;
}

/**
 * Utility type for CSS custom property names
 */
export type CSSCustomProperty = 
  | `--color-${string}`
  | `--font-${string}`
  | `--text-${string}`
  | `--space-${string}`
  | `--duration-${string}`
  | `--shadow-${string}`
  | `--radius-${string}`
  | `--z-${string}`
  | `--neon-pulse-duration`
  | `--terminal-cursor-blink`
  | `--glitch-intensity`
  | `--matrix-speed`
  | `--dragon-opacity`;

/**
 * Theme context interface for React context
 */
export interface ThemeContextValue {
  theme: CyberpunkTheme;
  variant: ThemeVariant;
  setVariant: (variant: ThemeVariant) => void;
  isDarkMode: boolean;
  isHighContrast: boolean;
  prefersReducedMotion: boolean;
}

/**
 * Theme hook return type
 */
export interface UseThemeReturn extends ThemeContextValue {
  cssVariables: Record<CSSCustomProperty, string>;
  applyTheme: (element: HTMLElement) => void;
  removeTheme: (element: HTMLElement) => void;
}