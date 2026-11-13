/**
 * The words the auth screens use.
 *
 * One place, so the screens never drift apart.
 */
export const AUTH_COPY = {
  signIn: {
    title: 'Sign in to Lumina Tabula',
    subtitle: 'Enter your credentials to reach your workspace.',
    submit: 'Sign in',
  },
  signUp: {
    title: 'Create your account',
    subtitle: 'Free forever. Your files are never uploaded.',
    submit: 'Create account',
  },
  verify: {
    title: 'Check your inbox',
    subtitle: 'We sent a confirmation link to your email address.',
    submit: 'I have verified — continue',
  },
  forbidden: {
    title: 'Administrators only',
    subtitle: 'This section is reserved for administrators of the account.',
  },
  offline: {
    title: 'Running without an account',
    subtitle:
      'No project is configured, so Lumina Tabula runs entirely on this device. Nothing is uploaded and nothing is shared.',
  },
} as const
