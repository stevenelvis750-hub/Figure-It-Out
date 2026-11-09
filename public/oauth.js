'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const callbackPath = '/auth/callback.html';
    const status = document.getElementById('oauthStatus');
    const returnLink = document.getElementById('oauthLoginLink');

    function showPageMessage(message) {
        const target = document.getElementById('registerMessage') || document.getElementById('loginMessage');
        if (target) {
            target.textContent = message;
            target.className = 'message show error';
        }
    }

    function rememberUser(user) {
        const role = user.role;
        const nameKey = role === 'admin' ? 'adminName' : role === 'teacher' ? 'teacherName' : 'studentName';
        const emailKey = role === 'admin' ? 'adminEmail' : role === 'teacher' ? 'teacherEmail' : 'studentEmail';
        localStorage.setItem(nameKey, user.name || '');
        localStorage.setItem(emailKey, user.email || '');
        localStorage.setItem('fioUser', JSON.stringify(user));
    }

    async function finishCallback() {
        if (window.location.pathname !== callbackPath || !status) return;

        const params = new URLSearchParams(window.location.search);
        const code = params.get('code') || '';
        const returnedState = params.get('state') || '';
        const providerError = params.get('error_description') || params.get('error');
        window.history.replaceState(null, '', callbackPath);

        if (providerError) {
            status.textContent = providerError;
            if (returnLink) returnLink.hidden = false;
            return;
        }

        let context;
        try {
            context = JSON.parse(sessionStorage.getItem('fioOAuthContext') || 'null');
        } catch (error) {
            console.error('Could not read social sign-in state.', error);
        }
        const expectedState = sessionStorage.getItem('fioOAuthState');
        const codeVerifier = sessionStorage.getItem('fioOAuthVerifier');
        if (!code || !returnedState || returnedState !== expectedState || !codeVerifier || !context) {
            status.textContent = 'This sign-in link expired or could not be verified. Please start again.';
            if (returnLink) returnLink.hidden = false;
            return;
        }

        status.textContent = 'Verifying your account...';
        try {
            const response = await fetch('/api/auth/oauth/exchange', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    state: returnedState,
                    codeVerifier,
                    provider: context.provider,
                    intent: context.intent,
                    role: context.role,
                    fullName: context.fullName,
                    schoolCode: context.schoolCode,
                    className: context.className,
                    stream: context.stream
                })
            });
            const data = await response.json();
            sessionStorage.removeItem('fioOAuthState');
            sessionStorage.removeItem('fioOAuthVerifier');
            sessionStorage.removeItem('fioOAuthContext');

            if (!response.ok) throw new Error(data.error || 'Social sign-in could not be completed.');
            if (!data.authenticated || !data.user) {
                status.textContent = data.message || 'Your school account request was received and is waiting for approval.';
                if (returnLink) returnLink.hidden = false;
                return;
            }

            rememberUser(data.user);
            status.textContent = 'Sign-in complete. Opening your dashboard...';
            const destinations = {
                student: '/Dashboards/students/student.html',
                independent: '/Dashboards/students/student.html',
                teacher: '/Dashboards/teachers/teacher.html',
                admin: '/Dashboards/admin/admin.html'
            };
            window.location.replace(destinations[data.user.role] || '/login.html');
        } catch (error) {
            console.error('Social sign-in failed:', error);
            status.textContent = error.message || 'Social sign-in failed. Please try again.';
            if (returnLink) returnLink.hidden = false;
        }
    }

    function randomBase64Url(byteLength) {
        const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
        let binary = '';
        bytes.forEach((value) => { binary += String.fromCharCode(value); });
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    async function startOAuth(provider, button) {
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('registerForm');
        const signup = Boolean(signupForm);
        const role = document.getElementById('role')?.value || '';
        if (role === 'admin') {
            showPageMessage('Administrator accounts must use password sign-in.');
            return;
        }

        const context = {
            provider,
            intent: signup ? 'signup' : 'signin',
            role,
            fullName: '',
            schoolCode: '',
            className: '',
            stream: ''
        };
        if (signup) {
            context.fullName = document.getElementById('fullName').value.trim();
            context.schoolCode = document.getElementById('schoolCode').value.trim();
            context.className = document.getElementById('className').value.trim();
            context.stream = document.getElementById('stream').value.trim();
            if (context.fullName.length < 2) {
                showPageMessage('Enter your full name before continuing with social sign-in.');
                document.getElementById('fullName').focus();
                return;
            }
            if (role !== 'independent' && !context.schoolCode) {
                showPageMessage('Enter your school code before continuing with social sign-in.');
                document.getElementById('schoolCode').focus();
                return;
            }
        } else if (!loginForm) {
            return;
        }

        const verifier = randomBase64Url(32);
        const challengeBytes = new Uint8Array(
            await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
        );
        let binaryChallenge = '';
        challengeBytes.forEach((value) => { binaryChallenge += String.fromCharCode(value); });
        const challenge = btoa(binaryChallenge)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '');
        button.disabled = true;
        const previousLabel = button.textContent;
        button.textContent = 'Connecting...';
        try {
            const params = new URLSearchParams({ provider, challenge });
            const response = await fetch(`/api/auth/oauth/start?${params}`, {
                credentials: 'same-origin'
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Social sign-in is unavailable.');

            sessionStorage.setItem('fioOAuthVerifier', verifier);
            sessionStorage.setItem('fioOAuthState', data.state);
            sessionStorage.setItem('fioOAuthContext', JSON.stringify(context));
            window.location.assign(data.authorizationUrl);
        } catch (error) {
            console.error('Could not start social sign-in:', error);
            showPageMessage(error.message || 'Could not start social sign-in. Please try again.');
            button.disabled = false;
            button.textContent = previousLabel;
        }
    }

    document.querySelectorAll('[data-oauth-provider]').forEach((button) => {
        button.addEventListener('click', () => startOAuth(button.dataset.oauthProvider, button));
    });

    finishCallback();
});
