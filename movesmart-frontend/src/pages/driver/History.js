import React, { useState, useEffect } from 'react';
import { History, Users, Clock, TrendingUp, Calendar, Route, CheckCircle } from 'lucide-react';
import { DriverSidebar, Topbar, Pill, EmptyState, Spinner, useToast } from '../../components/shared';
import { tripAPI } from '../../api';
export default function DriverHistory() {
  const [trips,   setTrips]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('');
  const { toast, ToastContainer } = useToast();

  useEffect(() => {
    tripAPI.list({ status: filter || undefined, limit: 200 })
      .then(r => setTrips(r.data.data))
      .catch(() => toast('Failed to load trip history', 'error'))
      .finally(() => setLoading(false));
  }, [filter, toast]);

  // ── Computed stats ─────────────────────────────────────────────────
  const completed = trips.filter(t => t.status === 'completed');
  const totalPax  = completed.reduce((s, t) => s + (t.passengerCount || 0), 0);
  const onTime    = completed.filter(t => {
    if (!t.actualEnd || !t.scheduledEnd) return false;
    return (new Date(t.actualEnd) - new Date(t.scheduledEnd)) / 60000 <= 10;
  });
  const onTimePct = completed.length ? Math.round(onTime.length / completed.length * 100) : 0;

  const totalMins = completed.reduce((s, t) => {
    if (!t.actualStart || !t.actualEnd) return s;
    return s + (new Date(t.actualEnd) - new Date(t.actualStart)) / 60000;
  }, 0);
  const totalHours = Math.round(totalMins / 60);

  // ── Group by month ─────────────────────────────────────────────────
  const displayTrips = filter ? trips : completed;
  const grouped = displayTrips.reduce((acc, t) => {
    const d   = t.scheduledStart ? new Date(t.scheduledStart) : new Date(t.createdAt);
    const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    (acc[key] = acc[key] || []).push(t);
    return acc;
  }, {});

  return (
    <div className="app-shell">
      <DriverSidebar />
      <div className="main-content">
        <Topbar title="Trip history" />
        <div className="page-body">

          {/* ── Summary stats ── */}
          <div className="metric-grid">
            {[
              { icon: CheckCircle, label: 'Trips completed', value: completed.length,          color: 'var(--brand-600)' },
              { icon: Users,       label: 'Passengers',      value: totalPax,                   color: '#059669'          },
              { icon: TrendingUp,  label: 'On-time rate',    value: `${onTimePct}%`,            color: '#0891b2'          },
              { icon: Clock,       label: 'Drive time',      value: `${totalHours}h`,           color: '#7c3aed'          },
            ].map(s => (
              <div key={s.label} className="metric-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <s.icon size={16} color={s.color} />
                  <span className="metric-label" style={{ color: s.color }}>{s.label}</span>
                </div>
                <div className="metric-value">{s.value}</div>
              </div>
            ))}
          </div>

          {/* ── Filter tabs ── */}
          <div className="card fade-up" style={{ padding: '10px 16px', marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['', 'Completed'], ['inProgress', 'In Progress'], ['scheduled', 'Scheduled']].map(([v, lbl]) => (
                <button key={v} className={`tab-btn ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* ── Trip list grouped by month ── */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
          ) : displayTrips.length === 0 ? (
            <EmptyState icon={History} title="No trips found" sub="Your completed trips will appear here" />
          ) : (
            Object.entries(grouped).map(([month, items]) => (
              <div key={month} className="card fade-up" style={{ marginBottom: 16 }}>
                {/* Month header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Calendar size={14} color="var(--brand-600)" />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{month}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {items.length} trip{items.length !== 1 ? 's' : ''} · {items.reduce((s, t) => s + (t.passengerCount || 0), 0)} passengers
                  </span>
                </div>

                {/* Trip rows */}
                {items.map(t => {
                  const route = t.routeId;
                  const late  = t.actualEnd && t.scheduledEnd &&
                    (new Date(t.actualEnd) - new Date(t.scheduledEnd)) / 60000 > 10;
                  const dep  = t.scheduledStart ? new Date(t.scheduledStart) : null;
                  const dur  = t.actualStart && t.actualEnd
                    ? Math.round((new Date(t.actualEnd) - new Date(t.actualStart)) / 60000)
                    : null;

                  return (
                    <div key={t._id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 0', borderBottom: '1px solid var(--border)',
                    }}>
                      {/* Route icon */}
                      <div style={{
                        width: 38, height: 38, borderRadius: 8, background: 'var(--brand-50)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Route size={16} color="var(--brand-600)" />
                      </div>

                      {/* Detail */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                          {route?.name || '—'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                          {route?.origin || '—'} → {route?.destination || '—'}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, color: 'var(--text-3)' }}>
                          {dep && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Calendar size={10} />
                              {dep.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} {dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Users size={10} /> {t.passengerCount || 0} passengers
                          </span>
                          {dur !== null && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Clock size={10} /> {dur >= 60 ? `${Math.floor(dur / 60)}h ${dur % 60}m` : `${dur}m`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <Pill status={t.status} />
                        {t.status === 'completed' && (
                          <div style={{ marginTop: 5, fontSize: 11, fontWeight: 600 }}>
                            {late
                              ? <span style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}><Clock size={10} /> Late</span>
                              : <span style={{ color: 'var(--success)' }}>On time</span>
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
