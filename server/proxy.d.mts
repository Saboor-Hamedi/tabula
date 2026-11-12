import type { IncomingMessage, ServerResponse } from 'node:http'

export function ensureServerEnv(rootDir?: string): void
export function applySecurityHeaders(request: IncomingMessage, response: ServerResponse): void
export function handleApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  rootDir?: string,
): boolean

export function encryptApiKey(plaintext: string, config: { encryptionSecret: string }): string
export function decryptApiKey(stored: string, config: { encryptionSecret: string }): string
export function computeEntitlement(input: {
  isAdmin: boolean
  profile: { tier?: string | null; created_at?: string | null } | null
  subscription: {
    tier?: string | null
    status?: string | null
    trial_ends_at?: string | null
    current_period_end?: string | null
    cancel_at_period_end?: boolean | null
    stripe_customer_id?: string | null
  } | null
}): {
  tier: string
  status: string
  hasAccess: boolean
  trialEndsAt: string | null
  trialDaysRemaining: number | null
  trialExpired: boolean
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  stripeCustomerId: string | null
}
export function verifyStripeSignature(
  rawBody: Buffer,
  sigHeader: string | string[] | undefined,
  secret: string,
): boolean
export function isSameOriginRequest(request: IncomingMessage): boolean
