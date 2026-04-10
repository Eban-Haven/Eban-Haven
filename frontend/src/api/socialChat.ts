import { apiFetch, parseJson } from './client'

export type SocialChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type SocialChatSuggestion = {
  title: string
  platform: string
  contentType: string
  format: string
  imageIdea: string
  caption: string
  hashtags: string[]
  cta: string
  bestTime: string
  whyItFits: string
  notes: string
}

export type RecommendationItem = {
  recommendation: string
  rationale: string
}

export type ConfidenceNote = {
  label: string
  detail: string
}

export type SocialChatStructuredReply = {
  clarifyingQuestions: string[]
  planningSummary: string
  postIdeas: SocialChatSuggestion[]
  captions: string[]
  timingRecommendations: RecommendationItem[]
  ctaRecommendations: RecommendationItem[]
  confidenceNotes: ConfidenceNote[]
  reasoning: string[]
}

export type SocialChatContextSnapshot = {
  websiteSummary: string
  brandGuidelines: {
    voice: string
    toneDos: string[]
    toneDonts: string[]
    safetyRules: string[]
  }
  recentSocialMetrics: {
    evidenceStrength: string
    highlights: string[]
    gaps: string[]
  }
  causalInsights: {
    evidenceStrength: string
    insights: string[]
    hypotheses: string[]
  }
  postStrategyInsights: {
    evidenceStrength: string
    validatedFindings: string[]
    directionalFindings: string[]
    tacticalInsights: { key: string; title: string; value: string; detail: string }[]
    recommendedHashtags: string[]
    recommendations: { title: string; detail: string }[]
    dataGaps: string[]
  }
}

export type SocialChatResponse = {
  message: string
  structured: SocialChatStructuredReply
  context: SocialChatContextSnapshot
  model: string
  generatedAtUtc: string
}

export async function sendSocialChat(messages: SocialChatMessage[], signal?: AbortSignal): Promise<SocialChatResponse> {
  return parseJson<SocialChatResponse>(
    await apiFetch('/api/social-chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
      signal,
    }),
  )
}
