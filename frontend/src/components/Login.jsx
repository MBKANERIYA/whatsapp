import { useState } from 'preact/hooks';
import { useStore } from '../stores/store';

/**
 * Auth Component — Login / Register with tab toggle
 * Register = self-service tenant signup (like AiSensy/Wati)
 */
export default function AuthPage({ initialMode = 'login', onBack }) {
    const { login, register, isLoading, error, clearError } = useStore();
    const [mode, setMode] = useState(initialMode);
    const [form, setForm] = useState({ name: '', firmName: '', email: '', password: '' });

    const switchMode = (m) => {
        setMode(m);
        clearError?.();
        setForm({ name: '', firmName: '', email: '', password: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (mode === 'login') {
            await login(form.email, form.password);
        } else {
            await register(form.name, form.firmName, form.email, form.password);
        }
    };

    const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: '100vh', width: '100vw', padding: '20px',
            background: '#0a0e1a',
        }}>
            {/* Glow */}
            <div style={{
                position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
                width: '500px', height: '400px',
                background: 'radial-gradient(ellipse, rgba(37,211,102,0.08) 0%, transparent 70%)',
                pointerEvents: 'none', filter: 'blur(60px)',
            }} />

            <div style={{
                width: '100%', maxWidth: '420px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '20px', padding: '36px 32px',
                position: 'relative',
            }}>
                {/* Back button */}
                {onBack && (
                    <button onClick={onBack} style={{
                        position: 'absolute', top: '16px', left: '16px',
                        background: 'none', border: 'none', color: '#64748b',
                        cursor: 'pointer', fontSize: '14px', display: 'flex',
                        alignItems: 'center', gap: '4px',
                    }}>
                        ← Back
                    </button>
                )}

                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '28px', marginTop: onBack ? '12px' : '0' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                        <div style={{
                            width: '56px', height: '56px',
                            background: 'linear-gradient(135deg, #25D366, #128C7E)',
                            borderRadius: '14px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '24px', fontWeight: 800, color: 'white',
                        }}>W</div>
                    </div>
                    <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                        {mode === 'login' ? 'Welcome back' : 'Create your account'}
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>
                        {mode === 'login'
                            ? 'Sign in to your WhatsApp Broadcast platform'
                            : 'Start broadcasting in under 2 minutes'}
                    </p>
                </div>

                {/* Tab toggle */}
                <div style={{
                    display: 'flex', background: 'rgba(255,255,255,0.04)',
                    borderRadius: '10px', padding: '3px', marginBottom: '24px',
                    border: '1px solid rgba(255,255,255,0.06)',
                }}>
                    {['login', 'register'].map(m => (
                        <button key={m} onClick={() => switchMode(m)} style={{
                            flex: 1, padding: '10px', borderRadius: '8px',
                            border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                            background: mode === m ? 'rgba(37,211,102,0.15)' : 'transparent',
                            color: mode === m ? '#25D366' : '#64748b',
                            transition: 'all 0.2s',
                        }}>
                            {m === 'login' ? 'Sign In' : 'Sign Up'}
                        </button>
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '10px', padding: '12px', marginBottom: '16px',
                        color: '#f87171', fontSize: '13px',
                    }}>{error}</div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    {mode === 'register' && (
                        <>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                                    Your Name
                                </label>
                                <input type="text" value={form.name} onInput={update('name')}
                                    placeholder="John Doe" required
                                    style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                                    Business Name
                                </label>
                                <input type="text" value={form.firmName} onInput={update('firmName')}
                                    placeholder="My Awesome Business" required
                                    style={inputStyle} />
                            </div>
                        </>
                    )}

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                            Email
                        </label>
                        <input type="email" value={form.email} onInput={update('email')}
                            placeholder="you@business.com" required
                            style={inputStyle} />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                            Password
                        </label>
                        <input type="password" value={form.password} onInput={update('password')}
                            placeholder="••••••••" required minLength={6}
                            style={inputStyle} />
                    </div>

                    <button type="submit" disabled={isLoading}
                        style={{
                            width: '100%', padding: '13px',
                            background: 'linear-gradient(135deg, #25D366, #128C7E)',
                            border: 'none', borderRadius: '10px',
                            color: '#fff', fontSize: '15px', fontWeight: 700,
                            cursor: isLoading ? 'wait' : 'pointer',
                            opacity: isLoading ? 0.7 : 1,
                            transition: 'all 0.2s',
                        }}>
                        {isLoading
                            ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
                            : (mode === 'login' ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <p style={{
                    textAlign: 'center', marginTop: '20px',
                    fontSize: '13px', color: '#64748b',
                }}>
                    {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                    <a href="#" onClick={(e) => { e.preventDefault(); switchMode(mode === 'login' ? 'register' : 'login'); }}
                        style={{ color: '#25D366', fontWeight: 600, textDecoration: 'none' }}>
                        {mode === 'login' ? 'Sign up free' : 'Sign in'}
                    </a>
                </p>
            </div>
        </div>
    );
}

const inputStyle = {
    width: '100%', padding: '11px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: '#e2e8f0',
    fontSize: '14px', outline: 'none',
    transition: 'border-color 0.2s',
};
