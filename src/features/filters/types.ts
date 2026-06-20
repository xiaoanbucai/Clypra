/**
 * Filters Types
 * Type definitions for color grading filters
 */

export interface FilterAsset {
  id: string;
  name: string;
  type: "filter";
  category: string;
  description: string;
  thumbnail: string;
  swatch?: string;
  url?: string;

  // LUT file
  lut?: string;

  // Metadata
  tags: string[];
  isPremium?: boolean;

  // UI hints
  intensity?: {
    min: number;
    max: number;
    default: number;
    step: number;
  };
}

export interface FilterCategory {
  id: string;
  name: string;
  description: string;
}

export interface AppliedFilter {
  id: string;
  filterId: string;
  intensity: number;
  params?: Record<string, any>;
}
