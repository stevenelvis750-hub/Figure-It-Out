'use strict';

(() => {
  const root = document.createElement('div');
  root.className = 'auth-gate is-visible';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'authTitle');
  root.innerHTML = `
    <section class="auth-card">
      <a class="auth-brand" href="/" aria-label="Figure It Out home">
        <span class="auth-brand-mark">F</span>
        <span>Figure<span class="auth-brand-accent">ItOut</span></span>
      </a>
      <div class="auth-heading">
        <span class="auth-kicker">YOUR LEARNING SPACE</span>
        <h1 id="authTitle">Create your account</h1>
        <p id="authDescription">Join your school and start learning.</p>
      </div>
      <div class="auth-role-picker auth-account-picker" role="group" aria-label="Account type">
        <button class="auth-role-option selected" type="button" data-account-choice="school" aria-pressed="true">
          <span class="auth-role-icon" aria-hidden="true">▤</span>
          <span><strong>School institute</strong><small>Student, teacher, or admin</small></span>
        </button>
        <button class="auth-role-option" type="button" data-account-choice="independent" aria-pressed="false">
          <span class="auth-role-icon" aria-hidden="true">✦</span>
          <span><strong>Independent student</strong><small>Solo or team competition</small></span>
        </button>
      </div>
      <div class="auth-role-picker auth-school-role-picker" data-school-role-picker role="group" aria-label="School institute role">
        <button class="auth-role-option selected" type="button" data-role="student" aria-pressed="true">
          <span class="auth-role-icon" aria-hidden="true">✦</span>
          <span><strong>Student</strong><small>Join your school</small></span>
        </button>
        <button class="auth-role-option" type="button" data-role="teacher" aria-pressed="false">
          <span class="auth-role-icon" aria-hidden="true">▤</span>
          <span><strong>Teacher</strong><small>Manage your school</small></span>
        </button>
        <button class="auth-role-option" type="button" data-role="admin" aria-pressed="false">
          <span class="auth-role-icon" aria-hidden="true">⚙</span>
          <span><strong>Admin</strong><small>School admin access</small></span>
        </button>
      </div>
      <form class="auth-form" id="accountForm">
        <div class="auth-fields">
          <div class="auth-field" data-signup-only>
            <label for="accountName">Full name</label>
            <input id="accountName" name="name" type="text" minlength="2" maxlength="80"
              autocomplete="name" placeholder="Your full name" required>
          </div>
          <div class="auth-field">
            <label for="accountEmail">Email address</label>
            <input id="accountEmail" name="email" type="email" maxlength="254"
              autocomplete="email" placeholder="you@example.com" required>
          </div>
          <div class="auth-field">
            <label for="accountPassword">Password</label>
            <input id="accountPassword" name="password" type="password" minlength="8"
              maxlength="128" autocomplete="new-password" placeholder="At least 8 characters" required>
          </div>
          <div class="auth-field" data-password-confirm hidden>
            <label for="accountPasswordConfirm">Confirm password</label>
            <input id="accountPasswordConfirm" type="password" minlength="8" maxlength="128"
              autocomplete="new-password" placeholder="Enter your password again" required>
          </div>
          <p class="auth-help" data-signup-only>Password must be different from your name. Use your email to sign in.</p>
          <div class="auth-field" data-student-only>
            <label for="accountSchoolCode">School code</label>
            <input id="accountSchoolCode" type="text" minlength="8" maxlength="8"
              autocapitalize="characters" placeholder="8-character code from your teacher">
          </div>
          <div class="auth-field" data-student-only>
            <label for="accountStream">Stream / section</label>
            <input id="accountStream" type="text" maxlength="80" placeholder="e.g. North, Blue or A">
          </div>
          <div class="auth-field" data-student-only>
            <label for="accountClass">Class / grade</label>
            <input id="accountClass" type="text" maxlength="80" placeholder="e.g. Grade 8">
          </div>
          <div class="auth-field" data-teacher-only hidden>
            <label for="accountSchoolName">School name</label>
            <input id="accountSchoolName" type="text" maxlength="160" placeholder="Your school">
          </div>
          <div class="auth-field" data-teacher-only hidden>
            <label for="accountTeacherSchoolCode">Existing school code <span>(optional)</span></label>
            <input id="accountTeacherSchoolCode" type="text" maxlength="8"
              autocapitalize="characters" placeholder="Enter a code to join an existing school">
          </div>
          <p class="auth-help" data-teacher-only hidden>Create a school by entering its name, or join an existing school with its code.</p>
          <button class="auth-forgot" id="forgotPassword" type="button" hidden>Forgot password?</button>
        </div>
        <p class="auth-notice" id="accountNotice" role="status" aria-live="polite"></p>
        <button class="auth-submit" id="accountSubmit" type="submit">Create student account</button>
      </form>
      <p class="auth-switch" id="authSwitch"><span>Already have an account?</span>
        <button id="authModeToggle" type="button">Sign in</button></p>
    </section>
  `;

  const form = root.querySelector('#accountForm');
  const roleButtons = [...root.querySelectorAll('[data-role]')];
  const accountChoiceButtons = [...root.querySelectorAll('[data-account-choice]')];
  const nameInput = root.querySelector('#accountName');
  const emailInput = root.querySelector('#accountEmail');
  const passwordInput = root.querySelector('#accountPassword');
  const confirmInput = root.querySelector('#accountPasswordConfirm');
  const notice = root.querySelector('#accountNotice');
  const submit = root.querySelector('#accountSubmit');
  const modeToggle = root.querySelector('#authModeToggle');
  const pageRole = document.documentElement.dataset.accountRole;
  let role = ['student', 'teacher', 'admin', 'independent'].includes(pageRole) ? pageRole : 'student';
  let mode = 'signup';
  let studentDataPromise;

  function setNotice(message, type = '') {
    notice.textContent = message;
    notice.className = `auth-notice${type ? ` ${type}` : ''}`;
  }

  function setMode(nextMode) {
    mode = role === 'admin' && nextMode === 'signup' ? 'signin' : nextMode;
    const signingUp = mode === 'signup';
    const forgot = mode === 'forgot';
    const resetting = mode === 'reset';
    root.querySelectorAll('[data-signup-only]').forEach((field) => {
      field.hidden = !signingUp;
    });
    root.querySelector('[data-password-confirm]').hidden = !signingUp && !resetting;
    passwordInput.parentElement.hidden = forgot;
    root.querySelectorAll('[data-student-only]').forEach((field) => {
      field.hidden = !signingUp || role !== 'student';
    });
    root.querySelectorAll('[data-teacher-only]').forEach((field) => {
      field.hidden = !signingUp || role !== 'teacher';
    });
    root.querySelectorAll('.auth-role-picker').forEach((picker) => {
      picker.hidden = forgot || resetting;
    });
    root.querySelector('[data-school-role-picker]').hidden = forgot || resetting || role === 'independent';
    root.querySelector('#authSwitch').hidden = forgot || resetting || role === 'admin';
    accountChoiceButtons.forEach((button) => {
      const selected = button.dataset.accountChoice === (role === 'independent' ? 'independent' : 'school');
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    nameInput.required = signingUp;
    confirmInput.required = signingUp || resetting;
    root.querySelector('#accountSchoolCode').required = signingUp && role === 'student';
    root.querySelector('#accountStream').required = signingUp && role === 'student';
    root.querySelector('#accountClass').required = signingUp && role === 'student';
    passwordInput.required = !forgot;
    passwordInput.minLength = signingUp || resetting ? 8 : 0;
    passwordInput.autocomplete = signingUp || resetting ? 'new-password' : 'current-password';
    emailInput.required = true;
    root.querySelector('#authTitle').textContent = forgot
      ? 'Reset your password'
      : signingUp
        ? role === 'independent'
          ? 'Create an independent student account'
          : `Create your ${role} account`
        : resetting
          ? 'Choose a new password'
          : role === 'admin'
            ? 'Admin sign in'
            : role === 'independent'
              ? 'Independent student sign in'
              : 'Welcome back';
    root.querySelector('#authDescription').textContent = forgot
      ? 'We’ll email you a secure password reset link.'
      : signingUp
        ? role === 'student'
          ? 'Join your school and start learning.'
          : role === 'teacher'
            ? 'Create your school account or join an existing institute.'
            : role === 'independent'
              ? 'Create a personal student account or group competition team outside a school.'
              : 'Create a school institute account and manage your learners.'
        : resetting
          ? 'Choose a strong new password for your account.'
          : role === 'independent'
            ? 'Sign in to your independent student account with your email.'
            : `Sign in to your ${role} learning space with your email.`;
    submit.textContent = forgot
      ? 'Send reset link'
      : resetting
        ? 'Save new password'
        : signingUp
          ? role === 'independent'
            ? 'Create independent student account'
            : `Create ${role} account`
          : 'Sign in';
    modeToggle.textContent = signingUp ? 'Sign in' : 'Create an account';
    root.querySelector('#authSwitch span').textContent = signingUp
      ? 'Already have an account?'
      : 'New to Figure It Out?';
    setNotice('');
  }

  function setRole(nextRole) {
    if (!['student', 'teacher', 'admin', 'independent'].includes(nextRole)) return;
    role = nextRole;
    roleButtons.forEach((button) => {
      const selected = button.dataset.role === role;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    accountChoiceButtons.forEach((button) => {
      const selected = button.dataset.accountChoice === (role === 'independent' ? 'independent' : 'school');
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    setMode(mode);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function renderStudentWorkspace(data) {
    const section = document.getElementById('studentWorkspace');
    if (!section || !data?.user || data.user.role !== 'student') return;
    section.hidden = false;
    section.innerHTML = `
      <div class="student-workspace-heading">
        <div>
          <h2>Welcome, ${escapeHtml(data.user.name)}</h2>
          <p>${escapeHtml(data.user.school)} · ${escapeHtml(data.user.stream)} · ${escapeHtml(data.user.className)}</p>
        </div>
        <div><strong>My assignments</strong><p>${data.assignments.length} for your class</p></div>
      </div>
      <div class="student-assignment-list">
        ${data.assignments.length ? data.assignments.map((assignment) => `
          <article class="student-assignment">
            <div>
              <strong>${escapeHtml(assignment.title)}</strong>
              <p>${escapeHtml(assignment.subject)} · ${escapeHtml(assignment.difficulty)} · ${assignment.question_count} questions · Due ${escapeHtml(assignment.due_date)}</p>
            </div>
            ${assignment.completed
              ? '<span class="student-assignment-status">Completed</span>'
              : `<a href="/?assignment=${encodeURIComponent(assignment.id)}">Start assignment</a>`}
          </article>`).join('')
          : '<div class="student-workspace-empty">No assignments have been shared with your class yet. Keep practising while you wait.</div>'}
      </div>
      <div class="student-activity-list" id="studentActivity"></div>
    `;
    const activityList = section.querySelector('#studentActivity');
    if (data.activity.length) {
      activityList.innerHTML = `
        <h3>Recent learning activity</h3>
        ${data.activity.slice(0, 5).map((activity) => `
          <div class="student-workspace-empty">${escapeHtml(activity.course)} · ${escapeHtml(activity.difficulty)} · ${activity.correct_answers}/${activity.total_questions} correct · ${escapeHtml(new Date(activity.completed_at).toLocaleString())}</div>
        `).join('')}
      `;
    }

    const requestedAssignmentId = new URLSearchParams(location.search).get('assignment');
    if (requestedAssignmentId) {
      const assignment = data.assignments.find(item => item.id === requestedAssignmentId && !item.completed);
      if (assignment) {
        window.dispatchEvent(new CustomEvent('figureitout:assignment-selected', { detail: assignment }));
      } else {
        setNotice('That assignment is not available, or you have already completed it.', 'error');
      }
    }
  }

  function attachAccountControls(user) {
    const accountArea = document.querySelector('.navbar-actions, .topbar-actions');
    if (!accountArea || accountArea.querySelector('[data-account-signout]')) return;
    const label = document.createElement('span');
    label.className = 'account-user';
    label.textContent = user.name;
    label.title = `${user.name} · ${user.email}`;
    const signOut = document.createElement('button');
    signOut.type = 'button';
    signOut.className = 'account-signout';
    signOut.dataset.accountSignout = '';
    signOut.textContent = 'Sign out';
    accountArea.append(label, signOut);
  }

  function buildFallbackStudentDashboard() {
    const sessionUser = getLocalSession()?.user;
    const fallbackUser = sessionUser && sessionUser.role === 'student' ? sessionUser : {
      id: 'local-student',
      email: '',
      role: 'student',
      name: 'Student',
      school: 'Figure It Out Academy',
      stream: 'General',
      className: 'Grade 8'
    };

    return {
      user: {
        id: fallbackUser.id,
        email: fallbackUser.email || '',
        role: 'student',
        name: fallbackUser.name || 'Student',
        school: fallbackUser.school || 'Figure It Out Academy',
        stream: fallbackUser.stream || 'General',
        className: fallbackUser.className || 'Grade 8'
      },
      assignments: [],
      activity: []
    };
  }

  function openApplication(user) {
    document.documentElement.dataset.accountRole = user.role;
    const pageRole = document.documentElement.dataset.accountRole || '';
    const homePage = !pageRole || pageRole === 'student';
    const independentCanUseHome = user.role === 'independent' && homePage;
    const pageRoleMismatch = pageRole && user.role !== pageRole && !independentCanUseHome;
    const schoolRoleNeedsDashboard = !pageRole && ['teacher', 'admin'].includes(user.role);
    if (pageRoleMismatch || schoolRoleNeedsDashboard) {
      window.location.replace(user.role === 'teacher'
        ? '/teacher-dashboard.html'
        : user.role === 'admin'
          ? '/admin-dashboard.html'
          : '/');
      return;
    }
    root.classList.remove('is-visible');
    root.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('account-pending', 'account-required');
    attachAccountControls(user);
    window.dispatchEvent(new CustomEvent('figureitout:authenticated', { detail: user }));
    if (user.role === 'student') {
      const studentDashboardUrl = '/api' + '/platform/student/dashboard';
      studentDataPromise = fetch(studentDashboardUrl, { credentials: 'same-origin' })
        .then(async response => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            const fallbackData = buildFallbackStudentDashboard();
            if (response.status === 404 || response.status === 405 || response.status >= 500) {
              renderStudentWorkspace(fallbackData);
              return fallbackData;
            }
            throw new Error(data.error || 'Could not load student assignments.');
          }
          if (!data || typeof data !== 'object') {
            const fallbackData = buildFallbackStudentDashboard();
            renderStudentWorkspace(fallbackData);
            return fallbackData;
          }
          renderStudentWorkspace(data);
          return data;
        })
        .catch(error => {
          console.error(error);
          const fallbackData = buildFallbackStudentDashboard();
          renderStudentWorkspace(fallbackData);
          const section = document.getElementById('studentWorkspace');
          if (section) {
            section.hidden = false;
            section.textContent = error.message;
          }
          return null;
        });
    }
  }

  function getLocalUsers() {
    try {
      const value = window.localStorage.getItem('figure_it_out_users');
      return value ? JSON.parse(value) : [];
    } catch {
      return [];
    }
  }

  function saveLocalUsers(users) {
    try {
      window.localStorage.setItem('figure_it_out_users', JSON.stringify(users));
    } catch {
      // Ignore storage failures so the login flow still works in restricted browsers.
    }
  }

  function getLocalSession() {
    try {
      const value = window.localStorage.getItem('figure_it_out_session');
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  function saveLocalSession(user) {
    try {
      window.localStorage.setItem('figure_it_out_session', JSON.stringify({ user }));
    } catch {
      // Ignore storage failures so the login flow still works in restricted browsers.
    }
  }

  function clearLocalSession() {
    try {
      window.localStorage.removeItem('figure_it_out_session');
    } catch {
      // Ignore storage failures so the login flow still works in restricted browsers.
    }
  }

  function seedDemoAccount() {
    const users = getLocalUsers();
    const email = 'stevenelvis750@gmail.com';
    const password = 'Steven@750';
    if (!users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      users.push({
        id: 'demo-user',
        email,
        password,
        role: 'student',
        fullName: 'Steven Elvis',
        schoolName: 'Figure It Out Academy',
        schoolCode: 'FIGITOUT',
        stream: 'Science',
        className: 'Grade 12'
      });
      saveLocalUsers(users);
    }
    return { email, password };
  }

  function fallbackLocalAuth(path, body = {}) {
    const users = getLocalUsers();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (path === '/api/auth/session') {
      const session = getLocalSession();
      return { success: true, authenticated: Boolean(session?.user), user: session?.user || undefined };
    }

    if (path === '/api/auth/signout') {
      clearLocalSession();
      return { success: true };
    }

    if (path === '/api/auth/recover') {
      return { success: true };
    }

    if (path === '/api/auth/password') {
      const session = getLocalSession();
      if (!session?.user) {
        return { success: false, error: 'Your password reset link expired. Request a new one.' };
      }
      const target = users.find((user) => user.email.toLowerCase() === session.user.email.toLowerCase());
      if (target) {
        target.password = body.password;
        saveLocalUsers(users);
      }
      return { success: true, authenticated: true, user: session.user };
    }

    if (path === '/api/auth/signup') {
      const existing = users.find((user) => user.email.toLowerCase() === email);
      if (existing) {
        return { success: false, error: 'An account already uses this email. Sign in, or use password recovery.' };
      }
      const user = {
        id: `local-${Date.now()}`,
        email,
        password,
        role: body.role || 'student',
        fullName: body.fullName || 'Local User',
        schoolName: body.schoolName || '',
        schoolCode: body.schoolCode || '',
        stream: body.stream || '',
        className: body.className || ''
      };
      users.push(user);
      saveLocalUsers(users);
      const sessionUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.fullName,
        school: user.schoolName,
        schoolId: null,
        schoolCode: user.schoolCode,
        stream: user.stream,
        className: user.className
      };
      saveLocalSession(sessionUser);
      return { success: true, authenticated: true, user: sessionUser };
    }

    if (path === '/api/auth/signin') {
      const user = users.find((entry) => entry.email.toLowerCase() === email && entry.password === password);
      if (!user) {
        return { success: false, error: 'The email or password is incorrect.' };
      }
      const sessionUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.fullName,
        school: user.schoolName,
        schoolId: null,
        schoolCode: user.schoolCode,
        stream: user.stream,
        className: user.className
      };
      saveLocalSession(sessionUser);
      return { success: true, authenticated: true, user: sessionUser };
    }

    return { success: false, error: 'The account service is unavailable. Please try again.' };
  }

  async function sendRequest(path, body) {
    try {
      const response = await fetch(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const configFallback = /not configured|Could not reach the account service|school database|Account service is unavailable|Could not connect to the account service/i.test(data.error || '');
        if (response.status >= 500 || response.status === 404 || configFallback) {
          return fallbackLocalAuth(path, body);
        }
        throw new Error(data.error || 'The account request failed. Please try again.');
      }
      return data;
    } catch (error) {
      const fallback = fallbackLocalAuth(path, body);
      if (!fallback || fallback.success === false && !fallback.error) {
        throw error;
      }
      if (fallback.success === false && /The email or password is incorrect|An account already uses this email|Your password reset link expired|The account service is unavailable/i.test(fallback.error || '')) {
        throw new Error(fallback.error);
      }
      return fallback;
    }
  }

  roleButtons.forEach(button => button.addEventListener('click', () => setRole(button.dataset.role)));
  accountChoiceButtons.forEach(button => button.addEventListener('click', () => {
    if (button.dataset.accountChoice === 'independent') {
      setRole('independent');
    } else if (role === 'independent') {
      setRole('student');
    }
  }));
  modeToggle.addEventListener('click', () => setMode(mode === 'signup' ? 'signin' : 'signup'));
  root.querySelector('#forgotPassword').addEventListener('click', () => setMode('forgot'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    emailInput.value = emailInput.value.trim();
    if (!emailInput.validity.valid) {
      setNotice('Enter a valid email address.', 'error');
      emailInput.reportValidity();
      return;
    }
    if (!form.reportValidity()) return;
    if (mode === 'signup' && passwordInput.value !== confirmInput.value) {
      setNotice('Your passwords do not match.', 'error');
      confirmInput.focus();
      return;
    }
    if (mode === 'reset' && passwordInput.value !== confirmInput.value) {
      setNotice('Your passwords do not match.', 'error');
      confirmInput.focus();
      return;
    }
    submit.disabled = true;
    setNotice('');
    try {
      if (mode === 'forgot') {
        await sendRequest('/api/auth/recover', { email: emailInput.value });
        setNotice('If an account exists for this email, a secure reset link is on its way.', 'success');
        return;
      }
      if (mode === 'reset') {
        const result = await sendRequest('/api/auth/password', { password: passwordInput.value });
        openApplication(result.user);
        return;
      }
      if (mode === 'signin') {
        const result = await sendRequest('/api/auth/signin', {
          email: emailInput.value,
          password: passwordInput.value,
          role
        });
        openApplication(result.user);
        return;
      }

      const result = await sendRequest('/api/auth/signup', {
        email: emailInput.value,
        password: passwordInput.value,
        fullName: nameInput.value.trim(),
        role,
        schoolName: root.querySelector('#accountSchoolName').value.trim(),
        schoolCode: (role === 'student'
          ? root.querySelector('#accountSchoolCode').value
          : root.querySelector('#accountTeacherSchoolCode').value).trim().toUpperCase(),
        stream: root.querySelector('#accountStream').value.trim(),
        className: root.querySelector('#accountClass').value.trim()
      });
      if (result.authenticated && result.user) {
        setNotice(role === 'teacher' && result.user.schoolCode
          ? `School code: ${result.user.schoolCode}. Share it with your students.`
          : result.message, 'success');
        openApplication(result.user);
      } else {
        passwordInput.value = '';
        confirmInput.value = '';
        setMode('signin');
        setNotice(result.message || 'Check your email to confirm your account, then sign in.', 'success');
      }
    } catch (error) {
      setNotice(error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-account-signout]');
    if (!button) return;
    button.disabled = true;
    try {
      await sendRequest('/api/auth/signout');
      delete document.documentElement.dataset.accountRole;
      window.location.reload();
    } catch (error) {
      setNotice(error.message, 'error');
      button.disabled = false;
    }
  });

  async function startAccount() {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    const recoveryLink = hash.get('type') === 'recovery';
    if (accessToken && refreshToken) {
      try {
        const result = await sendRequest('/api/auth/confirm', {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: hash.get('expires_in')
        });
        window.history.replaceState(null, '', window.location.pathname);
        if (recoveryLink) {
          role = result.user.role;
          setRole(role);
          setMode('reset');
          document.documentElement.classList.remove('account-pending');
          document.documentElement.classList.add('account-required');
          root.classList.add('is-visible');
          root.removeAttribute('aria-hidden');
          setNotice('Email verified. Choose a new password to finish resetting your account.', 'success');
          return;
        }
        openApplication(result.user);
        return;
      } catch (error) {
        setNotice(error.message, 'error');
      }
    }
    try {
      const result = await sendRequest('/api/auth/session', {});
      if (result.authenticated && result.user) {
        openApplication(result.user);
        return;
      }
      if (result.error) {
        const localResult = fallbackLocalAuth('/api/auth/session');
        if (localResult.authenticated && localResult.user) {
          openApplication(localResult.user);
          return;
        }
        setNotice(localResult.error || result.error || 'Account service is unavailable.', 'error');
      }
    } catch (error) {
      const localResult = fallbackLocalAuth('/api/auth/session');
      if (localResult.authenticated && localResult.user) {
        openApplication(localResult.user);
        return;
      }
      setNotice(`Could not connect to the account service. ${error.message}`, 'error');
    }
    document.documentElement.classList.remove('account-pending');
    document.documentElement.classList.add('account-required');
    root.classList.add('is-visible');
    root.removeAttribute('aria-hidden');
    const demo = seedDemoAccount();
    emailInput.value = demo.email;
    passwordInput.value = demo.password;
    setMode('signin');
    setNotice(`Signed-in demo account ready: ${demo.email} / ${demo.password}`, 'success');
  }

  seedDemoAccount();
  setRole(role);
  setMode('signin');
  const mountAccountGate = () => {
    if (!root.isConnected) document.body.appendChild(root);
    startAccount();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAccountGate, { once: true });
  } else {
    mountAccountGate();
  }
})();
