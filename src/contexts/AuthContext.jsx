import { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

// Simple hash for password (not crypto-secure, but fine for this app)
async function hashPassword(password) {
  if (!password) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('fixkosten_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const userRef = doc(db, 'users', username.toLowerCase().trim());
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error('Benutzer nicht gefunden');
    }

    const userData = userSnap.data();

    // If user has no password set (needs to set one on first login)
    if (!userData.passwordHash && userData.needsPassword) {
      return { needsPassword: true, username: username.toLowerCase().trim(), userData };
    }

    // If password is empty and user has empty password
    if (!userData.passwordHash && !password) {
      const loggedInUser = {
        username: username.toLowerCase().trim(),
        displayName: userData.displayName,
        isAdmin: userData.isAdmin || false
      };
      setUser(loggedInUser);
      localStorage.setItem('fixkosten_user', JSON.stringify(loggedInUser));
      return { success: true };
    }

    const hashed = await hashPassword(password);
    if (hashed !== userData.passwordHash) {
      throw new Error('Falsches Passwort');
    }

    const loggedInUser = {
      username: username.toLowerCase().trim(),
      displayName: userData.displayName,
      isAdmin: userData.isAdmin || false
    };
    setUser(loggedInUser);
    localStorage.setItem('fixkosten_user', JSON.stringify(loggedInUser));
    return { success: true };
  };

  const setInitialPassword = async (username, password) => {
    const hashed = await hashPassword(password);
    const userRef = doc(db, 'users', username);
    await updateDoc(userRef, { passwordHash: hashed, needsPassword: false });

    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    const loggedInUser = {
      username,
      displayName: userData.displayName,
      isAdmin: userData.isAdmin || false
    };
    setUser(loggedInUser);
    localStorage.setItem('fixkosten_user', JSON.stringify(loggedInUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('fixkosten_user');
  };

  const changePassword = async (oldPassword, newPassword) => {
    if (!user) throw new Error('Nicht angemeldet');
    const userRef = doc(db, 'users', user.username);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    if (userData.passwordHash) {
      const oldHashed = await hashPassword(oldPassword);
      if (oldHashed !== userData.passwordHash) {
        throw new Error('Altes Passwort ist falsch');
      }
    }

    const newHashed = await hashPassword(newPassword);
    await updateDoc(userRef, { passwordHash: newHashed });
  };

  // Admin functions
  const createUser = async (username, displayName, password) => {
    if (!user?.isAdmin) throw new Error('Keine Berechtigung');
    const userRef = doc(db, 'users', username.toLowerCase().trim());
    const existing = await getDoc(userRef);
    if (existing.exists()) throw new Error('Benutzer existiert bereits');

    const hashed = password ? await hashPassword(password) : '';
    await setDoc(userRef, {
      displayName: displayName || username,
      passwordHash: hashed,
      needsPassword: !password,
      isAdmin: false,
      createdAt: new Date().toISOString()
    });
  };

  const getUsers = async () => {
    if (!user?.isAdmin) throw new Error('Keine Berechtigung');
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  const deleteUser = async (username) => {
    if (!user?.isAdmin) throw new Error('Keine Berechtigung');
    if (username === user.username) throw new Error('Kann sich nicht selbst löschen');
    await deleteDoc(doc(db, 'users', username));
  };

  const updateUser = async (username, updates) => {
    if (!user?.isAdmin) throw new Error('Keine Berechtigung');
    const userRef = doc(db, 'users', username);
    const updateData = {};
    if (updates.displayName !== undefined) updateData.displayName = updates.displayName;
    if (updates.resetPassword) {
      updateData.passwordHash = '';
      updateData.needsPassword = true;
    }
    if (updates.newPassword !== undefined) {
      updateData.passwordHash = await hashPassword(updates.newPassword);
      updateData.needsPassword = false;
    }
    await updateDoc(userRef, updateData);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    setInitialPassword,
    changePassword,
    createUser,
    getUsers,
    deleteUser,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
