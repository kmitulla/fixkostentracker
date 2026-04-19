import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getCategories, addCategory, updateCategory, deleteCategory } from '../lib/firestore';
import {
  getNotificationSettings, saveNotificationSettings,
  requestNotificationPermission, isNotificationSupported, checkAndNotify,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '../lib/notifications';
import {
  Settings, Palette, Plus, Edit3, Trash2, Save, X, Lock, Eye, EyeOff, Tag, Bell, BellRing
} from 'lucide-react';

const DEFAULT_EMOJIS = ['📁', '🏠', '🚗', '📱', '🎬', '🎵', '💡', '🏥', '🎓', '🛡️', '🍔', '🏋️', '✈️', '👕', '🐾', '💻', '📰', '🎮', '☁️', '📦', '💳', '📞', '🧹', '💊', '🎭', '🏦', '⚡', '💧', '🌐', '🔒'];
const COLOR_OPTIONS = ['#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#6366f1'];

export default function EinstellungenPage() {
  const { user, changePassword } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#3b82f6');
  const [catIcon, setCatIcon] = useState('📁');
  const [deletingCat, setDeletingCat] = useState(null);
  const [customEmoji, setCustomEmoji] = useState('');
  const [customColor, setCustomColor] = useState('#ffffff');

  // Password
  const [showPwForm, setShowPwForm] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });

  // Notifications
  const [notif, setNotif] = useState({ ...DEFAULT_NOTIFICATION_SETTINGS });
  const [notifDaysText, setNotifDaysText] = useState('3, 1, 0');
  const [notifPerm, setNotifPerm] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [notifMsg, setNotifMsg] = useState({ type: '', text: '' });
  const [savingNotif, setSavingNotif] = useState(false);

  const loadCategories = async () => {
    if (!user) return;
    const cats = await getCategories(user.username);
    setCategories(cats);
    try {
      const s = await getNotificationSettings(user.username);
      setNotif(s);
      setNotifDaysText((s.daysBefore || []).join(', '));
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadCategories(); }, [user]);

  const parseDaysInput = (str) => {
    return Array.from(new Set(
      String(str).split(/[\s,;]+/).map(s => s.trim()).filter(Boolean)
        .map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n >= 0 && n <= 90)
    )).sort((a, b) => b - a);
  };

  const handleEnableNotifications = async () => {
    setNotifMsg({ type: '', text: '' });
    if (!isNotificationSupported()) {
      setNotifMsg({ type: 'error', text: 'Dein Browser unterstützt keine Benachrichtigungen. Auf iPhone: App über "Teilen → Zum Home-Bildschirm" installieren.' });
      return;
    }
    const perm = await requestNotificationPermission();
    setNotifPerm(perm);
    if (perm !== 'granted') {
      setNotifMsg({ type: 'error', text: 'Benachrichtigungen wurden blockiert. Bitte in den System-/Safari-Einstellungen erlauben.' });
      return;
    }
    const next = { ...notif, enabled: true };
    setNotif(next);
    await saveNotificationSettings(user.username, next);
    setNotifMsg({ type: 'success', text: 'Benachrichtigungen aktiviert!' });
  };

  const handleSaveNotifications = async () => {
    setSavingNotif(true);
    setNotifMsg({ type: '', text: '' });
    try {
      const days = parseDaysInput(notifDaysText);
      const next = {
        enabled: !!notif.enabled,
        daysBefore: days.length > 0 ? days : DEFAULT_NOTIFICATION_SETTINGS.daysBefore,
        includeIncome: !!notif.includeIncome,
      };
      setNotif(next);
      setNotifDaysText(next.daysBefore.join(', '));
      await saveNotificationSettings(user.username, next);
      setNotifMsg({ type: 'success', text: 'Einstellungen gespeichert.' });
    } catch (err) {
      setNotifMsg({ type: 'error', text: err.message || 'Fehler beim Speichern' });
    } finally {
      setSavingNotif(false);
    }
  };

  const handleTestNotification = async () => {
    setNotifMsg({ type: '', text: '' });
    if (Notification.permission !== 'granted') {
      const perm = await requestNotificationPermission();
      setNotifPerm(perm);
      if (perm !== 'granted') {
        setNotifMsg({ type: 'error', text: 'Bitte erst Benachrichtigungen erlauben.' });
        return;
      }
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification('Fixkosten Tracker', {
          body: 'Test-Erinnerung: So wirst du vor einer Abbuchung informiert.',
          icon: '/fixkostentracker/icon-192x192.png',
          badge: '/fixkostentracker/icon-192x192.png',
          tag: 'test-notification',
          data: { url: '/fixkostentracker/' },
        });
      } else {
        new Notification('Fixkosten Tracker', {
          body: 'Test-Erinnerung: So wirst du vor einer Abbuchung informiert.',
          icon: '/fixkostentracker/icon-192x192.png',
        });
      }
      setNotifMsg({ type: 'success', text: 'Test-Benachrichtigung gesendet.' });
    } catch (err) {
      setNotifMsg({ type: 'error', text: 'Test fehlgeschlagen: ' + err.message });
    }
  };

  const handleRunCheckNow = async () => {
    setNotifMsg({ type: '', text: '' });
    try {
      const res = await checkAndNotify(user.username);
      if (res.reason === 'no-permission') {
        setNotifMsg({ type: 'error', text: 'Keine Berechtigung. Bitte zuerst aktivieren.' });
      } else if (res.reason === 'disabled') {
        setNotifMsg({ type: 'error', text: 'Erinnerungen sind deaktiviert.' });
      } else if (res.reason === 'unsupported') {
        setNotifMsg({ type: 'error', text: 'Nicht unterstützt.' });
      } else {
        setNotifMsg({ type: 'success', text: `${res.shown} Erinnerung(en) ausgelöst (${res.total || 0} anstehende Abbuchungen im Fenster).` });
      }
    } catch (err) {
      setNotifMsg({ type: 'error', text: err.message });
    }
  };

  const resetCatForm = () => {
    setCatName('');
    setCatColor('#3b82f6');
    setCatIcon('📁');
    setEditingCat(null);
    setShowCatForm(false);
  };

  const handleCatSubmit = async (e) => {
    e.preventDefault();
    if (!catName.trim()) return;

    if (editingCat) {
      await updateCategory(user.username, editingCat.id, {
        name: catName, color: catColor, icon: catIcon
      });
    } else {
      await addCategory(user.username, {
        name: catName, color: catColor, icon: catIcon
      });
    }
    resetCatForm();
    await loadCategories();
  };

  const handleEditCat = (cat) => {
    setCatName(cat.name);
    setCatColor(cat.color || '#3b82f6');
    setCatIcon(cat.icon || '📁');
    setEditingCat(cat);
    setShowCatForm(true);
  };

  const handleDeleteCat = async (catId) => {
    await deleteCategory(user.username, catId);
    setDeletingCat(null);
    await loadCategories();
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwMsg({ type: '', text: '' });

    if (newPw !== newPw2) {
      setPwMsg({ type: 'error', text: 'Passwörter stimmen nicht überein' });
      return;
    }

    try {
      await changePassword(oldPw, newPw);
      setPwMsg({ type: 'success', text: 'Passwort wurde geändert!' });
      setOldPw('');
      setNewPw('');
      setNewPw2('');
      setTimeout(() => setShowPwForm(false), 2000);
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message });
    }
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
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Settings className="w-6 h-6 text-primary-400" />
        Einstellungen
      </h1>

      {/* Notifications section */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <BellRing className="w-5 h-5 text-primary-400" />
            Erinnerungen (Push)
          </h2>
          <span className={`text-xs px-2 py-1 rounded-full ${
            notifPerm === 'granted' ? 'bg-green-500/15 text-green-400' :
            notifPerm === 'denied' ? 'bg-red-500/15 text-red-400' :
            'bg-slate-500/15 text-slate-400'
          }`}>
            {notifPerm === 'granted' ? 'Erlaubt' :
             notifPerm === 'denied' ? 'Blockiert' :
             notifPerm === 'unsupported' ? 'Nicht unterstützt' : 'Nicht erlaubt'}
          </span>
        </div>

        <p className="text-sm text-slate-400 mb-4">
          Werde erinnert, bevor eine Abbuchung ansteht. Auf dem iPhone: App über <span className="text-slate-200">Safari → Teilen → Zum Home-Bildschirm</span> installieren, dann Benachrichtigungen erlauben. Erinnerungen werden beim Öffnen der App geprüft.
        </p>

        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-light/50">
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-primary-400" />
              <div>
                <div className="text-sm font-medium text-white">Erinnerungen aktiviert</div>
                <div className="text-xs text-slate-500">Benachrichtige mich vor bevorstehenden Abbuchungen</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={!!notif.enabled}
              onChange={async (e) => {
                const v = e.target.checked;
                if (v && Notification.permission !== 'granted') {
                  await handleEnableNotifications();
                  return;
                }
                const next = { ...notif, enabled: v };
                setNotif(next);
                await saveNotificationSettings(user.username, next);
              }}
              className="w-5 h-5 accent-primary-500"
            />
          </label>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Tage vor Abbuchung erinnern (kommagetrennt, z.B. "3, 1, 0")</label>
            <input
              type="text"
              value={notifDaysText}
              onChange={e => setNotifDaysText(e.target.value)}
              placeholder="3, 1, 0"
              className="w-full px-3 py-2 rounded-lg bg-surface/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white placeholder-slate-500 transition-colors"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {[0, 1, 2, 3, 5, 7, 14].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    const current = parseDaysInput(notifDaysText);
                    const set = new Set(current);
                    if (set.has(d)) set.delete(d); else set.add(d);
                    const arr = Array.from(set).sort((a, b) => b - a);
                    setNotifDaysText(arr.join(', '));
                  }}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                    parseDaysInput(notifDaysText).includes(d)
                      ? 'bg-primary-500/25 text-primary-300 ring-1 ring-primary-500/40'
                      : 'bg-surface-lighter/50 text-slate-400 hover:text-white'
                  }`}
                >
                  {d === 0 ? 'am Tag' : d === 1 ? '1 Tag' : `${d} Tage`}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-surface-light/50">
            <input
              type="checkbox"
              checked={!!notif.includeIncome}
              onChange={e => setNotif({ ...notif, includeIncome: e.target.checked })}
              className="w-4 h-4 accent-primary-500"
            />
            <span className="text-sm text-white">Auch bei Einnahmen erinnern</span>
          </label>

          <AnimatePresence>
            {notifMsg.text && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`text-sm p-3 rounded-lg ${
                  notifMsg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'
                }`}
              >
                {notifMsg.text}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveNotifications}
              disabled={savingNotif}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500 transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" /> Speichern
            </button>
            {notifPerm !== 'granted' && (
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-600 text-white text-sm font-medium hover:bg-accent-500 transition-colors"
              >
                <Bell className="w-4 h-4" /> Aktivieren
              </button>
            )}
            <button
              type="button"
              onClick={handleTestNotification}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-lighter/60 text-slate-200 text-sm font-medium hover:bg-surface-lighter transition-colors"
            >
              <BellRing className="w-4 h-4" /> Test-Benachrichtigung
            </button>
            <button
              type="button"
              onClick={handleRunCheckNow}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-lighter/60 text-slate-200 text-sm font-medium hover:bg-surface-lighter transition-colors"
            >
              Jetzt prüfen
            </button>
          </div>
        </div>
      </div>

      {/* Categories section */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-accent-400" />
            Kategorien
          </h2>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { resetCatForm(); setShowCatForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-500/15 text-accent-400 text-sm font-medium hover:bg-accent-500/25 transition-colors"
          >
            <Plus className="w-4 h-4" /> Neue Kategorie
          </motion.button>
        </div>

        {/* Category form */}
        <AnimatePresence>
          {showCatForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleCatSubmit}
              className="mb-4 overflow-hidden"
            >
              <div className="glass-light rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">
                    {editingCat ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
                  </p>
                  <button type="button" onClick={resetCatForm} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Name</label>
                  <input
                    type="text"
                    value={catName}
                    onChange={e => setCatName(e.target.value)}
                    placeholder="z.B. Streaming, Versicherung..."
                    className="w-full px-3 py-2 rounded-lg bg-surface/80 border border-slate-700 focus:border-accent-500 outline-none text-sm text-white placeholder-slate-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setCatIcon(emoji)}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all duration-200 ${
                          catIcon === emoji
                            ? 'bg-accent-500/30 ring-2 ring-accent-500 scale-110'
                            : 'bg-surface-lighter/50 hover:bg-surface-lighter'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="text"
                      value={customEmoji}
                      onChange={e => setCustomEmoji(e.target.value)}
                      placeholder="Eigenes Emoji eingeben..."
                      className="flex-1 px-3 py-2 rounded-lg bg-surface/80 border border-slate-700 focus:border-accent-500 outline-none text-sm text-white placeholder-slate-500 transition-colors"
                      maxLength={4}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customEmoji.trim()) {
                          setCatIcon(customEmoji.trim());
                          setCustomEmoji('');
                        }
                      }}
                      className="px-3 py-2 rounded-lg bg-accent-500/20 text-accent-400 text-sm font-medium hover:bg-accent-500/30 transition-colors"
                    >
                      Übernehmen
                    </button>
                  </div>
                  {catIcon && !DEFAULT_EMOJIS.includes(catIcon) && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                      <span>Gewählt:</span>
                      <span className="text-xl bg-accent-500/30 rounded-lg w-9 h-9 flex items-center justify-center ring-2 ring-accent-500">{catIcon}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Farbe</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCatColor(color)}
                        className={`w-8 h-8 rounded-full transition-all duration-200 ${
                          catColor === color ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <label className="relative w-9 h-9 rounded-full cursor-pointer overflow-hidden ring-1 ring-slate-600 hover:ring-slate-400 transition-all flex-shrink-0" style={{ backgroundColor: customColor }}>
                      <input
                        type="color"
                        value={customColor}
                        onChange={e => setCustomColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                    <input
                      type="text"
                      value={customColor}
                      onChange={e => {
                        const v = e.target.value;
                        setCustomColor(v);
                        if (/^#[0-9a-fA-F]{6}$/.test(v)) setCatColor(v);
                      }}
                      placeholder="#ff5500"
                      className="flex-1 px-3 py-2 rounded-lg bg-surface/80 border border-slate-700 focus:border-accent-500 outline-none text-sm text-white placeholder-slate-500 transition-colors font-mono"
                      maxLength={7}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (/^#[0-9a-fA-F]{6}$/.test(customColor)) {
                          setCatColor(customColor);
                        }
                      }}
                      className="px-3 py-2 rounded-lg bg-accent-500/20 text-accent-400 text-sm font-medium hover:bg-accent-500/30 transition-colors"
                    >
                      Übernehmen
                    </button>
                  </div>
                  {catColor && !COLOR_OPTIONS.includes(catColor) && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                      <span>Gewählt:</span>
                      <span className="w-6 h-6 rounded-full ring-2 ring-white" style={{ backgroundColor: catColor }} />
                      <span className="font-mono text-xs text-slate-500">{catColor}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-600 text-white text-sm font-medium hover:bg-accent-500 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {editingCat ? 'Speichern' : 'Erstellen'}
                  </button>
                  <button
                    type="button"
                    onClick={resetCatForm}
                    className="px-4 py-2 rounded-lg text-slate-400 text-sm hover:text-white transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Categories list */}
        {categories.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">Noch keine Kategorien angelegt</p>
        ) : (
          <div className="space-y-2">
            {categories.map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-light/50 hover:bg-surface-lighter/30 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{cat.icon}</span>
                  <span className="text-sm font-medium text-white">{cat.name}</span>
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditCat(cat)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {deletingCat === cat.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDeleteCat(cat.id)}
                        className="px-2 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-500"
                      >
                        Ja
                      </button>
                      <button
                        onClick={() => setDeletingCat(null)}
                        className="px-2 py-1 rounded text-xs text-slate-400 hover:text-white"
                      >
                        Nein
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingCat(cat.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Password section */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary-400" />
            Passwort ändern
          </h2>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setShowPwForm(!showPwForm); setPwMsg({ type: '', text: '' }); }}
            className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
          >
            {showPwForm ? 'Abbrechen' : 'Passwort ändern'}
          </motion.button>
        </div>

        <AnimatePresence>
          {showPwForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handlePasswordChange}
              className="overflow-hidden"
            >
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type={showOldPw ? 'text' : 'password'}
                    value={oldPw}
                    onChange={e => setOldPw(e.target.value)}
                    placeholder="Altes Passwort"
                    className="w-full px-4 pr-10 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white placeholder-slate-500 transition-colors"
                  />
                  <button type="button" onClick={() => setShowOldPw(!showOldPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    {showOldPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="Neues Passwort (kann leer sein)"
                    className="w-full px-4 pr-10 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white placeholder-slate-500 transition-colors"
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <input
                  type="password"
                  value={newPw2}
                  onChange={e => setNewPw2(e.target.value)}
                  placeholder="Neues Passwort bestätigen"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-primary-500 outline-none text-sm text-white placeholder-slate-500 transition-colors"
                />

                <AnimatePresence>
                  {pwMsg.text && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`text-sm p-3 rounded-lg ${
                        pwMsg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'
                      }`}
                    >
                      {pwMsg.text}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-500 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Passwort ändern
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* User info */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-3">Konto</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Benutzername</span>
            <span className="text-white">{user?.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Anzeigename</span>
            <span className="text-white">{user?.displayName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Rolle</span>
            <span className={user?.isAdmin ? 'text-amber-400' : 'text-white'}>
              {user?.isAdmin ? 'Administrator' : 'Benutzer'}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
