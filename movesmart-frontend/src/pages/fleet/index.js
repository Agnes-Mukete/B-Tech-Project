import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Route as RouteIcon, Users, AlertTriangle, Plus, CheckCircle } from 'lucide-react';
import { FleetSidebar, Topbar, Pill, FuelBar, Modal, SearchBar, EmptyState, Spinner, useToast } from '../../components/shared';
import { vehicleAPI, routeAPI, userAPI, incidentAPI } from '../../api';

// ── Vehicles ───────────────────────────────────────────────────────
export function FleetVehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ type: 'bus', capacity: 40, currentDriver: '' });
  const [saving, setSaving] = useState(false);
  const { toast, ToastContainer } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, dRes] = await Promise.all([
        vehicleAPI.list(),
        userAPI.list({ role: 'driver' }),
      ]);
      setVehicles(vRes.data.data);
      setDrivers(dRes.data.data);
    }
    catch { toast('Failed to load vehicles', 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.currentDriver) delete payload.currentDriver;
      await vehicleAPI.create(payload);
      toast('Vehicle added ✓');
      setShowAdd(false);
      setForm({ type: 'bus', capacity: 40, currentDriver: '' });
      load();
    }
    catch (err) { toast(err.response?.data?.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="app-shell">
      <FleetSidebar />
      <div className="main-content">
        <Topbar title="Vehicles" actions={<button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={14} /> Add vehicle</button>} />
        <div className="page-body">
          <div className="card fade-up">
            {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={28} /></div>
              : vehicles.length === 0 ? <EmptyState icon={Truck} title="No vehicles yet" sub="Add your first vehicle to get started" />
              : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>ID</th><th>Plate</th><th>Type</th><th>Capacity</th><th>Status</th><th>Fuel</th><th>Driver</th></tr></thead>
                    <tbody>
                      {vehicles.map(v => (
                        <tr key={v._id}>
                          <td className="td-bold">{v.vehicleId}</td>
                          <td className="td-mono">{v.plateNumber}</td>
                          <td style={{ textTransform: 'capitalize' }}>{v.type}</td>
                          <td>{v.capacity}</td>
                          <td><Pill status={v.status} /></td>
                          <td><FuelBar level={v.fuelLevel || 0} /></td>
                          <td className="td-muted">{v.currentDriver?.name || '—'}</td>
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
        <Modal title="Add vehicle" onClose={() => setShowAdd(false)}
          footer={<><button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(false)}>Cancel</button><button className="btn btn-primary btn-sm" disabled={saving} onClick={handleCreate}>{saving ? <Spinner size={14} /> : 'Add vehicle'}</button></>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[['plateNumber', 'Plate number', 'text'], ['vehicleId', 'Vehicle ID (e.g. V01)', 'text']].map(([k, lbl, t]) => (
              <div key={k} className="field"><label className="field-label">{lbl}</label><input className="field-input" type={t} required value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
            ))}
            <div className="field"><label className="field-label">Type</label>
              <select className="field-input field-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {['bus', 'minibus', 'van'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field"><label className="field-label">Capacity</label><input className="field-input" type="number" min={1} max={100} required value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: parseInt(e.target.value) }))} /></div>
            <div className="field"><label className="field-label">Assign driver</label>
              <select className="field-input field-select" value={form.currentDriver || ''} onChange={e => setForm(f => ({ ...f, currentDriver: e.target.value }))}>
                <option value="">Unassigned</option>
                {drivers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
          </div>
        </Modal>
      )}
      <ToastContainer />
    </div>
  );
}

// ── Routes ─────────────────────────────────────────────────────────
export function FleetRoutes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast, ToastContainer } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await routeAPI.list(); setRoutes(r.data.data); }
    catch { toast('Failed to load routes', 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await routeAPI.create(form); toast('Route created ✓'); setShowAdd(false); setForm({}); load(); }
    catch (err) { toast(err.response?.data?.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="app-shell">
      <FleetSidebar />
      <div className="main-content">
        <Topbar title="Routes" actions={<button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={14} /> Add route</button>} />
        <div className="page-body">
          <div className="card fade-up">
            {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={28} /></div>
              : routes.length === 0 ? <EmptyState icon={RouteIcon} title="No routes yet" />
              : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>ID</th><th>Name</th><th>Origin → Destination</th><th>Distance</th><th>Duration</th><th>Fare</th><th>Status</th></tr></thead>
                    <tbody>
                      {routes.map(r => (
                        <tr key={r._id}>
                          <td className="td-mono">{r.routeId}</td>
                          <td className="td-bold">{r.name}</td>
                          <td>{r.origin} → {r.destination}</td>
                          <td>{r.distanceKm} km</td>
                          <td>{r.estimatedDuration} min</td>
                          <td className="td-bold">{r.baseFare?.toLocaleString()} FCFA</td>
                          <td><Pill status={r.isActive ? 'active' : 'idle'} /></td>
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
        <Modal title="Add route" onClose={() => setShowAdd(false)}
          footer={<><button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(false)}>Cancel</button><button className="btn btn-primary btn-sm" disabled={saving} onClick={handleCreate}>{saving ? <Spinner size={14} /> : 'Create route'}</button></>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['name','Route name','text'],['origin','Origin city','text'],['destination','Destination city','text'],['distanceKm','Distance (km)','number'],['estimatedDuration','Duration (min)','number'],['baseFare','Base fare (FCFA)','number']].map(([k, lbl, t]) => (
              <div key={k} className="field"><label className="field-label">{lbl}</label><input className="field-input" type={t} required value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: t === 'number' ? parseFloat(e.target.value) : e.target.value }))} /></div>
            ))}
          </div>
        </Modal>
      )}
      <ToastContainer />
    </div>
  );
}

// ── Drivers ────────────────────────────────────────────────────────
export function FleetDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { toast, ToastContainer } = useToast();

  useEffect(() => {
    userAPI.list({ role: 'driver' })
      .then(r => setDrivers(r.data.data))
      .catch(() => toast('Failed to load drivers', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  const filtered = drivers.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="app-shell">
      <FleetSidebar />
      <div className="main-content">
        <Topbar title="Drivers" />
        <div className="page-body">
          <div className="card fade-up">
            <div style={{ marginBottom: 14 }}>
              <SearchBar value={search} onChange={setSearch} placeholder="Search drivers…" />
            </div>
            {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={28} /></div>
              : filtered.length === 0 ? <EmptyState icon={Users} title="No drivers found" />
              : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Driver</th><th>Email</th><th>Phone</th><th>Status</th><th>Last login</th></tr></thead>
                    <tbody>
                      {filtered.map(d => (
                        <tr key={d._id}>
                          <td className="td-bold">{d.name}</td>
                          <td className="td-muted">{d.email}</td>
                          <td className="td-muted">{d.phone || '—'}</td>
                          <td><Pill status={d.status} /></td>
                          <td className="td-muted">{d.lastLogin ? new Date(d.lastLogin).toLocaleDateString() : 'Never'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}

// ── Incidents ──────────────────────────────────────────────────────
export function FleetIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const { toast, ToastContainer } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await incidentAPI.list({ status: filter }); setIncidents(r.data.data); }
    catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }, [filter, toast]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id) => {
    try { await incidentAPI.resolve(id, { resolution: 'Resolved' }); toast('Resolved ✓'); load(); }
    catch { toast('Failed', 'error'); }
  };

  const priorityColor = { critical: 'var(--danger)', high: 'var(--warning)', routine: 'var(--brand-500)' };

  return (
    <div className="app-shell">
      <FleetSidebar />
      <div className="main-content">
        <Topbar title="Incidents" />
        <div className="page-body">
          <div className="card fade-up">
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {['open', 'resolved'].map(s => (
                <button key={s} className={`tab-btn ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={28} /></div>
              : incidents.length === 0 ? <EmptyState icon={filter === 'open' ? AlertTriangle : CheckCircle} title={`No ${filter} incidents`} />
              : incidents.map(inc => (
                <div key={inc._id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColor[inc.priority] || 'var(--text-3)', flexShrink: 0, marginTop: 5 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      {inc.vehicleId?.vehicleId || 'Vehicle'} · <span style={{ textTransform: 'capitalize', color: priorityColor[inc.priority] }}>{inc.priority}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{inc.description}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      Driver: {inc.driverId?.name || '—'} · {new Date(inc.reportedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {filter === 'open' && (
                    <button className="btn btn-success btn-sm" style={{ fontSize: 11 }} onClick={() => resolve(inc._id)}>
                      <CheckCircle size={11} /> Resolve
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
