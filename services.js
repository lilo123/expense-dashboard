import { supabaseClient } from './api.js';

// --- Authentication Services ---
export const authService = {
    getSession: () => supabaseClient.auth.getSession(),
    onAuthStateChange: (callback) => supabaseClient.auth.onAuthStateChange(callback),
    signIn: (email, password) => supabaseClient.auth.signInWithPassword({ email, password }),
    signUp: (email, password) => supabaseClient.auth.signUp({ email, password }),
    signOut: () => supabaseClient.auth.signOut(),
};

// --- Category Services ---
export const categoryService = {
    createDefaults: (userId, defaults) => {
        const inserts = defaults.map(name => ({ name, user_id: userId }));
        return supabaseClient.from('categories').insert(inserts);
    },
    fetchAll: (userId) => supabaseClient.from('categories').select('*').eq('user_id', userId).order('name', { ascending: true }),
    add: (userId, name) => supabaseClient.from('categories').insert([{ name, user_id: userId }]),
    update: (id, name) => supabaseClient.from('categories').update({ name }).eq('id', id),
    delete: (id) => supabaseClient.from('categories').delete().eq('id', id),
};

// --- Expense Services ---
export const expenseService = {
    updateCategoryName: (userId, oldName, newName) => supabaseClient.from('expenses').update({ category: newName }).eq('user_id', userId).eq('category', oldName),
    fetchAll: (userId) => supabaseClient.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false }),
    add: (userId, date, item, amount, category) => supabaseClient.from('expenses').insert([{ user_id: userId, date, item, amount, category }]),
    update: (id, item, amount, category, date) => supabaseClient.from('expenses').update({ item, amount, category, date }).eq('id', id),
    delete: (id) => supabaseClient.from('expenses').delete().eq('id', id),
    deleteBulk: (ids) => supabaseClient.from('expenses').delete().in('id', ids),
    updateBulk: (ids, updates) => supabaseClient.from('expenses').update(updates).in('id', ids),
};

// --- Token Services ---
export const tokenService = {
    fetchLatest: (userId) => supabaseClient.from('api_tokens').select('token').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
    create: (userId, token) => supabaseClient.from('api_tokens').insert([{ user_id: userId, token }]),
};
