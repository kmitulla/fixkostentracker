import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getFixedCosts, getCategories, getMonthlyAmount, getYearlyAmount, isCostActive, getCurrentAmount, getFrequencyLabel } from '../lib/firestore';
import { TrendingUp, TrendingDown, Calendar, DollarSign, CreditCard, PieChart, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [costs, setCosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Category breakdown
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

  // Upcoming payments (next 30 days)
  const today = new Date();
  const upcomingPayments = activeCosts
    .map(c => {
      const day = c.paymentDay || 1;
      let nextDate = new Date(today.getFullYear(), today.getMonth(), day);
      if (nextDate < today) nextDate.setMonth(nextDate.getMonth() + 1);
      return { ...c, nextDate, currentAmount: getCurrentAmount(c) };
    })
    .filter(c => {
      const diff = (c.nextDate - today) / (1000 * 60 * 60 * 24);
      return diff <= 30;
    })
    .sort((a, b) => a.nextDate - b.nextDate)
    .slice(0, 5);

  const fmt = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-3 border-primary-500/30 border-t-primary-500 rounded-full"
        />
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Welcome */}
      <motion.div variants={item}>
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          Hallo, {user?.displayName || user?.username} 👋
        </h1>
        <p className="text-slate-400 mt-1">Hier ist deine Fixkosten-Übersicht</p>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={item} className="glass rounded-2xl p-5 group hover:border-primary-500/30 transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-primary-500/15 text-primary-400 group-hover:bg-primary-500/25 transition-colors">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-sm text-slate-400">Monatlich</span>
          </div>
          <motion.p
            className="text-2xl font-bold text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {fmt(totalMonthly)}
          </motion.p>
        </motion.div>

        <motion.div variants={item} className="glass rounded-2xl p-5 group hover:border-accent-500/30 transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-accent-500/15 text-accent-400 group-hover:bg-accent-500/25 transition-colors">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-sm text-slate-400">Jährlich</span>
          </div>
          <motion.p
            className="text-2xl font-bold text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {fmt(totalYearly)}
          </motion.p>
        </motion.div>

        <motion.div variants={item} className="glass rounded-2xl p-5 group hover:border-green-500/30 transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-green-500/15 text-green-400 group-hover:bg-green-500/25 transition-colors">
              <PieChart className="w-5 h-5" />
            </div>
            <span className="text-sm text-slate-400">Aktive Posten</span>
          </div>
          <p className="text-2xl font-bold text-white">{activeCosts.length}</p>
        </motion.div>

        <motion.div variants={item} className="glass rounded-2xl p-5 group hover:border-amber-500/30 transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 group-hover:bg-amber-500/25 transition-colors">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-sm text-slate-400">Kategorien</span>
          </div>
          <p className="text-2xl font-bold text-white">{categories.length}</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming payments */}
        <motion.div variants={item} className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-400" />
              Nächste Abbuchungen
            </h2>
            <Link to="/uebersicht" className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors">
              Alle <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {upcomingPayments.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">Keine anstehenden Abbuchungen</p>
          ) : (
            <div className="space-y-3">
              {upcomingPayments.map((cost, i) => (
                <motion.div
                  key={cost.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * i }}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-light/50 hover:bg-surface-lighter/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {categoryMap[cost.categoryId]?.icon || '📌'}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">{cost.name}</p>
                      <p className="text-xs text-slate-500">
                        {cost.nextDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                        {' · '}
                        {getFrequencyLabel(cost)}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-white">{fmt(cost.currentAmount)}</span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Category breakdown */}
        <motion.div variants={item} className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-accent-400" />
            Kategorien-Verteilung
          </h2>
          {Object.keys(categoryBreakdown).length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">Noch keine Daten vorhanden</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(categoryBreakdown)
                .sort((a, b) => b[1].monthly - a[1].monthly)
                .map(([catId, data], i) => {
                  const cat = categoryMap[catId];
                  const pct = totalMonthly > 0 ? (data.monthly / totalMonthly) * 100 : 0;
                  return (
                    <motion.div
                      key={catId}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * i }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span>{cat?.icon || '📁'}</span>
                          <span className="text-sm text-slate-300">{cat?.name || 'Ohne Kategorie'}</span>
                          <span className="text-xs text-slate-500">({data.count})</span>
                        </div>
                        <span className="text-sm font-medium text-white">{fmt(data.monthly)}/M</span>
                      </div>
                      <div className="h-2 bg-surface-lighter rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: 0.2 * i, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: cat?.color || '#3b82f6' }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Empty state */}
      {costs.length === 0 && (
        <motion.div
          variants={item}
          className="glass rounded-2xl p-12 text-center"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-6xl mb-4"
          >
            📝
          </motion.div>
          <h3 className="text-xl font-semibold text-white mb-2">Noch keine Fixkosten erfasst</h3>
          <p className="text-slate-400 mb-6">Beginne damit, deine Fixkosten einzutragen.</p>
          <Link
            to="/eingaben"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-accent-600 text-white font-semibold hover:shadow-lg hover:shadow-primary-500/25 transition-all duration-300"
          >
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
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 12h8"/>
      <path d="M12 8v8"/>
    </svg>
  );
}
