/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Cyberpunk color palette
      colors: {
        // Background colors
        'cyber-bg': {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          tertiary: 'var(--color-bg-tertiary)',
          terminal: 'var(--color-bg-terminal)',
          overlay: 'var(--color-bg-overlay)',
        },
        // Text colors
        'cyber-text': {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          terminal: 'var(--color-text-terminal)',
          'terminal-prompt': 'var(--color-text-terminal-prompt)',
        },
        // Neon colors
        'neon': {
          green: 'var(--color-neon-green)',
          'green-dim': 'var(--color-neon-green-dim)',
          'green-bright': 'var(--color-neon-green-bright)',
          red: 'var(--color-neon-red)',
          'red-dim': 'var(--color-neon-red-dim)',
          cyan: 'var(--color-neon-cyan)',
          purple: 'var(--color-neon-purple)',
        },
        // Border colors
        'cyber-border': {
          primary: 'var(--color-border-primary)',
          secondary: 'var(--color-border-secondary)',
          neon: 'var(--color-border-neon)',
          terminal: 'var(--color-border-terminal)',
        },
      },
      
      // Typography
      fontFamily: {
        'cyber': 'var(--font-primary)',
        'terminal': 'var(--font-terminal)',
        'heading': 'var(--font-heading)',
      },
      
      fontSize: {
        'cyber-xs': 'var(--text-xs)',
        'cyber-sm': 'var(--text-sm)',
        'cyber-base': 'var(--text-base)',
        'cyber-lg': 'var(--text-lg)',
        'cyber-xl': 'var(--text-xl)',
        'cyber-2xl': 'var(--text-2xl)',
        'cyber-3xl': 'var(--text-3xl)',
        'cyber-4xl': 'var(--text-4xl)',
        'cyber-5xl': 'var(--text-5xl)',
        'cyber-6xl': 'var(--text-6xl)',
      },
      
      // Spacing system
      spacing: {
        'cyber-1': 'var(--space-1)',
        'cyber-2': 'var(--space-2)',
        'cyber-3': 'var(--space-3)',
        'cyber-4': 'var(--space-4)',
        'cyber-5': 'var(--space-5)',
        'cyber-6': 'var(--space-6)',
        'cyber-8': 'var(--space-8)',
        'cyber-10': 'var(--space-10)',
        'cyber-12': 'var(--space-12)',
        'cyber-16': 'var(--space-16)',
        'cyber-20': 'var(--space-20)',
        'cyber-24': 'var(--space-24)',
      },
      
      // Animation durations
      transitionDuration: {
        'cyber-fast': 'var(--duration-fast)',
        'cyber-normal': 'var(--duration-normal)',
        'cyber-slow': 'var(--duration-slow)',
        'cyber-glitch': 'var(--duration-glitch)',
        'cyber-matrix': 'var(--duration-matrix)',
      },
      
      // Box shadows for neon effects
      boxShadow: {
        'neon-green': 'var(--shadow-neon-green)',
        'neon-green-intense': 'var(--shadow-neon-green-intense)',
        'neon-red': 'var(--shadow-neon-red)',
        'neon-red-intense': 'var(--shadow-neon-red-intense)',
        'terminal': 'var(--shadow-terminal)',
      },
      
      // Text shadows for neon glow
      textShadow: {
        'neon-green': 'var(--shadow-neon-green)',
        'neon-green-intense': 'var(--shadow-neon-green-intense)',
        'neon-red': 'var(--shadow-neon-red)',
        'neon-red-intense': 'var(--shadow-neon-red-intense)',
      },
      
      // Border radius
      borderRadius: {
        'cyber-sm': 'var(--radius-sm)',
        'cyber-base': 'var(--radius-base)',
        'cyber-md': 'var(--radius-md)',
        'cyber-lg': 'var(--radius-lg)',
        'cyber-xl': 'var(--radius-xl)',
        'cyber-2xl': 'var(--radius-2xl)',
      },
      
      // Z-index layers
      zIndex: {
        'cyber-background': 'var(--z-background)',
        'cyber-base': 'var(--z-base)',
        'cyber-content': 'var(--z-content)',
        'cyber-navigation': 'var(--z-navigation)',
        'cyber-overlay': 'var(--z-overlay)',
        'cyber-modal': 'var(--z-modal)',
      },
      
      // Animation keyframes
      keyframes: {
        'glitch': {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
        },
        'neon-pulse': {
          '0%, 100%': { 
            textShadow: '0 0 5px currentColor, 0 0 10px currentColor, 0 0 15px currentColor',
            opacity: '1'
          },
          '50%': { 
            textShadow: '0 0 2px currentColor, 0 0 5px currentColor, 0 0 8px currentColor',
            opacity: '0.8'
          },
        },
        'matrix-rain': {
          '0%': { transform: 'translateY(-100vh)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'terminal-cursor': {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        'dragon-float': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-10px) rotate(1deg)' },
          '66%': { transform: 'translateY(5px) rotate(-1deg)' },
        },
        'shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      
      // Animation utilities
      animation: {
        'glitch': 'glitch var(--duration-glitch) infinite',
        'neon-pulse': 'neon-pulse var(--neon-pulse-duration) ease-in-out infinite',
        'matrix-rain': 'matrix-rain var(--duration-matrix) linear infinite',
        'terminal-cursor': 'terminal-cursor var(--terminal-cursor-blink) infinite',
        'dragon-float': 'dragon-float 6s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
      
      // Responsive breakpoints (matching our theme)
      screens: {
        'cyber-mobile': '320px',
        'cyber-tablet': '768px',
        'cyber-desktop': '1024px',
        'cyber-wide': '1440px',
        'cyber-ultra': '1920px',
      },
    },
  },
  plugins: [
    // Custom plugin for cyberpunk utilities
    function({ addUtilities, theme }) {
      const newUtilities = {
        // Neon text utilities
        '.text-neon-green': {
          color: theme('colors.neon.green'),
          textShadow: theme('textShadow.neon-green'),
        },
        '.text-neon-red': {
          color: theme('colors.neon.red'),
          textShadow: theme('textShadow.neon-red'),
        },
        '.text-neon-green-intense': {
          color: theme('colors.neon.green'),
          textShadow: theme('textShadow.neon-green-intense'),
        },
        '.text-neon-red-intense': {
          color: theme('colors.neon.red'),
          textShadow: theme('textShadow.neon-red-intense'),
        },
        
        // Terminal utilities
        '.terminal': {
          backgroundColor: theme('colors.cyber-bg.terminal'),
          color: theme('colors.cyber-text.terminal'),
          fontFamily: theme('fontFamily.terminal'),
          border: `1px solid ${theme('colors.cyber-border.terminal')}`,
          boxShadow: theme('boxShadow.terminal'),
        },
        
        // Cyberpunk button utilities
        '.btn-cyberpunk': {
          background: 'transparent',
          border: `2px solid ${theme('colors.neon.green')}`,
          color: theme('colors.neon.green'),
          fontFamily: theme('fontFamily.terminal'),
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          transition: `all ${theme('transitionDuration.cyber-normal')} ease-in-out`,
          position: 'relative',
          overflow: 'hidden',
          '&:hover': {
            background: theme('colors.neon.green'),
            color: theme('colors.cyber-bg.primary'),
            boxShadow: theme('boxShadow.neon-green-intense'),
          },
          '&:focus': {
            outline: `2px solid ${theme('colors.neon.green')}`,
            outlineOffset: '2px',
          },
        },
        
        // Cyberpunk card utilities
        '.card-cyberpunk': {
          background: theme('colors.cyber-bg.secondary'),
          border: `1px solid ${theme('colors.cyber-border.primary')}`,
          borderRadius: theme('borderRadius.cyber-lg'),
          transition: `all ${theme('transitionDuration.cyber-normal')} ease-in-out`,
          '&:hover': {
            borderColor: theme('colors.neon.green'),
            boxShadow: theme('boxShadow.neon-green'),
            transform: 'translateY(-2px)',
          },
        },
        
        // Dragon background utility
        '.dragon-bg': {
          opacity: 'var(--dragon-opacity)',
        },
        
        // Glitch effect utility
        '.glitch-hover': {
          '&:hover': {
            animation: 'glitch var(--duration-glitch) infinite',
          },
        },
        
        // Matrix background utility
        '.matrix-bg': {
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            background: 'linear-gradient(transparent, rgba(0, 255, 0, 0.1))',
            pointerEvents: 'none',
            zIndex: theme('zIndex.cyber-background'),
          },
        },
      };
      
      addUtilities(newUtilities);
    },
    
    // Plugin for responsive dragon graphics
    function({ addUtilities, theme }) {
      addUtilities({
        '@media (max-width: 767px)': {
          '.dragon-mobile-hidden': {
            display: 'none',
          },
          '.dragon-mobile-simplified': {
            opacity: '0.05',
            transform: 'scale(0.7)',
          },
        },
        '@media (min-width: 768px) and (max-width: 1023px)': {
          '.dragon-tablet-medium': {
            opacity: '0.08',
            transform: 'scale(0.85)',
          },
        },
        '@media (min-width: 1024px)': {
          '.dragon-desktop-full': {
            opacity: 'var(--dragon-opacity)',
            transform: 'scale(1)',
          },
        },
      });
    },
  ],
};