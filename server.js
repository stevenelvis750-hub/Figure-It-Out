'use strict';
require('dotenv').config();

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { MongoClient } = require('mongodb');
const {
  listSubjects,
  getQuestionInventory,
  getQuestionsForCourse,
  generateChallenge,
  normalizeDifficulty
} = require('./src/services/questionService');

const scrypt = promisify(crypto.scrypt);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const DATA_FILE = path.join(DATA_DIR, 'school-portal.json');
const PORT = Number(process.env.PORT || 3000);
const SESSION_MS = 12 * 60 * 60 * 1000;
const sessions = new Map();
const attempts = new Map();
let database = { users: [], schools: [], subjects: [], questions: [], quizzes: [], activity: [] };
let mongoClient = null;
let mongoDatabase = null;

function id() {
  return crypto.randomUUID();
}

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
  const email = String(value || '').trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(user) {
  const school = database.schools.find((entry) => entry.id === user.schoolId);
  return {
    id: user.id,
    email: user.email,
    name: user.fullName,
    role: user.role,
    school: school?.name || '',
    schoolId: user.schoolId || null,
    schoolCode: school?.code || '',
    stream: user.stream || '',
    className: user.className || ''
  };
}

async function persistMongoDatabase() {
  if (!mongoDatabase) return;

  try {
    const usersCollection = mongoDatabase.collection('users');
    const schoolsCollection = mongoDatabase.collection('schools');

    await usersCollection.deleteMany({});
    if (database.users.length) {
      await usersCollection.insertMany(database.users);
    }

    await schoolsCollection.deleteMany({});
    if (database.schools.length) {
      await schoolsCollection.insertMany(database.schools);
    }

    await usersCollection.createIndex({ email: 1 }, { unique: true, sparse: true });
    await schoolsCollection.createIndex({ code: 1 }, { unique: true, sparse: true });
  } catch (error) {
    console.warn('MongoDB persistence failed. Local JSON data remains the source of truth:', error.message);
  }
}

async function saveDatabase() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const temporary = `${DATA_FILE}.${crypto.randomBytes(5).toString('hex')}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(database, null, 2), { mode: 0o600 });
  await fs.rename(temporary, DATA_FILE);
  await persistMongoDatabase();
}

async function syncDatabaseFromMongo() {
  if (!mongoDatabase) return;

  try {
    const usersCollection = mongoDatabase.collection('users');
    const schoolsCollection = mongoDatabase.collection('schools');

    const [users, schools] = await Promise.all([
      usersCollection.find({}).toArray(),
      schoolsCollection.find({}).toArray()
    ]);

    database = {
      ...database,
      users: Array.isArray(users) ? users : [],
      schools: Array.isArray(schools) ? schools : []
    };
  } catch (error) {
    console.warn('Could not sync from MongoDB. Keeping local database state:', error.message);
  }
}

async function loadDatabase() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const contents = await fs.readFile(DATA_FILE, 'utf8');
    const saved = JSON.parse(contents);
    database = {
      users: Array.isArray(saved.users) ? saved.users : [],
      schools: Array.isArray(saved.schools) ? saved.schools : [],
      subjects: Array.isArray(saved.subjects) ? saved.subjects : [],
      questions: Array.isArray(saved.questions) ? saved.questions : [],
      quizzes: Array.isArray(saved.quizzes) ? saved.quizzes : [],
      activity: Array.isArray(saved.activity) ? saved.activity : []
    };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (mongoDatabase) {
    await syncDatabaseFromMongo();
  }

  const adminEmail = cleanEmail(process.env.ADMIN_EMAIL || 'admin@figureitout.local');
  const adminPassword = String(process.env.ADMIN_PASSWORD || 'FigureItOutAdmin!2025');
  if (!validEmail(adminEmail) || adminPassword.length < 12) {
    throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters before starting.');
  }
  const existing = database.users.find((user) => user.email === adminEmail);
  if (!existing) {
    database.users.push({
      id: id(), email: adminEmail, fullName: 'School administrator', role: 'admin',
      status: 'active', schoolId: null, salt: crypto.randomBytes(16).toString('hex'),
      passwordHash: '', createdAt: new Date().toISOString()
    });
    const admin = database.users[database.users.length - 1];
    admin.passwordHash = (await scrypt(adminPassword, admin.salt, 64)).toString('hex');
    await saveDatabase();
  } else if (existing.role !== 'admin') {
    throw new Error('ADMIN_EMAIL already belongs to a non-admin account. Choose a dedicated admin email.');
  }
}

async function initMongo() {
  const connectionString = String(process.env.MONGODB_URI || '').trim();
  if (!connectionString || connectionString.includes('<db_username>') || connectionString.includes('<db_password>')) {
    console.log('MongoDB not configured. Continuing with local JSON storage.');
    return false;
  }

  try {
    mongoClient = new MongoClient(connectionString, {
      serverSelectionTimeoutMS: 5000,
      retryWrites: true,
      retryReads: true
    });

    await mongoClient.connect();
    mongoDatabase = mongoClient.db(process.env.MONGO_DB_NAME || 'figure_it_out');

    await mongoDatabase.command({ ping: 1 });
    await mongoDatabase.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true });
    await mongoDatabase.collection('schools').createIndex({ code: 1 }, { unique: true, sparse: true });

    console.log(`MongoDB connected successfully to database "${mongoDatabase.databaseName}".`);
    return true;
  } catch (error) {
    console.warn('MongoDB connection failed. Falling back to local JSON storage:', error.message);
    mongoClient = null;
    mongoDatabase = null;
    return false;
  }
}

function json(response, status, data, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  };
  const existingCookies = response.getHeader('Set-Cookie');
  if (existingCookies && !headers['Set-Cookie']) {
    headers['Set-Cookie'] = existingCookies;
  }
  if (existingCookies && extraHeaders['Set-Cookie']) {
    const additionalCookies = Array.isArray(extraHeaders['Set-Cookie'])
      ? extraHeaders['Set-Cookie']
      : [extraHeaders['Set-Cookie']];
    headers['Set-Cookie'] = [
      ...(Array.isArray(existingCookies) ? existingCookies : [existingCookies]),
      ...additionalCookies
    ];
  }
  response.writeHead(status, headers);
  response.end(JSON.stringify(data));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 16_384) {
        reject(Object.assign(new Error('Request is too large.'), { status: 413 }));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(Object.assign(new Error('Send valid JSON.'), { status: 400 }));
      }
    });
    request.on('error', reject);
  });
}

function cookieMap(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').map((part) => {
    const separator = part.indexOf('=');
    return separator < 0 ? ['', ''] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
  }).filter(([key]) => key));
}

function getCurrentUser(request) {
  const token = cookieMap(request).fio_session;
  const session = token && sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  const user = database.users.find((entry) => entry.id === session.userId && entry.status === 'active');
  if (!user) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_MS;
  return user;
}

function requireRole(request, response, role) {
  const user = getCurrentUser(request);
  if (!user) {
    json(response, 401, { error: 'Please sign in to continue.' });
    return null;
  }
  if (user.role !== role) {
    json(response, 403, { error: 'Your account does not have access to this page.' });
    return null;
  }
  return user;
}

function requireSignedIn(request, response) {
  const user = getCurrentUser(request);
  if (!user) {
    json(response, 401, { error: 'Please create an account or sign in to access learning content.' });
    return null;
  }
  return user;
}

function checkLimit(request, response, bucket, max = 12) {
  const key = `${request.socket.remoteAddress || 'unknown'}:${bucket}`;
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.until < now) {
    attempts.set(key, { count: 1, until: now + 15 * 60 * 1000 });
    return true;
  }
  current.count += 1;
  if (current.count <= max) return true;
  json(response, 429, { error: 'Too many attempts. Please wait a few minutes and try again.' }, { 'Retry-After': '900' });
  return false;
}

function setSession(response, user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + SESSION_MS });
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `fio_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${secure}`);
}

function schoolForCode(code) {
  const normalized = String(code || '').trim().toUpperCase();
  return database.schools.find((school) => school.code === normalized);
}

function getSupabaseOAuthConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const apiKey = String(
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();
  if (!url || !apiKey || /^(replace-with|your[-_])/i.test(apiKey)) return null;

  try {
    const parsedUrl = new URL(url);
    if (!['https:', 'http:'].includes(parsedUrl.protocol)) return null;
    return { url: parsedUrl.origin, apiKey };
  } catch {
    return null;
  }
}

async function handleApi(request, response, url) {
  const method = request.method;
  const pathname = url.pathname;

  if (method === 'GET' && pathname === '/api/health') {
    return json(response, 200, {
      success: true,
      message: 'Question maker backend is running.',
      timestamp: new Date().toISOString()
    });
  }

  if (method === 'GET' && pathname === '/api/subjects') {
    if (!requireSignedIn(request, response)) return;
    try {
      const subjects = [...new Set([...listSubjects(), ...database.subjects])];
      return json(response, 200, {
        success: true,
        count: subjects.length,
        subjects
      });
    } catch (error) {
      console.error('Error while listing subjects:', error);
      return json(response, 500, {
        success: false,
        message: 'Unable to load subject list.'
      });
    }
  }

  if (method === 'GET' && pathname === '/api/questions') {
    if (!requireSignedIn(request, response)) return;
    try {
      const course = url.searchParams.get('course');
      const difficulty = url.searchParams.get('difficulty') || 'all';
      const limit = Number(url.searchParams.get('limit') || 0);

      if (!course || !String(course).trim()) {
        return json(response, 400, { success: false, message: 'A course name is required.' });
      }

      const storedQuestions = database.questions.filter((question) =>
        question.course.toLowerCase() === String(course).trim().toLowerCase() &&
        (difficulty === 'all' || normalizeDifficulty(question.difficulty) === normalizeDifficulty(difficulty))
      );
      const generatedQuestions = getQuestionsForCourse(course, difficulty || 'all', limit || 0);
      const questions = [...storedQuestions, ...generatedQuestions]
        .slice(0, limit > 0 ? limit : undefined);
      return json(response, 200, {
        success: true,
        course: String(course),
        difficulty: difficulty ? normalizeDifficulty(difficulty) : 'all',
        total: questions.length,
        questions
      });
    } catch (error) {
      console.error('Error fetching question list:', error);
      return json(response, 500, {
        success: false,
        message: 'Failed to fetch the requested question list.'
      });
    }
  }

  if (method === 'GET' && pathname.startsWith('/api/questions/')) {
    if (!requireSignedIn(request, response)) return;
    try {
      const course = decodeURIComponent(pathname.slice('/api/questions/'.length));
      const difficulty = url.searchParams.get('difficulty') || 'all';
      const limit = Number(url.searchParams.get('limit') || 0);
      const inventory = getQuestionInventory(course);
      const allQuestions = Array.isArray(inventory)
        ? inventory
        : Array.isArray(inventory?.questions)
          ? inventory.questions
          : [];
      const filteredQuestions = difficulty === 'all'
        ? allQuestions
        : allQuestions.filter(question => normalizeDifficulty(question.difficulty) === normalizeDifficulty(difficulty));
      const storedQuestions = database.questions.filter((question) =>
        question.course.toLowerCase() === course.toLowerCase() &&
        (difficulty === 'all' || normalizeDifficulty(question.difficulty) === normalizeDifficulty(difficulty))
      );
      const questions = limit > 0
        ? [...storedQuestions, ...filteredQuestions].slice(0, limit)
        : [...storedQuestions, ...filteredQuestions];
      return json(response, 200, {
        success: true,
        course: String(course),
        difficulty: difficulty === 'all' ? 'all' : normalizeDifficulty(difficulty),
        total: filteredQuestions.length,
        questions
      });
    } catch (error) {
      console.error('Error loading course question data:', error);
      return json(response, 500, {
        success: false,
        message: 'Could not load the requested questions.'
      });
    }
  }

  if (method === 'POST' && pathname === '/api/challenge') {
    if (!requireSignedIn(request, response)) return;
    try {
      const body = await readJson(request);
      const { course, difficulty, length } = body || {};
      if (!course || !String(course).trim()) {
        return json(response, 400, { success: false, message: 'Course is required to generate a challenge.' });
      }

      return json(response, 200, {
        success: true,
        challenge: generateChallenge(course, difficulty || 'easy', length || 10)
      });
    } catch (error) {
      console.error('Error generating challenge:', error);
      return json(response, 500, {
        success: false,
        message: 'Challenge generation failed.'
      });
    }
  }

  if (method === 'GET' && pathname === '/api/auth/session') {
    const user = getCurrentUser(request);
    return json(response, 200, user ? { authenticated: true, user: publicUser(user) } : { authenticated: false });
  }

  if (method === 'GET' && pathname === '/api/platform/admin/users') {
    if (!requireRole(request, response, 'admin')) return;
    return json(response, 200, {
      users: database.users.map((user) => ({
        id: user.id,
        name: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        school: database.schools.find((school) => school.id === user.schoolId)?.name || ''
      }))
    });
  }

  if (method === 'POST' && pathname === '/api/platform/subjects') {
    const user = getCurrentUser(request);
    if (!user || !['admin', 'teacher'].includes(user.role)) {
      return json(response, user ? 403 : 401, { error: 'A teacher or administrator account is required.' });
    }
    const body = await readJson(request);
    const name = String(body.name || '').trim();
    if (name.length < 2 || name.length > 100) {
      return json(response, 400, { error: 'Enter a subject name between 2 and 100 characters.' });
    }
    if ([...listSubjects(), ...database.subjects].some((subject) => subject.toLowerCase() === name.toLowerCase())) {
      return json(response, 409, { error: 'That subject already exists.' });
    }
    database.subjects.push(name);
    await saveDatabase();
    return json(response, 201, { success: true, subject: name });
  }

  if (method === 'POST' && pathname === '/api/platform/questions') {
    const user = getCurrentUser(request);
    if (!user || !['admin', 'teacher'].includes(user.role)) {
      return json(response, user ? 403 : 401, { error: 'A teacher or administrator account is required.' });
    }
    const body = await readJson(request);
    const course = String(body.course || '').trim();
    const questionText = String(body.question || '').trim();
    const options = Array.isArray(body.options) ? body.options.map((option) => String(option).trim()).filter(Boolean) : [];
    const answer = String(body.answer || '').trim();
    const difficulty = normalizeDifficulty(body.difficulty);
    if (course.length < 2 || questionText.length < 5 || options.length < 2 ||
        options.length > 6 || !answer || !options.includes(answer) ||
        !['easy', 'medium', 'hard'].includes(difficulty)) {
      return json(response, 400, { error: 'Provide a subject, question, at least two options, a matching correct answer, and a valid difficulty.' });
    }
    const savedQuestion = {
      id: id(),
      question: questionText,
      options,
      answer,
      difficulty,
      course,
      createdBy: user.id,
      createdAt: new Date().toISOString()
    };
    database.questions.push(savedQuestion);
    if (!listSubjects().some((subject) => subject.toLowerCase() === course.toLowerCase()) &&
        !database.subjects.some((subject) => subject.toLowerCase() === course.toLowerCase())) {
      database.subjects.push(course);
    }
    await saveDatabase();
    return json(response, 201, { success: true, question: savedQuestion });
  }

  const removeQuestion = pathname.match(/^\/api\/platform\/questions\/([\w-]+)$/);
  if (method === 'DELETE' && removeQuestion) {
    const user = getCurrentUser(request);
    if (!user || !['admin', 'teacher'].includes(user.role)) {
      return json(response, user ? 403 : 401, { error: 'A teacher or administrator account is required.' });
    }
    const index = database.questions.findIndex((question) => question.id === removeQuestion[1]);
    if (index < 0) return json(response, 404, { error: 'That saved question could not be found.' });
    if (user.role === 'teacher' && database.questions[index].createdBy !== user.id) {
      return json(response, 403, { error: 'You can only remove questions you created.' });
    }
    database.questions.splice(index, 1);
    await saveDatabase();
    return json(response, 200, { success: true });
  }

  if (pathname === '/api/platform/quizzes' && method === 'GET') {
    const user = getCurrentUser(request);
    if (!user) return json(response, 401, { error: 'Please sign in to view quizzes.' });
    const quizzes = user.role === 'admin'
      ? database.quizzes
      : database.quizzes.filter((quiz) => quiz.schoolId === user.schoolId || quiz.createdBy === user.id);
    return json(response, 200, { quizzes });
  }

  if (pathname === '/api/platform/quizzes' && method === 'POST') {
    const user = requireRole(request, response, 'teacher');
    if (!user) return;
    const body = await readJson(request);
    const title = String(body.title || '').trim();
    const subject = String(body.subject || '').trim();
    const description = String(body.description || '').trim();
    const difficulty = normalizeDifficulty(body.difficulty);
    const limit = Number(body.limit);
    if (title.length < 2 || title.length > 120 || !subject ||
        !['easy', 'medium', 'hard'].includes(difficulty) ||
        !Number.isInteger(limit) || limit < 1 || limit > 750) {
      return json(response, 400, { error: 'Enter a title, subject, valid difficulty, and question count from 1 to 750.' });
    }
    const quiz = {
      id: id(),
      title,
      description,
      subject,
      difficulty,
      limit,
      createdBy: user.id,
      schoolId: user.schoolId,
      createdAt: new Date().toISOString()
    };
    database.quizzes.push(quiz);
    await saveDatabase();
    return json(response, 201, { success: true, quiz });
  }

  const removeQuiz = pathname.match(/^\/api\/platform\/quizzes\/([\w-]+)$/);
  if (method === 'DELETE' && removeQuiz) {
    const user = getCurrentUser(request);
    if (!user || !['admin', 'teacher'].includes(user.role)) {
      return json(response, user ? 403 : 401, { error: 'A teacher or administrator account is required.' });
    }
    const index = database.quizzes.findIndex((quiz) => quiz.id === removeQuiz[1]);
    if (index < 0) return json(response, 404, { error: 'That quiz could not be found.' });
    if (user.role === 'teacher' && database.quizzes[index].createdBy !== user.id) {
      return json(response, 403, { error: 'You can only remove quizzes you created.' });
    }
    database.quizzes.splice(index, 1);
    await saveDatabase();
    return json(response, 200, { success: true });
  }

  if (method === 'GET' && pathname === '/api/auth/oauth/start') {
    if (!checkLimit(request, response, 'oauth', 10)) return;
    const provider = url.searchParams.get('provider');
    const challenge = url.searchParams.get('challenge');
    if (!['google', 'apple'].includes(provider)) {
      return json(response, 400, { error: 'Choose Google or Apple to continue.' });
    }
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(challenge || '')) {
      return json(response, 400, { error: 'The secure sign-in request was invalid. Please try again.' });
    }

    const config = getSupabaseOAuthConfig();
    if (!config) {
      return json(response, 503, { error: 'Social sign-in is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY on the server.' });
    }

    const state = crypto.randomBytes(32).toString('hex');
    const appUrl = String(process.env.APP_URL || `${request.socket.encrypted ? 'https' : 'http'}://${request.headers.host || 'localhost'}`).replace(/\/+$/, '');
    const redirectTo = new URL('/auth/callback.html', appUrl);
    redirectTo.searchParams.set('state', state);
    const authorizeUrl = new URL('/auth/v1/authorize', `${config.url}/`);
    authorizeUrl.searchParams.set('provider', provider);
    authorizeUrl.searchParams.set('redirect_to', redirectTo.toString());
    authorizeUrl.searchParams.set('code_challenge', challenge);
    authorizeUrl.searchParams.set('code_challenge_method', 's256');
    response.setHeader('Set-Cookie', `fio_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/api/auth/oauth; Max-Age=600${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`);
    return json(response, 200, { authorizationUrl: authorizeUrl.toString(), state });
  }

  if (method === 'POST' && pathname === '/api/auth/oauth/exchange') {
    const config = getSupabaseOAuthConfig();
    if (!config) {
      return json(response, 503, { error: 'Social sign-in is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY on the server.' });
    }

    const body = await readJson(request);
    const state = String(body.state || '');
    const code = String(body.code || '');
    const codeVerifier = String(body.codeVerifier || '');
    const intent = String(body.intent || '');
    const role = String(body.role || '');
    const provider = String(body.provider || '');
    const oauthCookie = cookieMap(request).fio_oauth_state;
    const clearStateCookie = 'fio_oauth_state=; HttpOnly; SameSite=Lax; Path=/api/auth/oauth; Max-Age=0';
    if (!oauthCookie || !state || oauthCookie.length !== state.length ||
        !crypto.timingSafeEqual(Buffer.from(oauthCookie), Buffer.from(state)) ||
        !/^[a-f0-9]{64}$/.test(state) || !code || code.length > 4096 ||
        !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)) {
      return json(response, 400, { error: 'The social sign-in request expired or could not be verified. Please try again.' }, { 'Set-Cookie': clearStateCookie });
    }
    if (!['signin', 'signup'].includes(intent) ||
        !['student', 'teacher', 'independent'].includes(role) ||
        !['google', 'apple'].includes(provider)) {
      return json(response, 400, { error: 'Choose a valid account type and try again.' }, { 'Set-Cookie': clearStateCookie });
    }

    let tokenResponse;
    let tokenData;
    try {
      tokenResponse = await fetch(new URL('/auth/v1/token?grant_type=pkce', `${config.url}/`), {
        method: 'POST',
        headers: {
          apikey: config.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ auth_code: code, code_verifier: codeVerifier }),
        signal: AbortSignal.timeout(15000)
      });
      tokenData = await tokenResponse.json().catch(() => ({}));
    } catch (error) {
      console.error('Supabase OAuth exchange failed:', error);
      return json(response, 502, { error: 'Could not complete social sign-in. Please try again.' }, { 'Set-Cookie': clearStateCookie });
    }
    if (!tokenResponse.ok || !tokenData.user?.email) {
      const providerError = tokenData.msg || tokenData.message || tokenData.error_description;
      return json(response, 401, { error: providerError || 'Google or Apple could not verify this sign-in.' }, { 'Set-Cookie': clearStateCookie });
    }
    if (!tokenData.user.email_confirmed_at && !tokenData.user.confirmed_at) {
      return json(response, 403, { error: 'Confirm your email with Google or Apple before using it to sign in.' }, { 'Set-Cookie': clearStateCookie });
    }

    const email = cleanEmail(tokenData.user.email);
    if (!validEmail(email)) {
      return json(response, 400, { error: 'The provider did not return a valid email address.' }, { 'Set-Cookie': clearStateCookie });
    }
    const existingUser = database.users.find((user) => user.email === email);
    if (intent === 'signin') {
      if (!existingUser) {
        return json(response, 404, { error: 'No account uses this provider email yet. Create an account first, then choose Google or Apple there.' }, { 'Set-Cookie': clearStateCookie });
      }
      if (existingUser.role !== role) {
        return json(response, 403, { error: `This email is registered as ${existingUser.role}. Choose that account type to sign in.` }, { 'Set-Cookie': clearStateCookie });
      }
      if (existingUser.status !== 'active') {
        return json(response, 403, { error: 'Your account is waiting for approval from your school administrator.' }, { 'Set-Cookie': clearStateCookie });
      }
      setSession(response, existingUser);
      return json(response, 200, { success: true, authenticated: true, user: publicUser(existingUser) }, { 'Set-Cookie': clearStateCookie });
    }

    if (existingUser) {
      return json(response, 409, { error: 'An account already uses this email. Choose sign in instead.' }, { 'Set-Cookie': clearStateCookie });
    }

    const fullName = String(body.fullName || tokenData.user.user_metadata?.full_name || tokenData.user.user_metadata?.name || '').trim();
    const schoolCode = String(body.schoolCode || '').trim().toUpperCase();
    if (fullName.length < 2 || fullName.length > 80) {
      return json(response, 400, { error: 'Enter your full name before continuing with social sign-in.' }, { 'Set-Cookie': clearStateCookie });
    }
    if (role !== 'independent' && !schoolForCode(schoolCode)) {
      return json(response, 400, { error: 'That school code was not found. Check it with your school administrator.' }, { 'Set-Cookie': clearStateCookie });
    }

    const school = role === 'independent' ? null : schoolForCode(schoolCode);
    const newUser = {
      id: id(),
      email,
      fullName,
      role,
      status: role === 'independent' ? 'active' : 'pending',
      schoolId: school?.id || null,
      stream: role === 'student' ? String(body.stream || '').trim().slice(0, 80) : '',
      className: role === 'student' ? String(body.className || '').trim().slice(0, 80) : '',
      salt: crypto.randomBytes(16).toString('hex'),
      passwordHash: '',
      authProvider: String(body.provider || 'oauth'),
      createdAt: new Date().toISOString()
    };
    database.users.push(newUser);
    await saveDatabase();
    if (newUser.status === 'active') {
      setSession(response, newUser);
      return json(response, 201, { success: true, authenticated: true, user: publicUser(newUser) }, { 'Set-Cookie': clearStateCookie });
    }

    const message = role === 'teacher'
      ? 'Your teacher account is waiting for approval from your school administrator.'
      : 'Your school account request was sent. A teacher at your school must approve it.';
    return json(response, 201, { success: true, authenticated: false, message }, { 'Set-Cookie': clearStateCookie });
  }

  if (method === 'POST' && pathname === '/api/auth/signup') {
    if (!checkLimit(request, response, 'signup', 8)) return;
    const body = await readJson(request);
    const email = cleanEmail(body.email);
    const password = String(body.password || '');
    const fullName = String(body.fullName || '').trim();
    const role = String(body.role || '');
    if (!validEmail(email)) return json(response, 400, { error: 'Enter a valid email address.' });
    if (password.length < 10 || password.length > 128) return json(response, 400, { error: 'Use a password between 10 and 128 characters.' });
    if (fullName.length < 2 || fullName.length > 80) return json(response, 400, { error: 'Enter your full name.' });
    if (!['student', 'teacher', 'independent'].includes(role)) {
      return json(response, 403, { error: 'Administrator accounts are created by the platform owner.' });
    }
    if (database.users.some((user) => user.email === email)) {
      return json(response, 409, { error: 'An account already uses this email. Sign in instead.' });
    }

    let school = null;
    if (role !== 'independent') {
      school = schoolForCode(body.schoolCode);
      if (!school) return json(response, 400, { error: 'That school code was not found. Check it with your school administrator.' });
    }

    const user = {
      id: id(), email, fullName, role,
      status: role === 'independent' ? 'active' : 'pending',
      schoolId: school?.id || null,
      stream: role === 'student' ? String(body.stream || '').trim().slice(0, 80) : '',
      className: role === 'student' ? String(body.className || '').trim().slice(0, 80) : '',
      salt: crypto.randomBytes(16).toString('hex'), passwordHash: '',
      createdAt: new Date().toISOString()
    };
    user.passwordHash = (await scrypt(password, user.salt, 64)).toString('hex');
    database.users.push(user);
    await saveDatabase();

    if (role === 'independent') {
      setSession(response, user);
      return json(response, 201, { success: true, authenticated: true, user: publicUser(user) });
    }
    const message = role === 'teacher'
      ? 'Your teacher account is waiting for approval from your school administrator.'
      : 'Your school account request was sent. A teacher at your school must approve it.';
    return json(response, 201, { success: true, authenticated: false, message });
  }

  if (method === 'POST' && pathname === '/api/auth/signin') {
    if (!checkLimit(request, response, 'signin', 10)) return;
    const body = await readJson(request);
    const email = cleanEmail(body.email);
    const password = String(body.password || '');
    const selectedRole = String(body.role || '');
    const user = database.users.find((entry) => entry.email === email);
    const salt = user?.salt || crypto.randomBytes(16).toString('hex');
    const candidate = await scrypt(password, salt, 64);
    const expected = user?.passwordHash ? Buffer.from(user.passwordHash, 'hex') : Buffer.alloc(64);
    const matches = expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate);
    if (!user || !matches) return json(response, 401, { error: 'The email or password is incorrect.' });
    if (selectedRole && selectedRole !== user.role) {
      return json(response, 403, { error: `This email is registered as ${user.role}. Choose that account type to sign in.` });
    }
    if (user.status === 'pending') {
      const message = user.role === 'teacher'
        ? 'Your account is waiting for your school administrator to approve it.'
        : 'Your school teacher must approve your account before you can sign in.';
      return json(response, 403, { error: message, pending: true });
    }
    if (user.status !== 'active') return json(response, 403, { error: 'This account is not active. Contact your school administrator.' });
    setSession(response, user);
    return json(response, 200, { success: true, authenticated: true, user: publicUser(user) });
  }

  if (method === 'POST' && pathname === '/api/auth/signout') {
    const token = cookieMap(request).fio_session;
    if (token) sessions.delete(token);
    return json(response, 200, { success: true }, { 'Set-Cookie': 'fio_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
  }

  if (method === 'GET' && pathname === '/api/platform/admin/schools') {
    if (!requireRole(request, response, 'admin')) return;
    return json(response, 200, { schools: database.schools.map((school) => ({
      id: school.id, name: school.name, code: school.code,
      teachers: database.users.filter((user) => user.schoolId === school.id && user.role === 'teacher' && user.status === 'active').length,
      students: database.users.filter((user) => user.schoolId === school.id && user.role === 'student' && user.status === 'active').length
    })) });
  }

  if (method === 'POST' && pathname === '/api/platform/admin/schools') {
    if (!requireRole(request, response, 'admin')) return;
    const body = await readJson(request);
    const name = String(body.name || '').trim();
    if (name.length < 2 || name.length > 160) return json(response, 400, { error: 'Enter a school name up to 160 characters.' });
    let code;
    do { code = crypto.randomBytes(4).toString('hex').toUpperCase(); }
    while (database.schools.some((school) => school.code === code));
    const school = { id: id(), name, code, createdAt: new Date().toISOString() };
    database.schools.push(school);
    await saveDatabase();
    return json(response, 201, { school });
  }

  if (method === 'GET' && pathname === '/api/platform/admin/teachers/pending') {
    if (!requireRole(request, response, 'admin')) return;
    const teachers = database.users.filter((user) => user.role === 'teacher' && user.status === 'pending').map((user) => ({
      id: user.id, full_name: user.fullName, email: user.email,
      schools: database.schools.find((school) => school.id === user.schoolId) || {}
    }));
    return json(response, 200, { teachers });
  }

  const approveTeacher = pathname.match(/^\/api\/platform\/admin\/teachers\/([\w-]+)\/approve$/);
  if (method === 'POST' && approveTeacher) {
    if (!requireRole(request, response, 'admin')) return;
    const teacher = database.users.find((user) => user.id === approveTeacher[1] && user.role === 'teacher' && user.status === 'pending');
    if (!teacher) return json(response, 404, { error: 'That pending teacher account could not be found.' });
    teacher.status = 'active';
    teacher.approvedAt = new Date().toISOString();
    await saveDatabase();
    return json(response, 200, { success: true });
  }

  if (method === 'GET' && pathname === '/api/platform/teacher/students/pending') {
    const teacher = requireRole(request, response, 'teacher');
    if (!teacher) return;
    const students = database.users.filter((user) => user.role === 'student' && user.status === 'pending' && user.schoolId === teacher.schoolId).map((user) => ({
      id: user.id, full_name: user.fullName, email: user.email,
      stream: user.stream, class_name: user.className,
      schools: database.schools.find((school) => school.id === user.schoolId) || {}
    }));
    return json(response, 200, { students });
  }

  if (method === 'GET' && pathname === '/api/platform/teacher/students') {
    const teacher = requireRole(request, response, 'teacher');
    if (!teacher) return;
    const students = database.users
      .filter((user) => user.role === 'student' && user.schoolId === teacher.schoolId)
      .map((user) => {
        const activity = database.activity.filter((entry) => entry.userId === user.id);
        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          status: user.status,
          stream: user.stream,
          className: user.className,
          challenges: activity.length,
          points: activity.reduce((sum, entry) => sum + entry.points, 0)
        };
      });
    return json(response, 200, { students });
  }

  const approveStudent = pathname.match(/^\/api\/platform\/teacher\/students\/([\w-]+)\/approve$/);
  if (method === 'POST' && approveStudent) {
    const teacher = requireRole(request, response, 'teacher');
    if (!teacher) return;
    const student = database.users.find((user) => user.id === approveStudent[1] && user.role === 'student' && user.status === 'pending' && user.schoolId === teacher.schoolId);
    if (!student) return json(response, 404, { error: 'That pending student account is not in your school.' });
    student.status = 'active';
    student.approvedAt = new Date().toISOString();
    await saveDatabase();
    return json(response, 200, { success: true });
  }

  if (method === 'GET' && pathname === '/api/platform/student/dashboard') {
    const student = getCurrentUser(request);
    if (!student || !['student', 'independent'].includes(student.role)) {
      return json(response, 401, { error: 'Please sign in as a student.' });
    }
    const activity = database.activity
      .filter((entry) => entry.userId === student.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const points = activity.reduce((sum, entry) => sum + entry.points, 0);
    return json(response, 200, {
      user: publicUser(student),
      assignments: database.quizzes.filter((quiz) => quiz.schoolId === student.schoolId),
      activity,
      points,
      challenges: activity.length,
      streak: (() => {
        const activityDates = new Set(activity.map((entry) => entry.createdAt.slice(0, 10)));
        const currentDate = new Date();
        currentDate.setUTCHours(0, 0, 0, 0);
        if (!activityDates.has(currentDate.toISOString().slice(0, 10))) {
          currentDate.setUTCDate(currentDate.getUTCDate() - 1);
        }
        let days = 0;
        while (activityDates.has(currentDate.toISOString().slice(0, 10))) {
          days += 1;
          currentDate.setUTCDate(currentDate.getUTCDate() - 1);
        }
        return days;
      })()
    });
  }

  if (method === 'POST' && pathname === '/api/platform/student/activity') {
    const student = getCurrentUser(request);
    if (!student || !['student', 'independent'].includes(student.role)) {
      return json(response, 401, { error: 'Please sign in as a student.' });
    }
    const body = await readJson(request);
    const course = String(body.course || '').trim();
    const difficulty = normalizeDifficulty(body.difficulty);
    const correct = Number(body.correct);
    const total = Number(body.total);
    if (!course || course.length > 100 || !['easy', 'medium', 'hard'].includes(difficulty) ||
        !Number.isInteger(correct) || !Number.isInteger(total) || total < 1 || total > 750 ||
        correct < 0 || correct > total) {
      return json(response, 400, { error: 'The challenge result is invalid.' });
    }
    const entry = {
      id: id(),
      userId: student.id,
      course,
      difficulty,
      correct,
      total,
      points: correct * 10,
      createdAt: new Date().toISOString()
    };
    database.activity.push(entry);
    await saveDatabase();
    return json(response, 201, { success: true, activity: entry });
  }

  if (method === 'POST' && pathname === '/api/ask') {
    if (!requireSignedIn(request, response)) return;
    let body = {};
    try {
      body = await readJson(request);
    } catch (error) {
      return json(response, error.status || 400, { success: false, error: error.message || 'Send valid JSON.' });
    }

    const question = typeof body.question === 'string' ? body.question.trim() : '';

    if (!question) {
      return json(response, 400, { success: false, error: 'Please enter a question.' });
    }

    const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey || /^(replace-with|your[-_])/i.test(apiKey)) {
      return json(response, 503, { success: false, error: 'The AI assistant is not configured. Set a valid GEMINI_API_KEY in the server environment or .env file.' });
    }

    try {
      const result = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-2.5-flash')}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: 'You are Figure It Out, a friendly educational assistant. Answer clearly and accurately.' }]
            },
            contents: [{ role: 'user', parts: [{ text: question }] }],
            generationConfig: { maxOutputTokens: 1024 }
          })
        }
      );

      const data = await result.json();
      if (!result.ok) {
        return json(response, 502, { success: false, error: data.error?.message || 'The AI provider could not answer right now.' });
      }

      const answer = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
      if (!answer) {
        return json(response, 502, { success: false, error: 'The AI provider returned an empty answer. Please try again.' });
      }

      return json(response, 200, { success: true, answer });
    } catch (error) {
      console.error('Error contacting Gemini API:', error);
      return json(response, 502, { success: false, error: 'Could not reach the AI provider. Check your connection and try again.' });
    }
  }

  return json(response, 404, { error: 'Account service route not found.' });
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

async function resolveCaseInsensitivePath(baseDir, relativePath) {
  const fullPath = path.resolve(baseDir, relativePath);

  try {
    await fs.access(fullPath);
    return fullPath;
  } catch {
    const parts = relativePath.split(/[\\/]/).filter(Boolean);
    let current = baseDir;

    for (const part of parts) {
      let match = null;

      try {
        const entries = await fs.readdir(current, { withFileTypes: true });
        match = entries.find((entry) => entry.name.toLowerCase() === part.toLowerCase());
      } catch {
        return null;
      }

      if (!match) return null;
      current = path.join(current, match.name);
    }

    return current;
  }
}

async function serveFile(response, pathname) {
  let decoded;

  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = '/';
  }

  const relative = decoded === '/'
    ? 'index.html'
    : decoded.replace(/^\/+/, '');

  const ROOT_PUBLIC_FILES = new Set([
    'index.html',
    'style.css',
    'script.js'
  ]);

  let file;

  // Dashboard pages are served from the dashboards folder.
  if (relative.toLowerCase().startsWith('dashboards/')) {
    file = await resolveCaseInsensitivePath(ROOT, relative);

    const allowed = [path.resolve(ROOT, 'Dashboards'), path.resolve(ROOT, 'dashboards')];
    const isAllowed = !!file && allowed.some((base) => file.startsWith(base + path.sep));

    if (!isAllowed) {
      response.writeHead(403);
      return response.end('Access denied');
    }
  }

  // Only explicitly approved files can be served from the project root.
  else if (ROOT_PUBLIC_FILES.has(relative)) {
    file = await resolveCaseInsensitivePath(ROOT, relative);
  }

  // All other public files must be inside public/.
  else {
    file = await resolveCaseInsensitivePath(PUBLIC_DIR, relative);

    if (!file || !file.startsWith(PUBLIC_DIR + path.sep)) {
      response.writeHead(403);
      return response.end('Access denied');
    }
  }

  const extension = path.extname(file).toLowerCase();

  if (!contentTypes[extension]) {
    response.writeHead(404);
    return response.end('Page not found');
  }

  try {
    const contents = await fs.readFile(file);

    response.writeHead(200, {
      'Content-Type': contentTypes[extension],
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy':
        "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
    });

    response.end(contents);

  } catch (error) {
    if (error.code === 'ENOENT') {
      response.writeHead(404);
      return response.end('Page not found');
    }

    throw error;
  }
}


async function start() {
  await loadDatabase();
  await initMongo();
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

      if (request.method === 'GET' || request.method === 'HEAD') {
        const authPages = new Map([
          ['/login.html', '/login.html'],
          ['/log.html', '/login.html'],
          ['/register.html', '/register.html'],
          ['/auth/callback.html', '/oauth-callback.html']
        ]);
        if (authPages.has(url.pathname.toLowerCase())) {
          await serveFile(response, authPages.get(url.pathname.toLowerCase()));
          return;
        }
      }

      if (url.pathname === '/') {
        const user = getCurrentUser(request);
        response.writeHead(302, { Location: user ? '/index.html' : '/login.html' });
        response.end();
        return;
      }

      if (url.pathname.startsWith('/api/')) await handleApi(request, response, url);
      else if (request.method === 'GET' || request.method === 'HEAD') {
        const user = getCurrentUser(request);
        const dashboardRole = url.pathname.toLowerCase().startsWith('/dashboards/admin/')
          ? 'admin'
          : url.pathname.toLowerCase().startsWith('/dashboards/teachers/')
            ? 'teacher'
            : url.pathname.toLowerCase().startsWith('/dashboards/students/')
              ? ['student', 'independent'].includes(user?.role) ? user.role : 'student'
              : null;
        const protectedLearningFile = ['/index.html', '/script.js'].includes(url.pathname.toLowerCase());

        if ((dashboardRole || protectedLearningFile) && !user) {
          response.writeHead(302, { Location: `/login.html?next=${encodeURIComponent(url.pathname)}` });
          response.end();
          return;
        }
        if (dashboardRole && user.role !== dashboardRole &&
            !(dashboardRole === 'student' && user.role === 'independent')) {
          response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
          response.end('Your account does not have access to this dashboard.');
          return;
        }

        await serveFile(response, url.pathname);
      }
      else json(response, 405, { error: 'Method not allowed.' }, { Allow: 'GET, HEAD' });
    } catch (error) {
      if (!response.headersSent) json(response, error.status || 500, { error: error.status ? error.message : 'The server could not complete that request.' });
      else response.destroy();
      if (!error.status) console.error(error);
    }
  });
  server.listen(PORT, () => {
    console.log(`Figure It Out school portal is running at http://localhost:${PORT}`);
    console.log(`Administrator: ${cleanEmail(process.env.ADMIN_EMAIL)}`);
  });
}

start().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});