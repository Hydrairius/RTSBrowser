/**
 * DOM class hooks for build preview UI.
 * Styles live in src/styles/build-preview.css (uses tokens.css).
 */
export const BUILD_PREVIEW = {
  layer: "build-preview",
  range: "build-preview__range",
  rangeCell: "build-preview__range-cell",
  snap: "build-preview__snap",
  ghost: "build-preview__ghost",
  ghostFill: "build-preview__ghost-fill",
  ghostLabel: "build-preview__ghost-label",
  ghostHint: "build-preview__ghost-hint",
  hidden: "is-hidden",
  valid: "is-valid",
  invalid: "is-invalid",
  shake: "is-shake",
} as const;
