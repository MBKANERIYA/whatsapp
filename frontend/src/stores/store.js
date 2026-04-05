/**
 * Zustand Store for CRM State Management — Multi-Tenant SaaS
 * RELIABILITY: Persists to localStorage for offline-first capability
 * SPEED: In-memory state with selective persistence
 * SUSTAINABILITY: Minimal boilerplate, ~2KB library
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Remove trailing slash from API URL if present
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

console.log('API Base URL:', API_BASE_URL);

/**
 * Get the tenant slug for API requests.
 * In production: extracted from subdomain (handled by backend via Host header)
 * In development: uses x-tenant-slug header with stored slug or 'default'
 */
const getTenantSlug = () => {
    // Check if we have a stored slug (set during login or onboarding)
    const storedSlug = localStorage.getItem('tenant_slug');
    if (storedSlug) return storedSlug;

    // Try to extract from hostname (e.g., firm-a.procrm.in -> firm-a)
    const parts = window.location.hostname.split('.');
    if (parts.length >= 3) return parts[0];

    return 'default';
};

// API helper with error handling + tenant header
const api = async (path, options = {}) => {
    const token = localStorage.getItem('token');
    const slug = getTenantSlug();

    const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(slug && { 'x-tenant-slug': slug }),
    };

    const url = `${API_BASE_URL}/api/v1${path}`;

    try {
        const res = await fetch(url, { ...options, headers });

        if (!res.ok) {
            const errorText = await res.text();
            let error;
            try {
                error = JSON.parse(errorText);
            } catch (e) {
                error = { error: errorText || `Request failed (${res.status} ${res.statusText})` };
            }

            // Handle subscription/trial expired - redirect to billing
            if (error.subscription_expired || error.trial_expired) {
                const store = useStore.getState();
                store.setCurrentView('settings');
                throw new Error(error.error);
            }

            // Handle WhatsApp not configured
            if (error.whatsapp_not_configured) {
                const store = useStore.getState();
                store.setCurrentView('settings');
                store.showToast('Configure your WhatsApp credentials in Settings first', 'info');
                throw new Error(error.error);
            }

            // Handle user limit reached
            if (error.upgrade_required) {
                throw new Error(error.error);
            }

            throw new Error(error.error || `Request failed (${res.status})`);
        }

        if (res.status === 204) return null;
        return res.json();
    } catch (error) {
        console.error(`API Error [${path}]:`, error);
        throw error;
    }
};

// API helper without tenant header (for public endpoints like onboarding)
const publicApi = async (path, options = {}) => {
    const headers = {
        'Content-Type': 'application/json',
    };

    const url = `${API_BASE_URL}/api/v1${path}`;

    try {
        const res = await fetch(url, { ...options, headers });

        if (!res.ok) {
            const errorText = await res.text();
            let error;
            try {
                error = JSON.parse(errorText);
            } catch (e) {
                error = { error: errorText || `Request failed (${res.status})` };
            }
            throw new Error(error.error || `Request failed (${res.status})`);
        }

        return res.json();
    } catch (error) {
        console.error(`Public API Error [${path}]:`, error);
        throw error;
    }
};

// Lead statuses for pipeline
export const LEAD_STATUSES = [
    { id: 'new', label: 'New', color: 'new' },
    { id: 'contacted', label: 'Contacted', color: 'contacted' },
    { id: 'qualified', label: 'Qualified', color: 'qualified' },
];

// Main store with persistence
export const useStore = create(
    persist(
        (set, get) => ({
            // Auth state
            user: null,
            isAuthenticated: false,

            // Tenant state (SaaS)
            tenant: null,

            // Data state
            leads: [],
            warmLeads: [],
            followUps: [],
            sources: [],
            users: [],
            dashboardStats: null,
            isLoading: false,
            error: null,
            currentView: 'dashboard',
            isModalOpen: false,

            // Cold Lead Reminders state
            coldReminders: [],
            dueReminders: [],

            // Toast notification state
            toast: null,
            showToast: (message, type = 'success', duration = 3000) => {
                set({ toast: { message, type, duration } });
            },
            clearToast: () => set({ toast: null }),

            // Actions
            setIsLoading: (isLoading) => set({ isLoading }),
            setCurrentView: (view) => set({ currentView: view }),
            openModal: () => set({ isModalOpen: true }),
            closeModal: () => set({ isModalOpen: false }),

            // ============================================================
            // ONBOARDING (Public — no tenant context)
            // ============================================================
            checkSlug: async (slug) => {
                return await publicApi(`/onboarding/check-slug/${encodeURIComponent(slug)}`);
            },

            signup: async (formData) => {
                const data = await publicApi('/onboarding/signup', {
                    method: 'POST',
                    body: JSON.stringify(formData),
                });

                // Auto-login after signup
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('tenant_slug', data.tenant.slug);

                set({
                    user: data.user,
                    tenant: data.tenant,
                    isAuthenticated: true,
                    error: null
                });

                return data;
            },

            // ============================================================
            // AUTH
            // ============================================================
            login: async (email, password) => {
                try {
                    const data = await api('/auth/login', {
                        method: 'POST',
                        body: JSON.stringify({ email, password }),
                    });
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    // Store tenant info from login response
                    if (data.tenant) {
                        localStorage.setItem('tenant_slug', data.tenant.slug);
                    }

                    set({
                        user: data.user,
                        tenant: data.tenant || null,
                        isAuthenticated: true,
                        error: null,
                    });
                    return true;
                } catch (error) {
                    set({ error: error.message });
                    return false;
                }
            },

            logout: () => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('tenant_slug');
                set({
                    user: null,
                    tenant: null,
                    isAuthenticated: false,
                    dashboardStats: null,
                    leads: [],
                    followUps: [],
                });
            },

            // ============================================================
            // TENANT SETTINGS (Admin only)
            // ============================================================
            tenantSettings: null,
            subscriptionInfo: null,

            fetchTenantSettings: async () => {
                try {
                    const settings = await api('/tenant-settings');
                    set({ tenantSettings: settings, tenant: settings });
                    return settings;
                } catch (error) {
                    console.error('Fetch tenant settings error:', error);
                }
            },

            updateTenantProfile: async (profileData) => {
                await api('/tenant-settings/profile', {
                    method: 'PUT',
                    body: JSON.stringify(profileData),
                });
                // Refresh settings
                get().fetchTenantSettings();
            },

            updateWhatsAppConfig: async (configData) => {
                await api('/tenant-settings/whatsapp', {
                    method: 'PUT',
                    body: JSON.stringify(configData),
                });
                get().fetchTenantSettings();
            },

            disconnectWhatsApp: async () => {
                await api('/tenant-settings/whatsapp', { method: 'DELETE' });
                get().fetchTenantSettings();
            },

            fetchSubscriptionInfo: async () => {
                try {
                    const info = await api('/tenant-settings/subscription');
                    set({ subscriptionInfo: info });
                    return info;
                } catch (error) {
                    console.error('Fetch subscription info error:', error);
                }
            },

            // ============================================================
            // COLD REMINDERS
            // ============================================================
            fetchReminders: async () => {
                try {
                    const reminders = await api('/reminders');
                    set({ coldReminders: reminders });
                } catch (error) {
                    console.error('Fetch reminders error:', error);
                }
            },

            fetchDueReminders: async () => {
                try {
                    const now = new Date();
                    const localTime = now.getFullYear() + '-' +
                        String(now.getMonth() + 1).padStart(2, '0') + '-' +
                        String(now.getDate()).padStart(2, '0') + ' ' +
                        String(now.getHours()).padStart(2, '0') + ':' +
                        String(now.getMinutes()).padStart(2, '0') + ':' +
                        String(now.getSeconds()).padStart(2, '0');

                    const reminders = await api(`/reminders/due?clientTime=${encodeURIComponent(localTime)}`);
                    set({ dueReminders: reminders });
                } catch (error) {
                    console.error('Fetch due reminders error:', error);
                }
            },

            createReminder: async (reminderData) => {
                await api('/reminders', {
                    method: 'POST',
                    body: JSON.stringify(reminderData)
                });
                get().fetchReminders();
            },

            completeReminder: async (id) => {
                await api(`/reminders/${id}/complete`, { method: 'PATCH' });
                get().fetchReminders();
                get().fetchDueReminders();
            },

            deleteReminder: async (id) => {
                await api(`/reminders/${id}`, { method: 'DELETE' });
                get().fetchReminders();
            },

            // ============================================================
            // PROJECTS
            // ============================================================
            projects: [],

            fetchProjects: async () => {
                try {
                    const projects = await api('/projects');
                    set({ projects });
                } catch (error) {
                    console.error('Fetch projects error:', error);
                }
            },

            createProject: async (projectData) => {
                await api('/projects', {
                    method: 'POST',
                    body: JSON.stringify(projectData)
                });
                get().fetchProjects();
            },

            updateProject: async (id, projectData) => {
                await api(`/projects/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(projectData)
                });
                get().fetchProjects();
            },

            deleteProject: async (id) => {
                await api(`/projects/${id}`, { method: 'DELETE' });
                get().fetchProjects();
            },

            // ============================================================
            // LEADS
            // ============================================================
            fetchLeads: async (filters = {}) => {
                set({ isLoading: true });
                try {
                    const queryParams = new URLSearchParams(filters).toString();
                    const leads = await api(`/leads?${queryParams}`);
                    set({ leads, isLoading: false });
                } catch (error) {
                    set({ error: error.message, isLoading: false });
                }
            },

            fetchWarmLeads: async () => {
                try {
                    const leads = await api('/leads?escalated=1');
                    set({ warmLeads: leads });
                } catch (error) {
                    console.error('Failed to fetch warm leads:', error);
                }
            },

            createLead: async (leadData) => {
                const tempId = Date.now();
                const optimisticLead = { ...leadData, id: tempId, status: 'new', created_at: new Date().toISOString() };

                set(state => ({ leads: [optimisticLead, ...state.leads], isModalOpen: false }));

                try {
                    const result = await api('/leads', {
                        method: 'POST',
                        body: JSON.stringify(leadData),
                    });
                    set(state => ({
                        leads: state.leads.map(l => l.id === tempId ? { ...l, id: result.id } : l)
                    }));
                    return result;
                } catch (error) {
                    set(state => ({
                        leads: state.leads.filter(l => l.id !== tempId),
                        error: error.message
                    }));
                    throw error;
                }
            },

            updateLead: async (id, updates) => {
                const originalLeads = get().leads;

                set(state => ({
                    leads: state.leads.map(l => l.id === id ? { ...l, ...updates } : l)
                }));

                try {
                    await api(`/leads/${id}`, {
                        method: 'PUT',
                        body: JSON.stringify(updates),
                    });
                } catch (error) {
                    set({ leads: originalLeads, error: error.message });
                    throw error;
                }
            },

            updateLeadStatus: async (id, status, notes = null) => {
                const originalLeads = get().leads;
                const userId = get().user?.id || 1;

                set(state => ({
                    leads: state.leads.map(l => l.id === id ? { ...l, status } : l)
                }));

                try {
                    await api(`/leads/${id}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status, notes, user_id: userId }),
                    });
                } catch (error) {
                    set({ leads: originalLeads, error: error.message });
                    throw error;
                }
            },

            deleteLead: async (id) => {
                const originalLeads = get().leads;

                set(state => ({
                    leads: state.leads.filter(l => l.id !== id)
                }));

                try {
                    await api(`/leads/${id}`, { method: 'DELETE' });
                    get().fetchDashboard();
                    get().fetchWarmLeads();
                    if (get().user?.role === 'admin') {
                        const today = new Date().toISOString().split('T')[0];
                        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                        get().fetchVisits(today, tomorrow);
                    }
                } catch (error) {
                    set({ leads: originalLeads, error: error.message });
                    throw error;
                }
            },

            // Lead Workflows
            convertLeadToClient: async (id, dealData = {}) => {
                try {
                    await api(`/leads/${id}/convert-client`, {
                        method: 'PUT',
                        body: JSON.stringify(dealData)
                    });
                    get().fetchLeads();
                    get().fetchWarmLeads();
                    get().fetchClients();
                } catch (error) {
                    set({ error: error.message });
                }
            },

            rejectLead: async (id) => {
                try {
                    await api(`/leads/${id}/reject`, { method: 'PATCH' });
                    get().fetchLeads();
                    get().fetchWarmLeads();
                } catch (error) {
                    set({ error: error.message });
                }
            },

            restoreLead: async (id) => {
                try {
                    await api(`/leads/${id}/restore`, { method: 'PATCH' });
                    get().fetchLeads({ archived: '1' });
                    get().fetchWarmLeads();
                } catch (error) {
                    set({ error: error.message });
                }
            },

            // ============================================================
            // CLIENTS
            // ============================================================
            clients: [],
            fetchClients: async (search = '') => {
                try {
                    const query = search ? `?search=${search}` : '';
                    const clients = await api(`/clients${query}`);
                    set({ clients });
                } catch (error) {
                    console.error('Failed to fetch clients:', error);
                }
            },

            createClient: async (data) => {
                try {
                    await api('/clients', {
                        method: 'POST',
                        body: JSON.stringify(data),
                    });
                    get().fetchClients();
                } catch (error) {
                    set({ error: error.message });
                    throw error;
                }
            },

            deleteClient: async (id) => {
                try {
                    await api(`/clients/${id}`, { method: 'DELETE' });
                    get().fetchClients();
                } catch (error) {
                    set({ error: error.message });
                }
            },

            updateClient: async (id, data) => {
                try {
                    await api(`/clients/${id}`, {
                        method: 'PUT',
                        body: JSON.stringify(data)
                    });
                    get().fetchClients();
                } catch (error) {
                    set({ error: error.message });
                    throw error;
                }
            },

            // ============================================================
            // INVENTORY
            // ============================================================
            inventory: [],
            fetchInventory: async () => {
                try {
                    const items = await api('/inventory');
                    set({ inventory: items });
                } catch (error) {
                    console.error('Failed to fetch inventory:', error);
                }
            },

            addInventory: async (data) => {
                try {
                    await api('/inventory', {
                        method: 'POST',
                        body: JSON.stringify(data)
                    });
                    get().fetchInventory();
                    return true;
                } catch (error) {
                    set({ error: error.message });
                    throw error;
                }
            },

            updateInventory: async (id, data) => {
                try {
                    await api(`/inventory/${id}`, {
                        method: 'PUT',
                        body: JSON.stringify(data)
                    });
                    get().fetchInventory();
                    return true;
                } catch (error) {
                    set({ error: error.message });
                    throw error;
                }
            },

            deleteInventory: async (id) => {
                try {
                    await api(`/inventory/${id}`, { method: 'DELETE' });
                    get().fetchInventory();
                    return true;
                } catch (error) {
                    set({ error: error.message });
                    throw error;
                }
            },

            // ============================================================
            // SITE VISITS
            // ============================================================
            visits: [],
            fetchVisits: async (fromDate, toDate) => {
                try {
                    let url = '/visits';
                    const params = [];
                    if (fromDate) params.push(`from_date=${fromDate}`);
                    if (toDate) params.push(`to_date=${toDate}`);
                    if (params.length) url += '?' + params.join('&');

                    const visits = await api(url);
                    set({ visits });
                } catch (error) {
                    console.error('Failed to fetch visits:', error);
                }
            },

            scheduleVisit: async (data) => {
                try {
                    await api('/visits', {
                        method: 'POST',
                        body: JSON.stringify(data),
                    });
                    get().fetchVisits();
                    return true;
                } catch (error) {
                    set({ error: error.message });
                    throw error;
                }
            },

            completeVisit: async (id) => {
                try {
                    await api(`/visits/${id}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: 'completed' }),
                    });
                    set(state => ({
                        visits: state.visits.filter(v => v.id !== id)
                    }));
                } catch (error) {
                    set({ error: error.message });
                    throw error;
                }
            },

            // ============================================================
            // DASHBOARD & SOURCES
            // ============================================================
            fetchDashboard: async () => {
                set({ isLoading: true });
                try {
                    const stats = await api('/dashboard');
                    set({ dashboardStats: stats, isLoading: false });
                } catch (error) {
                    set({ error: error.message, isLoading: false });
                }
            },

            fetchSources: async () => {
                try {
                    const sources = await api('/sources');
                    set({ sources });
                } catch (error) {
                    console.error('Failed to fetch sources:', error);
                }
            },

            // ============================================================
            // FOLLOW-UPS
            // ============================================================
            fetchFollowUps: async (pending = true) => {
                try {
                    const followUps = await api(`/followups?pending=${pending}`);
                    set({ followUps });
                } catch (error) {
                    set({ error: error.message });
                }
            },

            createFollowUp: async (data) => {
                try {
                    const result = await api('/followups', {
                        method: 'POST',
                        body: JSON.stringify(data),
                    });
                    get().fetchFollowUps();
                    return result;
                } catch (error) {
                    set({ error: error.message });
                    throw error;
                }
            },

            completeFollowUp: async (id, outcomeData = {}) => {
                try {
                    await api(`/followups/${id}/complete`, {
                        method: 'PATCH',
                        body: JSON.stringify(outcomeData)
                    });
                    set(state => ({
                        followUps: state.followUps.filter(f => f.id !== id)
                    }));

                    if (outcomeData.outcome === 'try_again' || outcomeData.outcome === 'rescheduled') {
                        get().fetchFollowUps();
                    }
                    if (outcomeData.outcome === 'escalated' || outcomeData.outcome === 'rejected') {
                        get().fetchLeads();
                    }
                } catch (error) {
                    set({ error: error.message });
                }
            },

            // ============================================================
            // USERS / TEAM
            // ============================================================
            fetchUsers: async () => {
                try {
                    const users = await api('/users');
                    set({ users });
                } catch (error) {
                    console.error('Failed to fetch users:', error);
                }
            },

            deleteUser: async (id) => {
                try {
                    await api(`/users/${id}`, { method: 'DELETE' });
                    set(state => ({
                        users: state.users.filter(u => u.id !== id)
                    }));
                } catch (error) {
                    set({ error: error.message });
                    throw error;
                }
            },

            registerUser: async (userData) => {
                try {
                    await api('/auth/register', {
                        method: 'POST',
                        body: JSON.stringify(userData)
                    });
                    get().fetchUsers();
                } catch (error) {
                    set({ error: error.message });
                    throw error;
                }
            },

            // ============================================================
            // WHATSAPP BROADCAST
            // ============================================================
            whatsappRecipients: null,
            whatsappCampaigns: [],

            fetchWhatsAppRecipients: async (type = 'all', status = '', search = '') => {
                try {
                    let url = `/whatsapp/recipients?type=${type}`;
                    if (status) url += `&status=${status}`;
                    if (search) url += `&search=${encodeURIComponent(search)}`;

                    const data = await api(url);
                    set({ whatsappRecipients: data });
                } catch (error) {
                    console.error('Failed to fetch WhatsApp recipients:', error);
                }
            },

            sendWhatsAppBroadcast: async (broadcastData) => {
                const data = await api('/whatsapp/broadcast', {
                    method: 'POST',
                    body: JSON.stringify(broadcastData),
                });
                return data;
            },

            sendWhatsAppMessage: async (messageData) => {
                const data = await api('/whatsapp/send', {
                    method: 'POST',
                    body: JSON.stringify(messageData),
                });
                return data;
            },

            fetchWhatsAppCampaigns: async () => {
                try {
                    const campaigns = await api('/whatsapp/campaigns');
                    set({ whatsappCampaigns: campaigns });
                } catch (error) {
                    console.error('Failed to fetch WhatsApp campaigns:', error);
                }
            },

            fetchWhatsAppCampaignDetail: async (id) => {
                const detail = await api(`/whatsapp/campaigns/${id}`);
                return detail;
            },

            // WhatsApp Template Management
            whatsappTemplates: [],

            uploadTemplateImage: async (imageFile) => {
                const token = localStorage.getItem('token');
                const slug = getTenantSlug();
                const formData = new FormData();
                formData.append('image', imageFile);

                const url = `${API_BASE_URL}/api/v1/whatsapp/templates/upload-image`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        ...(token && { Authorization: `Bearer ${token}` }),
                        ...(slug && { 'x-tenant-slug': slug }),
                    },
                    body: formData,
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to upload image');
                }

                const data = await res.json();
                return data.headerHandle;
            },

            createWhatsAppTemplate: async (templateData) => {
                const data = await api('/whatsapp/templates', {
                    method: 'POST',
                    body: JSON.stringify(templateData),
                });
                return data;
            },

            fetchWhatsAppTemplates: async () => {
                try {
                    const templates = await api('/whatsapp/templates');
                    set({ whatsappTemplates: templates });
                    return templates;
                } catch (error) {
                    console.error('Failed to fetch WhatsApp templates:', error);
                    return [];
                }
            },

            deleteWhatsAppTemplate: async (templateName) => {
                await api(`/whatsapp/templates/${encodeURIComponent(templateName)}`, {
                    method: 'DELETE',
                });
                get().fetchWhatsAppTemplates();
            },

            // ============================================================
            // UI ACTIONS
            // ============================================================
            setCurrentView: (view) => set({ currentView: view }),
            setSelectedLead: (lead) => set({ selectedLead: lead }),
            openModal: () => set({ isModalOpen: true }),
            closeModal: () => set({ isModalOpen: false, selectedLead: null }),
            clearError: () => set({ error: null }),
        }),
        {
            name: 'crm-saas-storage',
            // RELIABILITY: Only persist essential data
            partialize: (state) => ({
                user: state.user,
                tenant: state.tenant,
                isAuthenticated: state.isAuthenticated,
                currentView: state.currentView,
            }),
        }
    )
);
