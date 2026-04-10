/**
 * Semantic colors aligned with RiskBadge chips on the residents directory
 * (`AdminBadges.tsx` — Low / Medium / High risk pills).
 * Use these anywhere we want the same red–amber–green language as the resident table.
 */
export const RESIDENT_SEMANTIC = {
  neutral: {
    chip: 'border-[#D1D5DB] bg-[#F3F4F6] text-[#4B5563]',
  },
  success: {
    chip: 'border-[#B7E4C7] bg-[#E8F7EE] text-[#166534]',
    text: 'text-[#166534]',
    textBold: 'text-[#14532d]',
    border: 'border-[#B7E4C7]',
    bg: 'bg-[#E8F7EE]',
    bgSoft: 'bg-[#E8F7EE]/50',
    bgSoftHover: 'bg-[#E8F7EE]/70',
    listRow: 'border-[#B7E4C7] bg-[#E8F7EE]/40 hover:bg-[#E8F7EE]/70',
    dot: 'bg-[#166534]',
    /** Softer fill for stacked / wide bars (cohort bar, etc.) — not the dark chip text color. */
    bar: 'bg-[#7aab8c]',
  },
  warning: {
    chip: 'border-[#F3D19C] bg-[#FFF4E5] text-[#9A5B00]',
    text: 'text-[#9A5B00]',
    textBold: 'text-[#7c4700]',
    border: 'border-[#F3D19C]',
    bg: 'bg-[#FFF4E5]',
    bgSoft: 'bg-[#FFF4E5]/50',
    bgSoftHover: 'bg-[#FFF4E5]/80',
    listRow: 'border-[#F3D19C] bg-[#FFF4E5]/50 hover:bg-[#FFF4E5]/80',
    dot: 'bg-[#9A5B00]',
    /** Clear gold-amber for bar segments — avoids muddy brown while staying soft. */
    bar: 'bg-[#e4c65d]',
  },
  danger: {
    chip: 'border-[#F5B5B2] bg-[#FDECEC] text-[#B42318]',
    text: 'text-[#B42318]',
    textBold: 'text-[#991b1b]',
    border: 'border-[#F5B5B2]',
    bg: 'bg-[#FDECEC]',
    bgSoft: 'bg-[#FDECEC]/50',
    bgSoftHover: 'bg-[#FDECEC]/80',
    /** Full class string for selectable list rows (Tailwind JIT sees complete literals). */
    listRow: 'border-[#F5B5B2] bg-[#FDECEC]/50 hover:bg-[#FDECEC]/80',
    dot: 'bg-[#B42318]',
    /** Dusty rose-red for wide fills — less harsh than the danger text hex. */
    bar: 'bg-[#d67b73]',
    outlineButton: 'rounded-lg border border-[#F5B5B2] px-3 py-2 text-sm font-medium text-[#B42318] hover:bg-[#FDECEC]/80',
    outlineButtonWide: 'rounded-lg border border-[#F5B5B2] px-4 py-2 text-sm font-medium text-[#B42318] hover:bg-[#FDECEC]/80',
  },
} as const

export type ResidentSemanticKey = keyof typeof RESIDENT_SEMANTIC

/**
 * Resident Goals tab — donut-inspired accents (teal, navy, ochre, peach). No white strokes on rings.
 * Aligns with goal summary cards and wellbeing chart series.
 */
export const RESIDENT_GOAL_RING: Record<'health' | 'education' | 'safety', string> = {
  health: 'stroke-[#1a5f5c] dark:stroke-[#3dafa2]',
  education: 'stroke-[#243d52] dark:stroke-[#6b94a8]',
  safety: 'stroke-[#c9a227] dark:stroke-[#e3bc2a]',
}

export const RESIDENT_GOAL_SECTION = {
  wellbeing: 'text-[#1a5f5c] dark:text-[#5fd4c4]',
  recapTitle: 'text-[#243d52] dark:text-[#8ab4c8]',
  recapDate: 'text-[#1a6b7a] dark:text-[#5fd4c4]',
  dental: 'text-[#1a5f5c] dark:text-[#5fd4c4]',
  medical: 'text-[#243d52] dark:text-[#8ab4c8]',
  psychological: 'text-[#b8860b] dark:text-[#e3bc2a]',
} as const
