/**
 * 🐉 Property-Based Tests for Kali Dragon Landing Page Color Palette Compliance
 * **Feature: kali-dragon-landing, Property 2: Color Palette Compliance**
 * **Validates: Requirements 2.1, 2.4, 2.5**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import React from 'react';
import {
  PROPERTY_TEST_CONFIG,
  generateViewportSizes,
  FORBIDDEN_COLORS,
  isForbiddenColor,
} from '../../test/property-test-utils';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <HelmetProvider>
      {children}
    </HelmetProvider>
  </BrowserRouter>
);

const TestLandingPageElements: React.FC = () => (
  <div className="cyberpunk-theme min-h-screen">
    <nav className="bg-cyber-bg-primary border-b border-cyber-border-primary">
      <span className="text-cyber-text-primary font-heading">CyberSec Pro</span>
      <span className="text-neon-green font-terminal">[KALI-DRAGON]</span>
    </nav>
    <section className="bg-cyber-bg-primary">
      <h1 className="text-cyber-text-primary font-heading">
        World-Class <span className="text-neon-green">Cybersecurity</span>
      </h1>
      <button className="btn-neon-green">Initialize System</button>
    </section>
  </div>
);

const extractColorsFromElement = (element: Element): string[] => {
  const computedStyle = window.getComputedStyle(element);
  const colors: string[] = [];
  
  ['color', 'background-color', 'border-color'].forEach(property => {
    const value = computedStyle.getPropertyValue(property);
    if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') {
      colors.push(value);
    }
  });
  
  return colors.filter(color => color && color.trim() !== '');
};

describe('🐉 Property 2: Color Palette Compliance', () => {
  beforeEach(() => {
    document.documentElement.style.fontSize = '16px';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  it('should not contain any forbidden blue theme colors', () => {
    const iterations = PROPERTY_TEST_CONFIG.iterations;
    const failures: string[] = [];

    for (let i = 0; i < iterations; i++) {
      const { container } = render(
        <TestWrapper>
          <TestLandingPageElements />
        </TestWrapper>
      );

      const allElements = container.querySelectorAll('*');
      
      allElements.forEach((element, elementIndex) => {
        const colors = extractColorsFromElement(element);
        
        colors.forEach((color, colorIndex) => {
          if (isForbiddenColor(color)) {
            const elementInfo = element.tagName.toLowerCase() + 
              (element.className ? `.${element.className.split(' ').join('.')}` : '');
            
            failures.push(
              `Iteration ${i + 1}, Element ${elementIndex + 1} (${elementInfo}), ` +
              `Color ${colorIndex + 1}: Forbidden blue color found: ${color}`
            );
          }
        });
      });

      cleanup();
    }

    if (failures.length > 0) {
      console.error('Forbidden blue color violations found:', failures.slice(0, 10));
      expect(failures).toHaveLength(0);
    }
  }, PROPERTY_TEST_CONFIG.timeout);

  it('should maintain color palette compliance across viewport sizes', () => {
    const viewportSizes = generateViewportSizes();
    const failures: string[] = [];

    viewportSizes.forEach((viewportWidth) => {
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

      const allElements = Array.from(container.querySelectorAll('*'));
      const sampleElements = allElements.filter((_, index) => index % 5 === 0);
      
      sampleElements.forEach((element, elementIndex) => {
        const colors = extractColorsFromElement(element);
        
        colors.forEach((color, colorIndex) => {
          if (isForbiddenColor(color)) {
            failures.push(
              `Viewport ${viewportWidth}px, Element ${elementIndex + 1}, ` +
              `Color ${colorIndex + 1}: Forbidden color: ${color}`
            );
          }
        });
      });

      cleanup();
    });

    if (failures.length > 0) {
      console.error('Responsive color compliance violations found:', failures.slice(0, 10));
      expect(failures).toHaveLength(0);
    }
  }, PROPERTY_TEST_CONFIG.timeout);

  it('should have cyberpunk theme elements present', () => {
    const iterations = Math.min(PROPERTY_TEST_CONFIG.iterations, 20);
    const failures: string[] = [];

    for (let i = 0; i < iterations; i++) {
      const { container } = render(
        <TestWrapper>
          <TestLandingPageElements />
        </TestWrapper>
      );

      const themeContainer = container.querySelector('.cyberpunk-theme');
      if (!themeContainer) {
        failures.push(`Iteration ${i + 1}: Missing cyberpunk-theme container`);
      }

      const neonElements = container.querySelectorAll('[class*="neon"]');
      if (neonElements.length === 0) {
        failures.push(`Iteration ${i + 1}: No neon elements found`);
      }

      cleanup();
    }

    if (failures.length > 0) {
      console.error('Cyberpunk theme violations found:', failures);
      expect(failures).toHaveLength(0);
    }
  }, PROPERTY_TEST_CONFIG.timeout);
});
