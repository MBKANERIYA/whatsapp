import { useEffect, useState } from 'preact/hooks';
import { useStore } from './stores/store';
import Icon from './components/Icons';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Contacts from './components/Contacts';
import WhatsAppBroadcast from './components/WhatsAppBroadcast';
import WhatsAppChat from './components/WhatsAppChat';
import Settings from './components/Settings';
import Toast from './components/Toast';

export default function App() {
    const { isAuthenticated, currentView, tenant } = useStore();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    if (!isAuthenticated) {
        return (
            <>
                <Login />
                <Toast />
            </>
        );
    }

    const renderView = () => {
        switch (currentView) {
            case 'contacts':
                return <Contacts />;
            case 'broadcast':
                return <WhatsAppBroadcast />;
            case 'chat':
                return <WhatsAppChat />;
            case 'settings':
                return <Settings />;
            default:
                return <Contacts />;
        }
    };

    const logoUrl = tenant?.logo_url || '/assets/M.png';
    const firmName = tenant?.name || 'WhatsApp Platform';

    return (
        <div className="app-layout">
            <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

            <header className="mobile-header">
                <button className="btn-icon" onClick={() => setIsMobileMenuOpen(true)}>
                    <Icon name="menu" size={22} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src={logoUrl} alt={firmName} style={{ height: '40px', width: 'auto' }} />
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{firmName}</span>
                </div>
                <div style={{ width: '32px' }}></div>
            </header>

            <main className="main-content">
                {renderView()}
            </main>

            {isMobileMenuOpen && (
                <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} />
            )}

            <Toast />
        </div>
    );
}
