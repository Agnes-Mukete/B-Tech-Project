import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Users, AlertTriangle, CheckCircle, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { FleetSidebar, Topbar, Pill, FuelBar, Avatar, EmptyState, Spinner, useToast } from '../../components/shared';
import { vehicleAPI, incidentAPI, analyticsAPI, aiAPI, tripAPI } from '../../api';

const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIMES = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];

// Current-week Mon–Sun dates
function getWeekDates() {
  const now  = new Date();
  const day  = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0, 0, 0, 0);
  return DAYS.map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
}
const WEEK_DATES = getWeekDates();

function VehicleStatusCard({ label, count, total, color }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="metric-card">
      <div className="metric-label" style={{ color }}><Truck size={12} /> {label}</div>
      <div className="metric-value" style={{ color }}>{count}</div>
      <div className="metric-delta delta-neutral">{pct}% of fleet</div>
    </div>
  );
}

function AiAssistantPanel({ open, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Ask me about scheduling, driver assignment, maintenance, fuel, or alerts.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async (text = input) => {
    const clean = text.trim();
    if (!clean || loading) return;

    setMessages(current => [...current, { role: 'user', text: clean }]);
    setInput('');
    setLoading(true);

    try {
      const res = await aiAPI.fleetChat(clean);
      const { reply, suggestions = [] } = res.data.data;
      setMessages(current => [...current, { role: 'assistant', text: reply, suggestions }]);
    } catch (err) {
      setMessages(current => [
        ...current,
        { role: 'assistant', text: err.response?.data?.message || 'I could not generate a fleet suggestion right now.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 520, maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-head">
          <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} color="var(--brand-600)" /> Fleet AI Assistant
          </span>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {['What should I do first?', 'Any driver assignment issues?', 'Check maintenance risk', 'How is today’s schedule?'].map(prompt => (
            <button key={prompt} className="btn btn-secondary btn-sm" type="button" onClick={() => send(prompt)}>
              {prompt}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 2px 12px' }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                background: m.role === 'user' ? 'var(--brand-600)' : 'var(--surface-2)',
                color: m.role === 'user' ? '#fff' : 'var(--text-1)',
                borderRadius: 12,
                padding: '10px 12px',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {m.text}
              {m.suggestions?.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {m.suggestions.slice(0, 3).map(s => (
                    <div key={s} style={{ fontSize: 12, color: 'var(--text-2)' }}>- {s}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Thinking through the fleet data...</div>}
        </div>

        <form onSubmit={e => { e.preventDefault(); send(); }} style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <input className="field-input" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask for a fleet suggestion..." />
          <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()}>
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function FleetDashboard() {
  const [vehicles,  setVehicles]  = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [perf,      setPerf]      = useState([]);
  const [trips,     setTrips]     = useState([]);
  const [vFilter,   setVFilter]   = useState('all');
  const [loading,   setLoading]   = useState(true);
  const [aiOpen,    setAiOpen]    = useState(false);
  const { toast, ToastContainer } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, iRes, pRes, tRes] = await Promise.all([
        vehicleAPI.list(),
        incidentAPI.list({ status: 'open' }),
        analyticsAPI.driverPerformance(),
        tripAPI.list({
          dateFrom: WEEK_DATES[0].toISOString(),
          dateTo:   new Date(WEEK_DATES[6].getTime() + 86_399_999).toISOString(),
          limit: 200,
        }),
      ]);
      setVehicles(vRes.data.data);
      setIncidents(iRes.data.data);
      setPerf(pRes.data.data.slice(0, 6));
      setTrips(tRes.data.data);
    } catch { toast('Failed to load fleet data', 'error'); }
    finally  { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const resolveAlert = async (id) => {
    try {
      await incidentAPI.resolve(id, { resolution: 'Resolved by fleet manager' });
      toast('Incident resolved ✓');
      load();
    } catch { toast('Failed to resolve', 'error'); }
  };

  const updateVehicleStatus = async (id, status) => {
    try {
      await vehicleAPI.updateStatus(id, { status });
      toast(`Vehicle marked as ${status} ✓`);
      load();
    } catch { toast('Failed to update', 'error'); }
  };

  const filtered = vFilter === 'all' ? vehicles : vehicles.filter(v => v.status === vFilter);
  const counts = { active: 0, idle: 0, maintenance: 0 };
  vehicles.forEach(v => { if (counts[v.status] !== undefined) counts[v.status]++; });

  return (
    <div className="app-shell">
      <FleetSidebar />
      <div className="main-content">
        <Topbar title="Fleet overview"
          actions={<button className="btn btn-primary btn-sm" onClick={() => setAiOpen(true)}><MessageCircle size={14} /> AI Suggest</button>}
        />
        <div className="page-body">

          {/* Vehicle status cards */}
          <div className="metric-grid">
            <VehicleStatusCard label="Active vehicles"   count={counts.active}      total={vehicles.length} color="var(--success)" />
            <VehicleStatusCard label="Idle vehicles"     count={counts.idle}        total={vehicles.length} color="var(--warning)" />
            <VehicleStatusCard label="In maintenance"    count={counts.maintenance} total={vehicles.length} color="var(--danger)"  />
            <div className="metric-card">
              <div className="metric-label" style={{ color: 'var(--brand-600)' }}><AlertTriangle size={12} /> Open alerts</div>
              <div className="metric-value" style={{ color: incidents.length > 0 ? 'var(--danger)' : 'var(--text-1)' }}>{incidents.length}</div>
            </div>
          </div>

          {/* 2-col: vehicle list + schedule */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 16 }}>

            {/* Vehicle list */}
            <div className="card fade-up stagger-1">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="card-title" style={{ margin: 0 }}>Vehicle list</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['all', 'active', 'idle', 'maintenance'].map(f => (
                    <button key={f} onClick={() => setVFilter(f)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, border: '1px solid var(--border)', background: vFilter === f ? 'var(--brand-600)' : 'var(--surface)', color: vFilter === f ? '#fff' : 'var(--text-2)', cursor: 'pointer', fontWeight: 500 }}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState icon={Truck} title="No vehicles" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {filtered.map(v => (
                    <div key={v._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: 'var(--text-2)', flexShrink: 0 }}>{v.vehicleId}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{v.plateNumber}</div>
                        <div style={{ color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.currentDriver?.name || 'Unassigned'}</div>
                      </div>
                      <FuelBar level={v.fuelLevel || 0} />
                      <Pill status={v.status} />
                      <select className="field-input" style={{ width: 100, height: 26, fontSize: 11, padding: '2px 6px' }}
                        value={v.status} onChange={e => updateVehicleStatus(v._id, e.target.value)}>
                        <option value="active">Active</option>
                        <option value="idle">Idle</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Schedule calendar */}
            <div className="card fade-up stagger-2">
              <div className="card-title">Smart schedule — this week</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(7, 1fr)', gap: 2, fontSize: 10 }}>
                {/* Day headers */}
                <div />
                {DAYS.map((d, i) => {
                  const today = (() => { const n = new Date(); return WEEK_DATES[i].toDateString() === n.toDateString(); })();
                  return (
                    <div key={d} style={{
                      textAlign: 'center', fontWeight: 700, fontSize: 10, padding: '3px 2px',
                      color: today ? 'var(--brand-600)' : 'var(--text-3)',
                      borderBottom: `2px solid ${today ? 'var(--brand-500)' : 'var(--border)'}`,
                    }}>
                      {d}
                      <div style={{ fontWeight: 400, fontSize: 9, color: today ? 'var(--brand-500)' : 'var(--text-3)' }}>
                        {WEEK_DATES[i].getDate()}/{WEEK_DATES[i].getMonth() + 1}
                      </div>
                    </div>
                  );
                })}

                {/* Time + day slots */}
                {TIMES.map(time => {
                  const h = parseInt(time);
                  return (
                    <React.Fragment key={time}>
                      <div style={{ fontSize: 9, color: 'var(--text-3)', paddingRight: 5, paddingTop: 5, whiteSpace: 'nowrap' }}>{time}</div>
                      {DAYS.map((_, di) => {
                        const date      = WEEK_DATES[di];
                        const slotTrips = trips.filter(t => {
                          if (!t.scheduledStart) return false;
                          const s = new Date(t.scheduledStart);
                          return s.getDate()  === date.getDate()  &&
                                 s.getMonth() === date.getMonth() &&
                                 (s.getHours() === h || s.getHours() === h + 1);
                        });
                        const hasTrip = slotTrips.length > 0;
                        return (
                          <div key={di}
                            style={{
                              minHeight: 32, borderRadius: 3, padding: '2px 3px',
                              border: '1px solid var(--border)',
                              background: hasTrip ? 'var(--brand-50)' : 'var(--surface)',
                            }}
                            title={hasTrip
                              ? slotTrips.map(t => `${t.vehicleId?.vehicleId || 'V?'} — ${t.routeId?.name || 'Route'}`).join('\n')
                              : `${DAYS[di]} ${time} — free`}>
                            {slotTrips.map(t => (
                              <div key={t._id} style={{
                                fontSize: 8, fontWeight: 700,
                                background: 'var(--brand-500)', color: '#fff',
                                borderRadius: 2, padding: '1px 3px', marginBottom: 1,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>
                                {t.vehicleId?.vehicleId || 'V?'}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>

              {!loading && trips.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 14, padding: '8px 0' }}>
                  No trips scheduled this week
                </div>
              )}
            </div>
          </div>

          {/* 2-col: maintenance alerts + driver performance */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Maintenance alerts */}
            <div className="card fade-up stagger-3">
              <div className="card-title">Maintenance alerts</div>
              {loading ? <Spinner /> : incidents.length === 0 ? (
                <EmptyState icon={CheckCircle} title="No open alerts" sub="All vehicles are running smoothly" />
              ) : (
                incidents.map(inc => (
                  <div key={inc._id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className={`alert-dot alert-${inc.priority}`} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{inc.vehicleId?.vehicleId || 'Vehicle'} — <span style={{ textTransform: 'capitalize', fontWeight: 400, color: 'var(--text-2)' }}>{inc.priority}</span></div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{inc.description}</div>
                    </div>
                    <button className="btn btn-success btn-sm" style={{ fontSize: 10 }} onClick={() => resolveAlert(inc._id)}>Resolve</button>
                  </div>
                ))
              )}
            </div>

            {/* Driver leaderboard */}
            <div className="card fade-up stagger-4">
              <div className="card-title">Driver performance</div>
              {loading ? <Spinner /> : perf.length === 0 ? (
                <EmptyState icon={Users} title="No performance data yet" />
              ) : (
                <>
                  {perf.map((d, i) => (
                    <div key={d.driverId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', width: 16 }}>#{i + 1}</span>
                      <Avatar name={d.name} size={26} color="var(--brand-600)" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{d.name}</div>
                        <div style={{ color: 'var(--text-3)', fontSize: 11 }}>{d.trips} trips · {d.onTimePct}% on-time</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: d.score >= 80 ? 'var(--success)' : d.score >= 60 ? 'var(--warning)' : 'var(--danger)' }}>{d.score}%</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

        </div>
      </div>
      <ToastContainer />
      <AiAssistantPanel open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
