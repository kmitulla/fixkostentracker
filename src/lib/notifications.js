import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getFixedCosts, getIncomeSources, getCurrentAmount, isCostActive } from './firestore';

export const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: false,
  daysBefore: [3, 1, 0],
  includeIncome: false,
};

export async function getNotificationSettings(username) {
  const snap = await getDoc(doc(db, 'users', username));
  if (!snap.exists()) return { ...DEFAULT_NOTIFICATION_SETTINGS };
  const s = snap.data().notificationSettings;
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(s || {}) };
}

export async function saveNotificationSettings(username, settings) {
  await updateDoc(doc(db, 'users', username), { notificationSettings: settings });
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a, b) {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86400000);
}

function clampDay(year, month, day) {
  // month 0-based. Clamp to last day of month if day exceeds.
  const last = new Date(year, month + 1, 0).getDate();
  return Math.min(day, last);
}

/**
 * Compute the next upcoming payment date (Date) for a cost/income, >= today.
 * Respects cancelledDate (returns null if cancelled by then).
 */
export function getNextPaymentDate(item, today = new Date()) {
  today = startOfDay(today);
  const cancelled = item.cancelledDate ? startOfDay(item.cancelledDate) : null;
  const start = item.startDate ? startOfDay(item.startDate) : today;

  let candidate = null;

  if (item.frequency === 'yearly') {
    const m = start.getMonth();
    const d = start.getDate();
    let year = today.getFullYear();
    for (let i = 0; i < 3; i++) {
      const day = clampDay(year + i, m, d);
      const dt = new Date(year + i, m, day);
      if (dt >= today && dt >= start) { candidate = dt; break; }
    }
  } else if (item.frequency === 'custom' && item.frequencyMonths && item.frequencyMonths > 0) {
    const step = Number(item.frequencyMonths);
    const d = item.paymentDay || start.getDate();
    // Walk from start in steps of `step` months until we reach >= today
    let year = start.getFullYear();
    let month = start.getMonth();
    // First candidate is start, using paymentDay
    let dt = new Date(year, month, clampDay(year, month, d));
    let guard = 0;
    while (dt < today && guard < 240) {
      month += step;
      year += Math.floor(month / 12);
      month = ((month % 12) + 12) % 12;
      dt = new Date(year, month, clampDay(year, month, d));
      guard++;
    }
    candidate = dt;
  } else {
    // monthly (default)
    const d = item.paymentDay || 1;
    const year = today.getFullYear();
    const month = today.getMonth();
    let dt = new Date(year, month, clampDay(year, month, d));
    if (dt < today) {
      const nm = month + 1;
      const ny = year + Math.floor(nm / 12);
      const nmm = nm % 12;
      dt = new Date(ny, nmm, clampDay(ny, nmm, d));
    }
    if (dt < start) {
      // Monthly recurrence starts at or after startDate
      let y = start.getFullYear();
      let m = start.getMonth();
      dt = new Date(y, m, clampDay(y, m, d));
      if (dt < start) {
        m += 1; y += Math.floor(m / 12); m = m % 12;
        dt = new Date(y, m, clampDay(y, m, d));
      }
    }
    candidate = dt;
  }

  if (!candidate) return null;
  if (cancelled && candidate >= cancelled) return null;
  return candidate;
}

/**
 * List upcoming payments within maxDays from today for active costs/incomes.
 */
export async function getUpcomingPayments(username, { maxDays = 14, includeIncome = false } = {}) {
  const today = startOfDay(new Date());
  const [costs, incomes] = await Promise.all([
    getFixedCosts(username),
    includeIncome ? getIncomeSources(username) : Promise.resolve([]),
  ]);

  const list = [];
  for (const c of costs) {
    if (!isCostActive(c)) continue;
    const next = getNextPaymentDate(c, today);
    if (!next) continue;
    const diff = daysBetween(today, next);
    if (diff >= 0 && diff <= maxDays) {
      list.push({
        id: c.id,
        kind: 'cost',
        name: c.name,
        amount: getCurrentAmount(c),
        date: next,
        daysUntil: diff,
      });
    }
  }
  for (const i of incomes) {
    if (!isCostActive(i)) continue;
    const next = getNextPaymentDate(i, today);
    if (!next) continue;
    const diff = daysBetween(today, next);
    if (diff >= 0 && diff <= maxDays) {
      list.push({
        id: i.id,
        kind: 'income',
        name: i.name,
        amount: getCurrentAmount(i),
        date: next,
        daysUntil: diff,
      });
    }
  }
  list.sort((a, b) => a.date - b.date);
  return list;
}

/* ---------- Permission + Service Worker ---------- */

export function isNotificationSupported() {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator;
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission || 'default';
  }
}

export async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) return reg;
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/* ---------- Notified tracker (localStorage) ---------- */

const NOTIFIED_KEY = (username) => `fixkosten_notified_${username}`;

function loadNotified(username) {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY(username));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveNotified(username, data) {
  try { localStorage.setItem(NOTIFIED_KEY(username), JSON.stringify(data)); } catch { /* ignore */ }
}

function pruneNotified(data) {
  const today = startOfDay(new Date()).getTime();
  const out = {};
  for (const [k, ts] of Object.entries(data)) {
    // keep entries whose payment date is today or in the future (max 60 days old)
    if (typeof ts === 'number' && today - ts < 60 * 86400000) out[k] = ts;
  }
  return out;
}

/**
 * Check upcoming payments and display notifications for those matching daysBefore.
 * Uses localStorage to avoid re-notifying for the same payment occurrence.
 */
export async function checkAndNotify(username) {
  if (!isNotificationSupported()) return { shown: 0, reason: 'unsupported' };
  if (Notification.permission !== 'granted') return { shown: 0, reason: 'no-permission' };

  const settings = await getNotificationSettings(username);
  if (!settings.enabled) return { shown: 0, reason: 'disabled' };

  const daysBefore = Array.isArray(settings.daysBefore) && settings.daysBefore.length > 0
    ? settings.daysBefore : DEFAULT_NOTIFICATION_SETTINGS.daysBefore;
  const maxWindow = Math.max(...daysBefore, 0);

  const upcoming = await getUpcomingPayments(username, {
    maxDays: maxWindow,
    includeIncome: !!settings.includeIncome,
  });

  const reg = await getServiceWorkerRegistration();
  const notified = pruneNotified(loadNotified(username));
  let shown = 0;

  const fmtEUR = (n) => Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  for (const p of upcoming) {
    if (!daysBefore.includes(p.daysUntil)) continue;
    const iso = p.date.toISOString().slice(0, 10);
    const key = `${p.kind}:${p.id}:${iso}:${p.daysUntil}`;
    if (notified[key]) continue;

    const whenLabel = p.daysUntil === 0
      ? 'heute'
      : p.daysUntil === 1 ? 'morgen' : `in ${p.daysUntil} Tagen`;
    const prefix = p.kind === 'income' ? 'Einnahme' : 'Abbuchung';
    const title = `${prefix} ${whenLabel}: ${p.name}`;
    const body = `${fmtEUR(p.amount)} am ${p.date.toLocaleDateString('de-DE')}`;

    try {
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: '/fixkostentracker/icon-192x192.png',
          badge: '/fixkostentracker/icon-192x192.png',
          tag: key,
          data: { url: '/fixkostentracker/' },
        });
      } else {
        new Notification(title, { body, icon: '/fixkostentracker/icon-192x192.png', tag: key });
      }
      notified[key] = Date.now();
      shown++;
    } catch { /* ignore */ }
  }

  saveNotified(username, notified);
  return { shown, total: upcoming.length };
}
