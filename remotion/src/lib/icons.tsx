/**
 * icons.tsx — the one place shots get icons from.
 *
 * A small CURATED set of Phosphor icons (@phosphor-icons/react) that matches
 * the house style (see /brand.md): calm, premium, readable at caption scale.
 * Don't import from '@phosphor-icons/react' in shots directly — add the icon
 * here first so every video uses the same visual vocabulary.
 *
 * House defaults (mirroring the caption typography):
 *  - weight: 'bold'  — matches the Inter/Social-bold caption weight; reads at phone scale.
 *  - color:  COLORS.ink — the brand ink used for primary text on light surfaces.
 *
 * Usage:
 *   import { Icon, CheckCircle } from '../lib/icons';
 *
 *   <Icon name="CheckCircle" size={96} color={COLORS.signal} />
 *   <Icon name="Rocket" />                      // bold, ink, 64px
 *   <CheckCircle size={96} color={COLORS.signal} weight="fill" />  // direct use
 */
import React from 'react';
import {
  ArrowRight,
  Brain,
  ChartLineUp,
  CheckCircle,
  Clock,
  Code,
  Gear,
  Lightning,
  Lock,
  Rocket,
  Sparkle,
  Warning,
  type Icon as PhosphorIcon,
  type IconWeight,
} from '@phosphor-icons/react';
import { COLORS } from '../brand';

// ---------------------------------------------------------------------------
// Curated set — re-exported so shots can also use them directly.
// Keep this list short and broadly useful; add new icons here, not in shots.
// ---------------------------------------------------------------------------
export {
  ArrowRight,
  Brain,
  ChartLineUp,
  CheckCircle,
  Clock,
  Code,
  Gear,
  Lightning,
  Lock,
  Rocket,
  Sparkle,
  Warning,
};
export type { IconWeight };

/** The curated set, keyed by component name for the stringly-typed <Icon name="..."> API. */
const REGISTRY = {
  ArrowRight,
  Brain,
  ChartLineUp,
  CheckCircle,
  Clock,
  Code,
  Gear,
  Lightning,
  Lock,
  Rocket,
  Sparkle,
  Warning,
} as const;

/** Names of the curated icons — the valid values for <Icon name>. */
export type IconName = keyof typeof REGISTRY;

export interface IconProps {
  /** Name of a curated icon, e.g. "CheckCircle". */
  name: IconName;
  /** Icon box size in px (number) or any CSS size (string). Default 64. */
  size?: number | string;
  /** Icon color. Default: brand ink (COLORS.ink). */
  color?: string;
  /**
   * Phosphor stroke weight. Default: 'bold' — chosen to match the bold caption
   * typography so icons and text carry the same visual weight on screen.
   * Use 'fill' for solid stamps (checkmarks, badges) or 'duotone' for softer accents.
   */
  weight?: IconWeight;
  /** Flip horizontally (e.g. a left-pointing ArrowRight). */
  mirrored?: boolean;
  /** Accessible label rendered as <title> inside the svg. */
  alt?: string;
}

/**
 * Convenience icon component with house defaults applied:
 * weight 'bold' (caption weight), color COLORS.ink, size 64.
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 64,
  color = COLORS.ink,
  weight = 'bold',
  mirrored,
  alt,
}) => {
  const Component: PhosphorIcon = REGISTRY[name];
  return (
    <Component size={size} color={color} weight={weight} mirrored={mirrored} alt={alt} />
  );
};
