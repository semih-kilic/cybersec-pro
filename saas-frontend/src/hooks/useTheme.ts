/**
 * 🐉 useTheme Hook
 * React hook for managing cyberpunk theme state and preferences
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { 
  ThemeVariant, 
  UseThemeReturn, 
  CSSCustomProperty 
} from '../types/theme';
import { 
  cyberpunkTheme, 
  cssVariableMap, 
  applyThemeToElement, 
  removeThemeFromElement,
  themeVariants 
} from '../config/cyberpunk-theme';

/**
 * Custom hook for managing cyberpunk theme
 */
export const useTheme = (): UseThemeReturn => {
  // Theme variant state
  const [variant, setVariant] = useState<ThemeVariant>('default');
  
  // User preference states
  const [isDarkMode] = useState(true); // Always true for cyberpunk theme
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  /**
   * Detect user preferences from media queries
   */
  useEffect(() => {
    // Check for high contrast preference
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(highContrastQuery.matches);
    
    const handleHighContrastChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
      if (e.matches && variant !== 'high-contrast') {
        setVariant('high-contrast');
      }
    };
    
    highContrastQuery.addEventListener('change', handleHighContrastChange);

    // Check for reduced motion preference
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(reducedMotionQuery.matches);
    
    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
      if (e.matches && variant !== 'reduced-motion') {
        setVariant('reduced-motion');
      }
    };
    
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);

    // Cleanup
    return () => {
      highContrastQuery.removeEventListener('change', handleHighContrastChange);
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
    };
  }, [variant]);

  /**
   * Apply theme variant based on user preferences
   */
  useEffect(() => {
    if (isHighContrast && variant !== 'high-contrast') {
      setVariant('high-contrast');
    } else if (prefersReducedMotion && variant !== 'reduced-motion') {
      setVariant('reduced-motion');
    }
  }, [isHighContrast, prefersReducedMotion, variant]);

  /**
   * Get merged theme with variant overrides
   */
  const theme = useMemo(() => {
    const variantOverrides = themeVariants[variant];
    return { ...cyberpunkTheme, ...variantOverrides };
  }, [variant]);

  /**
   * Generate CSS variables object
   */
  const cssVariables = useMemo(() => {
    const variables: Record<CSSCustomProperty, string> = {} as Record<CSSCustomProperty, string>;
    
    // Apply base CSS variables
    Object.entries(cssVariableMap).forEach(([property, value]) => {
      variables[property as CSSCustomProperty] = value;
    });

    // Apply variant-specific overrides
    if (variant === 'high-contrast') {
      variables['--color-text-primary'] = '#ffffff';
      variables['--color-text-secondary'] = '#ffffff';
      variables['--color-bg-primary'] = '#000000';
      variables['--color-bg-secondary'] = '#000000';
      variables['--color-neon-green'] = '#00ff00';
      variables['--color-neon-red'] = '#ff0000';
    }

    if (variant === 'reduced-motion') {
      variables['--duration-fast'] = '0s';
      variables['--duration-normal'] = '0s';
      variables['--duration-slow'] = '0s';
      variables['--duration-glitch'] = '0s';
      variables['--duration-matrix'] = '0s';
      variables['--neon-pulse-duration'] = '0s';
      variables['--terminal-cursor-blink'] = '0s';
    }

    return variables;
  }, [variant]);

  /**
   * Apply theme to a specific element
   */
  const applyTheme = useCallback((element: HTMLElement) => {
    applyThemeToElement(element, variant);
  }, [variant]);

  /**
   * Remove theme from a specific element
   */
  const removeTheme = useCallback((element: HTMLElement) => {
    removeThemeFromElement(element);
  }, []);

  /**
   * Set theme variant with validation
   */
  const setThemeVariant = useCallback((newVariant: ThemeVariant) => {
    if (['default', 'high-contrast', 'reduced-motion'].includes(newVariant)) {
      setVariant(newVariant);
      
      // Store preference in localStorage
      try {
        localStorage.setItem('cyberpunk-theme-variant', newVariant);
      } catch (error) {
        console.warn('Failed to save theme preference:', error);
      }
    }
  }, []);

  /**
   * Load saved theme preference on mount
   */
  useEffect(() => {
    try {
      const savedVariant = localStorage.getItem('cyberpunk-theme-variant') as ThemeVariant;
      if (savedVariant && ['default', 'high-contrast', 'reduced-motion'].includes(savedVariant)) {
        setVariant(savedVariant);
      }
    } catch (error) {
      console.warn('Failed to load theme preference:', error);
    }
  }, []);

  /**
   * Apply theme to document root on variant change
   */
  useEffect(() => {
    const root = document.documentElement;
    applyTheme(root);
    
    return () => {
      // Cleanup is handled by the next effect or component unmount
    };
  }, [applyTheme]);

  return {
    theme,
    variant,
    setVariant: setThemeVariant,
    isDarkMode,
    isHighContrast,
    prefersReducedMotion,
    cssVariables,
    applyTheme,
    removeTheme,
  };
};

/**
 * Hook for getting responsive breakpoint information
 */
export const useResponsive = () => {
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop' | 'wide' | 'ultra'>('desktop');
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setWindowWidth(width);

      if (width < cyberpunkTheme.breakpoints.tablet) {
        setScreenSize('mobile');
      } else if (width < cyberpunkTheme.breakpoints.desktop) {
        setScreenSize('tablet');
      } else if (width < cyberpunkTheme.breakpoints.wide) {
        setScreenSize('desktop');
      } else if (width < cyberpunkTheme.breakpoints.ultra) {
        setScreenSize('wide');
      } else {
        setScreenSize('ultra');
      }
    };

    // Set initial size
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    screenSize,
    windowWidth,
    isMobile: screenSize === 'mobile',
    isTablet: screenSize === 'tablet',
    isDesktop: screenSize === 'desktop',
    isWide: screenSize === 'wide',
    isUltra: screenSize === 'ultra',
    isMobileOrTablet: screenSize === 'mobile' || screenSize === 'tablet',
    isDesktopOrWider: ['desktop', 'wide', 'ultra'].includes(screenSize),
  };
};

/**
 * Hook for managing animation preferences
 */
export const useAnimationPreferences = () => {
  const { prefersReducedMotion, variant } = useTheme();
  
  const shouldAnimate = useMemo(() => {
    return !prefersReducedMotion && variant !== 'reduced-motion';
  }, [prefersReducedMotion, variant]);

  const getAnimationDuration = useCallback((duration: 'fast' | 'normal' | 'slow') => {
    if (!shouldAnimate) return 0;
    
    switch (duration) {
      case 'fast': return 150;
      case 'normal': return 300;
      case 'slow': return 600;
      default: return 300;
    }
  }, [shouldAnimate]);

  return {
    shouldAnimate,
    prefersReducedMotion,
    getAnimationDuration,
  };
};

export default useTheme;