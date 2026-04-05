import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import {
  Shield, UserPlus, Users, Edit3, Trash2, KeyRound, Save, X, Eye, EyeOff, RotateCcw
} from 'lucide-react';

export default function AdminPage() {
  const { user, createUser, getUsers, deleteUser, updateUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Create form
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);

  // Edit form
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPw, setShowEditPw] = useState(false);

  if (!user?.isAdmin) return <Navigate to="/" replace />;

  const loadUsers = async () => {
    try {
      const u = await getUsers();
      setUsers(u);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    try {
      await createUser(newUsername, newDisplayName || newUsername, newPassword);
      setMsg({ type: 'success', text: `Benutzer "${newUsername}" wurde erstellt` });
      setNewUsername('');
      setNewDisplayName('');
      setNewPassword('');
      setShowCreateForm(false);
      await loadUsers();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const handleDelete = async (username) => {
    try {
      await deleteUser(username);
      setMsg({ type: 'success', text: `Benutzer "${username}" wurde gelöscht` });
      setDeleteConfirm(null);
      await loadUsers();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const startEdit = (u) => {
    setEditingUser(u.id);
    setEditDisplayName(u.displayName || '');
    setEditPassword('');
  };

  const handleUpdate = async (username) => {
    try {
      const updates = {};
      if (editDisplayName) updates.displayName = editDisplayName;
      if (editPassword) updates.newPassword = editPassword;
      await updateUser(username, updates);
      setMsg({ type: 'success', text: `Benutzer "${username}" wurde aktualisiert` });
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const handleResetPassword = async (username) => {
    try {
      await updateUser(username, { resetPassword: true });
      setMsg({ type: 'success', text: `Passwort von "${username}" wurde zurückgesetzt. Benutzer kann beim nächsten Login ein neues setzen.` });
      await loadUsers();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-3 border-amber-500/30 border-t-amber-500 rounded-full"
        />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-amber-400" />
          Admin - Benutzerverwaltung
        </h1>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Neuer Benutzer
        </motion.button>
      </div>

      {/* Message */}
      <AnimatePresence>
        {msg.text && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl text-sm ${
              msg.type === 'error'
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-green-500/10 text-green-400 border border-green-500/20'
            }`}
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="overflow-hidden"
          >
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Neuen Benutzer anlegen</h2>
                <button type="button" onClick={() => setShowCreateForm(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Benutzername *</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    placeholder="benutzername"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-amber-500 outline-none text-sm text-white placeholder-slate-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Anzeigename</label>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={e => setNewDisplayName(e.target.value)}
                    placeholder="Max Mustermann"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-amber-500 outline-none text-sm text-white placeholder-slate-500 transition-colors"
                  />
                </div>
                <div className="relative">
                  <label className="block text-xs text-slate-400 mb-1.5">Passwort (optional)</label>
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Leer = User setzt selbst"
                    className="w-full px-4 pr-10 py-2.5 rounded-xl bg-surface-light/80 border border-slate-700 focus:border-amber-500 outline-none text-sm text-white placeholder-slate-500 transition-colors"
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 bottom-2.5 text-slate-400 hover:text-white">
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Wenn kein Passwort vergeben wird, kann der Benutzer beim ersten Login selbst eines festlegen.
              </p>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-500 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Erstellen
                </motion.button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-5 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Users list */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700/50">
          <h2 className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <Users className="w-4 h-4" />
            {users.length} Benutzer
          </h2>
        </div>

        <div>
          {users.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="border-b border-slate-700/30 last:border-b-0"
            >
              <div className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                      u.isAdmin ? 'bg-amber-500/20 text-amber-400' : 'bg-primary-500/20 text-primary-400'
                    }`}>
                      {(u.displayName || u.id).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{u.displayName || u.id}</p>
                        {u.isAdmin && (
                          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Admin</span>
                        )}
                        {u.needsPassword && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Muss PW setzen</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">@{u.id}</p>
                    </div>
                  </div>

                  {u.id !== user.username && !u.isAdmin && (
                    <div className="flex items-center gap-1">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => startEdit(u)}
                        className="p-2 rounded-lg text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 transition-colors"
                        title="Bearbeiten"
                      >
                        <Edit3 className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleResetPassword(u.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                        title="Passwort zurücksetzen"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setDeleteConfirm(u.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  )}
                </div>

                {/* Edit form */}
                <AnimatePresence>
                  {editingUser === u.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 overflow-hidden"
                    >
                      <div className="glass-light rounded-xl p-4 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Anzeigename</label>
                            <input
                              type="text"
                              value={editDisplayName}
                              onChange={e => setEditDisplayName(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-surface/80 border border-slate-700 text-sm text-white outline-none"
                            />
                          </div>
                          <div className="relative">
                            <label className="block text-xs text-slate-400 mb-1">Neues Passwort</label>
                            <input
                              type={showEditPw ? 'text' : 'password'}
                              value={editPassword}
                              onChange={e => setEditPassword(e.target.value)}
                              placeholder="Nur wenn ändern"
                              className="w-full px-3 pr-9 py-2 rounded-lg bg-surface/80 border border-slate-700 text-sm text-white placeholder-slate-500 outline-none"
                            />
                            <button type="button" onClick={() => setShowEditPw(!showEditPw)} className="absolute right-2.5 bottom-2 text-slate-400 hover:text-white">
                              {showEditPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdate(u.id)}
                            className="px-4 py-1.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500 transition-colors"
                          >
                            Speichern
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="px-4 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Delete confirm */}
                <AnimatePresence>
                  {deleteConfirm === u.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 overflow-hidden"
                    >
                      <div className="glass-light rounded-xl p-4 border border-red-500/20">
                        <p className="text-sm text-red-400 mb-2">Benutzer "{u.displayName || u.id}" wirklich löschen?</p>
                        <p className="text-xs text-slate-500 mb-3">Alle Daten dieses Benutzers gehen verloren.</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500"
                          >
                            Endgültig löschen
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-4 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
