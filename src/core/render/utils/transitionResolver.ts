/**
 * Transition Resolver
 *
 * Resolves transition types to GPU transition definitions,
 * handling legacy mappings and parameter merging.
 */

const RENDERER_TO_GPU_TRANSITION: Record<string, { id: string; params?: Record<string, any> }> = {
  fade: { id: "cross-dissolve" },
  dissolve: { id: "cross-dissolve" },
  cut: { id: "strobe-cut" },
  slide_left: { id: "push", params: { direction: "left" } },
  slide_right: { id: "push", params: { direction: "right" } },
  slide_up: { id: "push", params: { direction: "up" } },
  slide_down: { id: "push", params: { direction: "down" } },
  wipe_left: { id: "push", params: { direction: "left" } },
  wipe_right: { id: "push", params: { direction: "right" } },
  wipe_up: { id: "push", params: { direction: "up" } },
  wipe_down: { id: "push", params: { direction: "down" } },
  wipe_clockwise: { id: "iris-reveal" },
  wipe_center: { id: "iris-reveal" },
  zoom_in: { id: "zoom", params: { direction: "in", scale: 1.3 } },
  zoom_out: { id: "zoom", params: { direction: "out", scale: 0.7 } },
  zoom_blur: { id: "zoom", params: { direction: "in", scale: 1.3, blurAmount: 12 } },
  circle_expand: { id: "iris-reveal", params: { type: "circle" } },
  circle_collapse: { id: "iris-reveal", params: { type: "circle", invert: true } },
  diamond_expand: { id: "iris-reveal", params: { type: "diamond" } },
  rectangle_expand: { id: "iris-reveal", params: { type: "rectangle" } },
  blur_fade: { id: "cross-dissolve" },
  directional_blur: { id: "cross-dissolve" },
  glitch: { id: "glitch" },
  rgb_split: { id: "chromatic-push" },
  chromatic: { id: "chromatic-push" },
  film_burn: { id: "film-burn-wipe" },
  light_leak: { id: "light-leak-sweep" },
  whip_pan: { id: "push" },
};

/**
 * Resolve transition type to GPU transition definition.
 *
 * Handles:
 * - Direct matches (transition type maps directly to GPU definition ID)
 * - Legacy mappings (old renderer types map to new GPU types)
 * - Parameter merging (default params from mapping + runtime params)
 *
 * @param transitionType - Transition type string
 * @param ALL_TRANSITIONS - Array of available GPU transition definitions
 * @returns Transition definition with merged parameters, or null if not found
 */
export function resolveTransitionDefinition(transitionType: string, ALL_TRANSITIONS: any[]): { definition: any; params: Record<string, any> } | null {
  // Direct match: transition type is a GPU definition ID
  let definition = ALL_TRANSITIONS.find((t) => t.id === transitionType);

  if (definition) {
    return { definition, params: {} };
  }

  // Legacy mapping: transition type needs conversion
  const mapping = RENDERER_TO_GPU_TRANSITION[transitionType];

  if (mapping) {
    definition = ALL_TRANSITIONS.find((t) => t.id === mapping.id);

    if (definition) {
      return {
        definition,
        params: mapping.params || {},
      };
    }
  }

  // Not found
  if (import.meta.env.DEV) {
    console.warn(`[TransitionResolver] Unknown transition type: ${transitionType}`);
  }

  return null;
}

/**
 * Merge transition parameters from multiple sources.
 *
 * Priority (highest to lowest):
 * 1. Runtime params (from transition instance)
 * 2. Mapping params (from legacy conversion)
 * 3. Definition params (from GPU definition defaults)
 *
 * @param definitionParams - Default params from GPU definition
 * @param mappingParams - Params from legacy mapping
 * @param runtimeParams - Params from transition instance
 * @returns Merged parameters
 */
export function mergeTransitionParams(definitionParams: Record<string, any> = {}, mappingParams: Record<string, any> = {}, runtimeParams: Record<string, any> = {}): Record<string, any> {
  return {
    ...definitionParams,
    ...mappingParams,
    ...runtimeParams,
  };
}
