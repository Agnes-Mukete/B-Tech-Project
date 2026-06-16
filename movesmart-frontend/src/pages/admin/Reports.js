import React, { useState, useCallback } from 'react';
import { FileText, Download, BarChart2, Users, DollarSign, Wrench, Fuel } from 'lucide-react';
import { AdminSidebar, Topbar, useToast } from '../../components/shared';
import axios from '../../api';

const REPORT_TYPES = [
  { id: 'fleet-utilisation',  label: 'Fleet Utilisation',   icon: BarChart2,  desc: 'Vehicle trips, occupancy & on-time rates' },
  { id: 'driver-performance', label: 'Driver Performance',  icon: Users,      desc: 'Trips, on-time %, incidents & scores' },
  { id: 'revenue-summary',    label: 'Revenue Summary',     icon: DollarSign, desc: 'Bookings and fare totals per route' },
  { id: 'maintenance-log',    label: 'Maintenance Log',     icon: Wrench,     desc: 'Incident history and resolution status' },
  { id: 'fuel-consumption',   label: 'Fuel Consumption',    icon: Fuel,       desc: 'Current fuel levels and vehicle status' },
];

export default function Reports() {
  const { toast } = useToast();
  const [type,     setType]     = useState('fleet-utilisation');
  const [format,   setFormat]   = useState('csv');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo,   setDateTo]   = useState(() => new Date().toISOString().slice(0, 10));
  const [loading,  setLoading]  = useState(false);
  const [lastFile, setLastFile] = useState(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setLastFile(null);
    try {
      const res = await axios.post('/reports/generate', { type, format, dateFrom, dateTo });
      const { filename, downloadUrl, rowCount, type: rType } = res.data.data;
      setLastFile({ filename, downloadUrl, rowCount, rType });
      toast({ title: 'Report ready', description: `${rowCount} records — click Download to save`, variant: 'default' });
    } catch (err) {
      toast({ title: 'Generation failed', description: err.response?.data?.message || 'Server error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [type, format, dateFrom, dateTo, toast]);

  const download = useCallback(async () => {
    if (!lastFile) return;
    try {
      const res = await axios.get(lastFile.downloadUrl, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = lastFile.filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Download failed', description: 'Could not fetch the report file', variant: 'destructive' });
    }
  }, [lastFile, toast]);

  const selectedDef = REPORT_TYPES.find(r => r.id === type);

  return (
    <div className="app-shell">
      <AdminSidebar />
      <div className="main-content">
        <Topbar title="Report generation" subtitle="FR-AD20 / FR-AD21" />
        <div className="page-body" style={{ maxWidth: 860 }}>

          {/* Report type picker */}
          <div className="card fade-up" style={{ marginBottom: 16 }}>
            <div className="card-title">Select report type</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginTop: 12 }}>
              {REPORT_TYPES.map(r => {
                const Icon = r.icon;
                const selected = type === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => { setType(r.id); setLastFile(null); }}
                    style={{
                      border: `2px solid ${selected ? 'var(--brand-500)' : 'var(--border)'}`,
                      borderRadius: 10,
                      padding: '12px 14px',
                      background: selected ? 'var(--brand-50, #eff6ff)' : 'var(--surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'border-color .15s, background .15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Icon size={15} color={selected ? 'var(--brand-600)' : 'var(--text-3)'} />
                      <span style={{ fontWeight: 600, fontSize: 13, color: selected ? 'var(--brand-700, #1d4ed8)' : 'var(--text-1)' }}>{r.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{r.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Parameters */}
          <div className="card fade-up stagger-2" style={{ marginBottom: 16 }}>
            <div className="card-title">Parameters</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 12 }}>

              <div className="field-group">
                <label className="field-label">Date from</label>
                <input className="field-input" type="date" value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setLastFile(null); }}
                  max={dateTo}
                />
              </div>

              <div className="field-group">
                <label className="field-label">Date to</label>
                <input className="field-input" type="date" value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setLastFile(null); }}
                  min={dateFrom} max={new Date().toISOString().slice(0, 10)}
                />
              </div>

              <div className="field-group">
                <label className="field-label">Format</label>
                <select className="field-input field-select" value={format}
                  onChange={e => { setFormat(e.target.value); setLastFile(null); }}>
                  <option value="csv">CSV (spreadsheet)</option>
                  <option value="pdf">PDF (printable)</option>
                </select>
              </div>
            </div>

            {type === 'fuel-consumption' && (
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                ℹ️ Fuel consumption report shows current vehicle fuel levels — date range is not applicable.
              </p>
            )}
          </div>

          {/* Generate / Download */}
          <div className="card fade-up stagger-3">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn btn-primary" onClick={generate} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 160 }}>
                <FileText size={14} />
                {loading ? 'Generating…' : `Generate ${format.toUpperCase()}`}
              </button>

              {lastFile && (
                <button className="btn btn-outline" onClick={download}
                  style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Download size={14} />
                  Download ({lastFile.filename})
                </button>
              )}
            </div>

            {lastFile && (
              <div style={{
                marginTop: 14, padding: '12px 16px',
                background: 'var(--success-bg, #f0fdf4)',
                border: '1px solid var(--success-border, #bbf7d0)',
                borderRadius: 8, fontSize: 13,
              }}>
                <strong style={{ color: 'var(--success)' }}>✓ Report generated</strong>
                <span style={{ color: 'var(--text-2)', marginLeft: 8 }}>
                  {selectedDef?.label} — {lastFile.rowCount} records — {format.toUpperCase()}
                </span>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
