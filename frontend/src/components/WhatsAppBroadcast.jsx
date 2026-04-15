import { useEffect, useState } from 'preact/hooks';
import { useStore } from '../stores/store';
import Icon, { EmptyStateIcon } from './Icons';

export default function WhatsAppBroadcast() {
    const {
        fetchWhatsAppRecipients, sendWhatsAppBroadcast, sendWhatsAppMessage,
        fetchWhatsAppCampaigns, fetchWhatsAppCampaignDetail,
        whatsappRecipients, whatsappCampaigns, showToast,
        uploadTemplateImage, createWhatsAppTemplate, fetchWhatsAppTemplates,
        deleteWhatsAppTemplate, whatsappTemplates
    } = useStore();

    const [tab, setTab] = useState('broadcast');

    // Template creation state
    const [tplName, setTplName] = useState('');
    const [tplCategory, setTplCategory] = useState('MARKETING');
    const [tplLanguage, setTplLanguage] = useState('en');
    const [tplBody, setTplBody] = useState('');
    const [tplFooter, setTplFooter] = useState('');
    const [tplButtons, setTplButtons] = useState([]); // { type, text, phone?, url?, urlExample? }
    const [tplImageFile, setTplImageFile] = useState(null);
    const [tplImagePreview, setTplImagePreview] = useState(null);
    const [tplCreating, setTplCreating] = useState(false);
    const [tplShowList, setTplShowList] = useState(false);

    const addButton = (type) => {
        if (tplButtons.length >= 10) return;
        if (type === 'PHONE_NUMBER' && tplButtons.filter(b => b.type === 'PHONE_NUMBER').length >= 1) return;
        if (type === 'URL' && tplButtons.filter(b => b.type === 'URL').length >= 2) return;
        setTplButtons(prev => [...prev, { type, text: '', phone: '', url: '', urlExample: '' }]);
    };
    const updateButton = (idx, field, value) => {
        setTplButtons(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
    };
    const removeButton = (idx) => {
        setTplButtons(prev => prev.filter((_, i) => i !== idx));
    };

    // Broadcast state
    const [recipientType, setRecipientType] = useState('all');
    const [filterTag, setFilterTag] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [filterMinTicket, setFilterMinTicket] = useState('');
    const [filterMaxTicket, setFilterMaxTicket] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [campaignName, setCampaignName] = useState('');
    const [templateParams, setTemplateParams] = useState(['', '', '']);
    const [directPhone, setDirectPhone] = useState('');
    const [directName, setDirectName] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [campaignDetail, setCampaignDetail] = useState(null);
    const [showStep2, setShowStep2] = useState(false);

    useEffect(() => {
        fetchWhatsAppRecipients();
        fetchWhatsAppCampaigns();
        fetchWhatsAppTemplates();
    }, []);

    // Fetch recipients when filters change
    useEffect(() => {
        const timer = setTimeout(() => {
            if (recipientType !== 'direct') {
                fetchWhatsAppRecipients(filterTag, searchQuery);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [recipientType, filterTag, filterLocation, filterMinTicket, filterMaxTicket, searchQuery]);

    const contacts = whatsappRecipients?.contacts || [];
    const counts = whatsappRecipients?.counts || {};

    // Filter contacts client-side for location/ticket_size (API also filters on backend)
    const filteredContacts = contacts.filter(c => {
        if (filterLocation && !(c.location || '').toLowerCase().includes(filterLocation.toLowerCase())) return false;
        if (filterMinTicket && (!c.ticket_size || c.ticket_size < parseFloat(filterMinTicket))) return false;
        if (filterMaxTicket && (!c.ticket_size || c.ticket_size > parseFloat(filterMaxTicket))) return false;
        return true;
    });

    const getRecipientCount = () => {
        if (recipientType === 'direct') return directPhone ? 1 : 0;
        if (recipientType === 'custom') return selectedIds.length;
        return filteredContacts.filter(c => c.validPhone).length;
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const selectAll = () => {
        const validIds = filteredContacts.filter(c => c.validPhone).map(c => c.id);
        setSelectedIds(validIds);
    };

    const deselectAll = () => setSelectedIds([]);

    // Templates for dropdown
    const approvedTemplates = (whatsappTemplates || []).filter(t => t.status === 'APPROVED');

    const selectedTemplate = approvedTemplates.find(t => t.name === campaignName);
    const templateVariables = selectedTemplate?.components?.find(c => c.type === 'BODY')?.text?.match(/\{\{\d+\}\}/g) || [];

    const handleSend = async () => {
        if (!campaignName) { showToast('Select a template first', 'error'); return; }
        if (recipientType === 'direct' && !directPhone) { showToast('Enter a phone number', 'error'); return; }
        if (recipientType === 'custom' && selectedIds.length === 0) { showToast('Select at least one contact', 'error'); return; }

        setShowConfirm(true);
    };

    const confirmSend = async () => {
        setIsSending(true);
        setShowConfirm(false);
        try {
            if (recipientType === 'direct') {
                await sendWhatsAppMessage({
                    phone: directPhone,
                    campaignName,
                    templateParams: templateParams.filter(Boolean),
                    userName: directName || 'Customer',
                });
                showToast('Message sent!');
            } else {
                const broadcastData = {
                    campaignName,
                    templateParams: templateParams.filter(Boolean),
                    recipientType: recipientType === 'custom' ? 'custom' : recipientType === 'tagged' ? 'tagged' : 'all',
                    recipientIds: recipientType === 'custom' ? selectedIds : undefined,
                    recipientFilter: recipientType === 'tagged' ? { tag: filterTag } : {},
                };
                const result = await sendWhatsAppBroadcast(broadcastData);
                showToast(`Broadcasting to ${result.totalRecipients} contacts`);
                fetchWhatsAppCampaigns();
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
        setIsSending(false);
    };

    const viewCampaign = async (id) => {
        try {
            const detail = await fetchWhatsAppCampaignDetail(id);
            setCampaignDetail(detail);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // Template image handling
    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setTplImageFile(file);
            const reader = new FileReader();
            reader.onload = (ev) => setTplImagePreview(ev.target.result);
            reader.readAsDataURL(file);
        }
    };

    const handleCreateTemplate = async (e) => {
        e.preventDefault();
        if (!tplName.trim() || !tplBody.trim()) { showToast('Template name and body are required', 'error'); return; }
        setTplCreating(true);
        try {
            let headerImageHandle = null;
            if (tplImageFile) {
                headerImageHandle = await uploadTemplateImage(tplImageFile);
            }
            // Build buttons array for backend
            const buttons = tplButtons.filter(b => b.text?.trim()).map(b => ({
                type: b.type,
                text: b.text.trim(),
                ...(b.type === 'PHONE_NUMBER' && { phone: b.phone }),
                ...(b.type === 'URL' && { url: b.url, urlExample: b.urlExample }),
            }));
            await createWhatsAppTemplate({
                name: tplName.trim(),
                category: tplCategory,
                language: tplLanguage,
                bodyText: tplBody,
                headerImageHandle,
                footerText: tplFooter || null,
                buttons,
            });
            showToast('Template submitted for review by Meta');
            setTplName(''); setTplBody(''); setTplFooter(''); setTplButtons([]);
            setTplImageFile(null); setTplImagePreview(null);
            fetchWhatsAppTemplates();
        } catch (err) {
            showToast(err.message, 'error');
        }
        setTplCreating(false);
    };

    const formatBudget = (amount) => {
        if (!amount) return '—';
        const num = Number(amount);
        if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
        if (num >= 100000) return `₹${(num / 100000).toFixed(0)}L`;
        return `₹${num.toLocaleString('en-IN')}`;
    };

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">WhatsApp Broadcast</h1>
                    <p className="page-subtitle">Send template messages to your contacts</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs" style={{ marginBottom: '20px' }}>
                {[
                    { id: 'broadcast', label: 'Send Broadcast' },
                    { id: 'history', label: 'Campaign History' },
                    { id: 'templates', label: 'Templates' },
                ].map(t => (
                    <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'broadcast' && renderBroadcastTab()}
            {tab === 'history' && renderHistoryTab()}
            {tab === 'templates' && renderTemplatesTab()}

            {/* Confirm Modal */}
            {showConfirm && (
                <div className="modal-backdrop" onClick={() => setShowConfirm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <h2>Confirm Broadcast</h2>
                            <button className="btn-icon" onClick={() => setShowConfirm(false)}><Icon name="close" size={20} /></button>
                        </div>
                        <p style={{ margin: '16px 0', opacity: 0.8 }}>
                            Send template <strong>"{campaignName}"</strong> to <strong>{getRecipientCount()}</strong> recipient{getRecipientCount() !== 1 ? 's' : ''}?
                        </p>
                        <p style={{ fontSize: '13px', opacity: 0.6, marginBottom: '20px' }}>
                            Messages will be sent in batches. Meta will bill your account directly.
                        </p>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button className="btn btn--outline" onClick={() => setShowConfirm(false)}>Cancel</button>
                            <button className="btn btn--success" onClick={confirmSend} disabled={isSending}>
                                {isSending ? 'Sending...' : 'Confirm & Send'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Campaign Detail Modal */}
            {campaignDetail && (
                <div className="modal-backdrop" onClick={() => setCampaignDetail(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'auto' }}>
                        <div className="modal-header">
                            <h2>Campaign: {campaignDetail.campaign_name}</h2>
                            <button className="btn-icon" onClick={() => setCampaignDetail(null)}><Icon name="close" size={20} /></button>
                        </div>
                        {campaignDetail.status === 'failed' && campaignDetail.error_log && (
                            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', margin: '12px 0', color: '#dc2626', fontSize: '13px' }}>
                                <strong>Error:</strong> {campaignDetail.error_log}
                            </div>
                        )}
                        <div style={{ display: 'grid', grid: 'auto / 1fr 1fr 1fr', gap: '12px', margin: '16px 0' }}>
                            <div className="stat-card">
                                <div className="stat-value">{campaignDetail.total_recipients}</div>
                                <div className="stat-label">Total</div>
                            </div>
                            <div className="stat-card" style={{ borderColor: '#22c55e' }}>
                                <div className="stat-value" style={{ color: '#22c55e' }}>{campaignDetail.successful_count || 0}</div>
                                <div className="stat-label">Sent</div>
                            </div>
                            <div className="stat-card" style={{ borderColor: '#ef4444' }}>
                                <div className="stat-value" style={{ color: '#ef4444' }}>{campaignDetail.failed_count || 0}</div>
                                <div className="stat-label">Failed</div>
                            </div>
                        </div>
                        {campaignDetail.messages && (
                            <table className="table" style={{ fontSize: '12px' }}>
                                <thead>
                                    <tr><th>Name</th><th>Phone</th><th>Status</th><th>Error</th></tr>
                                </thead>
                                <tbody>
                                    {campaignDetail.messages.map(m => (
                                        <tr key={m.id}>
                                            <td>{m.recipient_name}</td>
                                            <td style={{ fontFamily: 'monospace' }}>{m.phone}</td>
                                            <td>
                                                <span className={`status-badge status-badge--${m.status === 'sent' || m.status === 'delivered' || m.status === 'read' ? 'success' : m.status === 'failed' ? 'danger' : 'warning'}`}>
                                                    {m.status}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '11px', opacity: 0.6, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.error_message || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    // ============================================================
    // BROADCAST TAB
    // ============================================================
    function renderBroadcastTab() {
        return (
            <div>
                {!showStep2 ? renderStep1() : renderStep2()}
            </div>
        );
    }

    function renderStep1() {
        return (
            <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ marginBottom: '16px' }}>Step 1: Select Recipients</h3>

                {/* Recipient Type */}
                <div className="form-group">
                    <label className="form-label">Who to send to</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                            { id: 'all', label: 'All Contacts' },
                            { id: 'tagged', label: 'By Tag' },
                            { id: 'filtered', label: 'By Filters' },
                            { id: 'custom', label: 'Pick Manually' },
                            { id: 'direct', label: 'Single Number' },
                        ].map(opt => (
                            <button
                                key={opt.id}
                                className={`btn ${recipientType === opt.id ? 'btn--primary' : 'btn--outline'}`}
                                onClick={() => { setRecipientType(opt.id); setSelectedIds([]); }}
                                style={{ fontSize: '13px' }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Filters by Tag */}
                {recipientType === 'tagged' && (
                    <div className="form-group">
                        <label className="form-label">Tag</label>
                        <input className="form-input" value={filterTag} onInput={e => setFilterTag(e.target.value)} placeholder="e.g. vip, interested, delhi" />
                    </div>
                )}

                {/* Filters by Location / Ticket Size */}
                {recipientType === 'filtered' && (
                    <div style={{ display: 'grid', grid: 'auto / 1fr 1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label className="form-label">Location</label>
                            <input className="form-input" value={filterLocation} onInput={e => setFilterLocation(e.target.value)} placeholder="e.g. Delhi" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Min Ticket Size (₹)</label>
                            <input className="form-input" type="number" value={filterMinTicket} onInput={e => setFilterMinTicket(e.target.value)} placeholder="5000000" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Max Ticket Size (₹)</label>
                            <input className="form-input" type="number" value={filterMaxTicket} onInput={e => setFilterMaxTicket(e.target.value)} placeholder="50000000" />
                        </div>
                    </div>
                )}

                {/* Direct Phone */}
                {recipientType === 'direct' && (
                    <div style={{ display: 'grid', grid: 'auto / 1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label className="form-label">Phone Number</label>
                            <input className="form-input" value={directPhone} onInput={e => setDirectPhone(e.target.value)} placeholder="9876543210" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Name (optional)</label>
                            <input className="form-input" value={directName} onInput={e => setDirectName(e.target.value)} placeholder="John" />
                        </div>
                    </div>
                )}

                {/* Search */}
                {recipientType !== 'direct' && (
                    <div className="form-group">
                        <label className="form-label">Search Contacts</label>
                        <input className="form-input" value={searchQuery} onInput={e => setSearchQuery(e.target.value)} placeholder="Search by name, phone, email, location..." />
                    </div>
                )}

                {/* Recipient Count */}
                {recipientType !== 'direct' && (
                    <div style={{ background: 'var(--surface-2, #f1f5f9)', padding: '12px 16px', borderRadius: '8px', margin: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                            <strong>{getRecipientCount()}</strong> contacts with valid phone numbers
                        </span>
                        {(recipientType === 'custom') && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn--outline" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={selectAll}>Select All</button>
                                <button className="btn btn--outline" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={deselectAll}>Deselect</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Contact List (for custom selection) */}
                {recipientType === 'custom' && filteredContacts.length > 0 && (
                    <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <table className="table" style={{ fontSize: '13px' }}>
                            <thead>
                                <tr><th style={{ width: '40px' }}></th><th>Name</th><th>Phone</th><th>Location</th><th>Ticket</th><th>Tags</th></tr>
                            </thead>
                            <tbody>
                                {filteredContacts.map(c => (
                                    <tr key={c.id} onClick={() => c.validPhone && toggleSelect(c.id)} style={{ cursor: c.validPhone ? 'pointer' : 'default', opacity: c.validPhone ? 1 : 0.4 }}>
                                        <td>
                                            <input type="checkbox" checked={selectedIds.includes(c.id)} disabled={!c.validPhone} onChange={() => {}} />
                                        </td>
                                        <td style={{ fontWeight: 500 }}>{c.name}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{c.phone}</td>
                                        <td>{c.location || '—'}</td>
                                        <td>{formatBudget(c.ticket_size)}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                                                {(c.tags || []).slice(0, 2).map(t => (
                                                    <span key={t} style={{ padding: '1px 6px', borderRadius: '8px', background: '#eef2ff', color: '#6366f1', fontSize: '10px' }}>{t}</span>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Next Button */}
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        className="btn btn--primary"
                        onClick={() => setShowStep2(true)}
                        disabled={getRecipientCount() === 0}
                    >
                        Next: Select Template →
                    </button>
                </div>
            </div>
        );
    }

    function renderStep2() {
        return (
            <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3>Step 2: Choose Template & Send</h3>
                    <button className="btn btn--outline" onClick={() => setShowStep2(false)}>← Back</button>
                </div>

                <p style={{ fontSize: '13px', opacity: 0.6, marginBottom: '16px' }}>
                    Sending to <strong>{getRecipientCount()}</strong> contact{getRecipientCount() !== 1 ? 's' : ''}
                </p>

                {/* Template Selection */}
                <div className="form-group">
                    <label className="form-label">Template</label>
                    <select className="form-input" value={campaignName} onChange={e => setCampaignName(e.target.value)}>
                        <option value="">Select an approved template</option>
                        {approvedTemplates.map(t => (
                            <option key={t.name} value={t.name}>{t.name} ({t.language})</option>
                        ))}
                    </select>
                </div>

                {/* Template Variables */}
                {templateVariables.length > 0 && (
                    <div className="form-group">
                        <label className="form-label">Template Variables</label>
                        {templateVariables.map((v, i) => (
                            <input
                                key={i}
                                className="form-input"
                                value={templateParams[i] || ''}
                                onInput={e => {
                                    const newParams = [...templateParams];
                                    newParams[i] = e.target.value;
                                    setTemplateParams(newParams);
                                }}
                                placeholder={`Value for ${v} (use {name} for contact name)`}
                                style={{ marginBottom: '8px' }}
                            />
                        ))}
                    </div>
                )}

                {/* Preview */}
                {selectedTemplate && (
                    <div style={{ background: '#dcf8c6', padding: '16px', borderRadius: '12px', maxWidth: '380px', margin: '16px 0', fontFamily: 'system-ui', fontSize: '14px', lineHeight: '1.5' }}>
                        <div style={{ fontWeight: 500 }}>
                            {selectedTemplate.components?.find(c => c.type === 'BODY')?.text?.replace(/\{\{(\d+)\}\}/g, (_, idx) => templateParams[parseInt(idx) - 1] || `{{${idx}}}`) || 'Preview'}
                        </div>
                        {selectedTemplate.components?.find(c => c.type === 'FOOTER') && (
                            <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '8px' }}>
                                {selectedTemplate.components.find(c => c.type === 'FOOTER').text}
                            </div>
                        )}
                    </div>
                )}

                {/* Send */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                    <button className="btn btn--success" style={{ flex: 1 }} onClick={handleSend} disabled={isSending || !campaignName}>
                        {isSending ? 'Sending...' : `Send to ${getRecipientCount()} Contact${getRecipientCount() !== 1 ? 's' : ''}`}
                    </button>
                </div>
            </div>
        );
    }

    // ============================================================
    // HISTORY TAB
    // ============================================================
    function renderHistoryTab() {
        return (
            <div className="card" style={{ overflow: 'auto' }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Template</th>
                            <th>Recipients</th>
                            <th>Sent</th>
                            <th>Failed</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(whatsappCampaigns || []).length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>No campaigns yet</td></tr>
                        ) : whatsappCampaigns.map(c => (
                            <tr key={c.id}>
                                <td style={{ fontSize: '13px' }}>{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                                <td style={{ fontWeight: 600 }}>{c.campaign_name}</td>
                                <td>{c.total_recipients}</td>
                                <td style={{ color: '#22c55e' }}>{c.successful_count || 0}</td>
                                <td style={{ color: '#ef4444' }}>{c.failed_count || 0}</td>
                                <td>
                                    <span className={`status-badge status-badge--${c.status === 'completed' ? 'success' : c.status === 'processing' ? 'warning' : c.status === 'failed' ? 'danger' : 'info'}`}>
                                        {c.status}
                                    </span>
                                    {c.status === 'failed' && c.error_log && (
                                        <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.error_log}>
                                            {c.error_log}
                                        </div>
                                    )}
                                </td>
                                <td>
                                    <button className="btn btn--outline" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={() => viewCampaign(c.id)}>View</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    // ============================================================
    // TEMPLATES TAB
    // ============================================================
    function renderTemplatesTab() {
        return (
            <div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <button className={`btn ${!tplShowList ? 'btn--primary' : 'btn--outline'}`} onClick={() => setTplShowList(false)}>Create Template</button>
                    <button className={`btn ${tplShowList ? 'btn--primary' : 'btn--outline'}`} onClick={() => { setTplShowList(true); fetchWhatsAppTemplates(); }}>My Templates</button>
                </div>

                {!tplShowList ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
                        {/* ── Form ── */}
                        <div className="card" style={{ padding: '24px' }}>
                            <h3 style={{ marginBottom: '16px' }}>Create New Template</h3>
                            <form onSubmit={handleCreateTemplate}>
                                <div style={{ display: 'grid', grid: 'auto / 1fr 1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Name *</label>
                                        <input className="form-input" value={tplName} onInput={e => setTplName(e.target.value)} placeholder="e.g. welcome_offer" required />
                                        <small style={{ opacity: 0.5, fontSize: '11px' }}>Lowercase, underscores only</small>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Category</label>
                                        <select className="form-input" value={tplCategory} onChange={e => setTplCategory(e.target.value)}>
                                            <option value="MARKETING">Marketing</option>
                                            <option value="UTILITY">Utility</option>
                                            <option value="AUTHENTICATION">Authentication</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Language</label>
                                        <select className="form-input" value={tplLanguage} onChange={e => setTplLanguage(e.target.value)}>
                                            <option value="en">English</option>
                                            <option value="hi">Hindi</option>
                                            <option value="en_US">English (US)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Header Image (optional)</label>
                                    <input type="file" accept="image/*" onChange={handleImageSelect} className="form-input" />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Body Text * <span style={{ opacity: 0.5 }}>Use {'{{1}}'}, {'{{2}}'} for variables</span></label>
                                    <textarea className="form-input" value={tplBody} onInput={e => setTplBody(e.target.value)} rows={4} required
                                        placeholder="Hi {{1}}, thank you for your interest! We have a special offer for you." />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Footer (optional)</label>
                                    <input className="form-input" value={tplFooter} onInput={e => setTplFooter(e.target.value)} placeholder="Reply STOP to unsubscribe" maxLength={60} />
                                </div>

                                {/* ── Action Buttons Builder ── */}
                                <div className="form-group">
                                    <label className="form-label">Buttons <span style={{ opacity: 0.5, fontSize: '11px' }}>(optional · max 10)</span></label>
                                    
                                    {tplButtons.map((btn, idx) => (
                                        <div key={idx} style={{
                                            display: 'flex', gap: '8px', alignItems: 'flex-start',
                                            padding: '10px', background: 'var(--bg-tertiary)',
                                            borderRadius: '8px', marginBottom: '8px',
                                        }}>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                    {btn.type === 'PHONE_NUMBER' ? '📞 Call Button' : btn.type === 'URL' ? '🔗 URL Button' : '↩ Quick Reply'}
                                                </div>
                                                <input className="form-input" value={btn.text}
                                                    onInput={e => updateButton(idx, 'text', e.target.value)}
                                                    placeholder="Button text (max 25 chars)" maxLength={25}
                                                    style={{ fontSize: '13px' }} />
                                                {btn.type === 'PHONE_NUMBER' && (
                                                    <input className="form-input" value={btn.phone}
                                                        onInput={e => updateButton(idx, 'phone', e.target.value)}
                                                        placeholder="+919876543210" style={{ fontSize: '13px' }} />
                                                )}
                                                {btn.type === 'URL' && (
                                                    <>
                                                        <input className="form-input" value={btn.url}
                                                            onInput={e => updateButton(idx, 'url', e.target.value)}
                                                            placeholder="https://example.com/page/{{1}}" style={{ fontSize: '13px' }} />
                                                        {btn.url?.includes('{{') && (
                                                            <input className="form-input" value={btn.urlExample}
                                                                onInput={e => updateButton(idx, 'urlExample', e.target.value)}
                                                                placeholder="Example URL (for Meta review)" style={{ fontSize: '12px' }} />
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            <button type="button" className="btn-icon" onClick={() => removeButton(idx)}
                                                style={{ color: '#ef4444', marginTop: '18px' }} title="Remove">
                                                <Icon name="close" size={16} />
                                            </button>
                                        </div>
                                    ))}

                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        <button type="button" className="btn btn--outline" style={{ fontSize: '12px', padding: '4px 10px' }}
                                            onClick={() => addButton('PHONE_NUMBER')}
                                            disabled={tplButtons.filter(b => b.type === 'PHONE_NUMBER').length >= 1}>
                                            + Call
                                        </button>
                                        <button type="button" className="btn btn--outline" style={{ fontSize: '12px', padding: '4px 10px' }}
                                            onClick={() => addButton('URL')}
                                            disabled={tplButtons.filter(b => b.type === 'URL').length >= 2}>
                                            + Website
                                        </button>
                                        <button type="button" className="btn btn--outline" style={{ fontSize: '12px', padding: '4px 10px' }}
                                            onClick={() => addButton('QUICK_REPLY')}
                                            disabled={tplButtons.length >= 10}>
                                            + Quick Reply
                                        </button>
                                    </div>
                                </div>

                                <button type="submit" className="btn btn--primary" disabled={tplCreating} style={{ marginTop: '8px' }}>
                                    {tplCreating ? 'Submitting...' : 'Submit to Meta for Review'}
                                </button>
                            </form>
                        </div>

                        {/* ── Live Preview (WhatsApp Phone Mockup) ── */}
                        <div style={{ position: 'sticky', top: '32px' }}>
                            <div style={{
                                fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                                letterSpacing: '0.06em', color: 'var(--text-muted)',
                                marginBottom: '8px', paddingLeft: '4px',
                            }}>Live Preview</div>

                            {/* Phone Frame */}
                            <div style={{
                                background: '#0B141A', borderRadius: '24px',
                                padding: '12px 8px', boxShadow: 'var(--shadow-lg)',
                                overflow: 'hidden',
                            }}>
                                {/* Status Bar */}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '4px 12px 8px', fontSize: '11px', color: '#aaa',
                                }}>
                                    <span>9:41</span>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#aaa"><rect x="1" y="6" width="3" height="12" rx="1"/><rect x="7" y="4" width="3" height="14" rx="1"/><rect x="13" y="2" width="3" height="16" rx="1"/><rect x="19" y="0" width="3" height="18" rx="1"/></svg>
                                    </div>
                                </div>

                                {/* WhatsApp Header */}
                                <div style={{
                                    background: '#1F2C34', padding: '10px 14px',
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    borderRadius: '0',
                                }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '50%',
                                        background: '#25D366', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#fff',
                                    }}>B</div>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#e9edef' }}>Business</div>
                                        <div style={{ fontSize: '10px', color: '#8696a0' }}>online</div>
                                    </div>
                                </div>

                                {/* Chat Area */}
                                <div style={{
                                    background: '#0B141A',
                                    backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'p\' width=\'40\' height=\'40\' patternUnits=\'userSpaceOnUse\'%3E%3Cpath d=\'M0 20h40M20 0v40\' stroke=\'%23ffffff06\' fill=\'none\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect fill=\'url(%23p)\' width=\'200\' height=\'200\'/%3E%3C/svg%3E")',
                                    minHeight: '320px', padding: '16px 10px',
                                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                                }}>
                                    {/* Message Bubble */}
                                    <div style={{
                                        background: '#1F2C34', borderRadius: '0 8px 8px 8px',
                                        padding: '0', maxWidth: '280px', overflow: 'hidden',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                    }}>
                                        {/* Header Image */}
                                        {tplImagePreview && (
                                            <img src={tplImagePreview} style={{
                                                width: '100%', height: '140px',
                                                objectFit: 'cover', display: 'block',
                                            }} />
                                        )}

                                        {/* Body */}
                                        <div style={{ padding: '8px 10px 4px' }}>
                                            <div style={{
                                                fontSize: '13px', color: '#e9edef',
                                                lineHeight: '1.45', whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                            }}>
                                                {tplBody
                                                    ? tplBody.replace(/\{\{(\d+)\}\}/g, (_, n) => `[Variable ${n}]`)
                                                    : <span style={{ color: '#8696a0', fontStyle: 'italic' }}>Your message body will appear here...</span>
                                                }
                                            </div>

                                            {/* Footer */}
                                            {tplFooter && (
                                                <div style={{
                                                    fontSize: '11px', color: '#8696a0',
                                                    marginTop: '4px',
                                                }}>{tplFooter}</div>
                                            )}

                                            {/* Timestamp */}
                                            <div style={{
                                                fontSize: '10px', color: '#8696a0',
                                                textAlign: 'right', marginTop: '2px',
                                                display: 'flex', justifyContent: 'flex-end',
                                                alignItems: 'center', gap: '3px',
                                            }}>
                                                9:41 AM
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#53bdeb" strokeWidth="2.5" strokeLinecap="round"><path d="M2 12l5 5L18 6"/></svg>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        {tplButtons.filter(b => b.text?.trim()).map((btn, idx) => (
                                            <div key={idx} style={{
                                                borderTop: '1px solid rgba(255,255,255,0.06)',
                                                padding: '10px',
                                                textAlign: 'center',
                                                display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', gap: '6px',
                                            }}>
                                                {btn.type === 'PHONE_NUMBER' && (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#53bdeb" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                                )}
                                                {btn.type === 'URL' && (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#53bdeb" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                                                )}
                                                {btn.type === 'QUICK_REPLY' && (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#53bdeb" strokeWidth="2"><path d="M9 14l-4-4 4-4"/><path d="M5 10h11a4 4 0 1 1 0 8h-1"/></svg>
                                                )}
                                                <span style={{ fontSize: '13px', color: '#53bdeb', fontWeight: 500 }}>{btn.text}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Template Name Badge */}
                                    {tplName && (
                                        <div style={{
                                            marginTop: '8px', fontSize: '10px',
                                            color: '#8696a0', textAlign: 'center',
                                        }}>
                                            Template: <span style={{ color: '#53bdeb' }}>{tplName}</span>
                                            {' · '}{tplCategory.toLowerCase()} · {tplLanguage}
                                        </div>
                                    )}
                                </div>

                                {/* Input Bar */}
                                <div style={{
                                    background: '#1F2C34', padding: '8px 10px',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                }}>
                                    <div style={{
                                        flex: 1, background: '#2A3942', borderRadius: '20px',
                                        padding: '8px 14px', fontSize: '12px', color: '#8696a0',
                                    }}>Type a message</div>
                                    <div style={{
                                        width: '34px', height: '34px', borderRadius: '50%',
                                        background: '#25D366', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="card" style={{ overflow: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Category</th>
                                    <th>Language</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(whatsappTemplates || []).length === 0 ? (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>No templates found</td></tr>
                                ) : whatsappTemplates.map(t => (
                                    <tr key={t.id || t.name}>
                                        <td style={{ fontWeight: 600 }}>{t.name}</td>
                                        <td>{t.category}</td>
                                        <td>{t.language}</td>
                                        <td>
                                            <span className={`status-badge status-badge--${t.status === 'APPROVED' ? 'success' : t.status === 'REJECTED' ? 'danger' : 'warning'}`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td>
                                            <button className="btn btn--outline" style={{ fontSize: '12px', padding: '4px 10px', color: '#ef4444' }}
                                                onClick={() => { if (confirm(`Delete template "${t.name}"?`)) deleteWhatsAppTemplate(t.name); }}>
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    }
}
