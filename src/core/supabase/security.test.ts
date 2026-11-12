import { createHmac } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  BillingBlockError,
  getBillingBlockReason,
} from '../deepseek/client';
import {
  getWorkspaceScope,
  stickyNotesStorageKey,
  workspaceCacheKey,
  workspaceDbName,
} from '../storage/scope';
import {
  computeEntitlement,
  decryptApiKey,
  encryptApiKey,
  handleApiRequest,
  isSameOriginRequest,
  verifyStripeSignature,
} from '../../../server/proxy.mjs';

function makeMockReq(
  method: string,
  url: string,
  headers: Record<string, string> = {},
  body = '',
): IncomingMessage {
  const emitter = new EventEmitter();
  const req = Object.assign(emitter, {
    method,
    url,
    headers: { host: 'localhost:4173', ...headers },
    socket: { remoteAddress: '127.0.0.1' },
    destroy: () => req,
  }) as unknown as IncomingMessage;

  queueMicrotask(() => {
    if (body) emitter.emit('data', Buffer.from(body, 'utf8'));
    emitter.emit('end');
  });
  return req;
}

function makeMockRes(): {
  res: ServerResponse;
  done: Promise<{ status: number; headers: Record<string, string>; body: string }>;
} {
  let status = 200;
  let headersSent = false;
  let writableEnded = false;
  const headers: Record<string, string> = {};
  const chunks: Buffer[] = [];
  let resolveDone!: (value: { status: number; headers: Record<string, string>; body: string }) => void;
  const done = new Promise<{ status: number; headers: Record<string, string>; body: string }>((resolve) => {
    resolveDone = resolve;
  });

  const mock = {
    get headersSent() {
      return headersSent;
    },
    get writableEnded() {
      return writableEnded;
    },
    writeHead(code: number, hdrs?: Record<string, string | number>) {
      status = code;
      headersSent = true;
      if (hdrs) {
        for (const [k, v] of Object.entries(hdrs)) {
          headers[k.toLowerCase()] = String(v);
        }
      }
      return mock;
    },
    setHeader(name: string, value: string | number) {
      headers[name.toLowerCase()] = String(value);
    },
    write(chunk: Buffer | string) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    },
    end(chunk?: Buffer | string) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      writableEnded = true;
      resolveDone({
        status,
        headers,
        body: Buffer.concat(chunks).toString('utf8'),
      });
    },
  };

  return { res: mock as unknown as ServerResponse, done };
}

describe('API key AES-256-GCM encryption', () => {
  const config = { encryptionSecret: 'test-encryption-secret-32-bytes-ok' };

  it('round-trips a DeepSeek API key and masks ciphertext format', () => {
    const encrypted = encryptApiKey('sk-test-secret-key-123456', config);
    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    expect(encrypted).not.toContain('sk-test-secret-key');
    expect(decryptApiKey(encrypted, config)).toBe('sk-test-secret-key-123456');
  });

  it('returns empty string when ciphertext auth tag or payload is tampered with', () => {
    const encrypted = encryptApiKey('sk-test-secret-key-123456', config);
    const parts = encrypted.split(':');
    const tagBuf = Buffer.from(parts[3], 'base64');
    tagBuf[0] ^= 0xff;
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${tagBuf.toString('base64')}:${parts[4]}`;
    expect(decryptApiKey(tampered, config)).toBe('');
  });

  it('supports legacy unencrypted plaintext rows when decrypting', () => {
    expect(decryptApiKey('sk-legacy-plaintext', config)).toBe('sk-legacy-plaintext');
  });
});

describe('computeEntitlement (7-day free trial & Stripe access)', () => {
  const dayMs = 86_400_000;

  it('grants access during active 7-day trial', () => {
    const future = new Date(Date.now() + 4 * dayMs).toISOString();
    const ent = computeEntitlement({
      isAdmin: false,
      profile: { tier: 'free', created_at: new Date().toISOString() },
      subscription: { tier: 'free', status: 'trialing', trial_ends_at: future },
    });
    expect(ent.hasAccess).toBe(true);
    expect(ent.trialExpired).toBe(false);
    expect(ent.trialDaysRemaining).toBeGreaterThanOrEqual(3);
  });

  it('blocks access once 7-day trial has expired without paid subscription', () => {
    const past = new Date(Date.now() - 2 * dayMs).toISOString();
    const ent = computeEntitlement({
      isAdmin: false,
      profile: { tier: 'free', created_at: past },
      subscription: { tier: 'free', status: 'trialing', trial_ends_at: past },
    });
    expect(ent.hasAccess).toBe(false);
    expect(ent.trialExpired).toBe(true);
    expect(ent.trialDaysRemaining).toBe(0);
  });

  it('grants access for active paid pro subscription even after trial window', () => {
    const past = new Date(Date.now() - 30 * dayMs).toISOString();
    const futurePeriod = new Date(Date.now() + 20 * dayMs).toISOString();
    const ent = computeEntitlement({
      isAdmin: false,
      profile: { tier: 'pro', created_at: past },
      subscription: {
        tier: 'pro',
        status: 'active',
        trial_ends_at: past,
        current_period_end: futurePeriod,
      },
    });
    expect(ent.hasAccess).toBe(true);
    expect(ent.trialExpired).toBe(false);
    expect(ent.tier).toBe('pro');
  });

  it('always grants access to admins regardless of trial state', () => {
    const past = new Date(Date.now() - 30 * dayMs).toISOString();
    const ent = computeEntitlement({
      isAdmin: true,
      profile: { tier: 'free', created_at: past },
      subscription: { tier: 'free', status: 'trialing', trial_ends_at: past },
    });
    expect(ent.hasAccess).toBe(true);
    expect(ent.trialExpired).toBe(false);
  });
});

describe('verifyStripeSignature', () => {
  const secret = 'whsec_test_secret_12345';
  const payload = Buffer.from(JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' }), 'utf8');

  it('accepts valid fresh HMAC-SHA256 Stripe signatures', () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac('sha256', secret).update(`${ts}.${payload.toString('utf8')}`).digest('hex');
    expect(verifyStripeSignature(payload, `t=${ts},v1=${sig}`, secret)).toBe(true);
  });

  it('rejects tampered signatures', () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(verifyStripeSignature(payload, `t=${ts},v1=${'0'.repeat(64)}`, secret)).toBe(false);
  });

  it('rejects stale timestamps outside 5 minute tolerance', () => {
    const ts = Math.floor(Date.now() / 1000) - 600;
    const sig = createHmac('sha256', secret).update(`${ts}.${payload.toString('utf8')}`).digest('hex');
    expect(verifyStripeSignature(payload, `t=${ts},v1=${sig}`, secret)).toBe(false);
  });
});

describe('isSameOriginRequest & handleApiRequest hardening', () => {
  it('allows same-origin requests and blocks cross-origin requests', () => {
    const sameOriginReq = makeMockReq('POST', '/api/deepseek/v1/chat/completions', {
      host: 'tabula.app',
      origin: 'https://tabula.app',
    });
    expect(isSameOriginRequest(sameOriginReq)).toBe(true);

    const crossOriginReq = makeMockReq('POST', '/api/deepseek/v1/chat/completions', {
      host: 'tabula.app',
      origin: 'https://evil.example',
    });
    expect(isSameOriginRequest(crossOriginReq)).toBe(false);
  });

  it('rejects cross-origin API requests with 403', async () => {
    const req = makeMockReq('POST', '/api/deepseek/v1/chat/completions', {
      host: 'localhost:4173',
      origin: 'https://attacker.example',
    });
    const { res, done } = makeMockRes();
    const handled = handleApiRequest(req, res, process.cwd());
    expect(handled).toBe(true);
    const result = await done;
    expect(result.status).toBe(403);
    expect(result.headers['cache-control']).toBe('no-store');
  });

  it('rejects unauthenticated DeepSeek requests even when x-tabula-demo: 1 header is sent', async () => {
    const req = makeMockReq(
      'POST',
      '/api/deepseek/v1/chat/completions',
      {
        host: 'localhost:4173',
        origin: 'http://localhost:4173',
        'x-tabula-demo': '1',
      },
      JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'user', content: 'hi' }] }),
    );
    const { res, done } = makeMockRes();
    const handled = handleApiRequest(req, res, process.cwd());
    expect(handled).toBe(true);
    const result = await done;
    expect(result.status).toBe(401);
  });

  it('blocks non-allowlisted DeepSeek methods and paths', async () => {
    const getReq = makeMockReq('GET', '/api/deepseek/user/balance', {
      host: 'localhost:4173',
      origin: 'http://localhost:4173',
    });
    const getMock = makeMockRes();
    expect(handleApiRequest(getReq, getMock.res, process.cwd())).toBe(true);
    const getRes = await getMock.done;
    expect(getRes.status).toBe(405);

    const postBadPathReq = makeMockReq('POST', '/api/deepseek/user/balance', {
      host: 'localhost:4173',
      origin: 'http://localhost:4173',
    });
    const postMock = makeMockRes();
    expect(handleApiRequest(postBadPathReq, postMock.res, process.cwd())).toBe(true);
    const postRes = await postMock.done;
    expect(postRes.status).toBe(404);
  });
});

describe('Per-account workspace storage isolation', () => {
  it('assigns distinct IndexedDB, workspaceCache, and sticky note keys per user account', () => {
    const adminScope = getWorkspaceScope('admin-user-uuid-111');
    const memberScope = getWorkspaceScope('member-user-uuid-222');

    expect(adminScope).toBeTruthy();
    expect(memberScope).toBeTruthy();
    expect(adminScope).not.toBe(memberScope);

    expect(workspaceDbName(adminScope!)).not.toBe(workspaceDbName(memberScope!));
    expect(workspaceCacheKey(adminScope!)).not.toBe(workspaceCacheKey(memberScope!));
    expect(stickyNotesStorageKey(adminScope)).not.toBe(stickyNotesStorageKey(memberScope));
  });
});

describe('Billing block error detection', () => {
  it('recognizes direct BillingBlockError and wrapped AI SDK quota errors', () => {
    expect(getBillingBlockReason(new BillingBlockError('quota-exceeded', 'Out of tokens'))).toBe(
      'quota-exceeded',
    );
    expect(
      getBillingBlockReason({
        lastError: {
          responseBody: JSON.stringify({ code: 'QUOTA_EXCEEDED' }),
        },
      }),
    ).toBe('quota-exceeded');
    expect(
      getBillingBlockReason({
        cause: new BillingBlockError('trial-expired', 'Trial ended'),
      }),
    ).toBe('trial-expired');
    expect(getBillingBlockReason(new Error('Network timeout'))).toBeNull();
  });
});
