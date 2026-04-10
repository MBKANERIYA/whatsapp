import { useStore } from '../stores/store';
import Icon from './Icons';

const NAV_ITEMS = [
    { id: 'contacts', label: 'Contacts', icon: 'contacts' },
    { id: 'broadcast', label: 'Broadcast', icon: 'whatsapp' },
    { id: 'chat', label: 'Chat Inbox', icon: 'chat' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
];

export default function Sidebar({ isOpen, onClose }) {
    const { currentView, setCurrentView, user, tenant, logout, totalUnread } = useStore();

    const handleNav = (viewId) => {
        setCurrentView(viewId);
        onClose?.();
    };

    const logoUrl = tenant?.logo_url || null;
    const firmName = tenant?.name || 'WhatsApp Broadcast';

    return (
        <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
            {/* Logo */}
            <div className="sidebar-logo">
                <img src={logoUrl} alt={firmName} style={{ height: '36px', width: 'auto', borderRadius: '8px' }} />
                <span className="sidebar-logo-text">{firmName}</span>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                {NAV_ITEMS.map(item => (
                    <button
                        key={item.id}
                        className={`sidebar-nav-item ${currentView === item.id ? 'active' : ''}`}
                        onClick={() => handleNav(item.id)}
                    >
                        <Icon name={item.icon} size={20} />
                        <span>{item.label}</span>
                        {item.id === 'chat' && totalUnread > 0 && (
                            <span className="badge badge--danger" style={{
                                marginLeft: 'auto',
                                minWidth: '20px',
                                height: '20px',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: '#ef4444',
                                color: '#fff',
                                padding: '0 6px',
                            }}>
                                {totalUnread > 99 ? '99+' : totalUnread}
                            </span>
                        )}
                    </button>
                ))}
            </nav>

            {/* User */}
            <div className="sidebar-footer">
                <div className="sidebar-user">
                    <div className="avatar" style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: 'var(--primary)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '14px',
                    }}>
                        {(user?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user?.name || 'User'}
                        </div>
                        <div style={{ fontSize: '11px', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user?.email || ''}
                        </div>
                    </div>
                    <button className="btn-icon" onClick={logout} title="Logout">
                        <Icon name="logout" size={18} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
