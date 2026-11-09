'use strict';

const { randomBytes } = require('crypto');

const ACCESS_COOKIE = 'figure_it_out_access';
const REFRESH_COOKIE = 'figure_it_out_refresh';
const REFRESH_MAX_AGE = 60 * 24 * 60 * 60 * 1000;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publicKey || !secretKey) return null;

  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return null;
    return { url: parsedUrl.origin, publicKey, secretKey };
  } catch {
    return null;
  }
}

function getRuntimeConfig() {
  return getSupabaseConfig();
}

function newSchoolCode() {
  return randomBytes(5).toString('hex').slice(0, 8).toUpperCase();
}

function getAppUrl() {
  const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  const parsedUrl = new URL(appUrl);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('APP_URL must use HTTP or HTTPS.');
  }
  return parsedUrl.origin;
}

function saveSession(res, req, session) {
  const accessMaxAge = Math.max(60, Number(session.expires_in) || 3600) * 1000;
  res.cookie(ACCESS_COOKIE, session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || req.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: accessMaxAge
  });
  res.cookie(REFRESH_COOKIE, session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || req.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_MAX_AGE
  });
}

function clearSession(res, req) {
  res.clearCookie(ACCESS_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || req.secure,
    sameSite: 'lax',
    path: '/'
  });
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || req.secure,
    sameSite: 'lax',
    path: '/'
  });
}

function readCookie(req, name) {
  return req.cookies?.[name] || '';
}

async function authRequest(config, pathname, { method = 'GET', body, token } = {}) {
  if (!config?.url || !config.publicKey) {
    throw new Error('Account service is not configured. Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY.');
  }

  try {
    const response = await fetch(new URL(pathname, `${config.url}/`), {
      method,
      headers: {
        apikey: config.publicKey,
        ...(token ? { Authorization: 'Bear' + 'er ' + token } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } catch (error) {
    console.error('Supabase auth request failed:', error);
    throw new Error('Could not reach the account service. Check the Supabase URL and server network connection.');
  }
}

async function databaseRequest(config, pathname, { method = 'GET', body, prefer } = {}) {
  if (!config?.url || !config.secretKey) {
    throw new Error('School database is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.');
  }

  try {
    const response = await fetch(new URL(`/rest/v1/${pathname}`, `${config.url}/`), {
      method,
      headers: {
        apikey: config.secretKey,
        Authorization: 'Bear' + 'er ' + config.secretKey,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(prefer ? { Prefer: prefer } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000)
    });
    const data = response.status === 204 ? null : await response.json().catch(() => ({}));
    return { response, data };
  } catch (error) {
    console.error('Supabase database request failed:', error);
    throw new Error('Could not reach the school database. Check the Supabase URL and server network connection.');
  }
}

function databaseError(data) {
  return data?.message || data?.hint || data?.details || 'The school database could not complete the request.';
}

function validEmail(email) {
  if (typeof email !== 'string' || email.length > 254) return false;
  const [local, domain, ...extra] = email.trim().split('@');
  return extra.length === 0
    && Boolean(local && domain)
    && local.length <= 64
    && !local.startsWith('.')
    && !local.endsWith('.')
    && !local.includes('..')
    && /^[a-z\d.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)
    && /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)+$/i.test(domain);
}

function userFromProfile(profile) {
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    name: profile.full_name,
    school: profile.school_name,
    schoolId: profile.school_id,
    schoolCode: profile.school_code,
    stream: profile.stream,
    className: profile.class_name
  };
}

async function findProfile(config, userId) {
  const query = new URLSearchParams({
    select: 'id,email,role,full_name,school_id,stream,class_name,schools(name,join_code)',
    id: `eq.${userId}`,
    limit: '1'
  });
  const { response, data } = await databaseRequest(config, `profiles?${query}`);
  if (!response.ok) throw new Error(databaseError(data));
  if (!Array.isArray(data) || !data[0]) return null;
  const profile = data[0];
  return {
    ...profile,
    school_name: profile.schools?.name || '',
    school_code: profile.schools?.join_code || ''
  };
}

async function requireUser(req, res, next) {
  const config = getRuntimeConfig();
  const accessToken = readCookie(req, ACCESS_COOKIE);

  if (!accessToken) {
    return res.status(401).json({ success: false, error: 'Please sign in to continue.' });
  }

  try {
    const { response, data } = await authRequest(config, '/auth/v1/user', { token: accessToken });
    if (!response.ok || !data.id) {
      return res.status(401).json({ success: false, error: 'Your session expired. Please sign in again.' });
    }

    const profile = await findProfile(config, data.id);
    if (!profile) {
      return res.status(403).json({
        success: false,
        error: 'Your school profile is incomplete. Sign out and contact your school administrator.'
      });
    }

    req.platformUser = userFromProfile(profile);
    req.supabaseConfig = config;
    return next();
  } catch (error) {
    console.error('Could not verify platform account:', error);
    return res.status(502).json({ success: false, error: 'Could not verify your account. Please try again.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.platformUser?.role !== role) {
      return res.status(403).json({ success: false, error: `A ${role} account is required.` });
    }
    return next();
  };
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  authRequest,
  clearSession,
  databaseError,
  databaseRequest,
  findProfile,
  getAppUrl,
  getRuntimeConfig,
  getSupabaseConfig,
  newSchoolCode,
  readCookie,
  requireRole,
  requireUser,
  saveSession,
  userFromProfile,
  validEmail
};
