import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, List, PlusCircle, Settings, LogOut, Menu, X, Shield
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/uebersicht', label: 'Übersicht', icon: List },
  { path: '/eingaben', label: 'Eingaben', icon: PlusCircle },
  { path: '/einstellungen', label: 'Einstellungen', icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav bar */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="glass sticky top-0 z-50 px-4 md:px-6"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <motion.span
              className="text-2xl"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              💰
            </motion.span>
            <span className="text-lg font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
              Fixkosten Tracker
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-surface-lighter/50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute inset-0 bg-gradient-to-r from-primary-600/30 to-accent-600/30 rounded-xl border border-primary-500/30"
                        transition={{ type: 'spring', duration: 0.5 }}
                      />
                    )}
                    <item.icon className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
            {user?.isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? 'text-white'
                      : 'text-amber-400/70 hover:text-amber-300 hover:bg-surface-lighter/50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute inset-0 bg-gradient-to-r from-amber-600/30 to-orange-600/30 rounded-xl border border-amber-500/30"
                        transition={{ type: 'spring', duration: 0.5 }}
                      />
                    )}
                    <Shield className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">Admin</span>
                  </>
                )}
              </NavLink>
            )}
          </div>

          {/* User + logout */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400 hidden sm:block">
              {user?.displayName}
              {user?.isAdmin && (
                <span className="ml-1.5 text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                  Admin
                </span>
              )}
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={logout}
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300"
              title="Abmelden"
            >
              <LogOut className="w-5 h-5" />
            </motion.button>
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden overflow-hidden border-t border-slate-700/50"
            >
              <div className="py-3 space-y-1">
                {navItems.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                        isActive
                          ? 'text-white bg-primary-600/20 border border-primary-500/30'
                          : 'text-slate-400 hover:text-white hover:bg-surface-lighter/50'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </NavLink>
                ))}
                {user?.isAdmin && (
                  <NavLink
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                        isActive
                          ? 'text-amber-300 bg-amber-600/20 border border-amber-500/30'
                          : 'text-amber-400/70 hover:text-amber-300 hover:bg-surface-lighter/50'
                      }`
                    }
                  >
                    <Shield className="w-5 h-5" />
                    Admin
                  </NavLink>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
