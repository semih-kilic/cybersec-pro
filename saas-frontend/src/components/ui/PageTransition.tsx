/**
 * PageTransition — Framer Motion wrapper for smooth page transitions.
 * Wrap any page content for slide-fade entrance animation.
 */
import { memo, type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = {
  type: 'tween' as const,
  ease: 'easeOut',
  duration: 0.25,
};

export const PageTransition = memo(({ children, className }: PageTransitionProps) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={pageTransition}
    className={className}
  >
    {children}
  </motion.div>
));

PageTransition.displayName = 'PageTransition';

/**
 * Stagger children animation — each child fades in sequentially.
 */
interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

const containerVariants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

export const StaggerContainer = memo(({ children, className }: StaggerContainerProps) => (
  <motion.div
    variants={containerVariants}
    initial="initial"
    animate="animate"
    className={className}
  >
    {children}
  </motion.div>
));

StaggerContainer.displayName = 'StaggerContainer';

export const StaggerItem = memo(({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div variants={itemVariants} className={className}>
    {children}
  </motion.div>
));

StaggerItem.displayName = 'StaggerItem';

/**
 * Hover scale micro-interaction
 */
export const HoverScale = memo(({ children, className, scale = 1.02 }: { children: ReactNode; className?: string; scale?: number }) => (
  <motion.div
    whileHover={{ scale }}
    whileTap={{ scale: 0.98 }}
    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    className={className}
  >
    {children}
  </motion.div>
));

HoverScale.displayName = 'HoverScale';

/**
 * Fade-in on scroll (viewport entry animation)
 */
export const FadeInView = memo(({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-50px' }}
    transition={{ duration: 0.4 }}
    className={className}
  >
    {children}
  </motion.div>
));

FadeInView.displayName = 'FadeInView';
