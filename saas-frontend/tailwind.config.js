/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ============================================================
      //  🪟 VISION OS DESIGN SYSTEM (additive — does not break legacy)
      //  All `vos-*` utilities map to CSS custom properties defined in
      //  src/styles/visionos-theme.css. Use these for all new pages.
      // ============================================================

      // Vision OS color palette
      colors: {
        vos: {
          bg:        'var(--vos-bg)',
          'bg-deep': 'var(--vos-bg-deep)',
          canvas:    'var(--vos-bg-canvas)',
          'bg-elev-1': 'var(--vos-bg-elev-1)',
          'bg-elev-2': 'var(--vos-bg-elev-2)',
          'bg-elev-3': 'var(--vos-bg-elev-3)',
          'bg-elev-4': 'var(--vos-bg-elev-4)',
          // Glass tints
          'glass-1': 'var(--vos-glass-1)',
          'glass-2': 'var(--vos-glass-2)',
          'glass-3': 'var(--vos-glass-3)',
          'glass-4': 'var(--vos-glass-4)',
          // Borders
          'border-1':       'var(--vos-border-1)',
          'border-2':       'var(--vos-border-2)',
          'border-3':       'var(--vos-border-3)',
          'border-strong':  'var(--vos-border-strong)',
          // Text
          text:        'var(--vos-text)',
          'text-2':    'var(--vos-text-2)',
          'text-3':    'var(--vos-text-3)',
          'text-muted':'var(--vos-text-muted)',
          'on-accent': 'var(--vos-text-on-accent)',
          // Accents
          accent:        'var(--vos-accent)',
          'accent-2':    'var(--vos-accent-2)',
          'accent-soft': 'var(--vos-accent-soft)',
          cyan:          'var(--vos-cyan)',
          'cyan-soft':   'var(--vos-cyan-soft)',
          violet:        'var(--vos-violet)',
          'violet-soft': 'var(--vos-violet-soft)',
          // Semantic
          success:       'var(--vos-success)',
          'success-soft':'var(--vos-success-soft)',
          warning:       'var(--vos-warning)',
          'warning-soft':'var(--vos-warning-soft)',
          danger:        'var(--vos-danger)',
          'danger-soft': 'var(--vos-danger-soft)',
          info:          'var(--vos-info)',
          'info-soft':   'var(--vos-info-soft)',
          // Severity ramp
          'sev-critical':'var(--vos-sev-critical)',
          'sev-high':    'var(--vos-sev-high)',
          'sev-medium':  'var(--vos-sev-medium)',
          'sev-low':     'var(--vos-sev-low)',
          'sev-info':    'var(--vos-sev-info)',
        },

        // ===== Legacy cyberpunk palette (kept for backward compat) =====
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
        // Vision OS
        'vos':         'var(--vos-font-sans)',
        'vos-mono':    'var(--vos-font-mono)',
        'vos-display': 'var(--vos-font-display)',
        // Legacy
        'cyber': 'var(--font-primary)',
        'terminal': 'var(--font-terminal)',
        'heading': 'var(--font-heading)',
      },
      
      fontSize: {
        // Vision OS scale
        'vos-2xs':  ['var(--vos-text-2xs)',  { lineHeight: 'var(--vos-leading-snug)' }],
        'vos-xs':   ['var(--vos-text-xs)',   { lineHeight: 'var(--vos-leading-snug)' }],
        'vos-sm':   ['var(--vos-text-sm)',   { lineHeight: 'var(--vos-leading-snug)' }],
        'vos-base': ['var(--vos-text-base)', { lineHeight: 'var(--vos-leading-base)' }],
        'vos-md':   ['var(--vos-text-md)',   { lineHeight: 'var(--vos-leading-base)' }],
        'vos-lg':   ['var(--vos-text-lg)',   { lineHeight: 'var(--vos-leading-snug)' }],
        'vos-xl':   ['var(--vos-text-xl)',   { lineHeight: 'var(--vos-leading-snug)' }],
        'vos-2xl':  ['var(--vos-text-2xl)',  { lineHeight: 'var(--vos-leading-tight)', letterSpacing: 'var(--vos-tracking-snug)' }],
        'vos-3xl':  ['var(--vos-text-3xl)',  { lineHeight: 'var(--vos-leading-tight)', letterSpacing: 'var(--vos-tracking-tight)' }],
        'vos-4xl':  ['var(--vos-text-4xl)',  { lineHeight: 'var(--vos-leading-tight)', letterSpacing: 'var(--vos-tracking-tight)' }],
        'vos-5xl':  ['var(--vos-text-5xl)',  { lineHeight: 'var(--vos-leading-tight)', letterSpacing: 'var(--vos-tracking-tight)' }],
        'vos-6xl':  ['var(--vos-text-6xl)',  { lineHeight: 'var(--vos-leading-tight)', letterSpacing: 'var(--vos-tracking-tight)' }],
        // Legacy
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
      
      // Vision OS letter-spacing scale (Apple display tracking)
      letterSpacing: {
        'vos-tighter': 'var(--vos-tracking-tighter)',
        'vos-tight':   'var(--vos-tracking-tight)',
        'vos-snug':    'var(--vos-tracking-snug)',
        'vos-normal':  'var(--vos-tracking-normal)',
        'vos-wide':    'var(--vos-tracking-wide)',
      },

      // Vision OS line-height scale
      lineHeight: {
        'vos-tight': 'var(--vos-leading-tight)',
        'vos-snug':  'var(--vos-leading-snug)',
        'vos-base':  'var(--vos-leading-base)',
        'vos-loose': 'var(--vos-leading-loose)',
      },

      // Spacing system
      spacing: {
        // Vision OS spacing
        'vos-1':  'var(--vos-space-1)',
        'vos-2':  'var(--vos-space-2)',
        'vos-3':  'var(--vos-space-3)',
        'vos-4':  'var(--vos-space-4)',
        'vos-5':  'var(--vos-space-5)',
        'vos-6':  'var(--vos-space-6)',
        'vos-8':  'var(--vos-space-8)',
        'vos-10': 'var(--vos-space-10)',
        'vos-12': 'var(--vos-space-12)',
        'vos-16': 'var(--vos-space-16)',
        'vos-20': 'var(--vos-space-20)',
        'vos-24': 'var(--vos-space-24)',
        'vos-32': 'var(--vos-space-32)',
        // Layout
        'vos-sidebar':           'var(--vos-sidebar-w)',
        'vos-sidebar-collapsed': 'var(--vos-sidebar-w-collapsed)',
        'vos-topbar':            'var(--vos-topbar-h)',
        // Legacy
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
        // Vision OS
        'vos-1': 'var(--vos-dur-1)',
        'vos-2': 'var(--vos-dur-2)',
        'vos-3': 'var(--vos-dur-3)',
        'vos-4': 'var(--vos-dur-4)',
        'vos-5': 'var(--vos-dur-5)',
        // Legacy
        'cyber-fast': 'var(--duration-fast)',
        'cyber-normal': 'var(--duration-normal)',
        'cyber-slow': 'var(--duration-slow)',
        'cyber-glitch': 'var(--duration-glitch)',
        'cyber-matrix': 'var(--duration-matrix)',
      },

      transitionTimingFunction: {
        'vos-spring':  'var(--vos-ease-spring)',
        'vos-out':     'var(--vos-ease-out)',
        'vos-in-out':  'var(--vos-ease-in-out)',
        'vos-emph':    'var(--vos-ease-emph)',
      },

      // Backdrop blur (Vision OS levels)
      backdropBlur: {
        'vos-1': '12px',
        'vos-2': '20px',
        'vos-3': '32px',
        'vos-4': '48px',
      },
      backdropSaturate: {
        'vos-1': '140%',
        'vos-2': '160%',
        'vos-3': '180%',
        'vos-4': '200%',
      },

      // Box shadows for neon effects
      boxShadow: {
        // Vision OS depth tiers
        'vos-1':         'var(--vos-shadow-1)',
        'vos-2':         'var(--vos-shadow-2)',
        'vos-3':         'var(--vos-shadow-3)',
        'vos-4':         'var(--vos-shadow-4)',
        'vos-glow':      'var(--vos-glow-accent)',
        'vos-glow-success':'var(--vos-glow-success)',
        'vos-glow-danger': 'var(--vos-glow-danger)',
        'vos-highlight': 'var(--vos-highlight)',
        'vos-highlight-strong': 'var(--vos-highlight-strong)',
        // Legacy neon
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
        // Vision OS — generous, consistent
        'vos-xs':   'var(--vos-radius-xs)',
        'vos-sm':   'var(--vos-radius-sm)',
        'vos-md':   'var(--vos-radius-md)',
        'vos-lg':   'var(--vos-radius-lg)',
        'vos-xl':   'var(--vos-radius-xl)',
        'vos-2xl':  'var(--vos-radius-2xl)',
        'vos-full': 'var(--vos-radius-full)',
        // Legacy
        'cyber-sm': 'var(--radius-sm)',
        'cyber-base': 'var(--radius-base)',
        'cyber-md': 'var(--radius-md)',
        'cyber-lg': 'var(--radius-lg)',
        'cyber-xl': 'var(--radius-xl)',
        'cyber-2xl': 'var(--radius-2xl)',
      },
      
      // Z-index layers
      zIndex: {
        // Vision OS layer system
        'vos-bg':       'var(--vos-z-bg)',
        'vos-base':     'var(--vos-z-base)',
        'vos-content':  'var(--vos-z-content)',
        'vos-sticky':   'var(--vos-z-sticky)',
        'vos-nav':      'var(--vos-z-nav)',
        'vos-overlay':  'var(--vos-z-overlay)',
        'vos-modal':    'var(--vos-z-modal)',
        'vos-popover':  'var(--vos-z-popover)',
        'vos-toast':    'var(--vos-z-toast)',
        'vos-tooltip':  'var(--vos-z-tooltip)',
        'vos-max':      'var(--vos-z-max)',
        // Legacy
        'cyber-background': 'var(--z-background)',
        'cyber-base': 'var(--z-base)',
        'cyber-content': 'var(--z-content)',
        'cyber-navigation': 'var(--z-navigation)',
        'cyber-overlay': 'var(--z-overlay)',
        'cyber-modal': 'var(--z-modal)',
      },
      
      // Animation keyframes
      keyframes: {
        // Vision OS
        'vos-fade-in':  { from: { opacity: '0' }, to: { opacity: '1' } },
        'vos-rise-in':  { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'vos-scale-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'vos-shimmer':  { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'vos-float':    { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        // Legacy
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
        // Vision OS
        'vos-fade-in':  'vos-fade-in var(--vos-dur-4) var(--vos-ease-out) both',
        'vos-rise-in':  'vos-rise-in var(--vos-dur-4) var(--vos-ease-spring) both',
        'vos-scale-in': 'vos-scale-in var(--vos-dur-3) var(--vos-ease-spring) both',
        'vos-shimmer':  'vos-shimmer 1.6s linear infinite',
        'vos-float':    'vos-float 6s ease-in-out infinite',
        // Legacy
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
    // NOTE: @media inside addUtilities is invalid in Tailwind v3 — use flat class names instead
    function({ addUtilities }) {
      addUtilities({
        '.dragon-mobile-hidden': {
          display: 'none',
        },
        '.dragon-mobile-simplified': {
          opacity: '0.05',
          transform: 'scale(0.7)',
        },
        '.dragon-tablet-medium': {
          opacity: '0.08',
          transform: 'scale(0.85)',
        },
        '.dragon-desktop-full': {
          opacity: 'var(--dragon-opacity)',
          transform: 'scale(1)',
        },
      });
    },
  ],
};