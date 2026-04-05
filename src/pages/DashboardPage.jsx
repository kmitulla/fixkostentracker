import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getFixedCosts, getCategories, getIncomeSources, getMonthlyAmount, getYearlyAmount, isCostActive, getCurrentAmount, getFrequencyLabel } from '../lib/firestore';
import { TrendingUp, Calendar, CreditCard, PieChart as PieChartIcon, ArrowRight, BarChart3, ChevronLeft, ChevronRight, Settings2, Eye, EyeOff, Filter, Wallet, ArrowDownUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, ScatterChart, Scatter, PieChart, Pie, Cell,
  CartesianGrid, LabelList
} from 'recharts';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } }
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } }
};

const CHART_TYPES = [
  { id: 'stacked-bar', label: 'Gestapelte Säulen', icon: '📊' },
  { id: 'line', label: 'Liniendiagramm', icon: '📈' },
  { id: 'scatter', label: 'Punktediagramm', icon: '🔵' },
  { id: 'donut', label: 'Donut', icon: '🍩' },
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const fmt = (n) => Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const fmtShort = (n) => Number(n).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="glass rounded-lg p-3 text-xs shadow-xl border border-slate-700/50 min-w-[140px]">
      <p className="text-slate-300 font-medium mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3 mb-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.fill || p.stroke || p.color }} />
            <span className="text-slate-400">{p.name}</span>
          </div>
          <span className="text-white font-medium">{fmt(p.value)}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="flex items-center justify-between gap-3 mt-1.5 pt-1.5 border-t border-slate-700/50">
          <span className="text-slate-300 font-medium">Gesamt</span>
          <span className="text-white font-bold">{fmt(total)}</span>
        </div>
      )}
    </div>
  );
}

function getAmountAtDate(cost, dateStr) {
  if (!cost.amountHistory?.length) return 0;
  const sorted = [...cost.amountHistory].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  const entry = sorted.find(h => h.validFrom <= dateStr);
  return entry ? entry.amount : sorted[sorted.length - 1].amount;
}

function isCostActiveAtDate(cost, dateStr) {
  if (cost.cancelledDate && cost.cancelledDate <= dateStr) return false;
  if (cost.startDate && cost.startDate > dateStr) return false;
  return true;
}

function costPaysInMonth(cost, year, month) {
  const startDate = cost.startDate ? new Date(cost.startDate) : new Date(2000, 0, 1);
  if (cost.frequency === 'yearly') return startDate.getMonth() === month;
  if (cost.frequency === 'custom' && cost.frequencyMonths > 1) {
    const st = startDate.getFullYear() * 12 + startDate.getMonth();
    const ct = year * 12 + month;
    const d = ct - st;
    return d >= 0 && d % cost.frequencyMonths === 0;
  }
  return true;
}

// Custom bar label that shows total on top of stacked bars - rotated to avoid overlap
function StackedBarTotalLabel({ x, y, width, value }) {
  if (!value || value === 0) return null;
  return (
    <text x={x + width / 2} y={y - 8} textAnchor="end" fill="#94a3b8" fontSize={9} fontWeight={500}
      transform={`rotate(-45, ${x + width / 2}, ${y - 8})`}>
      {fmtShort(value)}
    </text>
  );
}

// Donut label - shows ALL values with lines connecting to slices
function DonutLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, value, name }) {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 28;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  // Line from slice to label
  const mx = cx + (outerRadius + 10) * Math.cos(-midAngle * RADIAN);
  const my = cy + (outerRadius + 10) * Math.sin(-midAngle * RADIAN);
  return (
    <g>
      <line x1={mx} y1={my} x2={x} y2={y} stroke="#475569" strokeWidth={0.5} />
      <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fill="#cbd5e1" fontSize={9}>
        {`${(percent * 100).toFixed(0)}% · ${fmtShort(value)}`}
      </text>
    </g>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [costs, setCosts] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  // View mode: 'current' = exclude future-cancelled, 'after-cancel' = treat all future cancellations as done
  const [viewMode, setViewMode] = useState('current');

  // Custom KPIs - persisted in localStorage
  const [customKpis, setCustomKpis] = useState(() => {
    try { return JSON.parse(localStorage.getItem('customKpis') || '[]'); } catch { return []; }
  });
  const [showKpiForm, setShowKpiForm] = useState(false);
  const [kpiEdit, setKpiEdit] = useState(null); // { year, month (0-11 or 'all'), categoryIds: [], name }
  const saveKpis = (kpis) => { setCustomKpis(kpis); localStorage.setItem('customKpis', JSON.stringify(kpis)); };

  // Chart config
  const [chartView, setChartView] = useState('year');
  const [chartType, setChartType] = useState('stacked-bar');
  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [chartMonth, setChartMonth] = useState(new Date().getMonth());
  const [showChartConfig, setShowChartConfig] = useState(false);
  const [showDonutLabels, setShowDonutLabels] = useState(true);
  const [showGridLines, setShowGridLines] = useState(true);
  const [showBarTotals, setShowBarTotals] = useState(true);
  const [showSumLine, setShowSumLine] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getFixedCosts(user.username),
      getCategories(user.username),
      getIncomeSources(user.username)
    ]).then(([c, cats, inc]) => {
      setCosts(c);
      setCategories(cats);
      setIncomes(inc);
      setLoading(false);
    });
  }, [user]);

  // Filter costs based on viewMode
  const relevantCosts = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return costs.filter(c => {
      // Always exclude costs already cancelled (today or past)
      if (c.cancelledDate && c.cancelledDate <= todayStr) return false;
      // In 'after-cancel' mode, also exclude future-cancelled costs
      if (viewMode === 'after-cancel' && c.cancelledDate) return false;
      // Must have started
      if (c.startDate && c.startDate > todayStr) return false;
      return true;
    });
  }, [costs, viewMode]);

  // For "after-cancel" mode, use the latest/newest amount entry instead of today's amount
  const getEffectiveMonthly = (cost) => {
    if (viewMode === 'after-cancel') {
      const sorted = [...(cost.amountHistory || [])].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
      const amount = sorted.length > 0 ? sorted[0].amount : 0;
      if (cost.frequency === 'yearly') return amount / 12;
      if (cost.frequency === 'custom' && cost.frequencyMonths) return amount / cost.frequencyMonths;
      return amount;
    }
    return getMonthlyAmount(cost);
  };
  const getEffectiveYearly = (cost) => {
    if (viewMode === 'after-cancel') {
      const sorted = [...(cost.amountHistory || [])].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
      const amount = sorted.length > 0 ? sorted[0].amount : 0;
      if (cost.frequency === 'yearly') return amount;
      if (cost.frequency === 'custom' && cost.frequencyMonths) return (amount / cost.frequencyMonths) * 12;
      return amount * 12;
    }
    return getYearlyAmount(cost);
  };

  const totalMonthly = relevantCosts.reduce((sum, c) => sum + getEffectiveMonthly(c), 0);
  const totalYearly = relevantCosts.reduce((sum, c) => sum + getEffectiveYearly(c), 0);

  // Income calculations - filter same way as costs
  const relevantIncomes = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return incomes.filter(inc => {
      if (inc.cancelledDate && inc.cancelledDate <= todayStr) return false;
      if (viewMode === 'after-cancel' && inc.cancelledDate) return false;
      if (inc.startDate && inc.startDate > todayStr) return false;
      return true;
    });
  }, [incomes, viewMode]);

  const totalMonthlyIncome = relevantIncomes.reduce((sum, inc) => sum + getEffectiveMonthly(inc), 0);
  const totalYearlyIncome = relevantIncomes.reduce((sum, inc) => sum + getEffectiveYearly(inc), 0);
  const monthlyRemaining = totalMonthlyIncome - totalMonthly;

  // Per-month remaining for current year (each month can differ due to frequencies)
  const monthlyRemainingByMonth = useMemo(() => {
    const year = new Date().getFullYear();
    return MONTH_NAMES.map((_, monthIdx) => {
      const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-15`;
      // Sum expenses for this month
      let expenseTotal = 0;
      relevantCosts.forEach(c => {
        if (!isCostActiveAtDate(c, dateStr)) return;
        if (!costPaysInMonth(c, year, monthIdx)) return;
        expenseTotal += getAmountAtDate(c, dateStr);
      });
      // Sum incomes for this month
      let incomeTotal = 0;
      relevantIncomes.forEach(inc => {
        if (!isCostActiveAtDate(inc, dateStr)) return;
        if (!costPaysInMonth(inc, year, monthIdx)) return;
        incomeTotal += getAmountAtDate(inc, dateStr);
      });
      return { month: MONTH_NAMES[monthIdx], income: Math.round(incomeTotal * 100) / 100, expenses: Math.round(expenseTotal * 100) / 100, remaining: Math.round((incomeTotal - expenseTotal) * 100) / 100 };
    });
  }, [relevantCosts, relevantIncomes]);

  const categoryMap = {};
  categories.forEach(cat => { categoryMap[cat.id] = cat; });
  const categoryBreakdown = {};
  relevantCosts.forEach(c => {
    const catId = c.categoryId || 'uncategorized';
    if (!categoryBreakdown[catId]) categoryBreakdown[catId] = { monthly: 0, yearly: 0, count: 0 };
    categoryBreakdown[catId].monthly += getMonthlyAmount(c);
    categoryBreakdown[catId].yearly += getYearlyAmount(c);
    categoryBreakdown[catId].count += 1;
  });

  // Upcoming payments - use active costs (not viewMode filtered, always show real upcoming)
  const today = new Date();
  const activeCosts = costs.filter(isCostActive);
  const minDate = new Date(today); minDate.setDate(minDate.getDate() - 4);
  const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 31);

  const allUpcomingPayments = activeCosts.flatMap(c => {
    const day = c.paymentDay || 1;
    const startDate = c.startDate ? new Date(c.startDate) : new Date(2000, 0, 1);
    const results = [];
    if (c.frequency === 'yearly') {
      for (let yo = -1; yo <= 1; yo++) {
        const pd = new Date(today.getFullYear() + yo, startDate.getMonth(), day);
        if (pd >= minDate && pd <= maxDate) results.push({ ...c, nextDate: pd, currentAmount: getCurrentAmount(c) });
      }
    } else if (c.frequency === 'custom' && c.frequencyMonths > 1) {
      const st = startDate.getFullYear() * 12 + startDate.getMonth();
      for (let m = -2; m <= 2; m++) {
        const cd = new Date(today.getFullYear(), today.getMonth() + m, day);
        const ct = cd.getFullYear() * 12 + cd.getMonth();
        if ((ct - st) >= 0 && (ct - st) % c.frequencyMonths === 0 && cd >= minDate && cd <= maxDate)
          results.push({ ...c, nextDate: cd, currentAmount: getCurrentAmount(c) });
      }
    } else {
      for (let m = -1; m <= 1; m++) {
        const pd = new Date(today.getFullYear(), today.getMonth() + m, day);
        if (pd >= minDate && pd <= maxDate) results.push({ ...c, nextDate: pd, currentAmount: getCurrentAmount(c) });
      }
    }
    return results;
  }).sort((a, b) => a.nextDate - b.nextDate);

  const upcomingPayments = showAllUpcoming ? allUpcomingPayments : allUpcomingPayments.slice(0, 10);

  // Chart data
  const catList = useMemo(() => {
    const ids = new Set();
    costs.forEach(c => ids.add(c.categoryId || 'uncategorized'));
    return Array.from(ids);
  }, [costs]);

  const catColors = useMemo(() => {
    const map = {};
    catList.forEach(catId => {
      const catName = categoryMap[catId]?.name || 'Ohne Kategorie';
      map[catName] = categoryMap[catId]?.color || '#64748b';
    });
    return map;
  }, [catList, categoryMap]);
  const catNames = Object.keys(catColors);

  const chartData = useMemo(() => {
    const costsForChart = viewMode === 'after-cancel'
      ? costs.filter(c => !c.cancelledDate)
      : costs;

    if (chartView === 'year') {
      return MONTH_NAMES.map((name, monthIdx) => {
        const dateStr = `${chartYear}-${String(monthIdx + 1).padStart(2, '0')}-15`;
        const row = { name };
        let total = 0;
        catList.forEach(catId => {
          let catTotal = 0;
          costsForChart.forEach(c => {
            if ((c.categoryId || 'uncategorized') !== catId) return;
            if (!isCostActiveAtDate(c, dateStr)) return;
            if (!costPaysInMonth(c, chartYear, monthIdx)) return;
            catTotal += getAmountAtDate(c, dateStr);
          });
          const catName = categoryMap[catId]?.name || 'Ohne Kategorie';
          row[catName] = Math.round(catTotal * 100) / 100;
          total += catTotal;
        });
        row['Gesamt'] = Math.round(total * 100) / 100;
        return row;
      });
    } else {
      const daysInMonth = new Date(chartYear, chartMonth + 1, 0).getDate();
      const rows = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${chartYear}-${String(chartMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const row = { name: `${d}.` };
        let total = 0;
        catList.forEach(catId => {
          let catTotal = 0;
          costsForChart.forEach(c => {
            if ((c.categoryId || 'uncategorized') !== catId) return;
            if (!isCostActiveAtDate(c, dateStr)) return;
            if ((c.paymentDay || 1) !== d) return;
            if (!costPaysInMonth(c, chartYear, chartMonth)) return;
            catTotal += getAmountAtDate(c, dateStr);
          });
          const catName = categoryMap[catId]?.name || 'Ohne Kategorie';
          row[catName] = Math.round(catTotal * 100) / 100;
          total += catTotal;
        });
        row['Gesamt'] = Math.round(total * 100) / 100;
        if (total > 0) rows.push(row);
      }
      return rows;
    }
  }, [costs, categories, chartView, chartYear, chartMonth, catList, viewMode]);

  const donutData = useMemo(() => {
    return Object.entries(categoryBreakdown).map(([catId, data]) => ({
      name: categoryMap[catId]?.name || 'Ohne Kategorie',
      value: Math.round(data.monthly * 100) / 100,
      color: categoryMap[catId]?.color || '#64748b',
    }));
  }, [categoryBreakdown, categoryMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-3 border-primary-500/30 border-t-primary-500 rounded-full" />
      </div>
    );
  }

  const gridProps = showGridLines ? { stroke: '#1e293b', strokeDasharray: '3 3' } : { stroke: 'transparent' };

  const renderChart = () => {
    if (chartType === 'donut') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
              paddingAngle={3} dataKey="value" nameKey="name" stroke="none"
              label={showDonutLabels ? DonutLabel : false} labelLine={false}>
              {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 20, right: 10, bottom: 5, left: 5 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} tickFormatter={v => fmtShort(v)} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            {catNames.map(name => (
              <Line key={name} type="monotone" dataKey={name} stroke={catColors[name]} strokeWidth={2} dot={{ r: 3, fill: catColors[name] }} activeDot={{ r: 5 }} />
            ))}
            {showSumLine && (
              <Line type="monotone" dataKey="Gesamt" stroke="#e2e8f0" strokeWidth={2.5} strokeDasharray="6 3" dot={{ r: 3, fill: '#e2e8f0' }} activeDot={{ r: 5 }} />
            )}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'scatter') {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 20, right: 10, bottom: 5, left: 5 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} type="category" allowDuplicatedCategory={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} tickFormatter={v => fmtShort(v)} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            {catNames.map(name => (
              <Scatter key={name} name={name} data={chartData.map(d => ({ name: d.name, [name]: d[name] || 0 }))} dataKey={name} fill={catColors[name]} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    // stacked bar
    return (
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={chartData} margin={{ top: 45, right: 10, bottom: 5, left: 5 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} tickFormatter={v => fmtShort(v)} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          {catNames.map((name, idx) => (
            <Bar key={name} dataKey={name} stackId="a" fill={catColors[name]}
              radius={idx === catNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
              {idx === catNames.length - 1 && showBarTotals && (
                <LabelList dataKey="Gesamt" content={StackedBarTotalLabel} />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
      {/* Welcome + view mode toggle */}
      <motion.div variants={item} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            Hallo, {user?.displayName || user?.username} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Deine Fixkosten-Übersicht</p>
        </div>
        {/* View mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-slate-700">
          <button onClick={() => setViewMode('current')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
              viewMode === 'current' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
            }`}>
            <Eye className="w-3 h-3" /> Aktuell
          </button>
          <button onClick={() => setViewMode('after-cancel')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
              viewMode === 'after-cancel' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
            }`}>
            <Filter className="w-3 h-3" /> Nach Kündigungen
          </button>
        </div>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        <motion.div variants={item} className="glass rounded-xl p-3 flex items-center gap-2.5 hover:border-red-500/30 transition-all">
          <div className="p-1.5 rounded-lg bg-red-500/15 text-red-400"><CreditCard className="w-4 h-4" /></div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Ausgaben/M</p>
            <p className="text-sm font-bold text-red-400 leading-tight">{fmt(totalMonthly)}</p>
          </div>
        </motion.div>
        <motion.div variants={item} className="glass rounded-xl p-3 flex items-center gap-2.5 hover:border-green-500/30 transition-all">
          <div className="p-1.5 rounded-lg bg-green-500/15 text-green-400"><Wallet className="w-4 h-4" /></div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Einnahmen/M</p>
            <p className="text-sm font-bold text-green-400 leading-tight">{fmt(totalMonthlyIncome)}</p>
          </div>
        </motion.div>
        <motion.div variants={item} className={`glass rounded-xl p-3 flex items-center gap-2.5 transition-all ${monthlyRemaining >= 0 ? 'hover:border-emerald-500/30' : 'hover:border-red-500/30'}`}>
          <div className={`p-1.5 rounded-lg ${monthlyRemaining >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}><ArrowDownUp className="w-4 h-4" /></div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Verbleibend/M</p>
            <p className={`text-sm font-bold leading-tight ${monthlyRemaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(monthlyRemaining)}</p>
          </div>
        </motion.div>
        <motion.div variants={item} className="glass rounded-xl p-3 flex items-center gap-2.5 hover:border-accent-500/30 transition-all">
          <div className="p-1.5 rounded-lg bg-accent-500/15 text-accent-400"><TrendingUp className="w-4 h-4" /></div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Ausgaben/J</p>
            <p className="text-sm font-bold text-white leading-tight">{fmt(totalYearly)}</p>
          </div>
        </motion.div>
        <motion.div variants={item} className="glass rounded-xl p-3 flex items-center gap-2.5 hover:border-green-500/30 transition-all">
          <div className="p-1.5 rounded-lg bg-green-500/15 text-green-400"><PieChartIcon className="w-4 h-4" /></div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Aktive Posten</p>
            <p className="text-sm font-bold text-white leading-tight">{relevantCosts.length} Ausg. · {relevantIncomes.length} Einn.</p>
          </div>
        </motion.div>
        <motion.div variants={item} className="glass rounded-xl p-3 flex items-center gap-2.5 hover:border-amber-500/30 transition-all">
          <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400"><Calendar className="w-4 h-4" /></div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Kategorien</p>
            <p className="text-sm font-bold text-white leading-tight">{categories.length}</p>
          </div>
        </motion.div>
      </div>

      {/* Monthly remaining breakdown */}
      {relevantIncomes.length > 0 && (
        <motion.div variants={item} className="glass rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
            <ArrowDownUp className="w-4 h-4 text-emerald-400" /> Monatliche Bilanz {new Date().getFullYear()}
          </h2>
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-1.5">
            {monthlyRemainingByMonth.map((m, i) => (
              <div key={i} className="text-center">
                <p className="text-[10px] text-slate-500 mb-1">{m.month}</p>
                <p className={`text-xs font-bold ${m.remaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {m.remaining >= 0 ? '+' : ''}{fmtShort(m.remaining)}
                </p>
                <p className="text-[9px] text-slate-600 mt-0.5">{fmtShort(m.income)}</p>
                <p className="text-[9px] text-red-400/50">-{fmtShort(m.expenses)}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming payments */}
        <motion.div variants={item} className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-400" /> Nächste Abbuchungen
            </h2>
            <Link to="/uebersicht" className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors">
              Alle <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {allUpcomingPayments.length === 0 ? (
            <p className="text-slate-500 text-xs py-4 text-center">Keine anstehenden Abbuchungen</p>
          ) : (
            <div className="space-y-1.5">
              {upcomingPayments.map((cost, i) => {
                const isPast = cost.nextDate < today;
                return (
                  <motion.div key={`${cost.id}-${cost.nextDate.toISOString()}`}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }}
                    className={`flex items-center justify-between p-2 rounded-lg transition-colors ${isPast ? 'bg-surface-light/30 opacity-50' : 'bg-surface-light/50 hover:bg-surface-lighter/50'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{categoryMap[cost.categoryId]?.icon || '📌'}</span>
                      <div>
                        <p className="text-xs font-medium text-white">{cost.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {cost.nextDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          {' · '}{getFrequencyLabel(cost)}{isPast && ' · vergangen'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-white">{fmt(cost.currentAmount)}</span>
                  </motion.div>
                );
              })}
              {allUpcomingPayments.length > 10 && (
                <button onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                  className="w-full text-center text-xs text-primary-400 hover:text-primary-300 py-1 transition-colors">
                  {showAllUpcoming ? 'Weniger anzeigen' : `Mehr anzeigen (${allUpcomingPayments.length - 10} weitere)`}
                </button>
              )}
            </div>
          )}
        </motion.div>

        {/* Category breakdown with monthly AND yearly */}
        <motion.div variants={item} className="glass rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
            <PieChartIcon className="w-4 h-4 text-accent-400" /> Kategorien-Verteilung
          </h2>
          {Object.keys(categoryBreakdown).length === 0 ? (
            <p className="text-slate-500 text-xs py-4 text-center">Noch keine Daten vorhanden</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(categoryBreakdown)
                .sort((a, b) => b[1].monthly - a[1].monthly)
                .map(([catId, data], i) => {
                  const cat = categoryMap[catId];
                  const pct = totalMonthly > 0 ? (data.monthly / totalMonthly) * 100 : 0;
                  return (
                    <motion.div key={catId} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{cat?.icon || '📁'}</span>
                          <span className="text-xs text-slate-300">{cat?.name || 'Ohne Kategorie'}</span>
                          <span className="text-[10px] text-slate-600">({data.count})</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-medium text-white">{fmt(data.monthly)}/M</span>
                          <span className="text-[10px] text-slate-500 ml-2">{fmt(data.yearly)}/J</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-surface-lighter rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: 0.12 * i, ease: 'easeOut' }}
                          className="h-full rounded-full" style={{ backgroundColor: cat?.color || '#3b82f6' }} />
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Custom KPIs */}
      <motion.div variants={item} className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary-400" /> Eigene KPIs
          </h2>
          <button onClick={() => { setKpiEdit({ name: '', year: new Date().getFullYear(), month: 'all', categoryIds: [] }); setShowKpiForm(true); }}
            className="text-xs text-primary-400 hover:text-primary-300 transition-colors">+ Neue KPI</button>
        </div>

        {/* KPI Form */}
        <AnimatePresence>
          {showKpiForm && kpiEdit && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
              <div className="glass-light rounded-xl p-3 space-y-2">
                <input type="text" placeholder="KPI Name" value={kpiEdit.name} onChange={e => setKpiEdit({ ...kpiEdit, name: e.target.value })}
                  className="w-full bg-surface-light border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary-500" />
                <div className="flex gap-2 flex-wrap">
                  <select value={kpiEdit.year} onChange={e => setKpiEdit({ ...kpiEdit, year: Number(e.target.value) })}
                    className="bg-surface-light border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary-500">
                    {[...Array(5)].map((_, i) => { const y = new Date().getFullYear() - 2 + i; return <option key={y} value={y}>{y}</option>; })}
                  </select>
                  <select value={kpiEdit.month} onChange={e => setKpiEdit({ ...kpiEdit, month: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
                    className="bg-surface-light border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary-500">
                    <option value="all">Ganzes Jahr</option>
                    {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 mb-1">Kategorien</p>
                  <div className="flex flex-wrap gap-1">
                    {categories.map(cat => (
                      <button key={cat.id} onClick={() => {
                        const ids = kpiEdit.categoryIds.includes(cat.id) ? kpiEdit.categoryIds.filter(id => id !== cat.id) : [...kpiEdit.categoryIds, cat.id];
                        setKpiEdit({ ...kpiEdit, categoryIds: ids });
                      }} className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                        kpiEdit.categoryIds.includes(cat.id) ? 'border-primary-500 bg-primary-500/20 text-white' : 'border-slate-700 text-slate-400 hover:text-white'
                      }`}>{cat.icon} {cat.name}</button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    if (!kpiEdit.name || kpiEdit.categoryIds.length === 0) return;
                    const existing = customKpis.findIndex(k => k.id === kpiEdit.id);
                    if (existing >= 0) { const u = [...customKpis]; u[existing] = kpiEdit; saveKpis(u); }
                    else saveKpis([...customKpis, { ...kpiEdit, id: Date.now() }]);
                    setShowKpiForm(false); setKpiEdit(null);
                  }} className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-500 transition-colors">Speichern</button>
                  <button onClick={() => { setShowKpiForm(false); setKpiEdit(null); }} className="px-3 py-1.5 rounded-lg text-slate-400 text-xs hover:text-white transition-colors">Abbrechen</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {customKpis.length === 0 && !showKpiForm ? (
          <p className="text-slate-500 text-xs py-2 text-center">Erstelle eigene KPIs mit bestimmten Kategorien und Zeiträumen</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {customKpis.map(kpi => {
              // Calculate KPI value - use relevantCosts (filtered by viewMode)
              const filtered = relevantCosts.filter(c => kpi.categoryIds.includes(c.categoryId));
              let total = 0;
              let monthlyAvg = 0;
              if (kpi.month === 'all') {
                // Sum actual payments across all months of the year
                MONTH_NAMES.forEach((_, monthIdx) => {
                  const dateStr = `${kpi.year}-${String(monthIdx + 1).padStart(2, '0')}-15`;
                  filtered.forEach(c => {
                    if (!isCostActiveAtDate(c, dateStr)) return;
                    if (!costPaysInMonth(c, kpi.year, monthIdx)) return;
                    total += getAmountAtDate(c, dateStr);
                  });
                });
                monthlyAvg = total / 12;
              } else {
                const dateStr = `${kpi.year}-${String(kpi.month + 1).padStart(2, '0')}-15`;
                filtered.forEach(c => {
                  if (!isCostActiveAtDate(c, dateStr)) return;
                  if (!costPaysInMonth(c, kpi.year, kpi.month)) return;
                  total += getAmountAtDate(c, dateStr);
                });
              }
              return (
                <div key={kpi.id} className="glass-light rounded-xl p-3 group relative">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{kpi.name}</p>
                    <div className="flex gap-1">
                      <button onClick={() => { setKpiEdit(kpi); setShowKpiForm(true); }} className="text-slate-600 hover:text-white text-[10px] transition-colors">✏️</button>
                      <button onClick={() => saveKpis(customKpis.filter(k => k.id !== kpi.id))} className="text-slate-600 hover:text-red-400 text-[10px] transition-colors">🗑️</button>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-white">{fmt(total)}</p>
                  <p className="text-[10px] text-slate-500">
                    {kpi.month === 'all' ? `${kpi.year} gesamt` : `${MONTH_NAMES[kpi.month]} ${kpi.year}`}
                    {' · '}{kpi.categoryIds.length} Kat.
                    {kpi.month === 'all' && ` · Ø ${fmt(monthlyAvg)}/M`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Charts section */}
      {costs.length > 0 && (
        <motion.div variants={item} className="glass rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary-400" /> Diagramme
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-lg overflow-hidden border border-slate-700">
                <button onClick={() => setChartView('year')}
                  className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${chartView === 'year' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  Jahr
                </button>
                <button onClick={() => setChartView('month')}
                  className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${chartView === 'month' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  Monat
                </button>
              </div>
              <button onClick={() => setShowChartConfig(!showChartConfig)}
                className={`p-1.5 rounded-lg transition-colors ${showChartConfig ? 'text-primary-400 bg-primary-500/15' : 'text-slate-400 hover:text-white hover:bg-surface-lighter/50'}`}>
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chart config panel */}
          <AnimatePresence>
            {showChartConfig && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
                <div className="glass-light rounded-xl p-4 space-y-3">
                  <div>
                    <p className="text-[11px] text-slate-400 mb-2 font-medium">Diagrammtyp</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CHART_TYPES.map(ct => (
                        <button key={ct.id} onClick={() => setChartType(ct.id)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                            chartType === ct.id ? 'bg-primary-600 text-white' : 'bg-surface-lighter/50 text-slate-400 hover:text-white'
                          }`}>
                          <span>{ct.icon}</span> {ct.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={showGridLines} onChange={e => setShowGridLines(e.target.checked)}
                        className="rounded border-slate-600 bg-surface-light text-primary-500 focus:ring-primary-500/30 w-3.5 h-3.5" />
                      Gitterlinien
                    </label>
                    {chartType === 'stacked-bar' && (
                      <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={showBarTotals} onChange={e => setShowBarTotals(e.target.checked)}
                          className="rounded border-slate-600 bg-surface-light text-primary-500 focus:ring-primary-500/30 w-3.5 h-3.5" />
                        Gesamtbeträge auf Säulen
                      </label>
                    )}
                    {chartType === 'donut' && (
                      <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={showDonutLabels} onChange={e => setShowDonutLabels(e.target.checked)}
                          className="rounded border-slate-600 bg-surface-light text-primary-500 focus:ring-primary-500/30 w-3.5 h-3.5" />
                        % und Beträge anzeigen
                      </label>
                    )}
                    {chartType === 'line' && (
                      <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={showSumLine} onChange={e => setShowSumLine(e.target.checked)}
                          className="rounded border-slate-600 bg-surface-light text-primary-500 focus:ring-primary-500/30 w-3.5 h-3.5" />
                        Gesamtlinie anzeigen
                      </label>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Year/Month navigation */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <button onClick={() => {
              if (chartView === 'year') setChartYear(y => y - 1);
              else { if (chartMonth === 0) { setChartMonth(11); setChartYear(y => y - 1); } else setChartMonth(m => m - 1); }
            }} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-lighter/50 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-white min-w-[100px] text-center">
              {chartView === 'year' ? chartYear : `${MONTH_NAMES[chartMonth]} ${chartYear}`}
            </span>
            <button onClick={() => {
              if (chartView === 'year') setChartYear(y => y + 1);
              else { if (chartMonth === 11) { setChartMonth(0); setChartYear(y => y + 1); } else setChartMonth(m => m + 1); }
            }} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-lighter/50 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="w-full overflow-x-auto -mx-2">
            {renderChart()}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {costs.length === 0 && (
        <motion.div variants={item} className="glass rounded-2xl p-12 text-center">
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-6xl mb-4">📝</motion.div>
          <h3 className="text-xl font-semibold text-white mb-2">Noch keine Fixkosten erfasst</h3>
          <p className="text-slate-400 mb-6">Beginne damit, deine Fixkosten einzutragen.</p>
          <Link to="/eingaben"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-accent-600 text-white font-semibold hover:shadow-lg hover:shadow-primary-500/25 transition-all duration-300">
            Erste Fixkosten erfassen
          </Link>
        </motion.div>
      )}
    </motion.div>
  );
}
