import { useState, useEffect } from 'preact/hooks';
import { useStore } from '../stores/store';
import Icon from './Icons';

/**
 * Settings Component — Tenant admin settings page
 * Tabs: Firm Profile | WhatsApp | Subscription
 */
export default function Settings() {
    const {
        tenantSettings,
        fetchTenantSettings,
        updateTenantProfile, updateWhatsAppConfig, disconnectWhatsApp,
        showToast, tenant
    } = useStore();

    const [activeTab, setActiveTab] = useState('profile');
    const [saving, setSaving] = useState(false);

    // Profile form
    const [profileForm, setProfileForm] = useState({
        name: '', email: '', phone: '', logo_url: '', primary_color: '#6366f1',
    });

    // WhatsApp form
    const [waForm, setWaForm] = useState({
        whatsapp_access_token: '',
        whatsapp_phone_number_id: '',
        whatsapp_business_account_id: '',
    });

    useEffect(() => {
        fetchTenantSettings();
    }, []);

    useEffect(() => {
        if (tenantSettings) {
            setProfileForm({
                name: tenantSettings.name || '',
                email: tenantSettings.email || '',
                phone: tenantSettings.phone || '',
                logo_url: tenantSettings.logo_url || '',
                primary_color: tenantSettings.primary_color || '#6366f1',
            });
        }
    }, [tenantSettings]);

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateTenantProfile(profileForm);
            showToast('Firm profile updated!', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleWhatsAppSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateWhatsAppConfig(waForm);
            showToast('WhatsApp configured! Credentials verified with Meta.', 'success');
            setWaForm({ whatsapp_access_token: '', whatsapp_phone_number_id: '', whatsapp_business_account_id: '' });
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDisconnectWhatsApp = async () => {
        if (!confirm('Disconnect WhatsApp? You won\'t be able to send broadcasts until you reconnect.')) return;
        try {
            await disconnectWhatsApp();
            showToast('WhatsApp disconnected', 'info');
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const tabs = [
        { id: 'profile', label: 'Firm Profile', icon: 'briefcase' },
        { id: 'whatsapp', label: 'WhatsApp', icon: 'message-circle' },
        { id: 'subscription', label: 'Subscription', icon: 'bar-chart' },
    ];

    return (
        <div>
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                    Settings
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    Manage your firm's profile, integrations, and subscription
                </p>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-1)',
                marginBottom: 'var(--space-6)',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '0',
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: 'var(--space-2) var(--space-4)',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                            borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            fontWeight: activeTab === tab.id ? 600 : 400,
                            fontSize: 'var(--text-sm)',
                            transition: 'all 0.2s ease',
                            marginBottom: '-1px',
                        }}
                    >
                        <Icon name={tab.icon} size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'profile' && (
                <div className="card" style={{ maxWidth: '600px' }}>
                    <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                        Firm Profile
                    </h2>
                    <form onSubmit={handleProfileSave}>
                        <div className="form-group">
                            <label className="form-label">Firm Name *</label>
                            <input
                                className="form-input"
                                value={profileForm.name}
                                onInput={e => setProfileForm(p => ({ ...p, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Contact Email *</label>
                            <input
                                type="email"
                                className="form-input"
                                value={profileForm.email}
                                onInput={e => setProfileForm(p => ({ ...p, email: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Phone</label>
                            <input
                                className="form-input"
                                value={profileForm.phone}
                                onInput={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                                placeholder="+91 98765 43210"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Logo URL</label>
                            <input
                                className="form-input"
                                value={profileForm.logo_url}
                                onInput={e => setProfileForm(p => ({ ...p, logo_url: e.target.value }))}
                                placeholder="https://example.com/logo.png"
                            />
                            {profileForm.logo_url && (
                                <div style={{ marginTop: 'var(--space-2)' }}>
                                    <img src={profileForm.logo_url} alt="Logo preview" style={{ maxHeight: '60px', borderRadius: 'var(--radius-md)' }} />
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Brand Color</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <input
                                    type="color"
                                    value={profileForm.primary_color}
                                    onInput={e => setProfileForm(p => ({ ...p, primary_color: e.target.value }))}
                                    style={{ width: '48px', height: '36px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
                                />
                                <input
                                    className="form-input"
                                    value={profileForm.primary_color}
                                    onInput={e => setProfileForm(p => ({ ...p, primary_color: e.target.value }))}
                                    style={{ maxWidth: '120px' }}
                                />
                            </div>
                        </div>

                        {/* Firm URL (read only) */}
                        <div className="form-group">
                            <label className="form-label">Your Platform URL</label>
                            <div style={{
                                padding: 'var(--space-2) var(--space-3)',
                                background: 'var(--bg-secondary)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-sm)',
                                fontFamily: 'monospace',
                                color: 'var(--accent-primary)',
                            }}>
                                {tenantSettings?.slug || '...'}.yourdomain.com
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 'var(--space-4)' }}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </form>
                </div>
            )}

            {activeTab === 'whatsapp' && (
                <div style={{ maxWidth: '600px' }}>
                    {/* Current Status */}
                    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                                    WhatsApp Integration
                                </h3>
                                <p style={{
                                    color: tenantSettings?.whatsapp_configured ? 'var(--accent-success)' : 'var(--text-muted)',
                                    fontSize: 'var(--text-sm)',
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                }}>
                                    <span style={{
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        background: tenantSettings?.whatsapp_configured ? 'var(--accent-success)' : 'var(--accent-danger)',
                                        display: 'inline-block',
                                    }} />
                                    {tenantSettings?.whatsapp_configured ? 'Connected' : 'Not Connected'}
                                </p>
                            </div>
                            {tenantSettings?.whatsapp_configured && (
                                <button className="btn btn-secondary" onClick={handleDisconnectWhatsApp} style={{ fontSize: 'var(--text-xs)' }}>
                                    Disconnect
                                </button>
                            )}
                        </div>

                        {tenantSettings?.whatsapp_configured && (
                            <div style={{
                                marginTop: 'var(--space-3)',
                                padding: 'var(--space-3)',
                                background: 'var(--bg-secondary)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-sm)',
                            }}>
                                <div><strong>Phone Number ID:</strong> {tenantSettings.whatsapp_phone_number_id}</div>
                                <div><strong>Business Account ID:</strong> {tenantSettings.whatsapp_business_account_id}</div>
                                <div><strong>Access Token:</strong> {tenantSettings.whatsapp_access_token}</div>
                            </div>
                        )}
                    </div>

                    {/* Configuration Form */}
                    <div className="card">
                        <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                            {tenantSettings?.whatsapp_configured ? 'Update Credentials' : 'Connect WhatsApp'}
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-4)' }}>
                            Get these from <a href="https://developers.facebook.com" target="_blank" rel="noopener" style={{ color: 'var(--accent-primary)' }}>Meta Developer Portal</a> → Your App → WhatsApp → API Setup
                        </p>

                        <form onSubmit={handleWhatsAppSave}>
                            <div className="form-group">
                                <label className="form-label">Permanent Access Token *</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={waForm.whatsapp_access_token}
                                    onInput={e => setWaForm(f => ({ ...f, whatsapp_access_token: e.target.value }))}
                                    placeholder="EAAxxxxx..."
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone Number ID *</label>
                                <input
                                    className="form-input"
                                    value={waForm.whatsapp_phone_number_id}
                                    onInput={e => setWaForm(f => ({ ...f, whatsapp_phone_number_id: e.target.value }))}
                                    placeholder="123456789012345"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">WhatsApp Business Account ID *</label>
                                <input
                                    className="form-input"
                                    value={waForm.whatsapp_business_account_id}
                                    onInput={e => setWaForm(f => ({ ...f, whatsapp_business_account_id: e.target.value }))}
                                    placeholder="123456789012345"
                                    required
                                />
                            </div>

                            <div style={{
                                background: 'rgba(99, 102, 241, 0.08)',
                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                borderRadius: 'var(--radius-md)',
                                padding: 'var(--space-3)',
                                marginBottom: 'var(--space-4)',
                                fontSize: 'var(--text-xs)',
                                color: 'var(--text-secondary)',
                            }}>
                                <strong>💡 Note:</strong> We'll verify these credentials with Meta's API before saving. Make sure your token is a permanent (System User) token, not a temporary one.
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? 'Verifying & Saving...' : 'Save & Verify'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {activeTab === 'subscription' && (
                <div style={{ maxWidth: '700px' }}>
                    {/* Current Plan */}
                    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                            Current Plan
                        </h2>

                        {subscriptionInfo?.current ? (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                                    <div style={{
                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                        color: 'white',
                                        padding: 'var(--space-2) var(--space-4)',
                                        borderRadius: 'var(--radius-lg)',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        fontSize: 'var(--text-lg)',
                                    }}>
                                        {subscriptionInfo.current.plan}
                                    </div>
                                    <span style={{
                                        padding: '4px 10px',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: 'var(--text-xs)',
                                        textTransform: 'uppercase',
                                        fontWeight: 600,
                                        background: subscriptionInfo.current.status === 'active'
                                            ? 'rgba(34,197,94,0.15)'
                                            : subscriptionInfo.current.status === 'trial'
                                                ? 'rgba(234,179,8,0.15)'
                                                : 'rgba(239,68,68,0.15)',
                                        color: subscriptionInfo.current.status === 'active'
                                            ? 'var(--accent-success)'
                                            : subscriptionInfo.current.status === 'trial'
                                                ? 'var(--accent-warning)'
                                                : 'var(--accent-danger)',
                                    }}>
                                        {subscriptionInfo.current.status}
                                    </span>
                                </div>

                                {/* Stats Row */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
                                    <div style={{ background: 'var(--bg-secondary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Team Members</div>
                                        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                                            {subscriptionInfo.current.current_users} / {subscriptionInfo.current.max_users}
                                        </div>
                                    </div>

                                    {subscriptionInfo.current.trial_days_left !== null && (
                                        <div style={{ background: 'rgba(234,179,8,0.1)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-warning)' }}>Trial Ends In</div>
                                            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--accent-warning)' }}>
                                                {subscriptionInfo.current.trial_days_left} days
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)' }}>Loading subscription info...</p>
                        )}
                    </div>

                    {/* Available Plans */}
                    {subscriptionInfo?.available_plans && subscriptionInfo.available_plans.length > 0 && (
                        <div>
                            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
                                Available Plans
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                                {subscriptionInfo.available_plans.map(plan => {
                                    const isCurrent = subscriptionInfo.current?.plan === plan.name;
                                    return (
                                        <div key={plan.id} className="card" style={{
                                            border: isCurrent ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                                            position: 'relative',
                                        }}>
                                            {isCurrent && (
                                                <div style={{
                                                    position: 'absolute', top: '-10px', right: 'var(--space-3)',
                                                    background: 'var(--accent-primary)', color: 'white',
                                                    padding: '2px 10px', borderRadius: '10px',
                                                    fontSize: '10px', fontWeight: 600,
                                                }}>
                                                    CURRENT
                                                </div>
                                            )}
                                            <h4 style={{ fontSize: 'var(--text-md)', fontWeight: 700, textTransform: 'capitalize', marginBottom: 'var(--space-1)' }}>
                                                {plan.display_name}
                                            </h4>
                                            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>
                                                ₹{plan.price_monthly}<span style={{ fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span>
                                            </div>
                                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                                                <li style={{ padding: '4px 0' }}>👥 {plan.max_users} team members</li>
                                                <li style={{ padding: '4px 0' }}>{plan.whatsapp_enabled ? '✅' : '❌'} WhatsApp Broadcast</li>
                                                <li style={{ padding: '4px 0' }}>📊 Unlimited contacts</li>
                                            </ul>
                                            {plan.price_yearly > 0 && (
                                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-success)', marginTop: 'var(--space-2)' }}>
                                                    Save ₹{(plan.price_monthly * 12 - plan.price_yearly)} yearly
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-4)' }}>
                                To upgrade or change plans, contact support. All plans include unlimited contacts and broadcasts. Meta charges for messages separately.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
