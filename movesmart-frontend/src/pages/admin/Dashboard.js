import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Truck, Navigation, Users, UserCheck, Building2, TrendingUp } from 'lucide-react';
import { AdminSidebar, Topbar, Spinner, EmptyState } from '../../components/shared';
import { analyticsAPI, agencyAPI } from '../../api';

const COLORS = { active: '#10b981', idle: '#f59e0b', maintenance: '#ef4444' };

function MetricCard({ icon: Icon, label, value, delta, color, onClick }) {
  return (
    <div className="metric-card fade-up" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="metric-label" style={{ color }}>
        <Icon size={13} /> {label}
      </div>
      <div className="metric-value">{value ?? <Spinner size={18} />}</div>
      {delta && <div className="metric-delta delta-up"><TrendingUp size={11} />{delta}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const [overview,  setOverview]  = useState(null);
  const [peak,      setPeak]      = useState([]);
  const [vStatus,   setVStatus]   = useState(null);
  const [routePerf, setRoutePerf] = useState([]);
  const [pending,   setPending]   = useState(0);
  const [range,     setRange]     = useState('today');
  const [loading,   setLoading]   = useState(true);

  const loadAll = useCallback(() => {
    Promise.all([
      analyticsAPI.overview(),
      analyticsAPI.peakHours({ range }),
      analyticsAPI.vehicleStatus(),
      analyticsAPI.routePerformance({ range }),
      agencyAPI.getStats(),
    ]).then(([ov, pk, vs, rp, ag]) => {
      setOverview(ov.data.data);
      setPeak(pk.data.data);
      setVStatus(vs.data.data);
      setRoutePerf(rp.data.data.slice(0, 6));
      setPending(ag.data.data.pending);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [range]);

  // Initial load + 30-second auto-refresh (FR-AD01)
  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const donutData = vStatus ? [
    { name: 'Active',      value: vStatus.active,      color: COLORS.active },
    { name: 'Idle',        value: vStatus.idle,        color: COLORS.idle },
    { name: 'Maintenance', value: vStatus.maintenance, color: COLORS.maintenance },
  ] : [];

  return (
    <div className="app-shell">
      <AdminSidebar pendingCount={pending} />
      <div className="main-content">
        <Topbar
          title="System overview"
          actions={
            <select className="field-input field-select" value={range}
              onChange={e => setRange(e.target.value)}
              style={{ width: 140, height: 32, fontSize: 12 }}>
              <option value="today">Today</option>
              <option value="last7">Last 7 days</option>
              <option value="last30">Last 30 days</option>
            </select>
          }
        />
        <div className="page-body">

          {/* Metric cards */}
          <div className="metric-grid">
            <MetricCard icon={Truck}     label="Total vehicles"  value={overview?.totalVehicles}  color="var(--brand-600)" delta="+3 this month" />
            <MetricCard icon={Navigation}label="Active trips"    value={overview?.activeTrips}    color="var(--success)"   delta="3 above avg" />
            <MetricCard icon={UserCheck} label="Drivers on duty" value={overview?.driversOnDuty}  color="#0891b2" />
            <MetricCard icon={Users}     label="Passengers today"value={overview?.passengersToday}color="var(--info)"      delta="+12% vs yesterday" />
            <MetricCard icon={Building2} label="Active agencies" value={overview?.activeAgencies} color="#7c3aed" />
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>

            {/* Peak hours */}
            <div className="card fade-up stagger-2">
              <div className="card-title">Peak hours analysis</div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12, color: 'var(--text-3)' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--brand-500)', marginRight: 5 }} />Bookings</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#10b981', marginRight: 5 }} />Trips</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={peak} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickFormatter={h => `${h}h`} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                  <Line type="monotone" dataKey="bookings" stroke="var(--brand-500)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="trips"    stroke="#10b981"           strokeWidth={2} dot={false} strokeDasharray="4 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Vehicle status donut */}
            <div className="card fade-up stagger-3">
              <div className="card-title">Vehicle status</div>
              {vStatus ? (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={45} outerRadius={68} paddingAngle={3} dataKey="value">
                        {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {donutData.map(d => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, color: 'var(--text-2)' }}>{d.name}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{d.value}</span>
                        <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
                          {vStatus.total ? `${Math.round(d.value / vStatus.total * 100)}%` : '0%'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <Spinner />}
            </div>
          </div>

          {/* Route performance */}
          <div className="card fade-up stagger-4">
            <div className="card-title">Route performance</div>
            {routePerf.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={routePerf} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={v => `${v}%`} />
                  <Bar dataKey="onTimePct"    name="On-time %"   fill="var(--brand-500)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="occupancyPct" name="Occupancy %" fill="var(--brand-100)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              loading ? <Spinner /> :
              <EmptyState icon={Navigation} title="No route data yet" sub="Complete some trips to see performance stats" />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
