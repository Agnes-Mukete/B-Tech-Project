import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart2 } from 'lucide-react';
import { FleetSidebar, Topbar, EmptyState, Spinner, ProgressBar } from '../../components/shared';
import { analyticsAPI } from '../../api';

export default function FleetAnalytics() {
  const [routePerf, setRoutePerf]   = useState([]);
  const [driverPerf, setDriverPerf] = useState([]);
  const [range,  setRange]   = useState('today');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      analyticsAPI.routePerformance({ range }),
      analyticsAPI.driverPerformance({ range }),
    ]).then(([rp, dp]) => {
      setRoutePerf(rp.data.data);
      setDriverPerf(dp.data.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <div className="app-shell">
      <FleetSidebar />
      <div className="main-content">
        <Topbar title="Analytics"
          actions={
            <select className="field-input field-select" value={range} onChange={e => setRange(e.target.value)}
              style={{ width: 130, height: 32, fontSize: 12 }}>
              <option value="today">Today</option>
              <option value="last7">Last 7 days</option>
              <option value="last30">Last 30 days</option>
            </select>
          }
        />
        <div className="page-body">

          {/* Route performance chart */}
          <div className="card fade-up">
            <div className="card-title">Route performance</div>
            {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={28} /></div>
              : routePerf.length === 0
                ? <EmptyState icon={BarChart2} title="No route data yet" sub="Complete some trips to see performance metrics" />
                : (
                  <>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12, color: 'var(--text-3)' }}>
                      <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--brand-500)', marginRight: 5 }} />On-time %</span>
                      <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--brand-100)', marginRight: 5 }} />Occupancy %</span>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={routePerf} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={v => `${v}%`} />
                        <Bar dataKey="onTimePct"    name="On-time %"   fill="var(--brand-500)" radius={[4,4,0,0]} />
                        <Bar dataKey="occupancyPct" name="Occupancy %" fill="var(--brand-100)" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Summary table */}
                    <div className="table-wrap" style={{ marginTop: 16 }}>
                      <table>
                        <thead><tr><th>Route</th><th>Trips</th><th>On-time %</th><th>Occupancy %</th></tr></thead>
                        <tbody>
                          {routePerf.map(r => (
                            <tr key={r.routeId}>
                              <td className="td-bold">{r.name}</td>
                              <td>{r.totalTrips}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <ProgressBar value={r.onTimePct} color={r.onTimePct >= 80 ? 'var(--success)' : 'var(--warning)'} />
                                  <span style={{ fontSize: 12, fontWeight: 600 }}>{r.onTimePct}%</span>
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <ProgressBar value={r.occupancyPct} color="var(--brand-500)" />
                                  <span style={{ fontSize: 12, fontWeight: 600 }}>{r.occupancyPct}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
          </div>

          {/* Driver leaderboard */}
          <div className="card fade-up stagger-2">
            <div className="card-title">Driver leaderboard</div>
            {loading ? <Spinner />
              : driverPerf.length === 0
                ? <EmptyState icon={BarChart2} title="No driver data yet" />
                : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>#</th><th>Driver</th><th>Trips</th><th>On-time %</th><th>Incidents</th><th>Score</th></tr></thead>
                      <tbody>
                        {driverPerf.map((d, i) => (
                          <tr key={d.driverId}>
                            <td style={{ fontWeight: 700, color: i < 3 ? '#f59e0b' : 'var(--text-3)', fontSize: 13 }}>#{i + 1}</td>
                            <td className="td-bold">{d.name}</td>
                            <td>{d.trips}</td>
                            <td>{d.onTimePct}%</td>
                            <td style={{ color: d.incidents > 0 ? 'var(--danger)' : 'var(--text-3)' }}>{d.incidents}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <ProgressBar value={d.score} color={d.score >= 80 ? 'var(--success)' : d.score >= 60 ? 'var(--warning)' : 'var(--danger)'} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: d.score >= 80 ? 'var(--success)' : 'var(--warning)' }}>{d.score}%</span>
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
    </div>
  );
}
