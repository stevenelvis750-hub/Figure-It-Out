'use strict';

const express = require('express');
const {
  authRequest,
  clearSession,
  databaseError,
  databaseRequest,
  findProfile,
  getAppUrl,
  getRuntimeConfig,
  newSchoolCode,
  readCookie,
  REFRESH_COOKIE,
  saveSession,
  userFromProfile,
  validEmail
} = require('../services/platformStore');

const router = express.Router();
const PROFILE_FIELDS = 'id,email,role,full_name,school_id,stream,class_name,schools(name,join_code)';

function providerMessage(data, fallback) {
  const message = data?.msg || data?.message || data?.error_description || data?.error || '';
  if (/user already registered|email.*already.*(registered|exists)/i.test(message)) {
    return 'An account already uses this email. Sign in, or use password recovery.';
  }
  if (/invalid login credentials|invalid_credentials/i.test(`${message} ${data?.code || ''}`)) {
    return 'The email or password is incorrect.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Confirm your email using the link we sent before signing in.';
  }
  if (/email rate limit exceeded|rate limit/i.test(message)) {
    return 'Too many email requests were made. Please wait a few minutes and try again.';
  }
  return message || fallback;
}

function getProfileFromMetadata(user) {
  const metadata = user?.user_metadata || {};
  return {
    role: metadata.account_type || metadata.role,
    fullName: metadata.full_name || metadata.fullName,
    schoolName: metadata.school_name || metadata.schoolName,
    schoolCode: metadata.school_code || metadata.schoolCode,
    stream: metadata.stream,
    className: metadata.class_name || metadata.className
  };
}

function emailIsConfirmed(user) {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at);
}

async function lookupSchool(config, code) {
  const query = new URLSearchParams({
    select: 'id,name,join_code',
    join_code: `eq.${code.toUpperCase()}`,
    limit: '1'
  });
  const { response, data } = await databaseRequest(config, `schools?${query}`);
  if (!response.ok) throw new Error(databaseError(data));
  return data[0] || null;
}

async function provisionProfile(config, user, profileData) {
  const role = profileData.role ?? profileData.account_type;
  const fullName = profileData.fullName ?? profileData.full_name;
  const schoolName = profileData.schoolName ?? profileData.school_name;
  const schoolCode = profileData.schoolCode ?? profileData.school_code;
  const stream = profileData.stream;
  const className = profileData.className ?? profileData.class_name;

  if (!['student', 'teacher', 'independent'].includes(role) || !fullName || !user?.id || !user?.email) {
    throw new Error('Account details are incomplete. Register again or contact support.');
  }
  if (role === 'student' && (!stream || !className)) {
    throw new Error('Students need a stream and class to join their school.');
  }

  let school = null;
  if (role !== 'independent') {
    if (schoolCode) {
      school = await lookupSchool(config, schoolCode);
      if (!school) throw new Error('That school code was not found. Check the code with your teacher.');
    } else if (role === 'teacher' && typeof schoolName === 'string' && schoolName.trim().length >= 2) {
      const existingQuery = new URLSearchParams({
        select: 'id,name,join_code',
        created_by: `eq.${user.id}`,
        limit: '1'
      });
      const existing = await databaseRequest(config, `schools?${existingQuery}`);
      if (!existing.response.ok) throw new Error(databaseError(existing.data));
      school = existing.data[0] || null;

      for (let attempt = 0; !school && attempt < 3; attempt += 1) {
        const { response, data } = await databaseRequest(
          config,
          'schools',
          {
            method: 'POST',
            prefer: 'return=representation',
            body: {
              name: schoolName.trim(),
              join_code: newSchoolCode(),
              created_by: user.id
            }
          }
        );
        if (response.ok && Array.isArray(data) && data[0]) {
          school = data[0];
        } else if (attempt === 2) {
          throw new Error(databaseError(data));
        }
      }
    }

    if (!school) {
      throw new Error(role === 'student'
        ? 'Enter a valid school code from your teacher.'
        : 'Enter your school name or the code for your existing school.');
    }
  }

  const profile = {
    id: user.id,
    email: user.email,
    role,
    full_name: fullName.trim(),
    school_id: school?.id || null,
    stream: role === 'student' ? String(stream || '').trim() : null,
    class_name: role === 'student' ? String(className || '').trim() : null
  };
  const query = new URLSearchParams({ on_conflict: 'id' });
  const { response, data } = await databaseRequest(
    config,
    `profiles?${query}`,
    {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: profile
    }
  );
  if (!response.ok) throw new Error(databaseError(data));
  const hydrated = {
    ...profile,
    school_name: school?.name || '',
    school_code: school?.join_code || ''
  };
  return userFromProfile(hydrated);
}

async function getAccount(config, authUser) {
  let profile = await findProfile(config, authUser.id);
  if (!profile) {
    return provisionProfile(config, authUser, getProfileFromMetadata(authUser));
  }
  return userFromProfile(profile);
}

function configurationError(res) {
  return res.status(503).json({
    success: false,
    error: 'Account service is not configured. Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY.'
  });
}

router.get('/session', async (req, res) => {
  const config = getRuntimeConfig();

  const accessToken = readCookie(req, 'figure_it_out_access');
  const refreshToken = readCookie(req, REFRESH_COOKIE);
  if (!accessToken && !refreshToken) {
    return res.json({ success: true, authenticated: false });
  }

  try {
    let authUser;
    let currentSession;
    if (accessToken) {
      const result = await authRequest(config, '/auth/v1/user', { token: accessToken });
      if (result.response.ok) {
        authUser = result.data;
      } else if (result.response.status >= 500) {
        return res.status(502).json({
          success: false,
          error: 'Could not verify your session. Please try again.'
        });
      }
    }
    if (!authUser && refreshToken) {
      const result = await authRequest(config, '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: { refresh_token: refreshToken }
      });
      if (!result.response.ok || !result.data.access_token || !result.data.refresh_token) {
        clearSession(res, req);
        return res.json({ success: true, authenticated: false });
      }
      authUser = result.data.user;
      currentSession = result.data;
    }
    if (!authUser) {
      clearSession(res, req);
      return res.json({ success: true, authenticated: false });
    }
    if (!emailIsConfirmed(authUser)) {
      clearSession(res, req);
      return res.status(403).json({
        success: false,
        error: 'Confirm your email using the verification link before signing in.'
      });
    }

    const user = await getAccount(config, authUser);
    if (currentSession) saveSession(res, req, currentSession);
    return res.json({ success: true, authenticated: true, user });
  } catch (error) {
    console.error('Could not load the signed-in profile:', error);
    return res.status(503).json({
      success: false,
      error: `Could not load your school profile. ${error.message}`
    });
  }
});

router.post('/signup', async (req, res) => {
  const config = getRuntimeConfig();

  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const role = req.body?.role;
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
  const schoolName = typeof req.body?.schoolName === 'string' ? req.body.schoolName.trim() : '';
  const schoolCode = typeof req.body?.schoolCode === 'string'
    ? req.body.schoolCode.trim().toUpperCase()
    : '';
  const stream = typeof req.body?.stream === 'string' ? req.body.stream.trim() : '';
  const className = typeof req.body?.className === 'string' ? req.body.className.trim() : '';

  if (!['student', 'teacher', 'independent'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Choose a school role or independent account.' });
  }
  if (!validEmail(email)) {
    return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({
      success: false,
      error: 'Choose a password with at least 8 characters.'
    });
  }
  if (password.toLowerCase() === fullName.toLowerCase()) {
    return res.status(400).json({
      success: false,
      error: 'For safety, use a password different from your name.'
    });
  }
  if (fullName.length < 2 || fullName.length > 80) {
    return res.status(400).json({ success: false, error: 'Enter your full name (2–80 characters).' });
  }
  if (role === 'student' && (!/^[A-Z0-9]{8}$/.test(schoolCode) || !stream || !className)) {
    return res.status(400).json({
      success: false,
      error: 'Students need a school code, stream, and class to join.'
    });
  }
  if (role === 'teacher' && (!schoolCode && (schoolName.length < 2 || schoolName.length > 160))) {
    return res.status(400).json({
      success: false,
      error: 'Enter your school name, or enter a school code to join an existing school.'
    });
  }
  if (role === 'teacher' && schoolCode && !/^[A-Z0-9]{8}$/.test(schoolCode)) {
    return res.status(400).json({ success: false, error: 'School codes must contain 8 letters or numbers.' });
  }
  if (stream.length > 80 || className.length > 80) {
    return res.status(400).json({ success: false, error: 'Stream and class names must be 80 characters or fewer.' });
  }

  if (schoolCode) {
    try {
      const school = await lookupSchool(config, schoolCode);
      if (!school) {
        return res.status(400).json({ success: false, error: 'That school code was not found. Check it with your teacher.' });
      }
    } catch (error) {
      console.error('School code validation failed:', error);
      return res.status(503).json({ success: false, error: 'Could not verify the school code. Please try again.' });
    }
  }
  const metadata = {
    full_name: fullName,
    account_type: role,
    school_name: schoolName,
    school_code: schoolCode,
    stream,
    class_name: className
  };

  try {
    const redirectTo = `${getAppUrl()}/`;
    const { response, data } = await authRequest(
      config,
      `/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`,
      { method: 'POST', body: { email, password, data: metadata } }
    );
    if (!response.ok || !data.user?.id || data.user.identities?.length === 0) {
      return res.status(response.status < 500 ? response.status : 502).json({
        success: false,
        error: providerMessage(data, 'Your account could not be created.')
      });
    }

    const authenticated = Boolean(data.access_token && data.refresh_token);
    if (authenticated && !emailIsConfirmed(data.user)) {
      return res.status(403).json({
        success: false,
        error: 'Confirm your email using the verification link before signing in.'
      });
    }
    const user = authenticated ? await provisionProfile(config, data.user, metadata) : null;
    if (authenticated) saveSession(res, req, data);
    return res.status(201).json({
      success: true,
      authenticated,
      confirmationRequired: !authenticated,
      user: authenticated ? user : undefined,
      message: authenticated
        ? `Welcome, ${user.name}! Your account is ready.`
        : 'Your account is ready. Confirm your email from the link we sent, then sign in.'
    });
  } catch (error) {
    console.error('Account registration failed:', error);
    return res.status(503).json({
      success: false,
      error: `Account setup could not finish. ${error.message} Apply the school database migration and try again.`
    });
  }
});

router.post('/signin', async (req, res) => {
  const config = getRuntimeConfig();

  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const role = req.body?.role;
  if (!validEmail(email) || !password || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Enter your valid email and password.' });
  }
  if (!['student', 'teacher', 'admin', 'independent'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Choose student, teacher, admin, or independent.' });
  }

  try {
    const { response, data } = await authRequest(
      config,
      '/auth/v1/token?grant_type=password',
      { method: 'POST', body: { email, password } }
    );
    if (!response.ok) {
      return res.status(response.status < 500 ? response.status : 502).json({
        success: false,
        error: providerMessage(data, 'We could not sign you in. Check your email and password.')
      });
    }
    if (!data.access_token || !data.refresh_token || !data.user) {
      return res.status(502).json({ success: false, error: 'The sign-in service returned an incomplete session.' });
    }
    if (!emailIsConfirmed(data.user)) {
      return res.status(403).json({
        success: false,
        error: 'Confirm your email using the verification link before signing in.'
      });
    }

    const user = await getAccount(config, data.user);
    if (user?.role && user.role !== role) {
      return res.status(403).json({
        success: false,
        error: `This email belongs to a ${user.role} account. Choose ${user.role} to sign in.`
      });
    }
    saveSession(res, req, data);
    return res.json({ success: true, authenticated: true, user });
  } catch (error) {
    console.error('Account sign-in failed:', error);
    return res.status(503).json({
      success: false,
      error: `Your account profile could not be loaded. ${error.message} Apply the school database migration and try again.`
    });
  }
});

router.post('/confirm', async (req, res) => {
  const config = getRuntimeConfig();
  const accessToken = typeof req.body?.access_token === 'string' ? req.body.access_token : '';
  const refreshToken = typeof req.body?.refresh_token === 'string' ? req.body.refresh_token : '';
  if (!accessToken || !refreshToken) {
    return res.status(400).json({ success: false, error: 'This confirmation link is incomplete or expired.' });
  }

  try {
    const { response, data } = await authRequest(config, '/auth/v1/user', { token: accessToken });
    if (!response.ok || !data.id || !emailIsConfirmed(data)) {
      return res.status(401).json({ success: false, error: 'This confirmation link is invalid, expired, or the email is not confirmed.' });
    }
    const user = await getAccount(config, data);
    saveSession(res, req, {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: req.body.expires_in
    });
    return res.json({ success: true, authenticated: true, user });
  } catch (error) {
    console.error('Email confirmation setup failed:', error);
    return res.status(503).json({ success: false, error: error.message });
  }
});

router.post('/recover', async (req, res) => {
  const config = getRuntimeConfig();
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (!validEmail(email)) {
    return res.status(400).json({ success: false, error: 'Enter the valid email address for your account.' });
  }
  try {
    const redirectTo = `${getAppUrl()}/`;
    const { response, data } = await authRequest(
      config,
      `/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
      { method: 'POST', body: { email } }
    );
    if (!response.ok) {
      return res.status(response.status < 500 ? response.status : 502).json({
        success: false,
        error: providerMessage(data, 'Could not send a password reset email.')
      });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Password recovery request failed:', error);
    return res.status(502).json({ success: false, error: 'Could not reach the email service. Please try again.' });
  }
});

router.post('/password', async (req, res) => {
  const config = getRuntimeConfig();
  const accessToken = readCookie(req, 'figure_it_out_access');
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!accessToken) {
    return res.status(401).json({ success: false, error: 'Your password reset link expired. Request a new one.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Choose a password with at least 8 characters.' });
  }
  try {
    const { response, data } = await authRequest(config, '/auth/v1/user', {
      method: 'PUT',
      token: accessToken,
      body: { password }
    });
    if (!response.ok) {
      return res.status(response.status < 500 ? response.status : 502).json({
        success: false,
        error: providerMessage(data, 'Your password could not be updated.')
      });
    }
    const user = await getAccount(config, data);
    return res.json({ success: true, user });
  } catch (error) {
    console.error('Password update failed:', error);
    return res.status(503).json({ success: false, error: 'Could not update your password. Please try again.' });
  }
});

router.post('/signout', async (req, res) => {
  const config = getRuntimeConfig();
  const accessToken = readCookie(req, 'figure_it_out_access');
  try {
    if (config && accessToken) {
      const { response } = await authRequest(config, '/auth/v1/logout', {
        method: 'POST',
        token: accessToken
      });
      if (!response.ok) {
        console.warn(`Supabase could not revoke the signed-out session (HTTP ${response.status}).`);
      }
    }
  } catch (error) {
    console.error('Could not revoke the account session:', error);
  } finally {
    clearSession(res, req);
  }
  return res.json({ success: true });
});

module.exports = router;
