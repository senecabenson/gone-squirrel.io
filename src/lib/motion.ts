// Motion primitives — physics-based, no spring overshoot. See globals.css for --dur-* / --ease-* CSS counterparts.

import type { Transition, Variants } from "framer-motion";

// Settle — task complete, list item in/out. Quiet gravity feel.
export const settleTransition: Transition = {
  duration: 0.28,
  ease: [0.2, 0.8, 0.2, 1],
};
export const settle: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: settleTransition },
  exit: { opacity: 0, y: -4, transition: { ...settleTransition, duration: 0.2 } },
};

// Slide — page / modal / sheet. Spatial directional.
export const slideTransition: Transition = {
  duration: 0.22,
  ease: [0.32, 0.72, 0, 1],
};
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: slideTransition },
  exit: { opacity: 0, y: 16, transition: slideTransition },
};
export const slideDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: { opacity: 1, y: 0, transition: slideTransition },
  exit: { opacity: 0, y: -16, transition: slideTransition },
};

// Fade — micro interactions. Tooltips, popovers.
export const fadeTransition: Transition = {
  duration: 0.16,
  ease: "easeOut",
};
export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: fadeTransition },
  exit: { opacity: 0, transition: fadeTransition },
};

// Stagger helper for lists.
export const staggerChildren = (delayChildren = 0, stagger = 0.04) => ({
  hidden: {},
  visible: {
    transition: { delayChildren, staggerChildren: stagger },
  },
});
