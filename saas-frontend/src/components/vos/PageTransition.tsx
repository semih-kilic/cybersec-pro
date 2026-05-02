import { type ReactNode, Children } from 'react';
import { motion } from 'framer-motion';

/**
 * PageTransition — wraps a route's content with the signature
 * Vision OS spring rise-in. Pair with React Router via key={location.key}
 * inside an <AnimatePresence mode="wait">.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      style={{ willChange: 'opacity, transform' }}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerChildren — animates direct children in sequence (60ms stagger).
 * Children should be wrapped in <motion.div /> or use the variants below.
 */
export function StaggerChildren({
  children,
  delay = 0,
  stagger = 0.06,
  className,
}: {
  children: ReactNode;
  delay?: number;
  stagger?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: stagger, delayChildren: delay },
        },
      }}
      className={className}
    >
      {Children.map(children, (child, i) => (
        <motion.div
          key={i}
          variants={{
            hidden: { opacity: 0, y: 14 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
            },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
