import type { Transition, Variants } from 'motion/react';

/**
 * Standardized Framer Motion Spring Presets for RuangLABmu Spatial HUD
 * Calibrated for crisp, tactile instrument responsiveness without overshoot oscillation.
 */
export const SPRING_TACTILE: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 28,
  mass: 0.9,
};

export const SPRING_DRAWER: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 28,
  mass: 0.9,
};

export const SPRING_LAYOUT_PILL: Transition = {
  type: 'spring',
  stiffness: 360,
  damping: 30,
  mass: 0.85,
};

export const SPRING_MODAL: Transition = {
  type: 'spring',
  stiffness: 340,
  damping: 29,
  mass: 0.9,
};

export const DRAWER_LEFT_VARIANTS: Variants = {
  open: {
    x: 0,
    opacity: 1,
    transition: SPRING_DRAWER,
  },
  closed: {
    x: -28,
    opacity: 0,
    transition: { duration: 0.16, ease: 'easeInOut' },
  },
};

export const DRAWER_RIGHT_VARIANTS: Variants = {
  open: {
    x: 0,
    opacity: 1,
    transition: SPRING_DRAWER,
  },
  closed: {
    x: 28,
    opacity: 0,
    transition: { duration: 0.16, ease: 'easeInOut' },
  },
};

export const MODAL_POPOVER_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: SPRING_MODAL,
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 6,
    transition: { duration: 0.14, ease: 'easeOut' },
  },
};

export const TACTILE_BUTTON_MOTION = {
  whileHover: { scale: 1.015 },
  whileTap: { scale: 0.975 },
  transition: SPRING_TACTILE,
} as const;
