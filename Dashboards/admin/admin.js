document.addEventListener('DOMContentLoaded', () => {

    // =========================================
    // 1. BASIC ELEMENTS
    // =========================================

    const $ = id => document.getElementById(id);

    async function checkSession() {
        try {
            const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
            const data = await response.json();

            if (!response.ok || !data.authenticated || !data.user || data.user.role !== 'admin') {
                window.location.href = '/login.html';
                return false;
            }

            localStorage.setItem('adminName', data.user.name || 'Administrator');
            localStorage.setItem('adminEmail', data.user.email || '');
            $('adminName').textContent = data.user.name || 'Administrator';
            $('topAdminName').textContent = data.user.name || 'Administrator';
            $('welcomeName').textContent = data.user.name || 'Administrator';
            $('settingsName').value = data.user.name || 'Administrator';
            $('settingsEmail').value = data.user.email || '';
            return true;
        } catch (error) {
            console.error('Admin session check failed:', error);
            window.location.href = '/login.html';
            return false;
        }
    }

    const adminName = localStorage.getItem('adminName') || 'Administrator';
    const adminEmail = localStorage.getItem('adminEmail') || '';

    $('adminName').textContent = adminName;
    $('topAdminName').textContent = adminName;
    $('welcomeName').textContent = adminName;
    $('settingsName').value = adminName;
    $('settingsEmail').value = adminEmail;

    let subjects = [];
    let questions = [];
    let quizzes = [];

    // User records require a real user-management API.
    let users = [];

    // =========================================
    // 2. TOAST
    // =========================================

    let toastTimer;

    function showToast(message) {
        const toast = $('toast');
        toast.textContent = message;
        toast.classList.add('show');

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2800);
    }

    // =========================================
    // 3. MODALS
    // =========================================

    function openModal(id) {
        $(id).classList.add('show');
    }

    function closeModal(id) {
        $(id).classList.remove('show');
    }

    document.querySelectorAll('[data-open]').forEach(button => {
        button.addEventListener('click', () => openModal(button.dataset.open));
    });

    document.querySelectorAll('[data-close]').forEach(button => {
        button.addEventListener('click', () => closeModal(button.dataset.close));
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', event => {
            if (event.target === modal) modal.classList.remove('show');
        });
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            document.querySelectorAll('.modal.show').forEach(modal => {
                modal.classList.remove('show');
            });
        }
    });

    // =========================================
    // 4. NAVIGATION
    // =========================================

    $('menuToggle').addEventListener('click', () => {
        $('sidebar').classList.toggle('open');
    });

    document.querySelectorAll('.nav-link[href^="#"]').forEach(link => {
        link.addEventListener('click', () => {
            document.querySelectorAll('.nav-link').forEach(item => {
                item.classList.remove('active');
            });

            link.classList.add('active');
            $('sidebar').classList.remove('open');
        });
    });

    document.querySelectorAll('[data-scroll]').forEach(button => {
        button.addEventListener('click', () => {
            $(button.dataset.scroll).scrollIntoView({ behavior: 'smooth' });
        });
    });

    // =========================================
    // 5. SUBJECTS
    // =========================================

    function normalizeSubject(item) {
        return typeof item === 'string'
            ? item
            : item.name || item.title || item.course || '';
    }

    function getSubjectIcon(name) {
        const value = name.toLowerCase();

        if (value.includes('math')) return 'fa-calculator';
        if (value.includes('biology')) return 'fa-dna';
        if (value.includes('chemistry')) return 'fa-flask';
        if (value.includes('physics')) return 'fa-atom';
        if (value.includes('computer') || value.includes('ict') || value.includes('web')) return 'fa-laptop-code';
        if (value.includes('business') || value.includes('account')) return 'fa-briefcase';
        if (value.includes('beauty')) return 'fa-spa';
        if (value.includes('electrical')) return 'fa-bolt';
        if (value.includes('motor') || value.includes('automotive')) return 'fa-car';

        return 'fa-book-open';
    }

    function renderSubjects() {
        const search = $('subjectSearch').value.toLowerCase();

        const filtered = subjects.filter(subject =>
            subject.toLowerCase().includes(search)
        );

        $('subjectsGrid').innerHTML = '';

        filtered.forEach(subject => {
            const card = document.createElement('article');
            card.className = 'subject-card';

            const symbol = document.createElement('div');
            symbol.className = 'subject-symbol';
            symbol.innerHTML = `<i class="fas ${getSubjectIcon(subject)}"></i>`;

            const title = document.createElement('h3');
            title.textContent = subject;

            const description = document.createElement('p');
            description.textContent = 'Available learning subject.';

            card.append(symbol, title, description);
            $('subjectsGrid').appendChild(card);
        });

        $('subjectsEmpty').classList.toggle('hidden', filtered.length > 0);
        $('totalSubjects').textContent = subjects.length;
    }

    async function loadSubjects() {
        try {
            const response = await fetch('/api/subjects');

            if (!response.ok) throw new Error('Subject request failed');

            const data = await response.json();

            if (!data.success || !Array.isArray(data.subjects)) {
                throw new Error('Invalid subject response');
            }

            subjects = data.subjects.map(normalizeSubject).filter(Boolean);

            renderSubjects();
        } catch (error) {
            console.error(error);
            renderSubjects();
            showToast('Could not load subjects. Check the server.');
        }
    }

    $('subjectSearch').addEventListener('input', renderSubjects);

    $('subjectForm').addEventListener('submit', async event => {
        event.preventDefault();

        const name = $('newSubjectName').value.trim();

        if (!name) return;

        if (subjects.some(subject => subject.toLowerCase() === name.toLowerCase())) {
            showToast('This subject already exists.');
            return;
        }

        try {
            const response = await fetch('/api/platform/subjects', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not add subject.');
            closeModal('subjectModal');
            $('subjectForm').reset();
            await loadSubjects();
            updateStats();
            saveActivity(`Added subject: ${name}`);
            showToast('Subject added.');
        } catch (error) {
            showToast(error.message);
        }
    });

    // =========================================
    // 6. QUESTIONS
    // =========================================

    function renderQuestions() {
        const search = $('questionSearch').value.toLowerCase();
        const difficulty = $('questionDifficulty').value;

        const filtered = questions.filter(question => {
            const matchesSearch = String(question.question || '')
                .toLowerCase().includes(search);

            const matchesDifficulty = !difficulty ||
                question.difficulty === difficulty;

            return matchesSearch && matchesDifficulty;
        });

        $('questionsTable').innerHTML = '';

        filtered.forEach(question => {
            const row = document.createElement('tr');

            const values = [
                question.question || '',
                question.course || 'Unknown'
            ];

            values.forEach(value => {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.appendChild(cell);
            });

            const difficultyCell = document.createElement('td');
            const badge = document.createElement('span');
            const level = question.difficulty || 'easy';

            badge.className = `difficulty ${level}`;
            badge.textContent = level;
            difficultyCell.appendChild(badge);

            const answerCell = document.createElement('td');
            answerCell.textContent = question.answer || 'Not available';

            row.append(difficultyCell, answerCell);
            $('questionsTable').appendChild(row);
        });

        $('questionsEmpty').classList.toggle('hidden', filtered.length > 0);
        $('totalQuestions').textContent = questions.length;
    }

  async function loadQuestions() {
    if (!subjects.length) {
        questions = [];
        renderQuestions();
        updateStats();
        return;
    }

    try {
        const responses = await Promise.all(
            subjects.map(async subject => {
                const url = `/api/questions/${encodeURIComponent(subject)}?limit=750`;

                const response = await fetch(url);

                if (!response.ok) {
                    console.warn(`Could not load questions for: ${subject}`);
                    return [];
                }

                const data = await response.json();

                if (!data.success || !Array.isArray(data.questions)) {
                    return [];
                }

                return data.questions.map(question => ({
                    ...question,
                    course: question.course || subject
                }));
            })
        );

        questions = responses.flat();

        renderQuestions();
        updateStats();

    } catch (error) {
        console.error('Question loading error:', error);
        showToast('Unable to load questions. Check the server.');
    }
}

    $('questionSearch').addEventListener('input', renderQuestions);
    $('questionDifficulty').addEventListener('change', renderQuestions);

    // =========================================
    // 7. QUIZ OVERVIEW
    // =========================================

    async function loadQuizzes() {
        try {
            const response = await fetch('/api/platform/quizzes', { credentials: 'same-origin' });
            const data = await response.json();
            if (!response.ok || !Array.isArray(data.quizzes)) {
                throw new Error(data.error || 'Could not load challenges.');
            }
            quizzes = data.quizzes;
        } catch (error) {
            console.error('Challenge loading error:', error);
            showToast(error.message);
            quizzes = [];
        }
        renderQuizzes();
    }

    function renderQuizzes() {
        $('quizGrid').innerHTML = '';

        quizzes.forEach(quiz => {
            const card = document.createElement('article');
            card.className = 'quiz-card';

            const title = document.createElement('h3');
            title.textContent = quiz.title || 'Untitled Quiz';

            const description = document.createElement('p');
            description.textContent = quiz.description || 'Teacher-created challenge';

            const meta = document.createElement('div');
            meta.className = 'quiz-meta';
            meta.textContent = `${quiz.subject || 'Unknown'} • ${quiz.difficulty || 'Not set'} • ${quiz.limit || 0} questions`;

            card.append(title, description, meta);
            $('quizGrid').appendChild(card);
        });

        $('quizzesEmpty').classList.toggle('hidden', quizzes.length > 0);
        $('totalQuizzes').textContent = quizzes.length;
    }

    // =========================================
    // 8. USER MANAGEMENT
    // =========================================

    function renderUsers() {
        const search = $('userSearch').value.toLowerCase();
        const role = $('userRoleFilter').value;

        const filtered = users.filter(user => {
            const matchesSearch =
                String(user.name || '').toLowerCase().includes(search) ||
                String(user.email || '').toLowerCase().includes(search);

            const matchesRole = !role || user.role === role;

            return matchesSearch && matchesRole;
        });

        $('usersTable').innerHTML = '';

        filtered.forEach(user => {
            const row = document.createElement('tr');

            const nameCell = document.createElement('td');
            nameCell.textContent = user.name || 'Unknown';

            const emailCell = document.createElement('td');
            emailCell.textContent = user.email || 'Not provided';

            const roleCell = document.createElement('td');
            const roleBadge = document.createElement('span');
            roleBadge.className = `role-badge ${user.role || 'student'}`;
            roleBadge.textContent = user.role || 'student';
            roleCell.appendChild(roleBadge);

            const statusCell = document.createElement('td');
            const statusBadge = document.createElement('span');
            statusBadge.className = `status-badge ${user.status || 'active'}`;
            statusBadge.textContent = user.status || 'Active';
            statusCell.appendChild(statusBadge);

            const actionCell = document.createElement('td');
            if (user.role === 'teacher' && user.status === 'pending') {
                const approveButton = document.createElement('button');
                approveButton.className = 'small-button';
                approveButton.textContent = 'Approve';
                approveButton.addEventListener('click', async () => {
                    approveButton.disabled = true;
                    try {
                        const response = await fetch(`/api/platform/admin/teachers/${encodeURIComponent(user.id)}/approve`, {
                            method: 'POST',
                            credentials: 'same-origin'
                        });
                        const data = await response.json();
                        if (!response.ok) throw new Error(data.error || 'Could not approve teacher.');
                        await loadUsers();
                        showToast('Teacher account approved.');
                    } catch (error) {
                        approveButton.disabled = false;
                        showToast(error.message);
                    }
                });
                actionCell.appendChild(approveButton);
            } else {
                actionCell.textContent = '—';
            }
            row.append(nameCell, emailCell, roleCell, statusCell, actionCell);
            $('usersTable').appendChild(row);
        });

        $('usersEmpty').classList.toggle('hidden', filtered.length > 0);
    }

    async function loadUsers() {
        const response = await fetch('/api/platform/admin/users', { credentials: 'same-origin' });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.users)) {
            throw new Error(data.error || 'Could not load platform accounts.');
        }
        users = data.users;
        renderUsers();
        renderTeachers();
        renderStudents();
        updateStats();
    }

    $('userSearch').addEventListener('input', renderUsers);
    $('userRoleFilter').addEventListener('change', renderUsers);

    $('userForm').addEventListener('submit', event => {
        event.preventDefault();
        showToast('Users create their own account from the sign-in page. Share the school code with them.');
        closeModal('userModal');
    });

    // =========================================
    // 9. TEACHERS AND STUDENTS
    // =========================================

    function renderTeachers() {
        const teachers = users.filter(user => user.role === 'teacher');

        $('teachersTable').innerHTML = '';

        teachers.forEach(teacher => {
            const row = document.createElement('tr');

            [teacher.name, teacher.email, teacher.status || 'active', 'Teacher'].forEach(value => {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.appendChild(cell);
            });

            $('teachersTable').appendChild(row);
        });

        $('teachersEmpty').classList.toggle('hidden', teachers.length > 0);
        $('totalTeachers').textContent = teachers.length;
    }

    function renderStudents() {
        const search = $('studentSearch').value.toLowerCase();

        const students = users.filter(user =>
            user.role === 'student' &&
            String(user.name || '').toLowerCase().includes(search)
        );

        $('studentsTable').innerHTML = '';

        students.forEach(student => {
            const row = document.createElement('tr');

            [student.name, student.email, 'Active'].forEach(value => {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.appendChild(cell);
            });

            $('studentsTable').appendChild(row);
        });

        $('studentsEmpty').classList.toggle('hidden', students.length > 0);
        $('totalStudents').textContent = users.filter(user => user.role === 'student').length;
    }

    $('studentSearch').addEventListener('input', renderStudents);

    // =========================================
    // 10. STATISTICS
    // =========================================

    function updateStats() {
        $('totalUsers').textContent = users.length;
        $('totalTeachers').textContent = users.filter(user => user.role === 'teacher').length;
        $('totalStudents').textContent = users.filter(user => user.role === 'student').length;
        $('totalSubjects').textContent = subjects.length;
        $('totalQuestions').textContent = questions.length;
        $('totalQuizzes').textContent = quizzes.length;
    }

    // =========================================
    // 11. CHARTS
    // =========================================

    let chartsCreated = false;

    function createCharts() {
        if (typeof Chart === 'undefined' || chartsCreated) return;

        chartsCreated = true;

        const teacherCount = users.filter(user => user.role === 'teacher').length;
        const studentCount = users.filter(user => user.role === 'student').length;
        const adminCount = users.filter(user => user.role === 'admin').length;

        const difficultyCounts = ['easy', 'medium', 'hard'].map(level =>
            questions.filter(question => question.difficulty === level).length
        );

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#aeb6d0',
                        font: { size: 10 },
                        padding: 15
                    }
                }
            }
        };

        const userData = {
            labels: ['Students', 'Teachers', 'Admins'],
            datasets: [{
                data: [studentCount, teacherCount, adminCount],
                backgroundColor: ['#30d6a0', '#4da3ff', '#9270ff'],
                borderWidth: 0
            }]
        };

        const questionData = {
            labels: ['Easy', 'Medium', 'Hard'],
            datasets: [{
                data: difficultyCounts.some(Boolean) ? difficultyCounts : [1, 1, 1],
                backgroundColor: ['#30d6a0', '#ffad61', '#ff789b'],
                borderWidth: 0
            }]
        };

        ['usersChart', 'analyticsUsersChart'].forEach(id => {
            const canvas = $(id);

            if (canvas) {
                new Chart(canvas, {
                    type: 'doughnut',
                    data: userData,
                    options: chartOptions
                });
            }
        });

        ['questionsChart', 'analyticsQuestionsChart'].forEach(id => {
            const canvas = $(id);

            if (canvas) {
                new Chart(canvas, {
                    type: 'doughnut',
                    data: questionData,
                    options: chartOptions
                });
            }
        });
    }

    // =========================================
    // 12. ACTIVITY LOGS
    // =========================================

    function getActivities() {
        try {
            const saved = JSON.parse(localStorage.getItem('adminActivities') || '[]');
            return Array.isArray(saved) ? saved : [];
        } catch {
            return [];
        }
    }

    function saveActivity(message) {
        const activities = getActivities();

        activities.unshift({
            message,
            time: new Date().toLocaleString()
        });

        localStorage.setItem('adminActivities', JSON.stringify(activities.slice(0, 50)));
        renderActivities();
    }

    function renderActivities() {
        const activities = getActivities();

        $('activityList').innerHTML = '';

        activities.forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';

            const icon = document.createElement('div');
            icon.className = 'activity-icon';
            icon.innerHTML = '<i class="fas fa-clock"></i>';

            const content = document.createElement('div');

            const title = document.createElement('strong');
            title.textContent = activity.message;

            const description = document.createElement('p');
            description.textContent = 'Administrator action recorded locally';

            content.append(title, description);

            const time = document.createElement('time');
            time.textContent = activity.time;

            item.append(icon, content, time);
            $('activityList').appendChild(item);
        });

        $('activityEmpty').classList.toggle('hidden', activities.length > 0);
    }

    $('clearActivity').addEventListener('click', () => {
        if (!confirm('Clear all locally stored activity logs?')) return;

        localStorage.removeItem('adminActivities');
        renderActivities();
        showToast('Activity logs cleared.');
    });

    // =========================================
    // 13. SETTINGS
    // =========================================

    $('settingsForm').addEventListener('submit', event => {
        event.preventDefault();

        const name = $('settingsName').value.trim();
        const email = $('settingsEmail').value.trim();

        if (!name) {
            showToast('Enter an administrator name.');
            return;
        }

        localStorage.setItem('adminName', name);
        localStorage.setItem('adminEmail', email);

        $('adminName').textContent = name;
        $('topAdminName').textContent = name;
        $('welcomeName').textContent = name;

        saveActivity('Updated administrator profile');

        showToast('Profile saved in this browser. Sign in again to change account details.');
    });

    // =========================================
    // 14. SERVER STATUS
    // =========================================

    async function checkServer() {
        $('serverStatus').textContent = 'Checking...';

        try {
            const response = await fetch('/api/health');

            if (!response.ok) throw new Error('Server unavailable');

            const data = await response.json();

            $('serverStatus').textContent = data.success ? 'Online' : 'Unavailable';
        } catch (error) {
            $('serverStatus').textContent = 'Offline';
        }
    }

    $('checkServer').addEventListener('click', checkServer);

    // =========================================
    // 15. OTHER ACTIONS
    // =========================================

    $('logoutBtn').addEventListener('click', async event => {
        event.preventDefault();
        if (!confirm('Are you sure you want to log out?')) return;
        try {
            const response = await fetch('/api/auth/signout', {
                method: 'POST',
                credentials: 'same-origin'
            });
            if (!response.ok) throw new Error('Logout failed');
            localStorage.removeItem('fioUser');
            window.location.href = '/login.html';
        } catch (error) {
            console.error('Logout error:', error);
            showToast('Could not log out. Please try again.');
        }
    });

    // =========================================
    // 16. INITIALIZE
    // =========================================

    async function initializeAdmin() {
        const authenticated = await checkSession();

        if (!authenticated) return;

        await loadQuizzes();
        renderActivities();
        await loadSubjects();
        await loadQuestions();
        try {
            await loadUsers();
        } catch (error) {
            console.error('Could not load users:', error);
            showToast(error.message);
        }
        updateStats();
        createCharts();
        checkServer();
    }

    initializeAdmin();

});
