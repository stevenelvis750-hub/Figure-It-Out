
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registerForm');
    const roleSelect = document.getElementById('role');
    const schoolFields = document.getElementById('schoolFields');
    const studentFields = document.getElementById('studentFields');
    const schoolCode = document.getElementById('schoolCode');
    const message = document.getElementById('registerMessage');
    const registerButton = document.getElementById('registerButton');

    if (!form || !roleSelect || !schoolFields || !studentFields || !schoolCode || !message || !registerButton) {
        return;
    }

    function showMessage(text, type = 'error') {
        message.textContent = text;
        message.className = `message show ${type}`;
    }

    function updateFields() {
        const role = roleSelect.value;
        const needsSchool = role === 'student' || role === 'teacher';

        schoolFields.style.display = needsSchool ? 'flex' : 'none';
        studentFields.style.display = role === 'student' ? 'flex' : 'none';
        schoolCode.required = needsSchool;
    }

    roleSelect.addEventListener('change', updateFields);
    updateFields();

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const role = roleSelect.value;

        if (password !== confirmPassword) {
            return showMessage('Your passwords do not match.');
        }

        if (password.length < 10) {
            return showMessage('Your password must contain at least 10 characters.');
        }

        if (!fullName || !email) {
            return showMessage('Please complete all required fields.');
        }

        const account = {
            fullName,
            email,
            password,
            role,
            schoolCode: schoolCode.value.trim(),
            className: document.getElementById('className').value.trim(),
            stream: document.getElementById('stream').value.trim()
        };

        registerButton.disabled = true;
        registerButton.textContent = 'CREATING ACCOUNT...';
        message.className = 'message';

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(account)
            });

            const data = await response.json();

            if (!response.ok) {
                showMessage(data.error || 'Registration failed. Please try again.');
                return;
            }

            if (data.authenticated && data.user) {
                const userRole = data.user.role;
                const nameKey = userRole === 'admin' ? 'adminName' : userRole === 'teacher' ? 'teacherName' : 'studentName';
                const emailKey = userRole === 'admin' ? 'adminEmail' : userRole === 'teacher' ? 'teacherEmail' : 'studentEmail';

                localStorage.setItem(nameKey, data.user.name || '');
                localStorage.setItem(emailKey, data.user.email || '');
                localStorage.setItem('fioUser', JSON.stringify(data.user));

                showMessage('Your account was created! Opening your dashboard...', 'success');

                const destinations = {
                    student: '/Dashboards/students/student.html',
                    independent: '/Dashboards/students/student.html',
                    teacher: '/Dashboards/teachers/teacher.html',
                    admin: '/Dashboards/admin/admin.html'
                };

                window.location.href = destinations[userRole] || '/login.html';
                return;
            }

            showMessage(data.message || 'Your registration was received.', 'success');
            registerButton.textContent = 'REGISTRATION RECEIVED';

            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
        } catch (error) {
            console.error('Registration error:', error);
            showMessage('Cannot connect to the server. Please check your connection and try again.');
        } finally {
            if (!message.classList.contains('success')) {
                registerButton.disabled = false;
                registerButton.textContent = 'CREATE ACCOUNT';
            }
        }
    });
});
