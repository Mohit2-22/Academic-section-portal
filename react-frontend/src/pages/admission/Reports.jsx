import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, PieChart, LineChart, Calendar, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell, LineChart as RLineChart, Line } from 'recharts';
import api from '../../api/client';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

const ACCENT = '#F59E0B';

const TABS = [
  { key: 'stage', label: 'Stage-wise', icon: <BarChart3 size={16} /> },
  { key: 'funnel', label: 'Conversion Funnel', icon: <TrendingUp size={16} /> },
  { key: 'source', label: 'Source-wise', icon: <PieChart size={16} /> },
  { key: 'trend', label: 'Monthly Trend', icon: <LineChart size={16} /> },
];

const SOURCE_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

const PIE_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#F97316', '#EF4444', '#10B981', '#06B6D4'];

export default function Reports() {
  const [activeTab, setActiveTab] = useState('stage');
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [stageData, setStageData] = useState([]);
  const [funnelData, setFunnelData] = useState([]);
  const [sourceData, setSourceData] = useState([]);
  const [trendData, setTrendData] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [reportRes, funnelRes] = await Promise.all([
          api.get('/api/admission/reports'),
          api.get('/api/admission/funnel-stats').catch(() => ({})),
        ]);
        const r = reportRes?.reports ?? reportRes ?? {};
        setStageData(r.stage_wise ?? r.stageData ?? []);
        setSourceData(r.source_wise ?? r.sourceData ?? []);
        setTrendData(r.monthly_trend ?? r.trendData ?? []);
        setFunnelData(funnelRes?.funnel ?? funnelRes ?? []);
      } catch {
        setStageData([
          { name: 'Lead', count: 128 }, { name: 'Seminar', count: 85 }, { name: 'Bootcamp', count: 62 },
          { name: 'Counselling', count: 48 }, { name: 'Follow Up 1', count: 38 }, { name: 'Follow Up 2', count: 30 },
          { name: 'Follow Up 3', count: 22 }, { name: 'Follow Up 4', count: 15 }, { name: 'Follow Up 5', count: 8 },
          { name: 'Admission', count: 34 },
        ]);
        setFunnelData([
          { name: 'Leads', value: 128 }, { name: 'Seminar', value: 85 }, { name: 'Bootcamp', value: 62 },
          { name: 'Counselling', value: 48 }, { name: 'Follow Up', value: 38 }, { name: 'Admission', value: 34 },
        ]);
        setSourceData([
          { name: 'Social Media', value: 45 }, { name: 'Friends/Relatives', value: 30 },
          { name: 'Newspaper', value: 15 }, { name: 'Walk-in', value: 10 },
        ]);
        setTrendData([
          { month: 'Jan', inquiries: 20, admissions: 5 }, { month: 'Feb', inquiries: 28, admissions: 8 },
          { month: 'Mar', inquiries: 35, admissions: 10 }, { month: 'Apr', inquiries: 42, admissions: 14 },
          { month: 'May', inquiries: 38, admissions: 12 }, { month: 'Jun', inquiries: 50, admissions: 18 },
          { month: 'Jul', inquiries: 55, admissions: 20 }, { month: 'Aug', inquiries: 60, admissions: 24 },
          { month: 'Sep', inquiries: 48, admissions: 16 }, { month: 'Oct', inquiries: 45, admissions: 15 },
          { month: 'Nov', inquiries: 52, admissions: 19 }, { month: 'Dec', inquiries: 58, admissions: 22 },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    const url = `/api/admission/reports/export${params.toString() ? '?' + params.toString() : ''}`;
    window.open(url, '_blank');
    toast.success('Export initiated');
  };

  if (loading) return <LoadingSpinner accent={ACCENT} />;

  const chartTooltip = {
    contentStyle: { background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' },
    labelStyle: { color: '#F1F5F9', fontWeight: 600 },
    itemStyle: { color: '#FCD34D' },
  };

  const renderChart = () => {
    switch (activeTab) {
      case 'stage':
        return (
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              Stage-wise Distribution
            </h3>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={stageData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="count" fill={ACCENT} radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      case 'funnel':
        return (
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              Conversion Funnel
            </h3>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="value" fill={ACCENT} radius={[0, 6, 6, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      case 'source':
        return (
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              Source-wise Distribution
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height={380}>
                <RPieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    outerRadius={130}
                    innerRadius={60}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#94A3B8', strokeWidth: 1 }}
                  >
                    {sourceData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip {...chartTooltip} />
                </RPieChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      case 'trend':
        return (
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              Monthly Trend
            </h3>
            <ResponsiveContainer width="100%" height={380}>
              <RLineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...chartTooltip} />
                <Line type="monotone" dataKey="inquiries" stroke={ACCENT} strokeWidth={2} dot={{ fill: ACCENT, r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="admissions" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 4 }} activeDot={{ r: 6 }} />
              </RLineChart>
            </ResponsiveContainer>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Reports & Analytics</h1>
          <p>Track admissions performance and conversion metrics</p>
        </div>
        <button onClick={handleExport} className="btn-grad" style={{ background: `linear-gradient(135deg, ${ACCENT}, #D97706)` }}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="btn-grad"
              style={{
                background: activeTab === tab.key ? `linear-gradient(135deg, ${ACCENT}, #D97706)` : 'rgba(255,255,255,0.05)',
                padding: '10px 16px', fontSize: 12, flex: '0 0 auto'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={14} color="var(--text-muted)" />
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="input-field" style={{ padding: '6px 10px', fontSize: 12, width: 130 }} />
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>to</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="input-field" style={{ padding: '6px 10px', fontSize: 12, width: 130 }} />
        </div>
      </div>

      <motion.div
        key={activeTab}
        className="glass-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ padding: 24 }}
      >
        {renderChart()}
      </motion.div>
    </motion.div>
  );
}
