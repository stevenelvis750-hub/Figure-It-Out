
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');
    const loginMessage = document.getElementById('loginMessage');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const forgotPasswordLink = document.getElementById('forgotPassword');

    if (!loginForm || !loginButton || !loginMessage || !passwordInput || !togglePassword) {
        return;
    }

    function showMessage(message, type = 'error') {
        loginMessage.textContent = message;
        loginMessage.className = `message show ${type}`;
    }

    function redirectUser(role) {
        const destinations = {
            student: '/Dashboards/students/student.html',
            independent: '/Dashboards/students/student.html',
            teacher: '/Dashboards/teachers/teacher.html',
            admin: '/Dashboards/admin/admin.html'
        };

        window.location.href = destinations[role] || '/login.html';
    }

    togglePassword.addEventListener('click', () => {
        const hidden = passwordInput.type === 'password';
        passwordInput.type = hidden ? 'text' : 'password';
        togglePassword.textContent = hidden ? 'Hide' : 'Show';
    });

    const sessionEndpoint = '/api/auth/session';

    function getPersistedUser() {
        try {
            const storedUser = localStorage.getItem('fioUser');
            return storedUser ? JSON.parse(storedUser) : null;
        } catch (error) {
            console.warn('Saved session could not be read.', error);
            return null;
        }
    }

    async function checkExistingSession() {
        const persistedUser = getPersistedUser();

        if (persistedUser && persistedUser.role) {
            redirectUser(persistedUser.role);
            return;
        }

        try {
            const response = await fetch(sessionEndpoint, {
                credentials: 'same-origin'
            });

            if (!response.ok) return;

            const data = await response.json();

            if (data?.authenticated && data?.user) {
                redirectUser(data.user.role);
            }
        } catch (error) {
            console.warn('Session check unavailable; continuing without redirect.', error);
        }
    }

    async function signInUser(email, password, selectedRole) {
        const response = await fetch('/api/auth/signin', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password,
                role: selectedRole
            })
        });

        return response;
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = passwordInput.value;
        const selectedRole = document.getElementById('role').value;

        if (!email || !password) {
            return showMessage('Please enter your email and password.');
        }

        loginButton.disabled = true;
        loginButton.textContent = 'SIGNING IN...';
        loginMessage.className = 'message';

        try {
            const response = await signInUser(email, password, selectedRole);
            const data = await response.json();

            if (!response.ok) {
                showMessage(data.error || 'Unable to sign in. Please try again.');
                return;
            }

            if (!data.authenticated || !data.user) {
                showMessage('Login was not completed. Please try again.');
                return;
            }

            showMessage('Login successful! Opening your dashboard...', 'success');

            const userRole = data.user.role;
            const nameKey = userRole === 'admin' ? 'adminName' : userRole === 'teacher' ? 'teacherName' : 'studentName';
            const emailKey = userRole === 'admin' ? 'adminEmail' : userRole === 'teacher' ? 'teacherEmail' : 'studentEmail';

            localStorage.setItem(nameKey, data.user.name || '');
            localStorage.setItem(emailKey, data.user.email || '');
            localStorage.setItem('fioUser', JSON.stringify(data.user));

            redirectUser(userRole);
        } catch (error) {
            console.error('Login error:', error);
            showMessage('Cannot connect to the server. Check that Figure It Out is running and try again.');
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'SIGN IN';
        }
    });

    forgotPasswordLink.addEventListener('click', (event) => {
        event.preventDefault();
        showMessage('Password recovery is not available yet. Please contact your administrator for assistance.');
    });

    checkExistingSession();
});
