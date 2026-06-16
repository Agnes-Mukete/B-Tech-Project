import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, CheckCircle, XCircle, Eye, EyeOff, RefreshCw, Shield } from 'lucide-react';
import { AdminSidebar, Topbar, Modal, Pill, SearchBar, EmptyState, Spinner, useToast } from '../../components/shared';
import { agencyAPI } from '../../api';

const TABS = ['all', 'active', 'pending', 'suspended'];

export default function AdminAgencies() {
  const [agencies, setAgencies]     = useState([]);
  const [stats,    setStats]        = useState({});
  const [tab,      setTab]          = useState('all');
  const [search,   setSearch]       = useState('');
  const [loading,  setLoading]      = useState(true);
  const [selected, setSelected]     = useState(null);  // detail modal
  const [showReg,  setShowReg]      = useState(false); // register modal
  const [form,     setForm]         = useState({});
  const [saving,   setSaving]       = useState(false);
  const { toast, ToastContainer }   = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, sRes] = await Promise.all([
        agencyAPI.listAdmin({ status: tab === 'all' ? undefined : tab, search }),
        agencyAPI.getStats(),
      ]);
      setAgencies(aRes.data.data);
      setStats(sRes.data.data);
    } catch (e) { toast('Failed to load agencies', 'error'); }
    finally     { setLoading(false); }
  }, [tab, search, toast]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    try {
      await agencyAPI.updateStatus(id, { status: 'active' });
      toast('Agency approved and published to passengers ✓');
      load();
      setSelected(null);
    } catch { toast('Failed to approve', 'error'); }
  };

  const suspend = async (id) => {
    try {
      await agencyAPI.updateStatus(id, { status: 'suspended' });
      toast('Agency suspended and hidden from passengers');
      load();
      setSelected(null);
    } catch { toast('Failed to suspend', 'error'); }
  };

  const reinstate = async (id) => {
    try {
      await agencyAPI.updateStatus(id, { status: 'active' });
      toast('Agency reinstated ✓');
      load();
      setSelected(null);
    } catch { toast('Failed to reinstate', 'error'); }
  };

  const toggleVis = async (id) => {
    try {
      const r = await agencyAPI.toggleVisibility(id);
      toast(r.data.data.visible ? 'Agency now visible to passengers ✓' : 'Agency hidden from passengers');
      load();
    } catch { toast('Failed to toggle visibility', 'error'); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await agencyAPI.register(form);
      toast('Agency created – invite sent to owner ✓');
      setShowReg(false);
      setForm({});
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Registration failed', 'error');
    } finally { setSaving(false); }
  };

  const tabCount = (t) => ({
    all: stats.total, active: stats.active,
    pending: stats.pending, suspended: stats.suspended,
  }[t]);

  return (
    <div className="app-shell">
      <AdminSidebar pendingCount={stats.pending || 0} />
      <div className="main-content">
        <Topbar
          title="Agency management"
          actions={
            <button className="btn btn-primary btn-sm" onClick={() => setShowReg(true)}>
              <Plus size={14} /> Register agency
            </button>
          }
        />
        <div className="page-body">

          {/* Stats row */}
          <div className="metric-grid">
            {[
              { label: 'Active', val: stats.active,    color: 'var(--success)' },
              { label: 'Pending', val: stats.pending,  color: 'var(--warning)' },
              { label: 'Suspended', val: stats.suspended, color: 'var(--danger)' },
              { label: 'Total', val: stats.total,      color: 'var(--brand-600)' },
            ].map((s, i) => (
              <div key={s.label} className="metric-card fade-up" style={{ animationDelay: `${i*.05}s` }}>
                <div className="metric-label" style={{ color: s.color }}><Building2 size={12} /> {s.label} agencies</div>
                <div className="metric-value">{s.val ?? '—'}</div>
              </div>
            ))}
          </div>

          {/* Table card */}
          <div className="card fade-up stagger-2">
            {/* Tabs + search */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div className="tab-row" style={{ border: 'none', gap: 4 }}>
                {TABS.map(t => (
                  <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                    {tabCount(t) > 0 && (
                      <span className="tab-count" style={{ background: t === 'pending' ? 'var(--danger-bg)' : 'var(--surface-3)', color: t === 'pending' ? 'var(--danger)' : 'var(--text-2)' }}>
                        {tabCount(t)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <SearchBar value={search} onChange={setSearch} placeholder="Search agencies…" />
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={28} /></div>
            ) : agencies.length === 0 ? (
              <EmptyState icon={Building2} title="No agencies found" sub="Try a different filter or register a new agency" />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Agency</th>
                      <th>Owner</th>
                      <th>Status</th>
                      <th>Visible</th>
                      <th>Routes</th>
                      <th>Rating</th>
                      <th>Registered</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agencies.map(a => (
                      <tr key={a._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: a.logoColor || '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                              {a.shortCode}
                            </div>
                            <div>
                              <div className="td-bold">{a.name}</div>
                              <div className="td-mono">{a._id.slice(-8)}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13 }}>{a.ownerName}</div>
                          <div className="td-muted">{a.city}</div>
                        </td>
                        <td><Pill status={a.status} /></td>
                        <td>
                          <button
                            onClick={() => a.status === 'active' && toggleVis(a._id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, background: a.visible ? 'var(--success-bg)' : 'var(--surface-3)', color: a.visible ? '#065f46' : 'var(--text-3)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: a.status === 'active' ? 'pointer' : 'not-allowed', opacity: a.status !== 'active' ? 0.5 : 1 }}>
                            {a.visible ? <><Eye size={12} /> Visible</> : <><EyeOff size={12} /> Hidden</>}
                          </button>
                        </td>
                        <td className="td-bold">{a.routes || 0}</td>
                        <td>{a.rating > 0 ? <span style={{ color: '#f59e0b', fontWeight: 600 }}>★ {a.rating}</span> : <span className="td-muted">—</span>}</td>
                        <td className="td-muted">{new Date(a.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(a)}>View</button>
                            {a.status === 'pending' && (
                              <>
                                <button className="btn btn-success btn-sm" onClick={() => approve(a._id)}><CheckCircle size={12} /></button>
                                <button className="btn btn-danger btn-sm"  onClick={() => suspend(a._id)}><XCircle size={12} /></button>
                              </>
                            )}
                            {a.status === 'active' && (
                              <button className="btn btn-danger btn-sm" onClick={() => suspend(a._id)}>Suspend</button>
                            )}
                            {a.status === 'suspended' && (
                              <button className="btn btn-success btn-sm" onClick={() => reinstate(a._id)}><RefreshCw size={12} /> Reinstate</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}
          footer={<>
            {selected.status === 'pending'   && <><button className="btn btn-danger btn-sm"   onClick={() => suspend(selected._id)}>Reject</button><button className="btn btn-primary btn-sm" onClick={() => approve(selected._id)}><CheckCircle size={13} /> Approve & publish</button></>}
            {selected.status === 'active'    && <button className="btn btn-danger btn-sm"  onClick={() => suspend(selected._id)}>Suspend agency</button>}
            {selected.status === 'suspended' && <button className="btn btn-success btn-sm" onClick={() => reinstate(selected._id)}><RefreshCw size={13} /> Reinstate</button>}
          </>}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, padding: '12px', background: 'var(--surface-2)', borderRadius: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: selected.logoColor || '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>{selected.shortCode}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.name}</div>
              <Pill status={selected.status} />
            </div>
          </div>
          {[
            ['Owner', selected.ownerName],
            ['Email', selected.ownerEmail],
            ['Phone', selected.ownerPhone],
            ['City', selected.city],
            ['Coverage', selected.coverageCities?.join(', ')],
            ['Tier', selected.tier],
            ['Registered', new Date(selected.createdAt).toLocaleDateString()],
            ['Visible to passengers', selected.visible ? 'Yes' : 'No'],
          ].map(([k, v]) => v && (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>{k}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-1)', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
            </div>
          ))}
          {selected.documents?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8 }}>SUBMITTED DOCUMENTS</div>
              {selected.documents.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, marginBottom: 6 }}>
                  <Shield size={14} color="var(--brand-500)" />
                  <span style={{ flex: 1 }}>{d.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>✓ Verified</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Register modal */}
      {showReg && (
        <Modal title="Add agency manually" onClose={() => setShowReg(false)}
          footer={<>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowReg(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleRegister}>
              {saving ? <Spinner size={14} /> : <><Plus size={13} /> Create agency</>}
            </button>
          </>}>
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[['name','Agency name','text',true],['shortCode','Short code (max 4)','text',true],
                ['ownerName','Owner full name','text',true],['ownerEmail','Owner email','email',true],
                ['ownerPhone','Owner phone','tel',true],['city','Head office city','text',true]
              ].map(([k, lbl, t, req]) => (
                <div key={k} className="field">
                  <label className="field-label">{lbl}</label>
                  <input className="field-input" type={t} required={req} value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="field">
              <label className="field-label">Coverage cities (comma-separated)</label>
              <input className="field-input" value={form.coverageCities || ''} onChange={e => setForm(f => ({ ...f, coverageCities: e.target.value.split(',').map(s => s.trim()) }))} placeholder="Yaoundé, Bafoussam, Douala" />
            </div>
            <div className="field">
              <label className="field-label">Agency tier</label>
              <select className="field-input field-select" value={form.tier || 'standard'} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div style={{ background: 'var(--info-bg)', color: '#3730a3', fontSize: 12, padding: '8px 12px', borderRadius: 8 }}>
              ℹ Agency will be set to <strong>Pending</strong> until you approve it. Only approved agencies appear to passengers.
            </div>
          </form>
        </Modal>
      )}
      <ToastContainer />
    </div>
  );
}
