export const getToken = () => localStorage.getItem('wm_token');
export const setToken = t => localStorage.setItem('wm_token', t);
export const getUser = () => JSON.parse(localStorage.getItem('wm_user') || 'null');
export const setUser = u => localStorage.setItem('wm_user', JSON.stringify(u));

export const logout = () => {
    localStorage.removeItem('wm_token');
    localStorage.removeItem('wm_user');
    window.location.href = '/app/';
};

export const requireAuth = () => {
    if (!getToken()) window.location.href = '/app/';
};
