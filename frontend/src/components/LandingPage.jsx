import { useState } from 'preact/hooks';
import Icon from './Icons';

const features = [
    {
        icon: 'whatsapp',
        title: 'Broadcast Campaigns',
        desc: 'Send template messages to thousands of contacts with smart filtering by tags, location, and budget.',
    },
    {
        icon: 'chat',
        title: 'Chat Inbox',
        desc: 'Two-way WhatsApp conversations with 24-hour window management and template fallback.',
    },
    {
        icon: 'contacts',
        title: 'Contact Management',
        desc: 'Unified contacts with CSV import, tagging, location tracking, and smart segmentation.',
    },
    {
        icon: 'bar-chart',
        title: 'Campaign Analytics',
        desc: 'Track delivery, read rates, and failures for every broadcast campaign in real time.',
    },
    {
        icon: 'lock',
        title: 'Multi-Tenant Isolation',
        desc: 'Your data is completely isolated. Use your own Meta API credentials — we never touch your messages.',
    },
    {
        icon: 'settings',
        title: 'Easy Setup',
        desc: 'Connect your WhatsApp Business API in minutes. No coding needed, just paste your credentials.',
    },
];

const steps = [
    { num: '01', title: 'Sign Up', desc: 'Create your account in 30 seconds' },
    { num: '02', title: 'Connect Meta API', desc: 'Paste your WhatsApp Business API credentials' },
    { num: '03', title: 'Import Contacts', desc: 'Upload your contacts via CSV or add manually' },
    { num: '04', title: 'Start Broadcasting', desc: 'Send campaigns and chat with customers' },
];

export default function LandingPage({ onNavigate }) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <div style={{ background: '#0a0e1a', color: '#e2e8f0', minHeight: '100vh', overflow: 'hidden' }}>
            {/* ── NAVBAR ── */}
            <nav style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                background: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                padding: '0 24px', height: '64px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '36px', height: '36px',
                        background: 'linear-gradient(135deg, #25D366, #128C7E)',
                        borderRadius: '10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '18px', fontWeight: 800, color: 'white',
                    }}>W</div>
                    <span style={{ fontWeight: 700, fontSize: '18px', color: '#fff' }}>WhatsApp Broadcast</span>
                </div>

                {/* Desktop nav */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                     className="landing-nav-buttons">
                    <button onClick={() => onNavigate('login')}
                        style={{
                            background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                            color: '#e2e8f0', padding: '8px 20px', borderRadius: '8px',
                            cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.target.style.borderColor = '#25D366'; e.target.style.color = '#25D366'; }}
                        onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.color = '#e2e8f0'; }}
                    >Sign In</button>
                    <button onClick={() => onNavigate('register')}
                        style={{
                            background: 'linear-gradient(135deg, #25D366, #128C7E)',
                            border: 'none', color: '#fff', padding: '8px 20px',
                            borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
                            fontWeight: 600, transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => e.target.style.transform = 'translateY(-1px)'}
                        onMouseLeave={e => e.target.style.transform = 'translateY(0)'}
                    >Get Started Free</button>
                </div>
            </nav>

            {/* ── HERO ── */}
            <section style={{
                paddingTop: '140px', paddingBottom: '80px',
                textAlign: 'center', position: 'relative',
                maxWidth: '900px', margin: '0 auto', padding: '140px 24px 80px',
            }}>
                {/* Glow */}
                <div style={{
                    position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)',
                    width: '600px', height: '400px',
                    background: 'radial-gradient(ellipse, rgba(37,211,102,0.12) 0%, transparent 70%)',
                    pointerEvents: 'none', filter: 'blur(40px)',
                }} />

                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)',
                    borderRadius: '100px', padding: '6px 16px', marginBottom: '28px',
                    fontSize: '13px', color: '#25D366', fontWeight: 600,
                }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#25D366' }} />
                    Powered by Meta Cloud API v21.0
                </div>

                <h1 style={{
                    fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800,
                    lineHeight: 1.1, marginBottom: '24px', color: '#fff',
                    position: 'relative',
                }}>
                    WhatsApp Marketing<br />
                    <span style={{
                        background: 'linear-gradient(135deg, #25D366, #00e676, #69f0ae)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>Made Effortless</span>
                </h1>

                <p style={{
                    fontSize: 'clamp(16px, 2vw, 20px)', color: '#94a3b8',
                    maxWidth: '600px', margin: '0 auto 40px', lineHeight: 1.6,
                }}>
                    Broadcast to thousands, chat with everyone, track every delivery.
                    Connect your own Meta API — you control the data, we provide the platform.
                </p>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => onNavigate('register')}
                        style={{
                            background: 'linear-gradient(135deg, #25D366, #128C7E)',
                            border: 'none', color: '#fff', padding: '14px 32px',
                            borderRadius: '12px', cursor: 'pointer', fontSize: '16px',
                            fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px',
                            boxShadow: '0 4px 24px rgba(37,211,102,0.3)',
                            transition: 'all 0.3s',
                        }}
                        onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.target.style.transform = 'translateY(0)'}
                    >
                        Start Free →
                    </button>
                    <button onClick={() => onNavigate('login')}
                        style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                            color: '#e2e8f0', padding: '14px 32px', borderRadius: '12px',
                            cursor: 'pointer', fontSize: '16px', fontWeight: 600,
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.1)'; }}
                        onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.05)'; }}
                    >
                        Sign In
                    </button>
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '60px 24px 80px' }}>
                <h2 style={{
                    textAlign: 'center', fontSize: '28px', fontWeight: 700,
                    marginBottom: '48px', color: '#fff',
                }}>Everything you need to grow with WhatsApp</h2>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '20px',
                }}>
                    {features.map((f, i) => (
                        <div key={i} style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '16px', padding: '28px',
                            transition: 'all 0.3s',
                        }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(37,211,102,0.05)';
                                e.currentTarget.style.borderColor = 'rgba(37,211,102,0.2)';
                                e.currentTarget.style.transform = 'translateY(-4px)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            <div style={{
                                width: '44px', height: '44px',
                                background: 'rgba(37,211,102,0.12)', borderRadius: '12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: '16px', color: '#25D366',
                            }}>
                                <Icon name={f.icon} size={22} />
                            </div>
                            <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>
                                {f.title}
                            </h3>
                            <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.6 }}>
                                {f.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section style={{
                maxWidth: '900px', margin: '0 auto', padding: '60px 24px 80px',
            }}>
                <h2 style={{
                    textAlign: 'center', fontSize: '28px', fontWeight: 700,
                    marginBottom: '48px', color: '#fff',
                }}>Get started in 4 simple steps</h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                    {steps.map((s, i) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                            <div style={{
                                fontSize: '40px', fontWeight: 800,
                                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                marginBottom: '12px',
                            }}>{s.num}</div>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: '#fff' }}>
                                {s.title}
                            </h3>
                            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
                                {s.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA ── */}
            <section style={{
                maxWidth: '800px', margin: '0 auto', padding: '60px 24px 100px',
                textAlign: 'center',
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, rgba(37,211,102,0.1), rgba(18,140,126,0.1))',
                    border: '1px solid rgba(37,211,102,0.2)',
                    borderRadius: '24px', padding: '48px 32px',
                }}>
                    <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: '#fff' }}>
                        Ready to scale your WhatsApp marketing?
                    </h2>
                    <p style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '28px' }}>
                        Free to start. No credit card needed. Connect your own Meta API.
                    </p>
                    <button onClick={() => onNavigate('register')}
                        style={{
                            background: 'linear-gradient(135deg, #25D366, #128C7E)',
                            border: 'none', color: '#fff', padding: '14px 36px',
                            borderRadius: '12px', cursor: 'pointer', fontSize: '16px',
                            fontWeight: 700, boxShadow: '0 4px 24px rgba(37,211,102,0.3)',
                            transition: 'all 0.3s',
                        }}
                        onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.target.style.transform = 'translateY(0)'}
                    >
                        Create Your Account →
                    </button>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer style={{
                borderTop: '1px solid rgba(255,255,255,0.06)',
                padding: '24px', textAlign: 'center',
                fontSize: '13px', color: '#64748b',
            }}>
                © {new Date().getFullYear()} WhatsApp Broadcast Platform — broadcast.innodify.in
            </footer>
        </div>
    );
}
