'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not complete that request.');
  return data;
}

function setNotice(element, message, type = '') {
  if (!element) return;
  element.textContent = message;
  element.className = `${element.classList.contains('notice') ? 'notice' : 'auth-notice'}${type ? ` ${type}` : ''}`;
}

function dashboardPath(role) {
  const destinations = {
    admin: '/Dashboards/admin/admin.html',
    teacher: '/Dashboards/teachers/teacher.html',
    student: '/Dashboards/students/student.html',
    independent: '/Dashboards/students/student.html'
  };
  return destinations[role] || '/login.html';
}

function accountPage() {
  const form = $('#accountForm');
  if (!form) return;

  const notice = $('#accountNotice');
  const submit = $('#accountSubmit');
  const email = $('#accountEmail');
  const password = $('#accountPassword');
  const name = $('#accountName');
  const confirm = $('#accountConfirm');
  const schoolCode = $('#schoolCode');
  const roleButtons = $$('[data-role]');
  let role = 'student';
  let mode = 'signin';

  function setRole(next) {
    if (!['student', 'teacher', 'admin', 'independent'].includes(next)) return;
    role = next;
    if (role === 'admin') mode = 'signin';
    roleButtons.forEach((button) => {
      const selected = button.dataset.role === role;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    setMode(mode);
  }

  function setMode(next) {
    mode = role === 'admin' ? 'signin' : next;
    const signingUp = mode === 'signup';
    const isSchool = role === 'student' || role === 'teacher';
    $$('[data-signup-only]').forEach((field) => { field.hidden = !signingUp; });
    $('[data-confirm-only]').hidden = !signingUp;
    $('[data-password-hint]').hidden = !signingUp;
    $('[data-school-only]').hidden = !signingUp || !isSchool;
    $('[data-student-only]').hidden = !signingUp || role !== 'student';
    $('[data-admin-only]').hidden = role !== 'admin';
    $('#modeSwitch').hidden = role === 'admin';
    name.required = signingUp;
    confirm.required = signingUp;
    schoolCode.required = signingUp && isSchool;
    password.autocomplete = signingUp ? 'new-password' : 'current-password';
    password.minLength = signingUp ? 10 : 0;

    $('#authTitle').textContent = signingUp
      ? role === 'independent' ? 'Create your account' : `Create a ${role} account`
      : role === 'admin' ? 'Admin sign in'
        : role === 'independent' ? 'Independent student sign in' : 'Welcome back';
    $('#authDescription').textContent = signingUp
      ? role === 'independent'
        ? 'Create a personal account and start learning right away.'
        : role === 'teacher'
          ? 'Request teacher access using your school join code.'
          : 'Request access to your school learning space.'
      : role === 'admin'
        ? 'Sign in with the administrator account provided by the platform owner.'
        : role === 'independent'
          ? 'Sign in to your personal learning space.'
          : 'Sign in to continue to your school learning space.';
    submit.textContent = signingUp
      ? role === 'independent' ? 'Create independent account' : `Request ${role} access`
      : 'Sign in';
    $('#modeSwitch span').textContent = signingUp ? 'Already have an account?' : 'New to Figure It Out?';
    $('#modeToggle').textContent = signingUp ? 'Sign in' : 'Create an account';
    setNotice(notice, '');
  }

  roleButtons.forEach((button) => button.addEventListener('click', () => setRole(button.dataset.role)));
  $('#modeToggle').addEventListener('click', () => setMode(mode === 'signup' ? 'signin' : 'signup'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const emailValue = email.value.trim().toLowerCase();
    const passwordValue = password.value;
    email.value = emailValue;
    if (!email.validity.valid) {
      setNotice(notice, 'Enter a valid email address.', 'error');
      email.focus();
      return;
    }
    if (passwordValue.length < (mode === 'signup' ? 10 : 1)) {
      setNotice(notice, mode === 'signup' ? 'Use a password with at least 10 characters.' : 'Enter your password.', 'error');
      password.focus();
      return;
    }
    if (mode === 'signup') {
      if (name.value.trim().length < 2) {
        setNotice(notice, 'Enter your full name.', 'error');
        name.focus();
        return;
      }
      if (passwordValue !== confirm.value) {
        setNotice(notice, 'Your passwords do not match.', 'error');
        confirm.focus();
        return;
      }
      if ((role === 'student' || role === 'teacher') && schoolCode.value.trim().length !== 8) {
        setNotice(notice, 'Enter the 8-character school join code.', 'error');
        schoolCode.focus();
        return;
      }
    }

    submit.disabled = true;
    setNotice(notice, '');
    try {
      if (mode === 'signin') {
        const result = await api('/api/auth/signin', {
          method: 'POST',
          body: JSON.stringify({ email: emailValue, password: passwordValue, role })
        });
        window.location.replace(dashboardPath(result.user.role));
        return;
      }

      const result = await api('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: emailValue,
          password: passwordValue,
          fullName: name.value.trim(),
          role,
          schoolCode: schoolCode.value.trim().toUpperCase(),
          className: $('#className').value.trim(),
          stream: $('#stream').value.trim()
        })
      });
      if (result.authenticated && result.user) {
        window.location.replace(dashboardPath(result.user.role));
        return;
      }
      password.value = '';
      confirm.value = '';
      setMode('signin');
      setNotice(notice, result.message || 'Your account request was received.', 'success');
    } catch (error) {
      setNotice(notice, error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });

  setMode('signin');
  api('/api/auth/session').then((result) => {
    if (result.authenticated && result.user) window.location.replace(dashboardPath(result.user.role));
  }).catch(() => {
    setNotice(notice, 'The account service is unavailable. Please try again in a moment.', 'error');
  });
}

function makeEmpty(message) {
  const node = document.createElement('p');
  node.className = 'empty-state';
  node.textContent = message;
  return node;
}

function renderSchools(schools) {
  const list = $('#schoolList');
  if (!list) return;
  list.replaceChildren();

  const schoolCountStat = $('#schoolCountStat');
  const teacherCountStat = $('#teacherCountStat');
  const codeCountStat = $('#codeCountStat');
  const totalApprovedTeachers = schools.reduce((sum, school) => sum + Number(school.teachers || 0), 0);

  if (schoolCountStat) schoolCountStat.textContent = String(schools.length);
  if (teacherCountStat) teacherCountStat.textContent = String(totalApprovedTeachers);
  if (codeCountStat) codeCountStat.textContent = String(schools.length);

  if (!schools.length) {
    list.append(makeEmpty('No schools yet. Create one to issue its first join code.'));
    return;
  }
  schools.forEach((school) => {
    const item = document.createElement('article');
    item.className = 'item';
    const copy = document.createElement('div');
    copy.className = 'item-copy';
    const title = document.createElement('strong');
    title.textContent = school.name;
    const counts = document.createElement('small');
    counts.textContent = `${school.teachers} approved teachers · ${school.students} approved students`;
    const codeBox = document.createElement('div');
    codeBox.className = 'code-display';
    const label = document.createElement('small');
    label.textContent = 'School join code';
    const code = document.createElement('strong');
    code.textContent = school.code;
    codeBox.append(label, code);
    copy.append(title, counts, codeBox);
    item.append(copy);
    list.append(item);
  });
}

function renderApprovals(list, people, type, reload) {
  if (!list) return;
  list.replaceChildren();
  if (!people.length) {
    list.append(makeEmpty(type === 'teacher'
      ? 'No teachers are waiting for approval.'
      : 'No students are waiting for approval.'));
    return;
  }
  people.forEach((person) => {
    const item = document.createElement('article');
    item.className = 'item';
    const copy = document.createElement('div');
    copy.className = 'item-copy';
    const name = document.createElement('strong');
    name.textContent = person.full_name;
    const email = document.createElement('span');
    email.textContent = person.email;
    const details = document.createElement('small');
    details.textContent = type === 'teacher'
      ? person.schools?.name || 'School unavailable'
      : [person.schools?.name, person.class_name, person.stream].filter(Boolean).join(' · ');
    copy.append(name, email, details);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'primary-button';
    button.textContent = type === 'teacher' ? 'Approve teacher' : 'Approve student';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const path = type === 'teacher'
          ? `/api/platform/admin/teachers/${encodeURIComponent(person.id)}/approve`
          : `/api/platform/teacher/students/${encodeURIComponent(person.id)}/approve`;
        await api(path, { method: 'POST' });
        await reload();
      } catch (error) {
        const notice = type === 'teacher' ? $('#teacherNotice') : $('#studentNotice');
        setNotice(notice, error.message, 'error');
        button.disabled = false;
      }
    });
    item.append(copy, button);
    list.append(item);
  });
}

async function loadSchools() {
  const result = await api('/api/platform/admin/schools');
  renderSchools(result.schools || []);
}

async function loadTeachers() {
  const result = await api('/api/platform/admin/teachers/pending');
  const pendingCount = result.teachers ? result.teachers.length : 0;
  const pendingCountStat = $('#pendingCountStat');
  if (pendingCountStat) pendingCountStat.textContent = String(pendingCount);
  renderApprovals($('#teacherList'), result.teachers || [], 'teacher', loadTeachers);
  setNotice($('#teacherNotice'), '');
}

async function loadStudents() {
  const result = await api('/api/platform/teacher/students/pending');
  renderApprovals($('#studentList'), result.students || [], 'student', loadStudents);
  setNotice($('#studentNotice'), '');
}

async function dashboardPage() {
  const kind = document.body.dataset.dashboard;
  if (!kind) return;
  try {
    const result = await api('/api/auth/session');
    if (!result.authenticated || !result.user) {
      window.location.replace('/');
      return;
    }
    const user = result.user;
    const expected = kind === 'student' ? ['student', 'independent'] : [kind];
    if (!expected.includes(user.role)) {
      window.location.replace(dashboardPath(user.role));
      return;
    }
    $('#accountLabel').textContent = `${user.name} · ${user.email}`;

    if (kind === 'admin') {
      const form = $('#schoolForm');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const input = $('#schoolName');
        const button = $('button[type="submit"]', form);
        button.disabled = true;
        setNotice($('#schoolNotice'), '');
        try {
          await api('/api/platform/admin/schools', { method: 'POST', body: JSON.stringify({ name: input.value.trim() }) });
          input.value = '';
          setNotice($('#schoolNotice'), 'School created. Share its code with the school community.', 'success');
          await loadSchools();
        } catch (error) {
          setNotice($('#schoolNotice'), error.message, 'error');
        } finally {
          button.disabled = false;
        }
      });
      $('#refreshTeachers').addEventListener('click', () => loadTeachers().catch((error) => setNotice($('#teacherNotice'), error.message, 'error')));
      await Promise.all([loadSchools(), loadTeachers()]);
    } else if (kind === 'teacher') {
      $('#schoolName').textContent = user.school || 'your school';
      $('#refreshStudents').addEventListener('click', () => loadStudents().catch((error) => setNotice($('#studentNotice'), error.message, 'error')));
      await loadStudents();
    } else {
      const independent = user.role === 'independent';
      $('#studentHeading').textContent = `Welcome, ${user.name}`;
      $('#studentWelcome').textContent = independent ? 'Your learning journey starts here.' : `Welcome to ${user.school}.`;
      $('#studentMessage').textContent = independent
        ? 'Your independent account is ready. It is separate from school approval and school records.'
        : 'Your school account is active. Learning activities will appear here as they are shared with you.';
      $('#studentIntro').textContent = independent
        ? 'Your personal learning space is ready.'
        : 'You are signed in to your school learning space.';
      $('#studentAccountType').textContent = independent ? 'INDEPENDENT STUDENT' : 'SCHOOL STUDENT';
      const meta = $('#studentMeta');
      if (!independent) {
        [user.school, user.className, user.stream].filter(Boolean).forEach((value) => {
          const tag = document.createElement('span');
          tag.textContent = value;
          meta.append(tag);
        });
      }
    }
  } catch (error) {
    if (kind === 'admin') setNotice($('#teacherNotice'), error.message, 'error');
    else if (kind === 'teacher') setNotice($('#studentNotice'), error.message, 'error');
    else window.location.replace('/');
  }
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-signout]');
  if (!button) return;
  button.disabled = true;
  try {
    await api('/api/auth/signout', { method: 'POST' });
  } finally {
    window.location.replace('/');
  }
});

accountPage();
dashboardPage();