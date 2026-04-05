import { useState } from 'preact/hooks';
import { useStore } from '../stores/store';

/**
 * Login Component — Multi-tenant SaaS
 * Shows tenant branding if available from subdomain
 */
export default function Login() {
    const { login, isLoading, error } = useStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        await login(email, password);
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            width: '100vw',
            padding: 'var(--space-4)',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(139,92,246,0.08) 100%)',
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
                        <div style={{
                            width: '64px', height: '64px',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            borderRadius: '16px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '28px', fontWeight: 800, color: 'white',
                        }}>
                            P
                        </div>
                    </div>
                    <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                        ProCRM
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                        Real Estate Lead Management
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid var(--accent-danger)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-3)',
                        marginBottom: 'var(--space-4)',
                        color: 'var(--accent-danger)',
                        fontSize: 'var(--text-sm)',
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="form-input"
                            value={email}
                            onInput={(e) => setEmail(e.target.value)}
                            placeholder="you@yourfirm.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onInput={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: 'var(--space-4)' }}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p style={{
                    textAlign: 'center',
                    marginTop: 'var(--space-6)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)'
                }}>
                    Don't have an account?{' '}
                    <a href="https://procrm.in" target="_blank" rel="noopener" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                        Start Free Trial
                    </a>
                </p>
            </div>
        </div>
    );
}
