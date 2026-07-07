import { getToken, logout } from './auth.js';

const BASE = '/api';

async function req(method, path, body = null) {
    const token = getToken();
    const opts = { method, headers: {} };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(BASE + path, opts);
    // Skip logout redirect for the login endpoint itself (wrong credentials also return 401)
    if (res.status === 401 && path !== '/auth/login') { logout(); return; }
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Request failed');
    return data;
}

export const login    = (username, password) => req('POST', '/auth/login', { username, password });
export const getMe    = () => req('GET', '/auth/me');
export const getBlocks = () => req('GET', '/blocks');

export const getToday  = () => req('GET', '/attendance/today');
export const clockIn   = () => req('POST', '/attendance/clock-in');
export const clockOut  = () => req('POST', '/attendance/clock-out');

export const getTasks   = (params = {}) => {
    const q = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return req('GET', '/tasks' + (q ? '?' + q : ''));
};
export const acceptTask = id => req('POST', `/tasks/${id}/accept`);
export const reportTask = (id, result, photos) =>
    req('POST', `/tasks/${id}/report`, { result, photos });
export const rateTask   = (id, rating, comment) =>
    req('POST', `/tasks/${id}/rate`, { rating, comment });

export const getPerformance = id => req('GET', `/users/${id}/performance`);
export const changePassword = (currentPwd, newPwd) =>
    req('POST', '/auth/change-password', { current_password: currentPwd, new_password: newPwd });

export async function uploadFile(file) {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
    });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
}
