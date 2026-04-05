import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import {
  getFixedCosts, getCategories, addFixedCost, updateFixedCost, deleteFixedCost,
  getCurrentAmount, getFrequencyLabel, isCostActive
} from '../lib/firestore';
import {
  Plus, Edit3, Trash2, Save, X, Calendar, DollarSign, Tag, Clock,
  AlertTriangle, History, ChevronDown, ChevronUp
} from 'lucide-react';

export default function EingabenPage() {
  const { user } = useAuth();
  const [costs, setCosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCost, setEditingCost] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Form state
  const [form, setForm] = useState({
    name: '', categoryId: '', paymentDay: 1,
    frequency: 'monthly', frequencyMonths: 1,
    amount: '', startDate: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  // For editing amount (adding new amount to history)
  const [showAmountEdit, setShowAmountEdit] = useState(null);
  const [newAmount, setNewAmount] = useState('');
  const [newAmountDate, setNewAmountDate] = useState(new Date().toISOString().slice(0, 10));

  // For cancellation
  const [showCancel, setShowCancel] = useState(null);
  const [cancelDate, setCancelDate] = useState(new Date().toISOString().slice(0, 10));

  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const loadData = async () => {
    if (!user) return;
    const [c, cats] = await Promise.all([
      getFixedCosts(user.username),
      getCategories(user.username)
    ]);
    setCosts(c);
    setCategories(cats);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const categoryMap = {};
  categories.forEach(cat => { categoryMap[cat.id] = cat; });
  const fmt = (n) => Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  const resetForm = () => {
    setForm({
      name: '', categoryId: '', paymentDay: 1,
      frequency: 'monthly', frequencyMonths: 1,
      amount: '', startDate: new Date().toISOString().slice(0, 10),
      notes: ''
    });
    setEditingCost(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (editingCost) {
      await updateFixedCost(user.username, editingCost.id, {
        name: form.name,
        categoryId: form.categoryId,
        paymentDay: parseInt(form.paymentDay) || 1,
        frequency: form.frequency,
        frequencyMonths: parseInt(form.frequencyMonths) || 1,
        startDate: form.startDate,
        notes: form.notes
      });
    } else {
      await addFixedCost(user.username, {
        name: form.name,
        categoryId: form.categoryId,
        paymentDay: parseInt(form.paymentDay) || 1,
        frequency: form.frequency,
        frequencyMonths: parseInt(form.frequencyMonths) || 1,
        amount: parseFloat(form.amount) || 0,
        startDate: form.startDate,
        notes: form.notes
      });
    }

    resetForm();
    await loadData();
  };

  const handleEdit = (cost) => {
    setForm({
      name: cost.name,
      categoryId: cost.categoryId || '',
      paymentDay: cost.paymentDay || 1,
      frequency: cost.frequency || 'monthly',
      frequencyMonths: cost.frequencyMonths || 1,
      amount: getCurrentAmount(cost),
      startDate: cost.startDate || '',
      notes: cost.notes || ''
    });
    setEditingCost(cost);
    setShowForm(true);
  };

  const handleUpdateAmount = async (cost) => {
    if (!newAmount && newAmount !== 0) return;
    const updatedHistory = [
      ...(cost.amountHistory || []),
      { amount: parseFloat(newAmount), validFrom: newAmountDate }
    ];
    await updateFixedCost(user.username, cost.id, { amountHistory: updatedHistory });
    setShowAmountEdit(null);
    setNewAmount('');
    await loadData();
  };

  const handleCancel = async (cost) => {
    await updateFixedCost(user.username, cost.id, { cancelledDate: cancelDate });
    setShowCancel(null);
    await loadData();
  };

  const handleReactivate = async (cost) => {
    await updateFixedCost(user.username, cost.id, { cancelledDate: null });
    await loadData();
  };

  const handleDelete = async (costId) => {
    await deleteFixedCost(user.username, costId);
    setDeleteConfirm(null);
    await loadData();
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Eingaben</h1>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-accent-600 text-white text-sm font-semibold shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 transition-all"
        >
          <Plus className="w-4 h-4" />
          Neue Fixkosten
        </motion.button>
      </div>

      {categories.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-4 flex items-center gap-3 border-amber-500/30 bg-amber-500/5"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            Erstelle zuerst Kategorien unter <span className="font-medium">Einstellungen</span>, um deine Fixkosten zu organisieren.
          </p>
        </motion.div>
      )}

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-white">
                  {editingCost ? 'Fixkosten bearbeiten' : 'Neue Fixkosten hinzufügen'}
                </h2>
                <button type="button" onClick={resetForm} className="text-slate-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="z.B. Netflix, Miete..."
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white placeholder-slate-500 transition-colors"
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Kategorie</label>
                  <select
                    value={form.categoryId}
                    onChange={e => setForm({ ...form, categoryId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 text-sm text-white outline-none cursor-pointer"
                  >
                    <option value="">Ohne Kategorie</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Amount (only for new entries) */}
                {!editingCost && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Betrag (EUR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.amount}
                      onChange={e => setForm({ ...form, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white placeholder-slate-500 transition-colors"
                      required
                    />
                  </div>
                )}

                {/* Payment day */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Zahltag (Tag im Monat)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.paymentDay}
                    onChange={e => setForm({ ...form, paymentDay: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white transition-colors"
                  />
                </div>

                {/* Frequency */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Zahlungsrhythmus</label>
                  <select
                    value={form.frequency}
                    onChange={e => setForm({ ...form, frequency: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 text-sm text-white outline-none cursor-pointer"
                  >
                    <option value="monthly">Monatlich</option>
                    <option value="yearly">Jährlich</option>
                    <option value="custom">Benutzerdefiniert</option>
                  </select>
                </div>

                {form.frequency === 'custom' && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Alle X Monate</label>
                    <input
                      type="number"
                      min="1"
                      value={form.frequencyMonths}
                      onChange={e => setForm({ ...form, frequencyMonths: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white transition-colors"
                    />
                  </div>
                )}

                {/* Start date */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Startdatum</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white transition-colors"
                  />
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block text-sm text-slate-400 mb-1.5">Notizen</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Optionale Notizen..."
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white placeholder-slate-500 transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-accent-600 text-white text-sm font-semibold shadow-lg shadow-primary-500/20 transition-all"
                >
                  <Save className="w-4 h-4" />
                  {editingCost ? 'Speichern' : 'Hinzufügen'}
                </motion.button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-surface-lighter/50 transition-all"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Costs list */}
      <div className="space-y-3">
        {costs.length === 0 && !showForm ? (
          <div className="glass rounded-2xl p-12 text-center">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-5xl mb-4">
              💰
            </motion.div>
            <p className="text-slate-400">Noch keine Fixkosten erfasst. Klicke auf "Neue Fixkosten" um zu beginnen.</p>
          </div>
        ) : (
          costs.map((cost, i) => {
            const cat = categoryMap[cost.categoryId];
            const active = isCostActive(cost);
            const expanded = expandedId === cost.id;

            return (
              <motion.div
                key={cost.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`glass rounded-2xl overflow-hidden ${!active ? 'opacity-60' : ''}`}
              >
                <div
                  onClick={() => setExpandedId(expanded ? null : cost.id)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-lighter/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cat?.icon || '📌'}</span>
                    <div>
                      <p className="font-medium text-white">{cost.name}</p>
                      <p className="text-xs text-slate-500">
                        {cat?.name || 'Ohne Kategorie'} · {getFrequencyLabel(cost)} · Tag {cost.paymentDay}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-white">{fmt(getCurrentAmount(cost))}</span>
                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </div>

                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3 border-t border-slate-700/30 pt-3">
                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleEdit(cost)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500/15 text-primary-400 text-xs font-medium hover:bg-primary-500/25 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Bearbeiten
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { setShowAmountEdit(cost.id); setNewAmount(''); setNewAmountDate(new Date().toISOString().slice(0, 10)); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-500/15 text-accent-400 text-xs font-medium hover:bg-accent-500/25 transition-colors"
                          >
                            <History className="w-3.5 h-3.5" /> Betrag anpassen
                          </motion.button>
                          {active ? (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => { setShowCancel(cost.id); setCancelDate(new Date().toISOString().slice(0, 10)); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-medium hover:bg-amber-500/25 transition-colors"
                            >
                              <Clock className="w-3.5 h-3.5" /> Kündigen
                            </motion.button>
                          ) : (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleReactivate(cost)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-xs font-medium hover:bg-green-500/25 transition-colors"
                            >
                              Reaktivieren
                            </motion.button>
                          )}
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setDeleteConfirm(cost.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Löschen
                          </motion.button>
                        </div>

                        {/* Amount update form */}
                        <AnimatePresence>
                          {showAmountEdit === cost.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="glass-light rounded-xl p-4 space-y-3 overflow-hidden"
                            >
                              <p className="text-sm text-slate-300 font-medium">Neuen Betrag hinzufügen</p>
                              <p className="text-xs text-slate-500">Der alte Betrag bleibt in der Historie erhalten.</p>
                              <div className="flex flex-wrap gap-3">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={newAmount}
                                  onChange={e => setNewAmount(e.target.value)}
                                  placeholder="Neuer Betrag"
                                  className="flex-1 min-w-[120px] px-3 py-2 rounded-lg bg-surface/80 border border-slate-700 text-sm text-white outline-none"
                                />
                                <input
                                  type="date"
                                  value={newAmountDate}
                                  onChange={e => setNewAmountDate(e.target.value)}
                                  className="px-3 py-2 rounded-lg bg-surface/80 border border-slate-700 text-sm text-white outline-none"
                                />
                                <button
                                  onClick={() => handleUpdateAmount(cost)}
                                  className="px-4 py-2 rounded-lg bg-accent-600 text-white text-sm font-medium hover:bg-accent-500 transition-colors"
                                >
                                  Speichern
                                </button>
                                <button
                                  onClick={() => setShowAmountEdit(null)}
                                  className="px-4 py-2 rounded-lg text-slate-400 text-sm hover:text-white transition-colors"
                                >
                                  Abbrechen
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Cancel form */}
                        <AnimatePresence>
                          {showCancel === cost.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="glass-light rounded-xl p-4 space-y-3 overflow-hidden"
                            >
                              <p className="text-sm text-amber-300 font-medium">Kündigung eintragen</p>
                              <p className="text-xs text-slate-500">Ab diesem Datum wird der Posten nicht mehr eingerechnet.</p>
                              <div className="flex flex-wrap gap-3">
                                <input
                                  type="date"
                                  value={cancelDate}
                                  onChange={e => setCancelDate(e.target.value)}
                                  className="px-3 py-2 rounded-lg bg-surface/80 border border-slate-700 text-sm text-white outline-none"
                                />
                                <button
                                  onClick={() => handleCancel(cost)}
                                  className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-colors"
                                >
                                  Kündigen
                                </button>
                                <button
                                  onClick={() => setShowCancel(null)}
                                  className="px-4 py-2 rounded-lg text-slate-400 text-sm hover:text-white transition-colors"
                                >
                                  Abbrechen
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Delete confirmation */}
                        <AnimatePresence>
                          {deleteConfirm === cost.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="glass-light rounded-xl p-4 space-y-3 overflow-hidden border border-red-500/20"
                            >
                              <p className="text-sm text-red-400 font-medium">Wirklich löschen?</p>
                              <p className="text-xs text-slate-400">Diese Aktion kann nicht rückgängig gemacht werden.</p>
                              <div className="flex gap-3">
                                <button
                                  onClick={() => handleDelete(cost.id)}
                                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors"
                                >
                                  Endgültig löschen
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="px-4 py-2 rounded-lg text-slate-400 text-sm hover:text-white transition-colors"
                                >
                                  Abbrechen
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Amount history */}
                        {cost.amountHistory && cost.amountHistory.length > 0 && (
                          <div className="glass-light rounded-xl p-4">
                            <p className="text-xs text-slate-400 font-medium mb-2">Betragshistorie</p>
                            <div className="space-y-1.5">
                              {[...cost.amountHistory]
                                .sort((a, b) => b.validFrom.localeCompare(a.validFrom))
                                .map((h, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Ab {h.validFrom}</span>
                                    <span className="text-white font-medium">{fmt(h.amount)}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
