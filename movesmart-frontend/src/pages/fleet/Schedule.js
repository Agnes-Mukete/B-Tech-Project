import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { FleetSidebar, Topbar, Modal, Spinner, EmptyState, useToast } from '../../components/shared';
import { tripAPI, vehicleAPI, routeAPI, userAPI } from '../../api';

const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

export default function FleetSchedule() {
  const [trips,    setTrips]    = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [routes,   setRoutes]   = useState([]);
  const [drivers,  setDrivers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(null); // { day, hour }
  const [form,     setForm]     = useState({});
  const [saving,   setSaving]   = useState(false);
  const { toast, ToastContainer } = useToast();

  // Current-week Mon–Sun dates, stable reference
  const weekDates = useMemo(() => {
    const now  = new Date();
    const day  = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon  = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0, 0, 0, 0);
    return DAYS.map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch entire week: Mon 00:00 → Sun 23:59:59
      const weekStart = weekDates[0].toISOString();
      const weekEnd   = new Date(weekDates[6].getTime() + 86_399_999).toISOString(); // Sun 23:59:59

      const [tRes, vRes, rRes, dRes] = await Promise.all([
        tripAPI.list({ dateFrom: weekStart, dateTo: weekEnd, limit: 200 }),
        vehicleAPI.list(),          // all statuses so already-active vehicles show
        routeAPI.list(),
        userAPI.list({ role: 'driver' }),
      ]);
      setTrips(tRes.data.data    || []);
      setVehicles(vRes.data.data || []);
      setRoutes(rRes.data.data   || []);
      setDrivers(dRes.data.data  || []);
    } catch { toast('Failed to load schedule', 'error'); }
    finally  { setLoading(false); }
  }, [toast, weekDates]);

  useEffect(() => { load(); }, [load]);

  // Find trips in a specific day + hour slot
  const getSlotTrips = (dayIndex, hour) => {
    const date = weekDates[dayIndex];
    return trips.filter(t => {
      if (!t.scheduledStart) return false;
      const s = new Date(t.scheduledStart);
      return s.getDate()  === date.getDate()  &&
             s.getMonth() === date.getMonth() &&
             s.getHours() === hour;
    });
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!showAdd) return;
    setSaving(true);
    try {
      const startDate = new Date(weekDates[showAdd.day]);
      startDate.setHours(showAdd.hour, 0, 0, 0);
      const endDate = new Date(startDate.getTime() + (form.durationHours || 4) * 3_600_000);

      await tripAPI.create({
        routeId:        form.routeId,
        vehicleId:      form.vehicleId,
        driverId:       form.driverId,
        scheduledStart: startDate.toISOString(),
        scheduledEnd:   endDate.toISOString(),
        ...(form.fare ? { fare: Number(form.fare) } : {}),
      });
      toast('Trip scheduled ✓');
      setShowAdd(null);
      setForm({});
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to schedule trip', 'error');
    } finally { setSaving(false); }
  };

  // Is this date today?
  const isToday = (date) => {
    const now = new Date();
    return date.getDate() === now.getDate() &&
           date.getMonth() === now.getMonth() &&
           date.getFullYear() === now.getFullYear();
  };

  return (
    <div className="app-shell">
      <FleetSidebar />
      <div className="main-content">
        <Topbar title="Schedule" actions={
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd({ day: 0, hour: 8 })}>
            <Plus size={14} /> New trip
          </button>
        } />
        <div className="page-body">
          <div className="card fade-up" style={{ overflowX: 'auto' }}>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={28} /></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: `48px repeat(${DAYS.length}, minmax(100px, 1fr))`, gap: 2 }}>

                {/* Header — day + date */}
                <div />
                {DAYS.map((d, i) => {
                  const today = isToday(weekDates[i]);
                  return (
                    <div key={d} style={{
                      textAlign: 'center', padding: '6px 4px',
                      borderBottom: '2px solid var(--border)',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 11, color: today ? 'var(--brand-600)' : 'var(--text-3)' }}>{d}</div>
                      <div style={{
                        fontSize: 13, fontWeight: today ? 700 : 400,
                        color: today ? 'var(--brand-600)' : 'var(--text-2)',
                        background: today ? 'var(--brand-50)' : 'transparent',
                        borderRadius: 4, marginTop: 2, padding: '1px 4px', display: 'inline-block',
                      }}>
                        {weekDates[i].getDate()}/{weekDates[i].getMonth() + 1}
                      </div>
                    </div>
                  );
                })}

                {/* Hour rows */}
                {HOURS.map(h => (
                  <React.Fragment key={h}>
                    {/* Time label */}
                    <div style={{
                      fontSize: 10, color: 'var(--text-3)', textAlign: 'right',
                      paddingRight: 8, paddingTop: 8, lineHeight: 1,
                    }}>
                      {h}:00
                    </div>

                    {/* Day cells */}
                    {DAYS.map((_, di) => {
                      const slotTrips = getSlotTrips(di, h);
                      const hasTrip   = slotTrips.length > 0;
                      return (
                        <div
                          key={di}
                          onClick={() => setShowAdd({ day: di, hour: h })}
                          title={`${DAYS[di]} ${h}:00 — click to schedule`}
                          style={{
                            minHeight: 44,
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            padding: '3px 4px',
                            cursor: 'pointer',
                            background: hasTrip ? 'var(--brand-50)' : 'var(--surface)',
                            transition: 'background .1s',
                          }}
                          onMouseEnter={e => { if (!hasTrip) e.currentTarget.style.background = 'var(--surface-2)'; }}
                          onMouseLeave={e => { if (!hasTrip) e.currentTarget.style.background = 'var(--surface)'; }}
                        >
                          {hasTrip ? slotTrips.map(t => (
                            <div key={t._id} style={{
                              fontSize: 9, fontWeight: 700,
                              background: 'var(--brand-500)',
                              color: '#fff',
                              borderRadius: 3,
                              padding: '2px 5px',
                              marginBottom: 2,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {t.vehicleId?.vehicleId || 'V?'} · {t.driverId?.name?.split(' ')[0] || '—'}
                            </div>
                          )) : null}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* No trips hint */}
            {!loading && trips.length === 0 && (
              <div style={{ marginTop: 20 }}>
                <EmptyState icon={Calendar} title="No trips scheduled this week"
                  sub="Click any cell or use New trip to schedule a trip" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule trip modal */}
      {showAdd && (
        <Modal
          title={`Schedule trip — ${DAYS[showAdd.day]} ${showAdd.hour}:00`}
          onClose={() => setShowAdd(null)}
          footer={<>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleSchedule}>
              {saving ? <Spinner size={14} /> : <><Calendar size={13} /> Schedule</>}
            </button>
          </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field">
              <label className="field-label">Route</label>
              <select className="field-input field-select" required value={form.routeId || ''}
                onChange={e => setForm(f => ({ ...f, routeId: e.target.value }))}>
                <option value="">Select route…</option>
                {routes.map(r => (
                  <option key={r._id} value={r._id}>{r.name} ({r.origin} → {r.destination})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Vehicle</label>
              <select className="field-input field-select" required value={form.vehicleId || ''}
                onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}>
                <option value="">Select vehicle…</option>
                {vehicles.map(v => (
                  <option key={v._id} value={v._id}>{v.vehicleId} — {v.plateNumber} (cap: {v.capacity})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Driver</label>
              <select className="field-input field-select" required value={form.driverId || ''}
                onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))}>
                <option value="">Select driver…</option>
                {drivers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field">
                <label className="field-label">Duration (hours)</label>
                <input className="field-input" type="number" min={1} max={12} step={0.5}
                  value={form.durationHours || 4}
                  onChange={e => setForm(f => ({ ...f, durationHours: parseFloat(e.target.value) }))} />
              </div>
              <div className="field">
                <label className="field-label">Fare (FCFA, optional)</label>
                <input className="field-input" type="number" min={0} placeholder="Uses route base fare"
                  value={form.fare || ''}
                  onChange={e => setForm(f => ({ ...f, fare: e.target.value }))} />
              </div>
            </div>
          </div>
        </Modal>
      )}
      <ToastContainer />
    </div>
  );
}
