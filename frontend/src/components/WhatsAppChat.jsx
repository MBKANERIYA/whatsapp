import { useState, useEffect, useRef } from 'preact/hooks';
import { useStore } from '../stores/store';
import Icon from './Icons';

export default function WhatsAppChat() {
    const {
        conversations, totalUnread, activeConversation, chatMessages,
        fetchConversations, fetchChatMessages, sendChatReply, sendChatTemplate,
        markConversationRead, archiveConversation, showToast,
        fetchWhatsAppTemplates, whatsappTemplates,
    } = useStore();

    const [search, setSearch] = useState('');
    const [selectedConvId, setSelectedConvId] = useState(null);
    const [messageText, setMessageText] = useState('');
    const [sending, setSending] = useState(false);
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [templateParams, setTemplateParams] = useState(['', '', '']);
    const messagesEndRef = useRef(null);
    const pollRef = useRef(null);

    // Initial load + polling
    useEffect(() => {
        fetchConversations();
        fetchWhatsAppTemplates();

        // Poll every 8 seconds
        pollRef.current = setInterval(() => {
            fetchConversations(search);
            if (selectedConvId) fetchChatMessages(selectedConvId);
        }, 8000);

        return () => clearInterval(pollRef.current);
    }, []);

    // Search debounce
    useEffect(() => {
        const timer = setTimeout(() => fetchConversations(search), 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const openConversation = async (convId) => {
        setSelectedConvId(convId);
        await fetchChatMessages(convId);
        await markConversationRead(convId);
    };

    const handleSend = async () => {
        if (!messageText.trim() || !selectedConvId) return;
        setSending(true);
        try {
            await sendChatReply(selectedConvId, messageText.trim());
            setMessageText('');
        } catch (err) {
            if (err.message?.includes('24-hour') || err.message?.includes('window')) {
                showToast('24-hour window expired. Use a template to re-engage.', 'info');
                setShowTemplatePicker(true);
            } else {
                showToast(err.message, 'error');
            }
        }
        setSending(false);
    };

    const handleSendTemplate = async () => {
        if (!selectedTemplate || !selectedConvId) return;
        setSending(true);
        try {
            await sendChatTemplate(selectedConvId, selectedTemplate, templateParams.filter(Boolean));
            setShowTemplatePicker(false);
            setSelectedTemplate('');
            setTemplateParams(['', '', '']);
            showToast('Template sent');
        } catch (err) {
            showToast(err.message, 'error');
        }
        setSending(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    const formatFullTime = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const statusIcon = (status) => {
        if (status === 'sent') return '✓';
        if (status === 'delivered') return '✓✓';
        if (status === 'read') return '✓✓';
        if (status === 'failed') return '✗';
        return '⏳';
    };

    const approvedTemplates = (whatsappTemplates || []).filter(t => t.status === 'APPROVED');

    const conv = activeConversation;
    const isWindowOpen = conv?.is_window_open;
    const windowMinutes = conv?.window_remaining_minutes || 0;

    return (
        <div className="page-container" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
            <div className="page-header" style={{ flexShrink: 0 }}>
                <div>
                    <h1 className="page-title">Chat Inbox</h1>
                    <p className="page-subtitle">
                        {totalUnread > 0 ? `${totalUnread} unread conversation${totalUnread !== 1 ? 's' : ''}` : 'Reply to WhatsApp conversations'}
                    </p>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', gap: '0', border: '1px solid var(--border, #e2e8f0)', borderRadius: '12px', overflow: 'hidden', minHeight: 0 }}>
                {/* Left: Conversation List */}
                <div style={{ width: '340px', flexShrink: 0, borderRight: '1px solid var(--border, #e2e8f0)', display: 'flex', flexDirection: 'column', background: 'var(--surface, #fff)' }}>
                    {/* Search */}
                    <div style={{ padding: '12px', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                        <div className="search-bar" style={{ margin: 0 }}>
                            <Icon name="search" size={16} />
                            <input type="text" value={search} onInput={e => setSearch(e.target.value)}
                                placeholder="Search chats..." className="search-input" style={{ fontSize: '13px' }} />
                        </div>
                    </div>

                    {/* Conversation List */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {conversations.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center', opacity: 0.5, fontSize: '13px' }}>
                                No conversations yet. Conversations appear when contacts reply to your broadcasts.
                            </div>
                        ) : conversations.map(c => (
                            <div
                                key={c.id}
                                onClick={() => openConversation(c.id)}
                                style={{
                                    padding: '12px 16px', cursor: 'pointer',
                                    background: selectedConvId === c.id ? 'var(--primary-light, #eef2ff)' : 'transparent',
                                    borderBottom: '1px solid var(--border, #f1f5f9)',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => { if (selectedConvId !== c.id) e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseLeave={e => { if (selectedConvId !== c.id) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: c.unread_count > 0 ? 700 : 500, fontSize: '14px' }}>
                                        {c.display_name}
                                    </span>
                                    <span style={{ fontSize: '11px', opacity: 0.5 }}>{formatTime(c.last_message_at)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{
                                        fontSize: '12px', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap', flex: 1, marginRight: '8px',
                                        fontWeight: c.unread_count > 0 ? 600 : 400,
                                    }}>
                                        {c.last_message_text || 'No messages'}
                                    </span>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                        {c.is_window_open && (
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} title="24h window open" />
                                        )}
                                        {c.unread_count > 0 && (
                                            <span style={{
                                                minWidth: '18px', height: '18px', borderRadius: '9px',
                                                background: '#25d366', color: '#fff', fontSize: '11px', fontWeight: 700,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                                            }}>
                                                {c.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Chat Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
                    {!selectedConvId ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', opacity: 0.4 }}>
                            <Icon name="chat" size={64} />
                            <p style={{ marginTop: '12px', fontSize: '16px' }}>Select a conversation to start chatting</p>
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            <div style={{
                                padding: '12px 20px', background: '#fff',
                                borderBottom: '1px solid var(--border, #e2e8f0)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{conv?.contact_name || conv?.phone}</div>
                                    <div style={{ fontSize: '12px', opacity: 0.5, fontFamily: 'monospace' }}>{conv?.phone}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {isWindowOpen ? (
                                        <span style={{
                                            fontSize: '11px', padding: '4px 10px', borderRadius: '12px',
                                            background: '#dcfce7', color: '#16a34a', fontWeight: 600,
                                        }}>
                                            🟢 Window open ({windowMinutes > 60 ? `${Math.floor(windowMinutes / 60)}h ${windowMinutes % 60}m` : `${windowMinutes}m`})
                                        </span>
                                    ) : (
                                        <span style={{
                                            fontSize: '11px', padding: '4px 10px', borderRadius: '12px',
                                            background: '#fef2f2', color: '#dc2626', fontWeight: 600,
                                        }}>
                                            🔴 Window closed
                                        </span>
                                    )}
                                    <button className="btn-icon" onClick={() => archiveConversation(selectedConvId)} title="Archive">
                                        <Icon name="archive" size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {chatMessages.map(msg => (
                                    <div key={msg.id} style={{
                                        display: 'flex',
                                        justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start',
                                        marginBottom: '2px',
                                    }}>
                                        <div style={{
                                            maxWidth: '70%', padding: '8px 12px', borderRadius: '8px',
                                            background: msg.direction === 'outbound' ? '#dcf8c6' : '#fff',
                                            boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                                            ...(msg.status === 'failed' && { border: '1px solid #ef4444', background: '#fef2f2' }),
                                        }}>
                                            {msg.message_type === 'template' && (
                                                <div style={{ fontSize: '10px', opacity: 0.5, marginBottom: '4px', fontStyle: 'italic' }}>Template</div>
                                            )}
                                            {msg.message_type === 'image' && (
                                                <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>📷 Image</div>
                                            )}
                                            {msg.message_type === 'video' && (
                                                <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>🎥 Video</div>
                                            )}
                                            {msg.message_type === 'document' && (
                                                <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>📄 Document</div>
                                            )}
                                            {msg.message_type === 'audio' && (
                                                <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>🎵 Audio</div>
                                            )}
                                            <div style={{ fontSize: '14px', lineHeight: '1.4', wordBreak: 'break-word' }}>
                                                {msg.body || ''}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                                <span style={{ fontSize: '10px', opacity: 0.4 }}>{formatFullTime(msg.created_at)}</span>
                                                {msg.direction === 'outbound' && (
                                                    <span style={{
                                                        fontSize: '12px',
                                                        color: msg.status === 'read' ? '#53bdeb' : msg.status === 'failed' ? '#ef4444' : '#999',
                                                    }}>
                                                        {statusIcon(msg.status)}
                                                    </span>
                                                )}
                                            </div>
                                            {msg.status === 'failed' && msg.error_message && (
                                                <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>{msg.error_message}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Window expired banner */}
                            {!isWindowOpen && (
                                <div style={{
                                    padding: '8px 16px', background: '#fef3c7', borderTop: '1px solid #fcd34d',
                                    fontSize: '13px', color: '#92400e', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                }}>
                                    <span>⚠️ 24-hour window expired. You can only send templates.</span>
                                    <button className="btn btn--outline" style={{ fontSize: '12px', padding: '4px 10px' }}
                                        onClick={() => setShowTemplatePicker(true)}>
                                        Send Template
                                    </button>
                                </div>
                            )}

                            {/* Input Area */}
                            <div style={{
                                padding: '12px 16px', background: '#fff',
                                borderTop: '1px solid var(--border, #e2e8f0)',
                                display: 'flex', gap: '8px', alignItems: 'flex-end',
                            }}>
                                <textarea
                                    value={messageText}
                                    onInput={e => setMessageText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={isWindowOpen ? "Type a message..." : "Window expired — use template"}
                                    disabled={!isWindowOpen || sending}
                                    style={{
                                        flex: 1, resize: 'none', border: '1px solid var(--border, #e2e8f0)',
                                        borderRadius: '20px', padding: '10px 16px', fontSize: '14px',
                                        maxHeight: '100px', minHeight: '42px', outline: 'none',
                                        fontFamily: 'inherit', lineHeight: '1.4',
                                        background: isWindowOpen ? '#fff' : '#f5f5f5',
                                    }}
                                    rows={1}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!messageText.trim() || sending || !isWindowOpen}
                                    style={{
                                        width: '42px', height: '42px', borderRadius: '50%',
                                        background: messageText.trim() && isWindowOpen ? '#25d366' : '#ccc',
                                        color: '#fff', border: 'none', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0, transition: 'background 0.2s',
                                    }}
                                >
                                    <Icon name="send" size={20} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Template Picker Modal */}
            {showTemplatePicker && (
                <div className="modal-backdrop" onClick={() => setShowTemplatePicker(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>Send Template Message</h2>
                            <button className="btn-icon" onClick={() => setShowTemplatePicker(false)}><Icon name="close" size={20} /></button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Select Template</label>
                            <select className="form-input" value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}>
                                <option value="">Choose a template</option>
                                {approvedTemplates.map(t => (
                                    <option key={t.name} value={t.name}>{t.name} ({t.language})</option>
                                ))}
                            </select>
                        </div>
                        {selectedTemplate && (
                            <div className="form-group">
                                <label className="form-label">Template Variables (if any)</label>
                                {[0, 1, 2].map(i => (
                                    <input key={i} className="form-input" value={templateParams[i] || ''}
                                        onInput={e => { const p = [...templateParams]; p[i] = e.target.value; setTemplateParams(p); }}
                                        placeholder={`Variable {{${i + 1}}}`} style={{ marginBottom: '8px' }} />
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                            <button className="btn btn--outline" onClick={() => setShowTemplatePicker(false)}>Cancel</button>
                            <button className="btn btn--success" onClick={handleSendTemplate} disabled={!selectedTemplate || sending}>
                                {sending ? 'Sending...' : 'Send Template'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
