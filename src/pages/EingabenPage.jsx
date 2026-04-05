import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import {
  getFixedCosts, getCategories, addFixedCost, updateFixedCost, deleteFixedCost,
  getIncomeSources, addIncomeSource, updateIncomeSource, deleteIncomeSource,
  getCurrentAmount, getFrequencyLabel, isCostActive, getMonthlyAmount
} from '../lib/firestore';
import {
  Plus, Edit3, Trash2, Save, X, Clock, Search,
  AlertTriangle, History, ChevronDown, ChevronUp, Wallet, ArrowDownCircle, ArrowUpCircle
} from 'lucide-react';

export default function EingabenPage() {
  const { user } = useAuth();
  const [costs, setCosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCost, setEditingCost] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses' | 'income'

  // Search & filter
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Form state
  const [form, setForm] = useState({
    name: '', categoryId: '', paymentDay: 1,
    frequency: 'monthly', frequencyMonths: 1,
    amount: '', startDate: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  // Income form state
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [incomeForm, setIncomeForm] = useState({
    name: '', paymentDay: 1, frequency: 'monthly', frequencyMonths: 1,
    amount: '', startDate: new Date().toISOString().slice(0, 10), notes: ''
  });

  const [showAmountEdit, setShowAmountEdit] = useState(null);
  const [newAmount, setNewAmount] = useState('');
  const [newAmountDate, setNewAmountDate] = useState(new Date().toISOString().slice(0, 10));
  const [showCancel, setShowCancel] = useState(null);
  const [cancelDate, setCancelDate] = useState(new Date().toISOString().slice(0, 10));
  const [editCancelId, setEditCancelId] = useState(null);
  const [editCancelDate, setEditCancelDate] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editHistoryItem, setEditHistoryItem] = useState(null); // { itemId, isIncome, idx, amount, validFrom }

  const loadData = async () => {
    if (!user) return;
    const [c, cats, inc] = await Promise.all([
      getFixedCosts(user.username),
      getCategories(user.username),
      getIncomeSources(user.username)
    ]);
    setCosts(c); setCategories(cats); setIncomes(inc); setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const categoryMap = {};
  categories.forEach(cat => { categoryMap[cat.id] = cat; });
  const fmt = (n) => Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  const parseAmount = (val) => {
    if (!val && val !== 0) return 0;
    return parseFloat(String(val).replace(',', '.')) || 0;
  };

  // Filtered costs
  const filteredCosts = useMemo(() => {
    let result = [...costs];
    if (filterStatus === 'active') result = result.filter(isCostActive);
    else if (filterStatus === 'cancelled') result = result.filter(c => !isCostActive(c));
    if (filterCategory !== 'all') result = result.filter(c => c.categoryId === filterCategory);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c => {
        const catName = (categoryMap[c.categoryId]?.name || '').toLowerCase();
        const amount = String(getCurrentAmount(c)).replace('.', ',');
        return c.name.toLowerCase().includes(s) || catName.includes(s) || amount.includes(s);
      });
    }
    return result;
  }, [costs, search, filterCategory, filterStatus]);

  // Filtered incomes
  const filteredIncomes = useMemo(() => {
    let result = [...incomes];
    if (filterStatus === 'active') result = result.filter(isCostActive);
    else if (filterStatus === 'cancelled') result = result.filter(c => !isCostActive(c));
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c => {
        const amount = String(getCurrentAmount(c)).replace('.', ',');
        return c.name.toLowerCase().includes(s) || amount.includes(s);
      });
    }
    return result;
  }, [incomes, search, filterStatus]);

  const resetForm = () => {
    setForm({ name: '', categoryId: '', paymentDay: 1, frequency: 'monthly', frequencyMonths: 1, amount: '', startDate: new Date().toISOString().slice(0, 10), notes: '' });
    setEditingCost(null); setShowForm(false);
  };
  const resetIncomeForm = () => {
    setIncomeForm({ name: '', paymentDay: 1, frequency: 'monthly', frequencyMonths: 1, amount: '', startDate: new Date().toISOString().slice(0, 10), notes: '' });
    setEditingIncome(null); setShowIncomeForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (editingCost) {
      const updates = { name: form.name, categoryId: form.categoryId, paymentDay: parseInt(form.paymentDay) || 1, frequency: form.frequency, frequencyMonths: parseInt(form.frequencyMonths) || 1, startDate: form.startDate, notes: form.notes };
      if (form.amount !== '' && form.amount !== undefined) {
        const newAmt = parseAmount(form.amount);
        const history = editingCost.amountHistory || [];
        if (history.length > 0) {
          const sorted = [...history].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
          sorted[0] = { ...sorted[0], amount: newAmt };
          updates.amountHistory = sorted;
        } else {
          updates.amountHistory = [{ amount: newAmt, validFrom: form.startDate }];
        }
      }
      await updateFixedCost(user.username, editingCost.id, updates);
    } else {
      await addFixedCost(user.username, { name: form.name, categoryId: form.categoryId, paymentDay: parseInt(form.paymentDay) || 1, frequency: form.frequency, frequencyMonths: parseInt(form.frequencyMonths) || 1, amount: parseAmount(form.amount), startDate: form.startDate, notes: form.notes });
    }
    resetForm(); await loadData();
  };

  const handleIncomeSubmit = async (e) => {
    e.preventDefault();
    if (!incomeForm.name.trim()) return;
    if (editingIncome) {
      const updates = { name: incomeForm.name, paymentDay: parseInt(incomeForm.paymentDay) || 1, frequency: incomeForm.frequency, frequencyMonths: parseInt(incomeForm.frequencyMonths) || 1, startDate: incomeForm.startDate, notes: incomeForm.notes };
      if (incomeForm.amount !== '' && incomeForm.amount !== undefined) {
        const newAmt = parseAmount(incomeForm.amount);
        const history = editingIncome.amountHistory || [];
        if (history.length > 0) {
          const sorted = [...history].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
          sorted[0] = { ...sorted[0], amount: newAmt };
          updates.amountHistory = sorted;
        } else {
          updates.amountHistory = [{ amount: newAmt, validFrom: incomeForm.startDate }];
        }
      }
      await updateIncomeSource(user.username, editingIncome.id, updates);
    } else {
      await addIncomeSource(user.username, { name: incomeForm.name, paymentDay: parseInt(incomeForm.paymentDay) || 1, frequency: incomeForm.frequency, frequencyMonths: parseInt(incomeForm.frequencyMonths) || 1, amount: parseAmount(incomeForm.amount), startDate: incomeForm.startDate, notes: incomeForm.notes });
    }
    resetIncomeForm(); await loadData();
  };

  const handleEdit = (cost) => {
    setForm({ name: cost.name, categoryId: cost.categoryId || '', paymentDay: cost.paymentDay || 1, frequency: cost.frequency || 'monthly', frequencyMonths: cost.frequencyMonths || 1, amount: String(getCurrentAmount(cost)).replace('.', ','), startDate: cost.startDate || '', notes: cost.notes || '' });
    setEditingCost(cost); setShowForm(true);
  };
  const handleEditIncome = (inc) => {
    setIncomeForm({ name: inc.name, paymentDay: inc.paymentDay || 1, frequency: inc.frequency || 'monthly', frequencyMonths: inc.frequencyMonths || 1, amount: String(getCurrentAmount(inc)).replace('.', ','), startDate: inc.startDate || '', notes: inc.notes || '' });
    setEditingIncome(inc); setShowIncomeForm(true);
  };

  const handleUpdateAmount = async (item, isIncome) => {
    if (!newAmount && newAmount !== 0) return;
    const updatedHistory = [...(item.amountHistory || []), { amount: parseAmount(newAmount), validFrom: newAmountDate }];
    if (isIncome) await updateIncomeSource(user.username, item.id, { amountHistory: updatedHistory });
    else await updateFixedCost(user.username, item.id, { amountHistory: updatedHistory });
    setShowAmountEdit(null); setNewAmount(''); await loadData();
  };

  const handleEditHistoryEntry = async (item, isIncome, idx, newAmt, newDate) => {
    const history = [...(item.amountHistory || [])];
    history[idx] = { amount: parseAmount(newAmt), validFrom: newDate };
    const sorted = history.sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    if (isIncome) await updateIncomeSource(user.username, item.id, { amountHistory: sorted });
    else await updateFixedCost(user.username, item.id, { amountHistory: sorted });
    setEditHistoryItem(null); await loadData();
  };

  const handleDeleteHistoryEntry = async (item, isIncome, idx) => {
    const history = [...(item.amountHistory || [])];
    if (history.length <= 1) return; // Don't delete the last entry
    history.splice(idx, 1);
    if (isIncome) await updateIncomeSource(user.username, item.id, { amountHistory: history });
    else await updateFixedCost(user.username, item.id, { amountHistory: history });
    setEditHistoryItem(null); await loadData();
  };

  const handleCancel = async (item, isIncome) => {
    if (isIncome) await updateIncomeSource(user.username, item.id, { cancelledDate: cancelDate });
    else await updateFixedCost(user.username, item.id, { cancelledDate: cancelDate });
    setShowCancel(null); await loadData();
  };

  const handleReactivate = async (item, isIncome) => {
    if (isIncome) await updateIncomeSource(user.username, item.id, { cancelledDate: null });
    else await updateFixedCost(user.username, item.id, { cancelledDate: null });
    await loadData();
  };

  const handleDelete = async (itemId, isIncome) => {
    if (isIncome) await deleteIncomeSource(user.username, itemId);
    else await deleteFixedCost(user.username, itemId);
    setDeleteConfirm(null); await loadData();
  };

  const renderItem = (item, i, isIncome) => {
    const cat = isIncome ? null : categoryMap[item.categoryId];
    const active = isCostActive(item);
    const expanded = expandedId === item.id;
    const itemKey = `${isIncome ? 'inc' : 'exp'}-${item.id}`;

    return (
      <motion.div key={itemKey} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
        className={`glass rounded-2xl overflow-hidden ${!active ? 'opacity-60' : ''}`}>
        <div onClick={() => setExpandedId(expanded ? null : item.id)}
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-lighter/20 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xl shrink-0">{isIncome ? '💵' : (cat?.icon || '📌')}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-white">{item.name}</p>
                {!active && item.cancelledDate && (
                  <span className="inline-flex items-center text-[10px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">
                    Beendet seit {new Date(item.cancelledDate).toLocaleDateString('de-DE')}
                  </span>
                )}
                {active && item.cancelledDate && new Date(item.cancelledDate) > new Date() && (
                  <span className="inline-flex items-center text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Endet am {new Date(item.cancelledDate).toLocaleDateString('de-DE')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {!isIncome && (cat?.name || 'Ohne Kategorie')} {!isIncome && '· '}{getFrequencyLabel(item)} · Tag {item.paymentDay}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className={`text-lg font-bold ${isIncome ? 'text-green-400' : 'text-white'}`}>{fmt(getCurrentAmount(item))}</span>
            {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
              <div className="px-4 pb-4 space-y-3 border-t border-slate-700/30 pt-3">
                <div className="flex flex-wrap gap-2">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => isIncome ? handleEditIncome(item) : handleEdit(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500/15 text-primary-400 text-xs font-medium hover:bg-primary-500/25 transition-colors">
                    <Edit3 className="w-3.5 h-3.5" /> Bearbeiten
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => { setShowAmountEdit(item.id); setNewAmount(''); setNewAmountDate(new Date().toISOString().slice(0, 10)); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-500/15 text-accent-400 text-xs font-medium hover:bg-accent-500/25 transition-colors">
                    <History className="w-3.5 h-3.5" /> Betrag anpassen
                  </motion.button>
                  {!item.cancelledDate ? (
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => { setShowCancel(item.id); setCancelDate(new Date().toISOString().slice(0, 10)); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-medium hover:bg-amber-500/25 transition-colors">
                      <Clock className="w-3.5 h-3.5" /> {isIncome ? 'Beenden' : 'Kündigen'}
                    </motion.button>
                  ) : (
                    <>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => { setEditCancelId(item.id); setEditCancelDate(item.cancelledDate); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-medium hover:bg-amber-500/25 transition-colors">
                        <Edit3 className="w-3.5 h-3.5" /> Datum bearbeiten
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => handleReactivate(item, isIncome)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-xs font-medium hover:bg-green-500/25 transition-colors">
                        Reaktivieren
                      </motion.button>
                    </>
                  )}
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => setDeleteConfirm(item.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Löschen
                  </motion.button>
                </div>

                {/* Amount edit */}
                <AnimatePresence>
                  {showAmountEdit === item.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="glass-light rounded-xl p-4 space-y-3 overflow-hidden">
                      <p className="text-sm text-slate-300 font-medium">Neuen Betrag hinzufügen</p>
                      <div className="flex flex-wrap gap-3">
                        <input type="text" inputMode="decimal" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="z.B. 12,50"
                          className="flex-1 min-w-[120px] px-3 py-2 rounded-lg bg-surface/80 border border-slate-700 text-sm text-white outline-none" />
                        <input type="date" value={newAmountDate} onChange={e => setNewAmountDate(e.target.value)}
                          className="px-3 py-2 rounded-lg bg-surface/80 border border-slate-700 text-sm text-white outline-none" />
                        <button onClick={() => handleUpdateAmount(item, isIncome)} className="px-4 py-2 rounded-lg bg-accent-600 text-white text-sm font-medium hover:bg-accent-500 transition-colors">Speichern</button>
                        <button onClick={() => setShowAmountEdit(null)} className="px-4 py-2 rounded-lg text-slate-400 text-sm hover:text-white transition-colors">Abbrechen</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Cancel form */}
                <AnimatePresence>
                  {showCancel === item.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="glass-light rounded-xl p-4 space-y-3 overflow-hidden">
                      <p className="text-sm text-amber-300 font-medium">{isIncome ? 'Enddatum eintragen' : 'Kündigung eintragen'}</p>
                      <div className="flex flex-wrap gap-3">
                        <input type="date" value={cancelDate} onChange={e => setCancelDate(e.target.value)}
                          className="px-3 py-2 rounded-lg bg-surface/80 border border-slate-700 text-sm text-white outline-none" />
                        <button onClick={() => handleCancel(item, isIncome)} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-colors">Speichern</button>
                        <button onClick={() => setShowCancel(null)} className="px-4 py-2 rounded-lg text-slate-400 text-sm hover:text-white transition-colors">Abbrechen</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Edit cancel date */}
                <AnimatePresence>
                  {editCancelId === item.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="glass-light rounded-xl p-4 space-y-3 overflow-hidden">
                      <p className="text-sm text-amber-300 font-medium">Datum bearbeiten</p>
                      <div className="flex flex-wrap gap-3">
                        <input type="date" value={editCancelDate} onChange={e => setEditCancelDate(e.target.value)}
                          className="px-3 py-2 rounded-lg bg-surface/80 border border-slate-700 text-sm text-white outline-none" />
                        <button onClick={async () => {
                          if (isIncome) await updateIncomeSource(user.username, item.id, { cancelledDate: editCancelDate });
                          else await updateFixedCost(user.username, item.id, { cancelledDate: editCancelDate });
                          setEditCancelId(null); await loadData();
                        }} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-colors">Speichern</button>
                        <button onClick={() => setEditCancelId(null)} className="px-4 py-2 rounded-lg text-slate-400 text-sm hover:text-white transition-colors">Abbrechen</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Delete confirm */}
                <AnimatePresence>
                  {deleteConfirm === item.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="glass-light rounded-xl p-4 space-y-3 overflow-hidden border border-red-500/20">
                      <p className="text-sm text-red-400 font-medium">Wirklich löschen?</p>
                      <div className="flex gap-3">
                        <button onClick={() => handleDelete(item.id, isIncome)} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500">Endgültig löschen</button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-slate-400 text-sm hover:text-white">Abbrechen</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Amount history */}
                {item.amountHistory?.length > 0 && (
                  <div className="glass-light rounded-xl p-4">
                    <p className="text-xs text-slate-400 font-medium mb-2">Betragshistorie</p>
                    <div className="space-y-1.5">
                      {[...item.amountHistory].sort((a, b) => b.validFrom.localeCompare(a.validFrom)).map((h, idx) => {
                        const origIdx = item.amountHistory.indexOf(h);
                        const isEditing = editHistoryItem?.itemId === item.id && editHistoryItem?.idx === origIdx;
                        if (isEditing) {
                          return (
                            <div key={idx} className="flex flex-wrap items-center gap-2 text-sm">
                              <input type="date" value={editHistoryItem.validFrom} onChange={e => setEditHistoryItem({ ...editHistoryItem, validFrom: e.target.value })}
                                className="bg-surface-light border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary-500" />
                              <input type="text" inputMode="decimal" value={editHistoryItem.amount} onChange={e => setEditHistoryItem({ ...editHistoryItem, amount: e.target.value })}
                                className="bg-surface-light border border-slate-700 rounded px-2 py-1 text-xs text-white w-24 focus:outline-none focus:border-primary-500" />
                              <button onClick={() => handleEditHistoryEntry(item, isIncome, origIdx, editHistoryItem.amount, editHistoryItem.validFrom)}
                                className="text-green-400 hover:text-green-300 text-xs">✓</button>
                              <button onClick={() => setEditHistoryItem(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
                            </div>
                          );
                        }
                        return (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Ab {h.validFrom}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">{fmt(h.amount)}</span>
                              <button onClick={() => setEditHistoryItem({ itemId: item.id, isIncome, idx: origIdx, amount: String(h.amount).replace('.', ','), validFrom: h.validFrom })}
                                className="text-slate-600 hover:text-white text-xs transition-colors">✏️</button>
                              {item.amountHistory.length > 1 && (
                                <button onClick={() => handleDeleteHistoryEntry(item, isIncome, origIdx)}
                                  className="text-slate-600 hover:text-red-400 text-xs transition-colors">🗑️</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const renderForm = (isIncome) => {
    const f = isIncome ? incomeForm : form;
    const setF = isIncome ? setIncomeForm : (v) => setForm(v);
    const editing = isIncome ? editingIncome : editingCost;
    const onSubmit = isIncome ? handleIncomeSubmit : handleSubmit;
    const onReset = isIncome ? resetIncomeForm : resetForm;

    return (
      <form onSubmit={onSubmit} className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-white">
            {editing ? (isIncome ? 'Einnahme bearbeiten' : 'Fixkosten bearbeiten') : (isIncome ? 'Neue Einnahme' : 'Neue Fixkosten')}
          </h2>
          <button type="button" onClick={onReset} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Name *</label>
            <input type="text" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder={isIncome ? 'z.B. Gehalt, Freelance...' : 'z.B. Netflix, Miete...'}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white placeholder-slate-500 transition-colors" required />
          </div>
          {!isIncome && (
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Kategorie</label>
              <select value={f.categoryId} onChange={e => setF({ ...f, categoryId: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 text-sm text-white outline-none cursor-pointer">
                <option value="">Ohne Kategorie</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">{editing ? 'Startbetrag (EUR)' : 'Betrag (EUR) *'}</label>
            <input type="text" inputMode="decimal" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} placeholder="0,00"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white placeholder-slate-500 transition-colors" required={!editing} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Zahltag</label>
            <input type="number" inputMode="numeric" min="1" max="31" value={f.paymentDay} onChange={e => setF({ ...f, paymentDay: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white transition-colors" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Zahlungsrhythmus</label>
            <select value={f.frequency} onChange={e => setF({ ...f, frequency: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 text-sm text-white outline-none cursor-pointer">
              <option value="monthly">Monatlich</option>
              <option value="yearly">Jährlich</option>
              <option value="custom">Benutzerdefiniert</option>
            </select>
          </div>
          {f.frequency === 'custom' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Alle X Monate</label>
              <input type="number" inputMode="numeric" min="1" value={f.frequencyMonths} onChange={e => setF({ ...f, frequencyMonths: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white transition-colors" />
            </div>
          )}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Startdatum</label>
            <input type="date" value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white transition-colors" />
          </div>
          <div className={isIncome ? '' : 'md:col-span-2'}>
            <label className="block text-sm text-slate-400 mb-1.5">Notizen</label>
            <textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Optionale Notizen..." rows={2}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white placeholder-slate-500 transition-colors resize-none" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-accent-600 text-white text-sm font-semibold shadow-lg shadow-primary-500/20 transition-all">
            <Save className="w-4 h-4" /> {editing ? 'Speichern' : 'Hinzufügen'}
          </motion.button>
          <button type="button" onClick={onReset} className="px-6 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-surface-lighter/50 transition-all">Abbrechen</button>
        </div>
      </form>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-3 border-primary-500/30 border-t-primary-500 rounded-full" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Header with tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Eingaben</h1>
        <div className="flex items-center gap-2">
          {activeTab === 'expenses' ? (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-accent-600 text-white text-sm font-semibold shadow-lg shadow-primary-500/20 transition-all">
              <Plus className="w-4 h-4" /> Neue Fixkosten
            </motion.button>
          ) : (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => { resetIncomeForm(); setShowIncomeForm(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold shadow-lg shadow-green-500/20 transition-all">
              <Plus className="w-4 h-4" /> Neue Einnahme
            </motion.button>
          )}
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex rounded-xl overflow-hidden border border-slate-700 w-fit">
        <button onClick={() => setActiveTab('expenses')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'expenses' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'}`}>
          <ArrowUpCircle className="w-4 h-4" /> Ausgaben ({costs.length})
        </button>
        <button onClick={() => setActiveTab('income')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'income' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'}`}>
          <ArrowDownCircle className="w-4 h-4" /> Einnahmen ({incomes.length})
        </button>
      </div>

      {/* Search & Filters */}
      <div className="glass rounded-xl p-3">
        <div className="flex flex-wrap gap-2.5 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, Betrag, Kategorie..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white placeholder-slate-500 transition-colors" />
          </div>
          {activeTab === 'expenses' && (
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-2 rounded-lg bg-surface-light/80 border border-slate-700 text-sm text-white outline-none cursor-pointer">
              <option value="all">Alle Kategorien</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
            </select>
          )}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-light/80 border border-slate-700 text-sm text-white outline-none cursor-pointer">
            <option value="all">Alle</option>
            <option value="active">Aktiv</option>
            <option value="cancelled">{activeTab === 'income' ? 'Beendet' : 'Gekündigt'}</option>
          </select>
        </div>
      </div>

      {categories.length === 0 && activeTab === 'expenses' && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-4 flex items-center gap-3 border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">Erstelle zuerst Kategorien unter <span className="font-medium">Einstellungen</span>.</p>
        </motion.div>
      )}

      {/* Form */}
      <AnimatePresence>
        {activeTab === 'expenses' && showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            {renderForm(false)}
          </motion.div>
        )}
        {activeTab === 'income' && showIncomeForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            {renderForm(true)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="space-y-3">
        {activeTab === 'expenses' ? (
          filteredCosts.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-slate-400">{search || filterCategory !== 'all' || filterStatus !== 'all' ? 'Keine Einträge gefunden.' : 'Noch keine Fixkosten erfasst.'}</p>
            </div>
          ) : filteredCosts.map((c, i) => renderItem(c, i, false))
        ) : (
          filteredIncomes.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-5xl mb-4">💵</motion.div>
              <p className="text-slate-400">{search || filterStatus !== 'all' ? 'Keine Einträge gefunden.' : 'Noch keine Einnahmen erfasst.'}</p>
            </div>
          ) : filteredIncomes.map((inc, i) => renderItem(inc, i, true))
        )}
      </div>
    </motion.div>
  );
}
