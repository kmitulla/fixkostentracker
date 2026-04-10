import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getFixedCosts, getCategories, getMonthlyAmount, getYearlyAmount, getCurrentAmount, isCostActive, getFrequencyLabel } from '../lib/firestore';
import { Search, Filter, ChevronDown, ChevronUp, Calendar, ArrowUpDown } from 'lucide-react';

export default function UebersichtPage() {
  const { user } = useAuth();
  const [costs, setCosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [expandedId, setExpandedId] = useState(null);

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

  const categoryMap = {};
  categories.forEach(cat => { categoryMap[cat.id] = cat; });

  const filteredCosts = useMemo(() => {
    let result = [...costs];

    // Filter by status
    if (filterStatus === 'active') result = result.filter(isCostActive);
    else if (filterStatus === 'cancelled') result = result.filter(c => !isCostActive(c));
    else if (filterStatus === 'future_cancelled') result = result.filter(c => isCostActive(c) && c.cancelledDate);

    // Filter by category
    if (filterCategory !== 'all') result = result.filter(c => c.categoryId === filterCategory);

    // Search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(s));
    }

    // Sort
    result.sort((a, b) => {
      let va, vb;
      if (sortBy === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
      else if (sortBy === 'amount') { va = getMonthlyAmount(a); vb = getMonthlyAmount(b); }
      else if (sortBy === 'day') { va = a.paymentDay || 0; vb = b.paymentDay || 0; }
      else if (sortBy === 'category') {
        va = (categoryMap[a.categoryId]?.name || 'zzz').toLowerCase();
        vb = (categoryMap[b.categoryId]?.name || 'zzz').toLowerCase();
      }
      else if (sortBy === 'frequency') {
        const freqOrder = { monthly: 1, custom: 2, yearly: 3 };
        va = freqOrder[a.frequency] || 0;
        vb = freqOrder[b.frequency] || 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [costs, filterStatus, filterCategory, search, sortBy, sortDir]);

  const totalMonthly = filteredCosts.filter(isCostActive).reduce((s, c) => s + getMonthlyAmount(c), 0);
  const totalYearly = filteredCosts.filter(isCostActive).reduce((s, c) => s + getYearlyAmount(c), 0);
  const fmt = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Übersicht</h1>

      {/* Filters */}
      <div className="glass rounded-2xl p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Suchen..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white placeholder-slate-500 transition-colors"
            />
          </div>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 text-sm text-white outline-none cursor-pointer"
          >
            <option value="all">Alle Kategorien</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 text-sm text-white outline-none cursor-pointer"
          >
            <option value="active">Aktiv</option>
            <option value="future_cancelled">Zukünftig gekündigt</option>
            <option value="cancelled">Gekündigt</option>
            <option value="all">Alle</option>
          </select>
          <select
            value={`${sortBy}-${sortDir}`}
            onChange={e => { const [f, d] = e.target.value.split('-'); setSortBy(f); setSortDir(d); }}
            className="px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 text-sm text-white outline-none cursor-pointer md:hidden"
          >
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="amount-desc">Betrag ↓</option>
            <option value="amount-asc">Betrag ↑</option>
            <option value="day-asc">Zahltag ↑</option>
            <option value="category-asc">Kategorie A-Z</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Anzahl</p>
          <p className="text-xl font-bold text-white">{filteredCosts.length}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Monatlich</p>
          <p className="text-xl font-bold text-primary-400">{fmt(totalMonthly)}</p>
        </div>
        <div className="glass rounded-xl p-4 text-center col-span-2 md:col-span-1">
          <p className="text-xs text-slate-400 mb-1">Jährlich</p>
          <p className="text-xl font-bold text-accent-400">{fmt(totalYearly)}</p>
        </div>
      </div>

      {/* Table / List */}
      <div className="glass rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-700/50 text-xs text-slate-400 font-medium">
          <button onClick={() => toggleSort('name')} className="col-span-4 flex items-center gap-1 hover:text-white transition-colors text-left">
            Name <ArrowUpDown className="w-3 h-3" />
          </button>
          <button onClick={() => toggleSort('category')} className="col-span-2 flex items-center gap-1 hover:text-white transition-colors text-left">
            Kategorie <ArrowUpDown className="w-3 h-3" />
          </button>
          <button onClick={() => toggleSort('amount')} className="col-span-2 flex items-center gap-1 hover:text-white transition-colors text-left">
            Betrag <ArrowUpDown className="w-3 h-3" />
          </button>
          <button onClick={() => toggleSort('day')} className="col-span-2 flex items-center gap-1 hover:text-white transition-colors text-left">
            Zahltag <ArrowUpDown className="w-3 h-3" />
          </button>
          <button onClick={() => toggleSort('frequency')} className="col-span-2 flex items-center gap-1 justify-end hover:text-white transition-colors">
            Frequenz <ArrowUpDown className="w-3 h-3" />
          </button>
        </div>

        {filteredCosts.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            Keine Einträge gefunden
          </div>
        ) : (
          <div>
            {filteredCosts.map((cost, i) => {
              const cat = categoryMap[cost.categoryId];
              const active = isCostActive(cost);
              const expanded = expandedId === cost.id;
              const hasFutureCancellation = active && cost.cancelledDate;
              const today = new Date().toISOString().slice(0, 10);
              const currentAmt = getCurrentAmount(cost);
              const futureAmounts = (cost.amountHistory || [])
                .filter(h => h.validFrom > today && h.amount !== currentAmt)
                .sort((a, b) => a.validFrom.localeCompare(b.validFrom));

              return (
                <motion.div
                  key={cost.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`border-b border-slate-700/30 last:border-b-0 ${!active ? 'opacity-50' : ''}`}
                >
                  <div
                    onClick={() => setExpandedId(expanded ? null : cost.id)}
                    className="grid grid-cols-12 gap-4 px-5 py-4 cursor-pointer hover:bg-surface-lighter/30 transition-colors items-center"
                  >
                    <div className="col-span-12 md:col-span-4 flex items-center gap-3">
                      <span className="text-lg">{cat?.icon || '📌'}</span>
                      <div>
                        <p className="text-sm font-medium text-white">{cost.name}</p>
                        <p className="text-xs text-slate-500 md:hidden">{cat?.name || 'Ohne Kategorie'} · {getFrequencyLabel(cost)}</p>
                      </div>
                      {!active && (
                        <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full">Gekündigt</span>
                      )}
                      {hasFutureCancellation && (
                        <span className="text-xs bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full">Endet {new Date(cost.cancelledDate).toLocaleDateString('de-DE')}</span>
                      )}
                      {futureAmounts.length > 0 && (
                        <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full">Beitragsänderung</span>
                      )}
                    </div>
                    <div className="hidden md:flex col-span-2 items-center gap-2 text-sm text-slate-300">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color || '#64748b' }} />
                      {cat?.name || 'Ohne'}
                    </div>
                    <div className="hidden md:block col-span-2 text-sm font-medium text-white">
                      {fmt(getCurrentAmount(cost))}
                    </div>
                    <div className="hidden md:flex col-span-2 items-center gap-1.5 text-sm text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      {cost.paymentDay}. des Monats
                    </div>
                    <div className="hidden md:flex col-span-2 justify-end items-center gap-2">
                      <span className="text-sm text-slate-400">{getFrequencyLabel(cost)}</span>
                      {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-4 space-y-3">
                          <div className="glass-light rounded-xl p-4 space-y-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <p className="text-slate-500 text-xs">Monatlich</p>
                                <p className="text-primary-400 font-medium">{fmt(getMonthlyAmount(cost))}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Jährlich</p>
                                <p className="text-accent-400 font-medium">{fmt(getYearlyAmount(cost))}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Startdatum</p>
                                <p className="text-slate-300">{cost.startDate}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Status</p>
                                {!active ? (
                                  <p className="text-red-400">Gekündigt ({new Date(cost.cancelledDate).toLocaleDateString('de-DE')})</p>
                                ) : hasFutureCancellation ? (
                                  <p className="text-amber-400">Gekündigt zum {new Date(cost.cancelledDate).toLocaleDateString('de-DE')}</p>
                                ) : (
                                  <p className="text-green-400">Aktiv</p>
                                )}
                              </div>
                            </div>

                            {/* Future price adjustments */}
                            {futureAmounts.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-700/50">
                                <p className="text-xs text-blue-400 mb-2 font-medium">Zukünftige Beitragsanpassung</p>
                                <div className="space-y-1">
                                  {futureAmounts.map((h, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-xs bg-blue-500/10 rounded-lg px-3 py-2">
                                      <span className="text-blue-300">Ab {new Date(h.validFrom).toLocaleDateString('de-DE')}</span>
                                      <span className="text-blue-200 font-medium">{fmt(h.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Amount history */}
                            {cost.amountHistory && cost.amountHistory.length > 1 && (
                              <div className="mt-3 pt-3 border-t border-slate-700/50">
                                <p className="text-xs text-slate-400 mb-2 font-medium">Betragshistorie</p>
                                <div className="space-y-1">
                                  {[...cost.amountHistory]
                                    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))
                                    .map((h, idx) => (
                                      <div key={idx} className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Ab {new Date(h.validFrom).toLocaleDateString('de-DE')}</span>
                                        <span className="text-white font-medium">{fmt(h.amount)}</span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                            {cost.notes && (
                              <div className="mt-3 pt-3 border-t border-slate-700/50">
                                <p className="text-xs text-slate-400 mb-1">Notizen</p>
                                <p className="text-sm text-slate-300">{cost.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
