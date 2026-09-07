import crypto from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

export const AUTH_COOKIE_NAME = 'ag_auth';

export function getExpectedToken(): string {
  return process.env.AUTH_TOKEN || process.env.DEV_AUTH_TOKEN || 'antigravity-dev-token';
}

export function isAuthDisabled(): boolean {
  if (process.env.AUTH_DISABLED === 'true') {
    return true;
  }
  // In test environment, enforce auth verification so security tests run
  if (process.env.NODE_ENV === 'test') {
    return false;
  }
  // If neither AUTH_TOKEN nor DEV_AUTH_TOKEN is defined in production,
  // authentication is handled at the network edge / Cloudflare Access
  return !process.env.AUTH_TOKEN && !process.env.DEV_AUTH_TOKEN;
}

/**
 * Constant-time comparison between two strings.
 * Prevents timing side-channel attacks by comparing byte buffers with crypto.timingSafeEqual.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');

  if (bufA.length !== bufB.length) {
    // Perform a dummy timingSafeEqual to minimize execution time divergence
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validates a provided token against the configured secret.
 */
export function validateToken(token?: string | null): boolean {
  if (isAuthDisabled()) {
    return true;
  }

  if (!token || typeof token !== 'string') {
    return false;
  }

  const expected = getExpectedToken();
  return timingSafeEqualStrings(token.trim(), expected.trim());
}

/**
 * Extracts the auth token from cookies, headers, or query string (for SSE).
 */
export function extractToken(request: FastifyRequest): string | null {
  // 0. Cloudflare Access authenticated header: if request passed Cloudflare Access
  if (
    request.headers['cf-access-authenticated-user-email'] ||
    request.headers['cf-access-jwt-assertion']
  ) {
    return getExpectedToken();
  }

  // 1. Authorization header: Bearer <token>
  const authHeader = request.headers.authorization;
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }
    return authHeader.trim();
  }

  // 2. Custom header x-auth-token
  const customHeader = request.headers['x-auth-token'];
  if (typeof customHeader === 'string' && customHeader.length > 0) {
    return customHeader.trim();
  }

  // 3. HttpOnly cookie: ag_auth
  const cookieToken = request.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken) {
    return cookieToken.trim();
  }

  // 4. Query param token (crucial for SSE EventSource which does not support custom headers)
  const query = request.query as Record<string, unknown> | undefined;
  if (query && typeof query.token === 'string') {
    return query.token.trim();
  }

  return null;
}

/**
 * Fastify preHandler hook to guard API routes.
 */
export async function authGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const rawUrl = request.url.split('?')[0];
  const url = rawUrl.replace(/^\/agy/, '');

  // Whitelist public endpoints
  if (
    url === '/health' ||
    url === '/api/auth/login' ||
    !url.startsWith('/api/')
  ) {
    return;
  }

  const token = extractToken(request);
  if (!validateToken(token)) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication credentials',
    });
  }
}

/**
 * Attaches the HttpOnly auth cookie to the response.
 */
export function setAuthCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(AUTH_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // Prevents cookie drop behind reverse proxies like Coolify/Traefik
    maxAge: 60 * 60 * 24 * 30, // 30 days in seconds
  });
}

/**
 * Clears the auth cookie.
 */
export function clearAuthCookie(reply: FastifyReply): void {
  reply.clearCookie(AUTH_COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });
}
