/**
 * 🐉 Test Setup Configuration
 * Vitest setup file for Kali Dragon Landing Page tests
 */

import '@testing-library/jest-dom';
import { expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Import CSS files for testing
import '../styles/cyberpunk-theme.css';

const ACT_DEPRECATION_MSG =
  'Warning: `ReactDOMTestUtils.act` is deprecated in favor of `React.act`. Import `act` from `react` instead of `react-dom/test-utils`.';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
const originalConsoleError = console.error.bind(console);

beforeAll(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string' && first.includes(ACT_DEPRECATION_MSG)) {
      return;
    }

    originalConsoleError(...(args as Parameters<typeof console.error>));
  });
});

afterAll(() => {
  consoleErrorSpy?.mockRestore();
});

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Mock CSS imports
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback) => {
  const timer = setTimeout(callback, 16);
  if (timer.unref) timer.unref();
  return timer as unknown as number;
};

global.cancelAnimationFrame = (id: number) => {
  clearTimeout(id as unknown as NodeJS.Timeout);
};