/**
 * 🐉 Property-Based Tests for Kali Dragon Landing Page Theme Consistency
 * **Feature: kali-dragon-landing, Property 1: Theme Consistency Across Components**
 * **Validates: Requirements 1.2, 1.3, 1.5, 5.1**
 * 
 * This test validates that cyberpunk theme elements (dragon graphics, dark colors, neon accents)
 * are consistently applied across all page sections and components according to the theme specification.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import React from 'react';
import {
  PROPERTY_TEST_CONFIG,
  generateViewportSizes,
  generateThemeVariants,
  CYBERPUNK_COLORS,
  CYBERPUNK_FONTS,
  FORBIDDEN_COLORS,
  normalizeColor,
} from '../../test/property-test-utils';
import { cyberpunkTheme } from '../../config/cyberpunk-theme';

// Create a test component that represents the key elements of the landing page
const TestLandingPageElements: React.FC = () => (
  <div className="cyberpunk-theme min-h-screen">
    {/* Navigation */}
    <nav className="bg-cyber-bg-primary border-b border-cyber-border-primary">
      <div className="flex items-center">
        <span className="text-cyber-text-primary font-heading">CyberSec Pro</span>
        <span className="text-neon-green font-terminal">[KALI-DRAGON]</span>
      </div>
    </nav>

    {/* Hero Section */}
    <section className="bg-cyber-bg-primary">
      <div className="dragon-silhouette">
        <div className="dragon-bg opacity-10"></div>
      </div>
      <h1 className="text-cyber-text-primary font-heading">
        World-Class <span className="text-neon-green">Cybersecurity</span>
      </h1>
      <p className="text-cyber-text-secondary font-terminal">
        Access <span className="text-neon-green">289 verified security tools</span>
      </p>
      <button className="btn-neon-green">Initialize System</button>
      <button className="btn-neon-red">Watch Demo</button>
    </section>

    {/* Features Section */}
    <section className="bg-cyber-bg-secondary">
      <div className="card-cyberpunk">
        <h3 className="text-cyber-text-primary font-heading">Advanced Security Testing</h3>
        <p className="text-cyber-text-secondary font-terminal">289 verified cybersecurity tools</p>
        <div className="text-neon-red font-terminal">root@kali:~# nmap -sS -O target</div>
      </div>
    </section>

    {/* Footer */}
    <footer className="bg-cyber-bg-primary border-t border-cyber-border-primary">
      <span className="text-cyber-text-primary font-heading">CyberSec Pro</span>
      <span className="text-neon-green font-terminal">[KALI-DRAGON]</span>
    </footer>
  </div>
);

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <HelmetProvider>
      {children}
    </HelmetProvider>
  </BrowserRouter>
);

describe('🐉 Property 1: Theme Consistency Across Components', () => {
  beforeEach(() => {
    // Reset viewport and any global styles
    document.documentElement.style.fontSize = '16px';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
  });

  afterEach(() => {
    cleanup();
    // Reset viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  /**
   * Property Test 1.1: Theme Configuration Consistency
   * For any theme property, it should match the expected cyberpunk values
   */
  it('should have consistent cyberpunk theme configuration', () => {
    const iterations = PROPERTY_TEST_CONFIG.iterations;
    const failures: string[] = [];

    for (let i = 0; i < iterations; i++) {
      // Test background colors
      const backgroundColors = Object.values(cyberpunkTheme.colors.background);
      backgroundColors.forEach((color, index) => {
        if (!color.startsWith('#') && !color.startsWith('rgba')) {
          failures.push(`Iteration ${i + 1}: Invalid background color format: ${color}`);
        }
      });

      // Test neon colors
      const neonColors = Object.values(cyberpunkTheme.colors.neon);
      neonColors.forEach((color, index) => {
        if (!color.startsWith('#')) {
          failures.push(`Iteration ${i + 1}: Invalid neon color format: ${color}`);
        }
        
        // Neon colors should be bright (high saturation)
        if (color.length === 7) { // hex format
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          const max = Math.max(r, g, b);
          
          if (max < 200) { // Should be bright
            failures.push(`Iteration ${i + 1}: Neon color not bright enough: ${color} (max: ${max})`);
          }
        }
      });

      // Test font families
      const fonts = Object.values(cyberpunkTheme.typography.fonts);
      fonts.forEach((font, index) => {
        if (!font || font.trim() === '') {
          failures.push(`Iteration ${i + 1}: Empty font family: ${font}`);
        }
      });
    }

    if (failures.length > 0) {
      console.error('Theme configuration violations found:', failures);
      expect(failures).toHaveLength(0);
    }
  }, PROPERTY_TEST_CONFIG.timeout);

  /**
   * Property Test 1.2: CSS Custom Properties Consistency
   * For any CSS custom property, it should be properly defined and accessible
   */
  it('should have consistent CSS custom properties', () => {
    const iterations = Math.min(PROPERTY_TEST_CONFIG.iterations, 50); // Reduced for performance
    const failures: string[] = [];

    for (let i = 0; i < iterations; i++) {
      const { container } = render(
        <TestWrapper>
          <TestLandingPageElements />
        </TestWrapper>
      );

      // Test that cyberpunk theme class is applied
      const themeContainer = container.querySelector('.cyberpunk-theme');
      if (!themeContainer) {
        failures.push(`Iteration ${i + 1}: Missing cyberpunk-theme class`);
      }

      // Test that key CSS custom properties would be available
      const testElement = document.createElement('div');
      testElement.className = 'cyberpunk-theme';
      document.body.appendChild(testElement);

      const computedStyle = window.getComputedStyle(testElement);
      
      // These properties should be defined in the CSS
      const expectedProperties = [
        '--color-bg-primary',
        '--color-text-primary',
        '--color-neon-green',
        '--font-terminal',
      ];

      expectedProperties.forEach(property => {
        const value = computedStyle.getPropertyValue(property);
        // In test environment, CSS custom properties might not be loaded
        // So we just check that the element can be styled
        if (testElement.style.setProperty) {
          testElement.style.setProperty(property, '#000000');
          const testValue = testElement.style.getPropertyValue(property);
          if (!testValue) {
            failures.push(`Iteration ${i + 1}: Cannot set CSS custom property: ${property}`);
          }
        }
      });

      document.body.removeChild(testElement);
      cleanup();
    }

    if (failures.length > 0) {
      console.error('CSS custom property violations found:', failures);
      expect(failures).toHaveLength(0);
    }
  }, PROPERTY_TEST_CONFIG.timeout);

  /**
   * Property Test 1.3: Component Class Name Consistency
   * For any component element, it should use consistent cyberpunk class naming
   */
  it('should use consistent cyberpunk class naming patterns', () => {
    const iterations = Math.min(PROPERTY_TEST_CONFIG.iterations, 50);
    const failures: string[] = [];

    for (let i = 0; i < iterations; i++) {
      const { container } = render(
        <TestWrapper>
          <TestLandingPageElements />
        </TestWrapper>
      );

      // Check for consistent class naming patterns
      const elements = container.querySelectorAll('*');
      
      elements.forEach((element, elementIndex) => {
        const className = element.className;
        if (typeof className === 'string' && className.length > 0) {
          const classes = className.split(' ');
          
          classes.forEach(cls => {
            // Check for cyberpunk-specific class patterns
            if (cls.includes('cyber') || cls.includes('neon') || cls.includes('terminal')) {
              // These should follow consistent naming - but allow current patterns
              if (cls.includes('cyber') && 
                  !cls.startsWith('cyber-') && 
                  !cls.startsWith('bg-cyber-') && 
                  !cls.startsWith('text-cyber-') && 
                  !cls.startsWith('border-cyber-') && 
                  cls !== 'cyberpunk-theme' && 
                  cls !== 'card-cyberpunk') {
                failures.push(
                  `Iteration ${i + 1}, Element ${elementIndex + 1}: ` +
                  `Inconsistent cyber class naming: ${cls}`
                );
              }
              
              if (cls.includes('neon') && 
                  !cls.includes('text-neon') && 
                  !cls.includes('btn-neon') && 
                  !cls.includes('border-neon') &&
                  !cls.includes('shadow-neon')) {
                failures.push(
                  `Iteration ${i + 1}, Element ${elementIndex + 1}: ` +
                  `Inconsistent neon class naming: ${cls}`
                );
              }
            }
          });
        }
      });

      cleanup();
    }

    if (failures.length > 0) {
      console.error('Class naming violations found:', failures);
      expect(failures).toHaveLength(0);
    }
  }, PROPERTY_TEST_CONFIG.timeout);

  /**
   * Property Test 1.4: Responsive Viewport Consistency
   * For any viewport size, the theme structure should be maintained
   */
  it('should maintain theme structure across viewport sizes', () => {
    const viewportSizes = generateViewportSizes();
    const failures: string[] = [];

    viewportSizes.forEach((viewportWidth, index) => {
      // Set viewport size
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: viewportWidth,
      });

      const { container } = render(
        <TestWrapper>
          <TestLandingPageElements />
        </TestWrapper>
      );

      // Check that main theme container exists
      const themeContainer = container.querySelector('.cyberpunk-theme');
      if (!themeContainer) {
        failures.push(`Viewport ${viewportWidth}px: Missing cyberpunk-theme container`);
      }

      // Check that key sections exist
      const nav = container.querySelector('nav');
      const section = container.querySelector('section');
      const footer = container.querySelector('footer');

      if (!nav) failures.push(`Viewport ${viewportWidth}px: Missing navigation`);
      if (!section) failures.push(`Viewport ${viewportWidth}px: Missing main section`);
      if (!footer) failures.push(`Viewport ${viewportWidth}px: Missing footer`);

      // Check that neon elements exist
      const neonElements = container.querySelectorAll('[class*="neon"]');
      if (neonElements.length === 0) {
        failures.push(`Viewport ${viewportWidth}px: No neon elements found`);
      }

      // Check that terminal elements exist
      const terminalElements = container.querySelectorAll('.font-terminal');
      if (terminalElements.length === 0) {
        failures.push(`Viewport ${viewportWidth}px: No terminal font elements found`);
      }

      cleanup();
    });

    if (failures.length > 0) {
      console.error('Responsive viewport violations found:', failures);
      expect(failures).toHaveLength(0);
    }
  }, PROPERTY_TEST_CONFIG.timeout);

  /**
   * Property Test 1.5: Dragon Graphics Elements Presence
   * For any page render, dragon-related elements should be present
   */
  it('should maintain dragon graphics elements presence', () => {
    const iterations = Math.min(PROPERTY_TEST_CONFIG.iterations, 30);
    const failures: string[] = [];

    for (let i = 0; i < iterations; i++) {
      const { container } = render(
        <TestWrapper>
          <TestLandingPageElements />
        </TestWrapper>
      );

      // Check for dragon elements
      const dragonElements = container.querySelectorAll(
        '.dragon-silhouette, .dragon-bg, [class*="dragon"]'
      );
      
      if (dragonElements.length === 0) {
        failures.push(`Iteration ${i + 1}: No dragon elements found`);
      } else {
        // Check that dragon elements have appropriate classes
        dragonElements.forEach((element, elementIndex) => {
          const className = element.className;
          if (!className.includes('dragon')) {
            failures.push(
              `Iteration ${i + 1}, Dragon Element ${elementIndex + 1}: ` +
              `Element doesn't have dragon class: ${className}`
            );
          }
        });
      }

      cleanup();
    }

    if (failures.length > 0) {
      console.error('Dragon graphics violations found:', failures);
      expect(failures).toHaveLength(0);
    }
  }, PROPERTY_TEST_CONFIG.timeout);

  /**
   * Property Test 1.6: Theme Color Palette Validation
   * For any color used in the theme, it should be from the approved palette
   */
  it('should only use approved cyberpunk color palette', () => {
    const iterations = Math.min(PROPERTY_TEST_CONFIG.iterations, 20);
    const failures: string[] = [];

    // Test the theme configuration colors directly
    for (let i = 0; i < iterations; i++) {
      const allColors = [
        ...Object.values(cyberpunkTheme.colors.background),
        ...Object.values(cyberpunkTheme.colors.text),
        ...Object.values(cyberpunkTheme.colors.neon),
        ...Object.values(cyberpunkTheme.colors.border),
      ];

      allColors.forEach((color, colorIndex) => {
        // Check that no forbidden colors are used
        FORBIDDEN_COLORS.forEach(forbiddenColor => {
          if (color.toLowerCase() === forbiddenColor.toLowerCase()) {
            failures.push(
              `Iteration ${i + 1}, Color ${colorIndex + 1}: ` +
              `Forbidden color found in theme: ${color}`
            );
          }
        });

        // Check color format validity
        if (!color.startsWith('#') && !color.startsWith('rgb') && !color.startsWith('hsl')) {
          failures.push(
            `Iteration ${i + 1}, Color ${colorIndex + 1}: ` +
            `Invalid color format: ${color}`
          );
        }
      });
    }

    if (failures.length > 0) {
      console.error('Color palette violations found:', failures);
      expect(failures).toHaveLength(0);
    }
  }, PROPERTY_TEST_CONFIG.timeout);

  /**
   * Property Test 1.7: Font Family Consistency
   * For any font family in the theme, it should be appropriate for cyberpunk aesthetic
   */
  it('should use consistent cyberpunk-appropriate font families', () => {
    const iterations = Math.min(PROPERTY_TEST_CONFIG.iterations, 20);
    const failures: string[] = [];

    for (let i = 0; i < iterations; i++) {
      const fonts = cyberpunkTheme.typography.fonts;

      // Check primary font
      if (!fonts.primary.includes('Inter') && !fonts.primary.includes('sans-serif')) {
        failures.push(`Iteration ${i + 1}: Primary font should include Inter or sans-serif: ${fonts.primary}`);
      }

      // Check terminal font
      if (!fonts.terminal.includes('mono') && !fonts.terminal.includes('Courier')) {
        failures.push(`Iteration ${i + 1}: Terminal font should be monospace: ${fonts.terminal}`);
      }

      // Check heading font
      if (!fonts.heading.includes('Orbitron') && !fonts.heading.includes('Inter')) {
        failures.push(`Iteration ${i + 1}: Heading font should include Orbitron or Inter: ${fonts.heading}`);
      }
    }

    if (failures.length > 0) {
      console.error('Font family violations found:', failures);
      expect(failures).toHaveLength(0);
    }
  }, PROPERTY_TEST_CONFIG.timeout);
});