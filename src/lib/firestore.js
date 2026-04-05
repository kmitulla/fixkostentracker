import { db } from './firebase';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
  query, where, orderBy, getDoc, setDoc
} from 'firebase/firestore';

// --- Categories ---
export async function getCategories(username) {
  const snapshot = await getDocs(
    query(collection(db, 'users', username, 'categories'), orderBy('name'))
  );
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addCategory(username, category) {
  return await addDoc(collection(db, 'users', username, 'categories'), {
    name: category.name,
    color: category.color || '#3b82f6',
    icon: category.icon || '📁',
    createdAt: new Date().toISOString()
  });
}

export async function updateCategory(username, categoryId, updates) {
  await updateDoc(doc(db, 'users', username, 'categories', categoryId), updates);
}

export async function deleteCategory(username, categoryId) {
  await deleteDoc(doc(db, 'users', username, 'categories', categoryId));
}

// --- Fixed Costs ---
export async function getFixedCosts(username) {
  const snapshot = await getDocs(
    query(collection(db, 'users', username, 'fixedCosts'), orderBy('name'))
  );
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addFixedCost(username, cost) {
  return await addDoc(collection(db, 'users', username, 'fixedCosts'), {
    name: cost.name,
    categoryId: cost.categoryId || '',
    paymentDay: cost.paymentDay || 1,
    frequency: cost.frequency || 'monthly', // monthly, yearly, custom
    frequencyMonths: cost.frequencyMonths || 1, // for custom: every X months
    startDate: cost.startDate || new Date().toISOString().slice(0, 10),
    cancelledDate: cost.cancelledDate || null,
    notes: cost.notes || '',
    // Amount history: array of { amount, validFrom }
    amountHistory: cost.amountHistory || [{
      amount: cost.amount || 0,
      validFrom: cost.startDate || new Date().toISOString().slice(0, 10)
    }],
    createdAt: new Date().toISOString()
  });
}

export async function updateFixedCost(username, costId, updates) {
  await updateDoc(doc(db, 'users', username, 'fixedCosts', costId), updates);
}

export async function deleteFixedCost(username, costId) {
  await deleteDoc(doc(db, 'users', username, 'fixedCosts', costId));
}

// --- Utility functions ---
export function getCurrentAmount(cost) {
  if (!cost.amountHistory || cost.amountHistory.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...cost.amountHistory].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  const current = sorted.find(h => h.validFrom <= today);
  return current ? current.amount : sorted[sorted.length - 1].amount;
}

export function getMonthlyAmount(cost) {
  const amount = getCurrentAmount(cost);
  if (cost.frequency === 'monthly') return amount;
  if (cost.frequency === 'yearly') return amount / 12;
  if (cost.frequency === 'custom' && cost.frequencyMonths) return amount / cost.frequencyMonths;
  return amount;
}

export function getYearlyAmount(cost) {
  const amount = getCurrentAmount(cost);
  if (cost.frequency === 'yearly') return amount;
  if (cost.frequency === 'monthly') return amount * 12;
  if (cost.frequency === 'custom' && cost.frequencyMonths) return (amount / cost.frequencyMonths) * 12;
  return amount * 12;
}

export function isCostActive(cost) {
  if (!cost.cancelledDate) return true;
  return new Date(cost.cancelledDate) > new Date();
}

export function getFrequencyLabel(cost) {
  if (cost.frequency === 'monthly') return 'Monatlich';
  if (cost.frequency === 'yearly') return 'Jährlich';
  if (cost.frequency === 'custom') return `Alle ${cost.frequencyMonths} Monate`;
  return cost.frequency;
}
