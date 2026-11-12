import { supabaseAnonKey, supabaseUrl } from '../../core/supabase/client'

/**
 * Which sign-in methods the project actually offers.
 *
 * GoTrue knows which providers are enabled; the browser does not, until it
 * asks. A button that cannot work should not be offered, so the auth screen
 * reads this first and hides the rest.
 */

export type OAuthProvider = 'google' | 'github'

export interface ProviderAvailability {
  google: boolean
  github: boolean
  email: boolean
}

const PROVIDERS: OAuthProvider[] = ['google', 'github']

/** The names shown on the buttons. */
export const PROVIDER_LABEL: Record<OAuthProvider, string> = {
  google: 'Google',
  github: 'GitHub',
}

const UNAVAILABLE: ProviderAvailability = { google: false, github: false, email: true }

/**
 * Reads the enabled providers from the project's public settings endpoint.
 *
 * A failure is not fatal: the buttons stay visible and the sign-in attempt
 * reports the real reason.
 */
export async function fetchProviderAvailability(): Promise<ProviderAvailability> {
  if (!supabaseUrl || !supabaseAnonKey) return UNAVAILABLE

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
    })
    if (!response.ok) return UNAVAILABLE

    const settings = (await response.json()) as {
      external?: Partial<Record<string, boolean>>
    }
    const external = settings.external ?? {}

    return {
      google: Boolean(external.google),
      github: Boolean(external.github),
      email: external.email !== false,
    }
  } catch {
    return UNAVAILABLE
  }
}

/** True when at least one social provider is enabled. */
export function hasSocialProvider(availability: ProviderAvailability): boolean {
  return PROVIDERS.some((provider) => availability[provider])
}

/**
 * Turns a provider error into something a person can act on.
 *
 * GoTrue answers "Unsupported provider: provider is not enabled" with a raw
 * JSON body. That is a configuration problem, not a user error, and it should
 * read like one.
 */
export function describeAuthError(error: unknown, provider?: OAuthProvider): string {
  const message = error instanceof Error ? error.message : String(error ?? '')

  if (/not enabled|unsupported provider/i.test(message)) {
    const name = provider ? PROVIDER_LABEL[provider] : 'This provider'
    return `${name} sign-in is not enabled for this project. An administrator has to turn it on in Supabase → Authentication → Providers.`
  }

  if (/invalid login credentials/i.test(message)) {
    return 'That e-mail and password do not match an account.'
  }

  if (/email not confirmed|not confirmed/i.test(message)) {
    return 'Confirm your e-mail address first — check your inbox for the link.'
  }

  if (/user already registered|already been registered/i.test(message)) {
    return 'An account already exists for that e-mail. Sign in instead.'
  }

  if (/rate limit|too many/i.test(message)) {
    return 'Too many attempts. Wait a moment and try again.'
  }

  if (/redirect/i.test(message) && /not allowed|invalid/i.test(message)) {
    return 'That sign-in address is not in the list of allowed redirect URLs.'
  }

  return message || 'Authentication failed.'
}
