import { describe, expect, it } from 'vitest'

function computeVerificationStatus(user: { email?: string; email_confirmed_at?: string | null } | null) {
  const isVerified = Boolean(user && (!user.email || user.email_confirmed_at))
  const needsVerification = Boolean(user && user.email && !user.email_confirmed_at)
  return { isVerified, needsVerification }
}

describe('Auth Verification Logic (Prompt 4.2 & 4.9)', () => {
  it('identifies unconfirmed users as needing verification', () => {
    const unconfirmedUser = {
      email: 'alex@company.com',
      email_confirmed_at: null,
    }
    const status = computeVerificationStatus(unconfirmedUser)
    expect(status.needsVerification).toBe(true)
    expect(status.isVerified).toBe(false)
  })

  it('identifies confirmed users as verified', () => {
    const confirmedUser = {
      email: 'alex@company.com',
      email_confirmed_at: '2026-11-10T10:00:00Z',
    }
    const status = computeVerificationStatus(confirmedUser)
    expect(status.needsVerification).toBe(false)
    expect(status.isVerified).toBe(true)
  })

  it('handles null user safely', () => {
    const status = computeVerificationStatus(null)
    expect(status.needsVerification).toBe(false)
    expect(status.isVerified).toBe(false)
  })

  it('handles anonymous or OAuth users without email as verified', () => {
    const anonUser = {
      email_confirmed_at: null,
    }
    const status = computeVerificationStatus(anonUser)
    expect(status.needsVerification).toBe(false)
    expect(status.isVerified).toBe(true)
  })
})
