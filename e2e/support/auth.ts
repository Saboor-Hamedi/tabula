import type { Page } from '@playwright/test'

/**
 * Hermetic auth for e2e.
 *
 * The workspace sits behind Supabase auth, and uploads are quota-gated on the
 * usage status. Tests seed a fake future-dated session into localStorage and
 * fulfill every Supabase / usage request locally, so the suite runs fully
 * offline and never touches a real project.
 */

export const FAKE_USER = {
  id: 'e2e00000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'e2e@lumina.test',
  email_confirmed_at: '2026-11-01T00:00:00.000Z',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-11-01T00:00:00.000Z',
}

export const FAKE_SESSION = {
  access_token: 'e2e-access-token',
  refresh_token: 'e2e-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.parse('2035-01-01T00:00:00.000Z') / 1000),
  user: FAKE_USER,
}

export const FAKE_USAGE = {
  tier: 'free',
  status: 'trialing',
  isAdmin: false,
  hasAccess: true,
  trialEndsAt: '2035-01-01T00:00:00.000Z',
  trialDaysRemaining: 3650,
  trialExpired: false,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  usedTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  queryCount: 0,
  monthlyLimit: 250000,
  remainingTokens: 250000,
  periodStart: '2026-11-01T00:00:00.000Z',
  stripeConfigured: false,
}

export const FAKE_USAGE_ADMIN = {
  ...FAKE_USAGE,
  isAdmin: true,
  tier: 'pro' as const,
  status: 'active',
  monthlyLimit: null,
  remainingTokens: null,
  usedTokens: 0,
}

const FAKE_PROFILE_ADMIN = {
  id: FAKE_USER.id,
  email: FAKE_USER.email,
  role: 'admin',
  tier: 'pro',
  display_name: 'E2E Admin',
  avatar_url: null,
  created_at: '2026-11-01T00:00:00.000Z',
}

export interface HermeticAuthOptions {
  /** Canned usage payload; defaults to an in-trial free user with access. */
  usage?: typeof FAKE_USAGE
  /** Canned profile row when fetchProfile runs; defaults to a member profile. */
  profile?: Record<string, unknown>
}

/** Seeds the fake session and intercepts every network call the auth layer makes. */
export async function installHermeticAuth(
  page: Page,
  options: HermeticAuthOptions = {},
): Promise<void> {
  const usage = options.usage ?? FAKE_USAGE
  const profile = options.profile ?? { ...FAKE_PROFILE_ADMIN, role: 'member', tier: 'free', display_name: 'E2E User' }

  await page.route('**/api/usage', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(usage),
    }),
  )
  await page.route('**supabase.co/**', (route) => {
    const url = route.request().url()
    if (url.includes('/rest/v1/profiles')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profile),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    })
  })
  await page.addInitScript((session) => {
    window.localStorage.setItem('sb-dummy-auth-token', JSON.stringify(session))
  }, FAKE_SESSION)
}

export async function installAdminAuth(page: Page): Promise<void> {
  return installHermeticAuth(page, { usage: FAKE_USAGE_ADMIN, profile: FAKE_PROFILE_ADMIN })
}

export async function openWorkspace(page: Page): Promise<void> {
  await installHermeticAuth(page)
  await page.goto('/workspace')
}

export function sseChunk(delta: Record<string, unknown>, finishReason: string | null = null): string {
  return `data: ${JSON.stringify({
    id: 'chatcmpl-e2e',
    object: 'chat.completion.chunk',
    created: 1730000000,
    model: 'deepseek-v4-flash',
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })}\n\n`
}

/** Fulfills the managed proxy's DeepSeek endpoint with a canned one-shot answer. */
export async function installMockModel(page: Page, answer: string): Promise<void> {
  const stream =
    sseChunk({ role: 'assistant', content: '' }) +
    sseChunk({ content: answer }) +
    sseChunk({}, 'stop') +
    'data: [DONE]\n\n'

  await page.route('**supabase.co/functions/v1/deepseek-proxy/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: { 'cache-control': 'no-store' },
      body: stream,
    }),
  )
}
