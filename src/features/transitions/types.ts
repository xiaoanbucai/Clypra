/**
 * Transitions Types
 * Type definitions for transition effects between clips
 */

export type TransitionType = "fade" | "dissolve" | "slide" | "wipe" | "zoom" | "creative";

export type TransitionRenderer = "fade" | "dissolve" | "zoom_in" | "zoom_out" | "slide_left" | "slide_right" | "wipe";

export interface TransitionAsset {
  id: string;
  name: string;
  type: "transition";
  category: string;
  description: string;
  thumbnail: string;
  preview: string;
  renderer: TransitionRenderer;
  duration?: {
    min: number;
    max: number;
    default: number;
  };
  tags?: string[];
  isPremium?: boolean;
  published?: boolean;
}

export interface TransitionCategory {
  id: string;
  name: string;
  description: string;
}

export interface AppliedTransition {
  id: string;
  transitionId: string;
  renderer: TransitionRenderer;
  duration: number;
  params?: Record<string, any>;
}
