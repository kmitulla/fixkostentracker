import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getFixedCosts, getCategories, getMonthlyAmount, getYearlyAmount, isCostActive, getCurrentAmount, getFrequencyLabel } from '../lib/firestore';
import { TrendingUp, Calendar, CreditCard, PieChart as PieChartIcon, ArrowRight, BarChart3, LineChart as LineChartIcon, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, ScatterChart, Scatter, PieChart, Pie, Cell
} from 'recharts';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const item = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

const CHART_TYPES = [
  { id: 'stacked-bar', label: 'Gestapelte Säulen', icon: '📊' },
  { id: 'line', label: 'Liniendiagramm', icon: '📈' },
  { id: 'scatter', label: 'Punktediagramm', icon: '🔵' },
  { id: 'donut', label: 'Donut', icon: '🍩' },
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const fmt = (n) => Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

// Custom tooltip for recharts
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg p-3 text-xs shadow-xl border border-slate-700/50">
      <p className="text-slate-300 font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill || p.stroke || p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white font-medium">{fmt(p.value)}</span>
        </div>
      ))}
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
  if (cost.frequency === 'yearly') {
    return startDate.getMonth() === month;
  }
  if (cost.frequency === 'custom' && cost.frequencyMonths > 1) {
    const startTotal = startDate.getFullYear() * 12 + startDate.getMonth();
    const checkTotal = year * 12 + month;
    const diff = checkTotal - startTotal;
    return diff >= 0 && diff % cost.frequencyMonths === 0;
  }
  return true; // monthly
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [costs, setCosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  // Chart config
  const [chartView, setChartView] = useState('year'); // 'year' or 'month'
  const [chartType, setChartType] = useState('stacked-bar');
  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [chartMonth, setChartMonth] = useState(new Date().getMonth());
  const [showChartConfig, setShowChartConfig] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getFixedCosts(user.username),
      getCategories(user.username)
    ]).then(([c, cats]) => {
      setCosts(c);
      setCategories(cats);
      setLoading(false);
    });
  }, [user]);

  const activeCosts = costs.filter(isCostActive);
  const totalMonthly = activeCosts.reduce((sum, c) => sum + getMonthlyAmount(c), 0);
  const totalYearly = activeCosts.reduce((sum, c) => sum + getYearlyAmount(c), 0);

  const categoryMap = {};
  categories.forEach(cat => { categoryMap[cat.id] = cat; });
  const categoryBreakdown = {};
  activeCosts.forEach(c => {
    const catId = c.categoryId || 'uncategorized';
    if (!categoryBreakdown[catId]) categoryBreakdown[catId] = { monthly: 0, yearly: 0, count: 0 };
    categoryBreakdown[catId].monthly += getMonthlyAmount(c);
    categoryBreakdown[catId].yearly += getYearlyAmount(c);
    categoryBreakdown[catId].count += 1;
  });

  // Upcoming payments
  const today = new Date();
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

  // Build chart data
  const catList = useMemo(() => {
    const ids = new Set();
    costs.forEach(c => ids.add(c.categoryId || 'uncategorized'));
    return Array.from(ids);
  }, [costs]);

  const chartData = useMemo(() => {
    if (chartView === 'year') {
      // 12 months for the selected year
      return MONTH_NAMES.map((name, monthIdx) => {
        const dateStr = `${chartYear}-${String(monthIdx + 1).padStart(2, '0')}-15`;
        const row = { name };
        let total = 0;
        catList.forEach(catId => {
          let catTotal = 0;
          costs.forEach(c => {
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
      // Days in the selected month
      const daysInMonth = new Date(chartYear, chartMonth + 1, 0).getDate();
      const rows = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${chartYear}-${String(chartMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const row = { name: `${d}.` };
        let total = 0;
        catList.forEach(catId => {
          let catTotal = 0;
          costs.forEach(c => {
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
  }, [costs, categories, chartView, chartYear, chartMonth, catList]);

  // Donut data
  const donutData = useMemo(() => {
    return Object.entries(categoryBreakdown).map(([catId, data]) => ({
      name: categoryMap[catId]?.name || 'Ohne Kategorie',
      value: Math.round(data.monthly * 100) / 100,
      color: categoryMap[catId]?.color || '#64748b',
    }));
  }, [categoryBreakdown, categoryMap]);

  const catColors = useMemo(() => {
    const map = {};
    catList.forEach(catId => {
      const catName = categoryMap[catId]?.name || 'Ohne Kategorie';
      map[catName] = categoryMap[catId]?.color || '#64748b';
    });
    return map;
  }, [catList, categoryMap]);

  const catNames = Object.keys(catColors);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-3 border-primary-500/30 border-t-primary-500 rounded-full" />
      </div>
    );
  }

  const renderChart = () => {
    if (chartType === 'donut') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={donutData} cx="50%" cy="50%" innerRadius={70} outerRadius={110}
              paddingAngle={3} dataKey="value" nameKey="name" stroke="none">
              {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            {catNames.map(name => (
              <Line key={name} type="monotone" dataKey={name} stroke={catColors[name]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'scatter') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} type="category" allowDuplicatedCategory={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            {catNames.map(name => (
              <Scatter key={name} name={name} data={chartData.map(d => ({ name: d.name, [name]: d[name] || 0 }))} dataKey={name} fill={catColors[name]} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    // Default: stacked bar
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
          {catNames.map(name => (
            <Bar key={name} dataKey={name} stackId="a" fill={catColors[name]} radius={catNames.indexOf(name) === catNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      {/* Welcome - compact */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            Hallo, {user?.displayName || user?.username} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Deine Fixkosten-Übersicht</p>
        </div>
      </motion.div>

      {/* Summary cards - compact row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div variants={item} className="glass rounded-xl p-3 flex items-center gap-3 group hover:border-primary-500/30 transition-all">
          <div className="p-2 rounded-lg bg-primary-500/15 text-primary-400">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Monatlich</p>
            <p className="text-base font-bold text-white leading-tight">{fmt(totalMonthly)}</p>
          </div>
        </motion.div>
        <motion.div variants={item} className="glass rounded-xl p-3 flex items-center gap-3 group hover:border-accent-500/30 transition-all">
          <div className="p-2 rounded-lg bg-accent-500/15 text-accent-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Jährlich</p>
            <p className="text-base font-bold text-white leading-tight">{fmt(totalYearly)}</p>
          </div>
        </motion.div>
        <motion.div variants={item} className="glass rounded-xl p-3 flex items-center gap-3 group hover:border-green-500/30 transition-all">
          <div className="p-2 rounded-lg bg-green-500/15 text-green-400">
            <PieChartIcon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Aktive Posten</p>
            <p className="text-base font-bold text-white leading-tight">{activeCosts.length}</p>
          </div>
        </motion.div>
        <motion.div variants={item} className="glass rounded-xl p-3 flex items-center gap-3 group hover:border-amber-500/30 transition-all">
          <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Kategorien</p>
            <p className="text-base font-bold text-white leading-tight">{categories.length}</p>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming payments */}
        <motion.div variants={item} className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-400" />
              Nächste Abbuchungen
            </h2>
            <Link to="/uebersicht" className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors">
              Alle <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {allUpcomingPayments.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">Keine anstehenden Abbuchungen</p>
          ) : (
            <div className="space-y-2">
              {upcomingPayments.map((cost, i) => {
                const isPast = cost.nextDate < today;
                return (
                  <motion.div key={`${cost.id}-${cost.nextDate.toISOString()}`}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }}
                    className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${isPast ? 'bg-surface-light/30 opacity-50' : 'bg-surface-light/50 hover:bg-surface-lighter/50'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{categoryMap[cost.categoryId]?.icon || '📌'}</span>
                      <div>
                        <p className="text-xs font-medium text-white">{cost.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {cost.nextDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          {' · '}{getFrequencyLabel(cost)}
                          {isPast && ' · vergangen'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-white">{fmt(cost.currentAmount)}</span>
                  </motion.div>
                );
              })}
              {allUpcomingPayments.length > 10 && (
                <button onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                  className="w-full text-center text-xs text-primary-400 hover:text-primary-300 py-1.5 transition-colors">
                  {showAllUpcoming ? 'Weniger anzeigen' : `Mehr anzeigen (${allUpcomingPayments.length - 10} weitere)`}
                </button>
              )}
            </div>
          )}
        </motion.div>

        {/* Category breakdown */}
        <motion.div variants={item} className="glass rounded-2xl p-5">
          <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-3">
            <PieChartIcon className="w-4 h-4 text-accent-400" />
            Kategorien-Verteilung
          </h2>
          {Object.keys(categoryBreakdown).length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">Noch keine Daten vorhanden</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(categoryBreakdown)
                .sort((a, b) => b[1].monthly - a[1].monthly)
                .map(([catId, data], i) => {
                  const cat = categoryMap[catId];
                  const pct = totalMonthly > 0 ? (data.monthly / totalMonthly) * 100 : 0;
                  return (
                    <motion.div key={catId} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{cat?.icon || '📁'}</span>
                          <span className="text-xs text-slate-300">{cat?.name || 'Ohne Kategorie'}</span>
                          <span className="text-[10px] text-slate-600">({data.count})</span>
                        </div>
                        <span className="text-xs font-medium text-white">{fmt(data.monthly)}/M</span>
                      </div>
                      <div className="h-1.5 bg-surface-lighter rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: 0.15 * i, ease: 'easeOut' }}
                          className="h-full rounded-full" style={{ backgroundColor: cat?.color || '#3b82f6' }} />
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Charts section */}
      {costs.length > 0 && (
        <motion.div variants={item} className="glass rounded-2xl p-5">
          {/* Chart header / controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary-400" />
              Diagramme
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* View toggle */}
              <div className="flex rounded-lg overflow-hidden border border-slate-700">
                <button onClick={() => setChartView('year')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${chartView === 'year' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  Jahresansicht
                </button>
                <button onClick={() => setChartView('month')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${chartView === 'month' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  Monatsansicht
                </button>
              </div>
              {/* Config toggle */}
              <button onClick={() => setShowChartConfig(!showChartConfig)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-lighter/50 transition-colors">
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chart config panel */}
          <AnimatePresence>
            {showChartConfig && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
                <div className="glass-light rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-2 font-medium">Diagrammtyp</p>
                  <div className="flex flex-wrap gap-2">
                    {CHART_TYPES.map(ct => (
                      <button key={ct.id} onClick={() => setChartType(ct.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          chartType === ct.id ? 'bg-primary-600 text-white' : 'bg-surface-lighter/50 text-slate-400 hover:text-white'
                        }`}>
                        <span>{ct.icon}</span> {ct.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Year/Month navigation */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <button onClick={() => {
              if (chartView === 'year') setChartYear(y => y - 1);
              else { if (chartMonth === 0) { setChartMonth(11); setChartYear(y => y - 1); } else setChartMonth(m => m - 1); }
            }} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-lighter/50 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-white min-w-[120px] text-center">
              {chartView === 'year' ? chartYear : `${MONTH_NAMES[chartMonth]} ${chartYear}`}
            </span>
            <button onClick={() => {
              if (chartView === 'year') setChartYear(y => y + 1);
              else { if (chartMonth === 11) { setChartMonth(0); setChartYear(y => y + 1); } else setChartMonth(m => m + 1); }
            }} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-lighter/50 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Chart */}
          <div className="w-full overflow-x-auto">
            {renderChart()}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {costs.length === 0 && (
        <motion.div variants={item} className="glass rounded-2xl p-12 text-center">
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-6xl mb-4">
            📝
          </motion.div>
          <h3 className="text-xl font-semibold text-white mb-2">Noch keine Fixkosten erfasst</h3>
          <p className="text-slate-400 mb-6">Beginne damit, deine Fixkosten einzutragen.</p>
          <Link to="/eingaben"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-accent-600 text-white font-semibold hover:shadow-lg hover:shadow-primary-500/25 transition-all duration-300">
            <PlusCircle className="w-5 h-5" />
            Erste Fixkosten erfassen
          </Link>
        </motion.div>
      )}
    </motion.div>
  );
}

function PlusCircle(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>
    </svg>
  );
}
