import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, UserCheck, UserX } from 'lucide-react';
import { AdminSidebar, Topbar, Modal, Pill, Avatar, SearchBar, EmptyState, Spinner, useToast } from '../../components/shared';
import { userAPI, agencyAPI } from '../../api';

const ROLES = ['admin', 'fleetManager', 'driver', 'passenger'];

export default function AdminUsers() {
  const [users,    setUsers]    = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [search,   setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [form,     setForm]     = useState({ role: 'passenger' });
  const [saving,   setSaving]   = useState(false);
  const { toast, ToastContainer } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, aRes] = await Promise.all([
        userAPI.list({ search, role: roleFilter || undefined }),
        agencyAPI.listAdmin({ limit: 100 }),
      ]);
      setUsers(uRes.data.data);
      setAgencies(aRes.data.data);
    } catch { toast('Failed to load users', 'error'); }
    finally  { setLoading(false); }
  }, [search, roleFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (id, current) => {
    try {
      await userAPI.updateStatus(id, { status: current === 'active' ? 'inactive' : 'active' });
      toast(`User ${current === 'active' ? 'deactivated' : 'activated'} ✓`);
      load();
    } catch { toast('Failed to update status', 'error'); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await userAPI.create(form);
      const created = res.data?.data;
      const staffMsg = created?.staffId ? ` Staff ID: ${created.staffId}` : '';
      toast(`User created ✓${staffMsg}`);
      setShowAdd(false);
      setForm({ role: 'passenger' });
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to create user', 'error');
    } finally { setSaving(false); }
  };

  const roleColors = { admin: '#1d4ed8', superAdmin: '#1d4ed8', agencyAdmin: '#0f766e', fleetManager: '#059669', driver: '#0891b2', passenger: '#7c3aed' };

  return (
    <div className="app-shell">
      <AdminSidebar />
      <div className="main-content">
        <Topbar
          title="User management"
          actions={
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Add user
            </button>
          }
        />
        <div className="page-body">
          <div className="card fade-up">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <SearchBar value={search} onChange={setSearch} placeholder="Search name or email…" />
              <select className="field-input field-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ width: 140, height: 34, fontSize: 12 }}>
                <option value="">All roles</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)' }}>{users.length} user{users.length !== 1 ? 's' : ''}</span>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={28} /></div>
            ) : users.length === 0 ? (
              <EmptyState icon={Users} title="No users found" sub="Adjust your filters or add a new user" />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>User</th><th>Staff ID</th><th>Role</th><th>Agency</th><th>Status</th><th>Last login</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar name={u.name} size={30} color={roleColors[u.role] || '#64748b'} />
                            <div>
                              <div className="td-bold">{u.name}</div>
                              <div className="td-muted">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="td-muted">
                          {u.staffId
                            ? <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4 }}>{u.staffId}</span>
                            : <span style={{ color: 'var(--text-4)' }}>—</span>}
                        </td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: `${roleColors[u.role]}18`, color: roleColors[u.role] }}>
                            {u.role}
                          </span>
                        </td>
                        <td className="td-muted">{u.agencyId?.name || '—'}</td>
                        <td><Pill status={u.status} /></td>
                        <td className="td-muted">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}</td>
                        <td>
                          <button
                            className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                            onClick={() => toggleStatus(u._id, u.status)}>
                            {u.status === 'active' ? <><UserX size={12} /> Deactivate</> : <><UserCheck size={12} /> Activate</>}
                          </button>
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

      {showAdd && (
        <Modal title="Add new user" onClose={() => setShowAdd(false)}
          footer={<>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleCreate}>
              {saving ? <Spinner size={14} /> : 'Create user'}
            </button>
          </>}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[['name','Full name','text'],['email','Email','email'],['phone','Phone','tel'],['password','Temporary password','password']].map(([k, lbl, t]) => (
              <div key={k} className="field">
                <label className="field-label">{lbl}</label>
                <input className="field-input" type={t} required={k !== 'phone'} value={form[k] || ''}
                  onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="field">
              <label className="field-label">Role</label>
              <select className="field-input field-select" value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value, agencyId: '' }))}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {['agencyAdmin', 'fleetManager', 'driver'].includes(form.role) && (
              <div className="field">
                <label className="field-label">Agency *</label>
                <select className="field-input field-select" required value={form.agencyId || ''}
                  onChange={e => setForm(f => ({ ...f, agencyId: e.target.value }))}>
                  <option value="">Select agency…</option>
                  {agencies.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
            )}
          </form>
        </Modal>
      )}
      <ToastContainer />
    </div>
  );
}
