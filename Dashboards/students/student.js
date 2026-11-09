
/* =========================================
   FIGURE IT OUT
   STUDENT DASHBOARD JAVASCRIPT
========================================= */

document.addEventListener('DOMContentLoaded', () => {

    // =====================================
    // ELEMENTS
    // =====================================

    const subjectsGrid = document.getElementById('subjectsGrid');
    const subjectCount = document.getElementById('subjectCount');
    const subjectLabel = document.getElementById('subjectLabel');
    const subjectSearch = document.getElementById('subjectSearch');
    const difficultyFilter = document.getElementById('difficultyFilter');

    const challengeModal = document.getElementById('challengeModal');
    const closeModal = document.getElementById('closeModal');
    const challengeForm = document.getElementById('challengeForm');
    const challengeSubject = document.getElementById('challengeSubject');
    const challengeDifficulty = document.getElementById('challengeDifficulty');
    const questionLimit = document.getElementById('questionLimit');

    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    const toast = document.getElementById('toast');

    let subjects = [];
    let selectedSubject = '';
    let selectedDifficulty = 'easy';

    async function checkSession() {
        try {
            const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
            const data = await response.json();

            if (!response.ok || !data.authenticated || !data.user || !['student', 'independent'].includes(data.user.role)) {
                window.location.href = '/login.html';
                return false;
            }

            localStorage.setItem('studentName', data.user.name || 'Student');
            localStorage.setItem('studentEmail', data.user.email || '');
            student.name = data.user.name || 'Student';
            return true;
        } catch (error) {
            console.error('Student session check failed:', error);
            window.location.href = '/login.html';
            return false;
        }
    }

    // =====================================
    // STUDENT INFORMATION
    // =====================================

    const student = {
        name: localStorage.getItem('studentName') || 'Student',
        points: Number(localStorage.getItem('studentPoints')) || 0,
        challenges: Number(localStorage.getItem('studentChallenges')) || 0,
        streak: Number(localStorage.getItem('studentStreak')) || 0
    };

    function renderStudentSummary() {
        document.getElementById('studentName').textContent = student.name;
        document.querySelector('.avatar').textContent = student.name.charAt(0).toUpperCase();
        document.getElementById('totalPoints').textContent = student.points.toLocaleString();
        document.getElementById('challengeCount').textContent = String(student.challenges);
        document.getElementById('learningStreak').textContent = `${student.streak} Days`;
    }

    renderStudentSummary();

    // =====================================
    // TOAST NOTIFICATIONS
    // =====================================

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');

        clearTimeout(showToast.timeout);

        showToast.timeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // =====================================
    // LOAD SUBJECTS FROM BACKEND
    // =====================================

    async function loadSubjects() {

        subjectsGrid.innerHTML = `
            <div class="loading-state">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p>Loading your subjects...</p>
            </div>
        `;

        try {
            const response = await fetch('/api/subjects', { credentials: 'same-origin' });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            const data = await response.json();

            if (!data.success || !Array.isArray(data.subjects)) {
                throw new Error('Invalid subjects response');
            }

            subjects = data.subjects
                .map(subject => {
                    if (typeof subject === 'string') {
                        return subject.trim();
                    }

                    return String(subject.name || subject.course || '').trim();
                })
                .filter(Boolean);

            // Remove duplicate subject names.
            subjects = [...new Map(
                subjects.map(subject => [
                    subject.toLowerCase(),
                    subject
                ])
            ).values()];

            subjectCount.textContent = subjects.length;
            subjectLabel.textContent = `${subjects.length} Subjects`;

            populateSubjectSelector();
            renderSubjects(subjects);

        } catch (error) {

            console.error('Subject loading error:', error);

            subjectsGrid.innerHTML = `
                <div class="loading-state">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <p>Unable to load subjects.</p>
                    <button class="retry-button" id="retrySubjects">
                        Try Again
                    </button>
                </div>
            `;

            subjectCount.textContent = '—';
            subjectLabel.textContent = 'Connection error';

            document.getElementById('retrySubjects')
                .addEventListener('click', loadSubjects);
        }
    }

    // =====================================
    // SUBJECT ICONS
    // =====================================

    function getSubjectIcon(subject) {

        const name = subject.toLowerCase();

        const icons = [
            { words: ['math'], icon: 'fa-calculator' },
            { words: ['biology'], icon: 'fa-dna' },
            { words: ['chemistry'], icon: 'fa-flask' },
            { words: ['physics'], icon: 'fa-atom' },
            { words: ['english', 'literature'], icon: 'fa-book' },
            { words: ['kiswahili'], icon: 'fa-language' },
            { words: ['geography'], icon: 'fa-earth-africa' },
            { words: ['history'], icon: 'fa-landmark' },
            { words: ['computer', 'ict', 'web development', 'software'], icon: 'fa-code' },
            { words: ['business', 'accounting', 'economics'], icon: 'fa-briefcase' },
            { words: ['agriculture'], icon: 'fa-seedling' },
            { words: ['electrical'], icon: 'fa-bolt' },
            { words: ['automotive', 'motor vehicle'], icon: 'fa-car' },
            { words: ['beauty', 'cosmetology', 'hair'], icon: 'fa-scissors' },
            { words: ['catering', 'baking', 'cook'], icon: 'fa-utensils' },
            { words: ['creative arts', 'graphic design'], icon: 'fa-palette' },
            { words: ['science'], icon: 'fa-microscope' },
            { words: ['driving'], icon: 'fa-car-side' },
            { words: ['videography', 'photography'], icon: 'fa-camera' },
            { words: ['religion', 'c.r.e', 'i.r.e'], icon: 'fa-book-open' }
        ];

        const match = icons.find(item =>
            item.words.some(word => name.includes(word))
        );

        return match ? match.icon : 'fa-book-open';
    }

    // =====================================
    // DISPLAY SUBJECTS
    // =====================================

    function renderSubjects(list) {

        subjectsGrid.innerHTML = '';

        if (list.length === 0) {
            document.getElementById('subjectEmpty').hidden = false;
            return;
        }

        document.getElementById('subjectEmpty').hidden = true;

        list.forEach((subject, index) => {

            const card = document.createElement('article');

            card.className = 'subject-card';
            card.style.animationDelay = `${index * 0.06}s`;

            const icon = getSubjectIcon(subject);

            card.innerHTML = `
                <div class="subject-top">
                    <div class="subject-icon">
                        <i class="fa-solid ${icon}"></i>
                    </div>

                    <span class="subject-tag">AVAILABLE</span>
                </div>

                <h3></h3>

                <p>
                    Test your knowledge, improve your skills
                    and discover something new.
                </p>

                <div class="subject-footer">
                    <span>Figure It Out</span>

                    <button type="button" class="start-subject">
                        Start <i class="fa-solid fa-arrow-right"></i>
                    </button>
                </div>
            `;

            // Use textContent for the subject name.
            card.querySelector('h3').textContent = subject;

            card.querySelector('.start-subject')
                .addEventListener('click', () => {
                    const difficulty = difficultyFilter.value === 'all' ? 'easy' : difficultyFilter.value;
                    openChallenge(subject, difficulty);
                });

            subjectsGrid.appendChild(card);
        });
    }

    // =====================================
    // SEARCH SUBJECTS
    // =====================================

    subjectSearch.addEventListener('input', () => {

        const search = subjectSearch.value.toLowerCase().trim();

        const filtered = subjects.filter(subject =>
            subject.toLowerCase().includes(search)
        );

        renderSubjects(filtered);
    });

    // =====================================
    // POPULATE CHALLENGE SUBJECTS
    // =====================================

    function populateSubjectSelector() {

        challengeSubject.innerHTML = `
            <option value="">Choose a subject</option>
        `;

        subjects.forEach(subject => {

            const option = document.createElement('option');

            option.value = subject;
            option.textContent = subject;

            challengeSubject.appendChild(option);
        });
    }

    // =====================================
    // OPEN CHALLENGE MODAL
    // =====================================

    function openChallenge(subject = '', difficulty = 'easy') {

        if (subjects.length === 0) {
            showToast('No subjects are currently available.');
            return;
        }

        selectedSubject = subject;
        selectedDifficulty = difficulty;

        challengeSubject.value = subject;
        challengeDifficulty.value = difficulty;

        challengeModal.classList.add('show');
    }

    function hideChallengeModal() {
        challengeModal.classList.remove('show');
    }

    closeModal.addEventListener('click', hideChallengeModal);

    challengeModal.addEventListener('click', event => {
        if (event.target === challengeModal) {
            hideChallengeModal();
        }
    });

    // =====================================
    // QUICK CHALLENGES
    // =====================================

    document.querySelectorAll('.challenge-btn').forEach(button => {

        button.addEventListener('click', () => {

            const difficulty = button.dataset.difficulty;

            openChallenge('', difficulty);
        });
    });

    document.getElementById('startLearningBtn').addEventListener('click', () => {
        const defaultSubject = subjects[0] || '';
        openChallenge(defaultSubject, 'easy');
    });

    // =====================================
    // FILTER BY DIFFICULTY
    // =====================================

    difficultyFilter.addEventListener('change', () => {

        const difficulty = difficultyFilter.value;

        // Difficulty is selected in the challenge modal.
        if (difficulty !== 'all') {
            selectedDifficulty = difficulty;
            showToast(`New challenges will start at ${difficulty} difficulty.`);
        } else {
            selectedDifficulty = 'easy';
            showToast('Showing all subjects.');
        }
    });

    // =====================================
    // START EXISTING QUIZ
    // =====================================

    challengeForm.addEventListener('submit', async event => {

        event.preventDefault();

        const course = challengeSubject.value;
        const difficulty = challengeDifficulty.value;
        const limit = Number(questionLimit.value);

        if (!course) {
            showToast('Please choose a subject first.');
            return;
        }

        if (!Number.isInteger(limit) || limit < 1 || limit > 750) {
            showToast('Choose a valid challenge length between 1 and 750 questions.');
            return;
        }

        const submitButton = challengeForm.querySelector('button[type="submit"]');

        submitButton.disabled = true;
        submitButton.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Preparing Challenge...
        `;

        try {

            const response = await fetch(
                `/api/questions?course=${encodeURIComponent(course)}&difficulty=${encodeURIComponent(difficulty)}&limit=750`,
                { credentials: 'same-origin' }
            );

            if (!response.ok) {
                throw new Error(`Could not load questions from the server (HTTP ${response.status}).`);
            }

            const data = await response.json();

            if (!data.success || !Array.isArray(data.questions)) {
                throw new Error('The question bank response is invalid.');
            }

            if (data.questions.length === 0) {
                throw new Error(
                    `No ${difficulty} questions are currently available for ${course}.`
                );
            }

            // Store challenge details for the existing quiz.
            sessionStorage.setItem('fioSelectedCourse', course);
            sessionStorage.setItem('fioSelectedDifficulty', difficulty);
            sessionStorage.setItem('fioQuestionLimit', String(limit));

            const challengeUrl = new URL('../../index.html', window.location.href);
            challengeUrl.searchParams.set('course', course);
            challengeUrl.searchParams.set('difficulty', difficulty);
            challengeUrl.searchParams.set('length', String(limit));

            // Start the existing Figure It Out quiz.
            window.location.href = challengeUrl.toString();

        } catch (error) {

            console.error('Challenge error:', error);
            showToast(error.message);

        } finally {

            submitButton.disabled = false;

            submitButton.innerHTML = `
                Start Learning
                <i class="fa-solid fa-arrow-right"></i>
            `;
        }
    });

    // =====================================
    // MOBILE SIDEBAR
    // =====================================

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    document.querySelectorAll('.nav-link').forEach(link => {

        link.addEventListener('click', () => {

            document.querySelectorAll('.nav-link').forEach(item => {
                item.classList.remove('active');
            });

            link.classList.add('active');

            sidebar.classList.remove('open');
        });
    });

    // =====================================
    // LOGOUT
    // =====================================

    document.getElementById('logoutBtn')
        .addEventListener('click', async () => {

            const confirmed = confirm('Are you sure you want to log out?');

            if (!confirmed) return;

            try {
                const response = await fetch('/api/auth/signout', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Logout failed');
                }

                localStorage.removeItem('fioUser');
                window.location.href = '/login.html';
            } catch (error) {
                console.error('Student logout error:', error);
                showToast('Could not log out. Please try again.');
            }
        });

    // =====================================
    // HELP BUTTON
    // =====================================

    document.getElementById('helpBtn')
        .addEventListener('click', () => {
            showToast('Help and support will be available soon.');
        });

    // =====================================
    // NOTIFICATIONS
    // =====================================

    document.getElementById('notificationBtn')
        .addEventListener('click', () => {
            showToast('You have no new notifications.');
        });

    // =====================================
    // PROFILE
    // =====================================

    document.getElementById('profileBtn')
        .addEventListener('click', () => {
            showToast(`Logged in as ${student.name}`);
        });

    // =====================================
    // ACHIEVEMENTS
    // =====================================

    function updateAchievements() {
        const completed = student.challenges;
        const points = student.points;
        const achievements = document.querySelectorAll(
            '.achievement-item'
        );
        const conditions = [
            completed >= 1,
            subjects.length >= 5,
            points >= 1000
        ];

        achievements.forEach((item, index) => {

            const status = item.querySelector('.achievement-status');

            if (conditions[index]) {
                status.textContent = 'Unlocked';
                status.classList.add('unlocked');
            } else {
                status.textContent = 'Locked';
                status.classList.remove('unlocked');
            }
        });
    }

    async function loadStudentActivity() {
        try {
            const response = await fetch('/api/platform/student/dashboard', { credentials: 'same-origin' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not load learning activity.');

            student.points = Number(data.points) || 0;
            student.challenges = Number(data.challenges) || 0;
            student.streak = Number(data.streak) || 0;
            renderStudentSummary();
            localStorage.setItem('studentPoints', String(student.points));
            localStorage.setItem('studentChallenges', String(student.challenges));
            localStorage.setItem('studentStreak', String(student.streak));

            const activityList = document.getElementById('activityList');
            activityList.replaceChildren();
            if (!Array.isArray(data.activity) || data.activity.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'activity-empty';
                empty.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i><p>Your learning activity will appear here.</p>';
                activityList.appendChild(empty);
                return;
            }

            data.activity.slice(0, 5).forEach((entry) => {
                const item = document.createElement('div');
                item.className = 'activity-item';
                const text = document.createElement('p');
                text.textContent = `${entry.course}: ${entry.correct}/${entry.total} correct (${entry.points} points)`;
                const time = document.createElement('time');
                time.textContent = new Date(entry.createdAt).toLocaleString();
                item.append(text, time);
                activityList.appendChild(item);
            });
        } catch (error) {
            console.error('Activity loading error:', error);
            showToast(error.message);
        }
    }

    async function loadAssignedQuizzes() {
        const grid = document.getElementById('assignedQuizGrid');
        const empty = document.getElementById('assignedQuizEmpty');
        try {
            const response = await fetch('/api/platform/quizzes', { credentials: 'same-origin' });
            const data = await response.json();
            if (!response.ok || !Array.isArray(data.quizzes)) {
                throw new Error(data.error || 'Could not load teacher challenges.');
            }
            grid.replaceChildren();
            data.quizzes.forEach((quiz) => {
                const card = document.createElement('article');
                card.className = 'subject-card';
                const title = document.createElement('h3');
                title.textContent = quiz.title;
                const detail = document.createElement('p');
                detail.textContent = `${quiz.subject} · ${quiz.difficulty} · ${quiz.limit} questions`;
                const start = document.createElement('button');
                start.type = 'button';
                start.className = 'start-subject';
                start.textContent = 'Start challenge';
                start.addEventListener('click', () => {
                    openChallenge(quiz.subject, quiz.difficulty);
                    if (![...questionLimit.options].some((option) => option.value === String(quiz.limit))) {
                        const option = document.createElement('option');
                        option.value = String(quiz.limit);
                        option.textContent = `${quiz.limit} Questions`;
                        questionLimit.appendChild(option);
                    }
                    questionLimit.value = String(quiz.limit);
                    challengeForm.requestSubmit();
                });
                card.append(title, detail, start);
                grid.appendChild(card);
            });
            empty.hidden = data.quizzes.length > 0;
        } catch (error) {
            console.error('Teacher challenge loading error:', error);
            empty.textContent = error.message;
            empty.hidden = false;
        }
    }

    // =====================================
    // INITIALIZE DASHBOARD
    // =====================================

    checkSession().then((authenticated) => {
        if (!authenticated) return;

        Promise.all([loadSubjects(), loadStudentActivity(), loadAssignedQuizzes()]).then(() => {
            updateAchievements();
        });
    });

});
