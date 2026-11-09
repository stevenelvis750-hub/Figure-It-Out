document.addEventListener('DOMContentLoaded', () => {

    // ======================================
    // 1. ELEMENTS AND TEACHER PROFILE
    // ======================================

    const $ = (id) => document.getElementById(id);

    async function checkSession() {
        try {
            const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
            const data = await response.json();
            if (!response.ok || !data.authenticated || !data.user || data.user.role !== 'teacher') {
                window.location.href = '/login.html';
                return false;
            }

            localStorage.setItem('fioUser', JSON.stringify(data.user));
            localStorage.setItem('teacherName', data.user.name || 'Teacher');
            localStorage.setItem('teacherEmail', data.user.email || '');
            return true;
        } catch (error) {
            console.error('Teacher session check failed:', error);
            window.location.href = '/login.html';
            return false;
        }
    }

    const teacherName = localStorage.getItem('teacherName') || 'Teacher';
    const teacherEmail = localStorage.getItem('teacherEmail') || '';

    const subjectsGrid = $('subjectsGrid');
    const questionsTable = $('questionsTable');
    const quizGrid = $('quizGrid');
    const studentsTable = $('studentsTable');

    let subjects = [];
    let questions = [];
    let quizzes = [];

    // ======================================
    // 2. TOAST NOTIFICATIONS
    // ======================================

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

    // ======================================
    // 3. MODAL CONTROLS
    // ======================================

    function openModal(id) {
        $(id).classList.add('show');
    }

    function closeModal(id) {
        $(id).classList.remove('show');
    }

    document.querySelectorAll('[data-open]').forEach(button => {
        button.addEventListener('click', () => {
            openModal(button.dataset.open);
        });
    });

    document.querySelectorAll('[data-close]').forEach(button => {
        button.addEventListener('click', () => {
            closeModal(button.dataset.close);
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', event => {
            if (event.target === modal) {
                modal.classList.remove('show');
            }
        });
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            document.querySelectorAll('.modal.show').forEach(modal => {
                modal.classList.remove('show');
            });
        }
    });

    $('createQuizTop').addEventListener('click', () => openModal('quizModal'));

    // ======================================
    // 4. SIDEBAR NAVIGATION
    // ======================================

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

    // ======================================
    // 5. SUBJECTS
    // ======================================

    function subjectIcon(name) {
        const value = name.toLowerCase();

        if (value.includes('math')) return 'fa-calculator';
        if (value.includes('biology')) return 'fa-dna';
        if (value.includes('chemistry')) return 'fa-flask';
        if (value.includes('physics')) return 'fa-atom';
        if (value.includes('computer') || value.includes('ict') || value.includes('web')) return 'fa-laptop-code';
        if (value.includes('business') || value.includes('account')) return 'fa-briefcase';
        if (value.includes('english') || value.includes('literature')) return 'fa-book';
        if (value.includes('history')) return 'fa-landmark';
        if (value.includes('geography')) return 'fa-earth-africa';
        if (value.includes('beauty') || value.includes('cosmetology')) return 'fa-spa';
        if (value.includes('electrical')) return 'fa-bolt';
        if (value.includes('automotive') || value.includes('motor')) return 'fa-car';

        return 'fa-book-open';
    }

    function normalizeSubject(item) {
        return typeof item === 'string'
            ? item
            : item.name || item.title || item.course || '';
    }

    function populateSubjectSelectors() {
        const selectors = [
            $('questionSubjectFilter'),
            $('newQuestionSubject'),
            $('quizSubject')
        ];

        selectors.forEach(select => {
            const previousValue = select.value;

            select.innerHTML = select.id === 'questionSubjectFilter'
                ? '<option value="">All Subjects</option>'
                : '<option value="">Choose a subject</option>';

            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject;
                option.textContent = subject;
                select.appendChild(option);
            });

            if (subjects.includes(previousValue)) {
                select.value = previousValue;
            }
        });
    }

    function renderSubjects() {
        const search = $('subjectSearch').value.toLowerCase();

        const filtered = subjects.filter(subject =>
            subject.toLowerCase().includes(search)
        );

        subjectsGrid.innerHTML = '';

        filtered.forEach(subject => {
            const card = document.createElement('article');
            card.className = 'subject-card';

            const icon = document.createElement('div');
            icon.className = 'subject-symbol';
            icon.innerHTML = '<i class="fas ' + subjectIcon(subject) + '"></i>';

            const title = document.createElement('h3');
            title.textContent = subject;

            const description = document.createElement('p');
            description.textContent = 'Teaching subject and question bank.';

            const actions = document.createElement('div');
            actions.className = 'card-actions';

            const addButton = document.createElement('button');
            addButton.className = 'small-button';
            addButton.textContent = 'Add Question';

            addButton.addEventListener('click', () => {
                $('newQuestionSubject').value = subject;
                openModal('questionModal');
            });

            actions.appendChild(addButton);
            card.append(icon, title, description, actions);
            subjectsGrid.appendChild(card);
        });

        $('subjectsEmpty').classList.toggle('hidden', filtered.length > 0);
        $('totalSubjects').textContent = subjects.length;
    }

    async function loadSubjects() {
        try {
            const response = await fetch('/api/subjects', { credentials: 'same-origin' });
            const data = await response.json();
            if (!response.ok || !data.success || !Array.isArray(data.subjects)) {
                throw new Error(data.error || data.message || 'Could not load subjects.');
            }
            subjects = data.subjects.map(normalizeSubject).filter(Boolean);
            populateSubjectSelectors();
            renderSubjects();
            updateDashboardStats();
        } catch (error) {
            console.error('Subject loading error:', error);
            showToast(error.message || 'Could not load subjects.');
            renderSubjects();
        }
    }

    $('subjectSearch').addEventListener('input', renderSubjects);

    $('subjectForm').addEventListener('submit', async event => {
        event.preventDefault();

        const name = $('newSubjectName').value.trim();

        if (!name) return;

        if (subjects.some(item => item.toLowerCase() === name.toLowerCase())) {
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
            showToast('Subject added.');
        } catch (error) {
            showToast(error.message);
        }
    });

    // ======================================
    // 6. QUESTION BANK
    // ======================================

    function renderQuestions() {
        const search = $('questionSearch').value.toLowerCase();
        const subjectFilter = $('questionSubjectFilter').value;
        const difficultyFilter = $('questionDifficultyFilter').value;

        const filtered = questions.filter(question => {
            const text = String(question.question || '').toLowerCase();
            const matchesSearch = text.includes(search);
            const matchesSubject = !subjectFilter || question.course === subjectFilter;
            const matchesDifficulty = !difficultyFilter ||
                question.difficulty === difficultyFilter;

            return matchesSearch && matchesSubject && matchesDifficulty;
        });

        questionsTable.innerHTML = '';

        filtered.forEach(question => {
            const row = document.createElement('tr');

            const questionCell = document.createElement('td');
            questionCell.textContent = question.question;

            const subjectCell = document.createElement('td');
            subjectCell.textContent = question.course || 'Unknown';

            const difficultyCell = document.createElement('td');
            const badge = document.createElement('span');
            const difficulty = question.difficulty || 'easy';
            badge.className = 'difficulty ' + difficulty;
            badge.textContent = difficulty;
            difficultyCell.appendChild(badge);

            const answerCell = document.createElement('td');
            answerCell.textContent = question.answer || 'Not available';

            const actionCell = document.createElement('td');
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.textContent = 'Delete';

            if (question.id) {
                deleteButton.addEventListener('click', async () => {
                    if (!confirm('Delete this question?')) return;
                    try {
                        const response = await fetch(`/api/platform/questions/${encodeURIComponent(question.id)}`, {
                            method: 'DELETE',
                            credentials: 'same-origin'
                        });
                        const data = await response.json();
                        if (!response.ok) throw new Error(data.error || 'Could not delete question.');
                        await loadQuestions();
                        showToast('Question deleted.');
                    } catch (error) {
                        showToast(error.message);
                    }
                });
                actionCell.appendChild(deleteButton);
            } else {
                actionCell.textContent = 'Question bank';
            }
            row.append(questionCell, subjectCell, difficultyCell, answerCell, actionCell);
            questionsTable.appendChild(row);
        });

        $('questionsEmpty').classList.toggle('hidden', filtered.length > 0);
        $('totalQuestions').textContent = questions.length;
    }

    async function loadQuestions() {
        try {
            const results = await Promise.all(
                subjects.map(async subject => {
                    const url = '/api/questions?course=' + encodeURIComponent(subject) + '&limit=750';
                    const response = await fetch(url, { credentials: 'same-origin' });

                    if (!response.ok) return [];

                    const data = await response.json();
                    if (!data.success || !Array.isArray(data.questions)) return [];

                    return data.questions.map(question => ({
                        ...question,
                        course: question.course || subject
                    }));
                })
            );

            questions = results.flat();
            renderQuestions();
            updateDashboardStats();
        } catch (error) {
            console.error('Question loading error:', error);
            showToast('Unable to load question bank.');
        }
    }

    $('questionSearch').addEventListener('input', renderQuestions);
    $('questionSubjectFilter').addEventListener('change', renderQuestions);
    $('questionDifficultyFilter').addEventListener('change', renderQuestions);

    $('questionForm').addEventListener('submit', async event => {
        event.preventDefault();

        const options = [
            $('optionA').value.trim(),
            $('optionB').value.trim(),
            $('optionC').value.trim(),
            $('optionD').value.trim()
        ].filter(Boolean);

        const correctIndex = Number($('correctAnswer').value);

        if (!options[correctIndex]) {
            showToast('Select a correct answer that has been filled in.');
            return;
        }

        if (new Set(options.map(option => option.toLowerCase())).size !== options.length) {
            showToast('Answer options must be different.');
            return;
        }

        const question = {
            question: $('newQuestionText').value.trim(),
            options,
            answer: options[correctIndex],
            difficulty: $('newQuestionDifficulty').value,
            course: $('newQuestionSubject').value
        };

        if (!question.course) {
            showToast('Choose a subject first.');
            return;
        }

        try {
            const response = await fetch('/api/platform/questions', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(question)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not save question.');
            closeModal('questionModal');
            $('questionForm').reset();
            await loadSubjects();
            await loadQuestions();
            showToast('Question saved to the shared question bank.');
        } catch (error) {
            showToast(error.message);
        }
    });

    // ======================================
    // 7. QUIZ CREATION
    // ======================================

    function renderQuizzes() {
        quizGrid.innerHTML = '';

        quizzes.forEach((quiz) => {
            const card = document.createElement('article');
            card.className = 'quiz-card';

            const title = document.createElement('h3');
            title.textContent = quiz.title;

            const description = document.createElement('p');
            description.textContent = quiz.description || 'Teacher-created challenge';

            const meta = document.createElement('div');
            meta.className = 'quiz-meta';
            meta.textContent = quiz.subject + ' • ' + quiz.difficulty + ' • ' + quiz.limit + ' questions';

            const actions = document.createElement('div');
            actions.className = 'card-actions';

            const deleteButton = document.createElement('button');
            deleteButton.className = 'small-button';
            deleteButton.textContent = 'Remove';

            deleteButton.addEventListener('click', async () => {
                if (!confirm('Remove this challenge?')) return;
                try {
                    const response = await fetch(`/api/platform/quizzes/${encodeURIComponent(quiz.id)}`, {
                        method: 'DELETE',
                        credentials: 'same-origin'
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Could not remove challenge.');
                    quizzes = quizzes.filter((item) => item.id !== quiz.id);
                    renderQuizzes();
                    updateDashboardStats();
                    showToast('Challenge removed.');
                } catch (error) {
                    showToast(error.message);
                }
            });

            const startButton = document.createElement('button');
            startButton.className = 'small-button';
            startButton.textContent = 'Preview';
            startButton.addEventListener('click', () => {
                const url = new URL('/index.html', window.location.origin);
                url.searchParams.set('course', quiz.subject);
                url.searchParams.set('difficulty', quiz.difficulty);
                url.searchParams.set('length', String(quiz.limit));
                window.location.href = url.toString();
            });

            actions.append(startButton, deleteButton);
            card.append(title, description, meta, actions);
            quizGrid.appendChild(card);
        });

        $('quizzesEmpty').classList.toggle('hidden', quizzes.length > 0);
        $('totalQuizzes').textContent = quizzes.length;
    }

    async function loadSavedQuizzes() {
        try {
            const response = await fetch('/api/platform/quizzes', { credentials: 'same-origin' });
            const data = await response.json();
            if (!response.ok || !Array.isArray(data.quizzes)) {
                throw new Error(data.error || 'Could not load challenges.');
            }
            quizzes = data.quizzes;
            renderQuizzes();
        } catch (error) {
            console.error('Challenge loading error:', error);
            showToast(error.message);
        }
    }

    $('quizForm').addEventListener('submit', async event => {
        event.preventDefault();

        const quiz = {
            title: $('quizTitle').value.trim(),
            subject: $('quizSubject').value,
            difficulty: $('quizDifficulty').value,
            limit: Number($('quizLimit').value),
            description: $('quizDescription').value.trim()
        };

        if (!quiz.subject) {
            showToast('Please choose a subject.');
            return;
        }

        if (!Number.isInteger(quiz.limit) || quiz.limit < 1 || quiz.limit > 750) {
            showToast('Choose between 1 and 750 questions.');
            return;
        }

        try {
            const response = await fetch('/api/platform/quizzes', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quiz)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not create challenge.');
            quizzes.push(data.quiz);
            renderQuizzes();
            updateDashboardStats();
            closeModal('quizModal');
            $('quizForm').reset();
            showToast('Challenge created.');
        } catch (error) {
            showToast(error.message);
        }
    });

    // ======================================
    // 8. STUDENT RECORDS
    // ======================================

    async function renderStudents() {
        const search = $('studentSearch').value.toLowerCase();
        try {
            const response = await fetch('/api/platform/teacher/students', { credentials: 'same-origin' });
            const data = await response.json();
            if (!response.ok || !Array.isArray(data.students)) {
                throw new Error(data.error || 'Could not load students.');
            }
            const filtered = data.students.filter((student) =>
                String(student.name || '').toLowerCase().includes(search) ||
                String(student.email || '').toLowerCase().includes(search)
            );
            studentsTable.innerHTML = '';
            filtered.forEach((student) => {
                const row = document.createElement('tr');
                [student.name, student.challenges || 0, student.points || 0, student.status].forEach((value) => {
                    const cell = document.createElement('td');
                    cell.textContent = String(value ?? '');
                    row.appendChild(cell);
                });
                studentsTable.appendChild(row);
            });
            $('studentsEmpty').classList.toggle('hidden', filtered.length > 0);
            $('totalStudents').textContent = data.students.length;
        } catch (error) {
            console.error('Could not load students:', error);
            showToast(error.message);
        }
    }

    $('studentSearch').addEventListener('input', renderStudents);

    // ======================================
    // 9. DASHBOARD STATISTICS
    // ======================================

    function updateDashboardStats() {
        $('totalSubjects').textContent = subjects.length;
        $('totalQuestions').textContent = questions.length;
        $('totalQuizzes').textContent = quizzes.length;
    }

    // ======================================
    // 10. CHARTS
    // ======================================

    function createCharts() {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js is not available.');
            return;
        }

        const performanceCanvas = $('performanceChart');

        if (performanceCanvas) {
            new Chart(performanceCanvas, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Performance',
                        data: [0, 0, 0, 0, 0, 0, 0],
                        borderColor: '#9270ff',
                        backgroundColor: 'rgba(146,112,255,.12)',
                        fill: true,
                        tension: .4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#aeb6d0', font: { size: 10 } } }
                    },
                    scales: {
                        x: { ticks: { color: '#8c96b2' }, grid: { color: 'rgba(255,255,255,.04)' } },
                        y: { beginAtZero: true, ticks: { color: '#8c96b2' }, grid: { color: 'rgba(255,255,255,.04)' } }
                    }
                }
            });
        }

        const difficultyCanvas = $('difficultyChart');

        if (difficultyCanvas) {
            const counts = ['easy', 'medium', 'hard'].map(level =>
                questions.filter(question => question.difficulty === level).length
            );

            new Chart(difficultyCanvas, {
                type: 'doughnut',
                data: {
                    labels: ['Easy', 'Medium', 'Hard'],
                    datasets: [{
                        data: counts.some(Boolean) ? counts : [1, 1, 1],
                        backgroundColor: ['#30d6a0', '#ffad61', '#ff718d'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#aeb6d0', padding: 18, font: { size: 10 } }
                        }
                    }
                }
            });
        }
    }

    // ======================================
    // 11. SETTINGS
    // ======================================

    $('settingsForm').addEventListener('submit', event => {
        event.preventDefault();

        const name = $('settingsName').value.trim();
        const email = $('settingsEmail').value.trim();

        if (!name) {
            showToast('Enter your name.');
            return;
        }

        localStorage.setItem('teacherName', name);
        localStorage.setItem('teacherEmail', email);

        $('teacherName').textContent = name;
        $('topTeacherName').textContent = name;
        $('welcomeName').textContent = name;

        showToast('Profile saved in this browser.');
    });

    // ======================================
    // 12. OTHER BUTTONS
    // ======================================

    $('notificationBtn').addEventListener('click', () => {
        showToast('You have no new notifications.');
    });

    $('helpBtn').addEventListener('click', event => {
        event.preventDefault();
        showToast('Help Center will be available soon.');
    });

    $('logoutBtn').addEventListener('click', async event => {
        event.preventDefault();

        if (!confirm('Are you sure you want to log out?')) return;

        try {
            const response = await fetch('/api/auth/signout', {
                method: 'POST',
                credentials: 'same-origin'
            });
            if (!response.ok) throw new Error('Logout failed.');
            localStorage.removeItem('fioUser');
            localStorage.removeItem('teacherName');
            localStorage.removeItem('teacherEmail');
            window.location.href = '/login.html';
        } catch (error) {
            console.error('Teacher logout failed:', error);
            showToast('Could not log out. Please try again.');
        }
    });

    // ======================================
    // 13. START DASHBOARD
    // ======================================

    async function initializeDashboard() {
        const authenticated = await checkSession();

        if (!authenticated) return;

        const user = JSON.parse(localStorage.getItem('fioUser') || 'null');
        const name = user?.name || 'Teacher';
        const email = user?.email || '';
        $('teacherName').textContent = name;
        $('topTeacherName').textContent = name;
        $('welcomeName').textContent = name;
        $('settingsName').value = name;
        $('settingsEmail').value = email;

        await loadSubjects();
        await loadQuestions();
        await Promise.all([loadSavedQuizzes(), renderStudents()]);

        createCharts();
        updateDashboardStats();
    }

    initializeDashboard();

});
