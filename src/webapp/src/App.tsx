import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Bell,
  Settings,
  ChevronUp,
  ChevronDown,
  Activity,
  AlertCircle,
  Zap,
  Shield,
  BarChart3,
  Search,
  Key,
  Sun,
  Moon,
  Menu,
  Download,
  LayoutGrid,
} from 'lucide-react';

import Dashboard from './components/Dashboard';
import ModuleExplorer from './components/ModuleExplorer';

function App() {
  const [activeView, setActiveView] = useState<'dashboard' | 'modules' | 'analytics' | 'settings'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'modules', label: 'Module Explorer', icon: LayoutGrid },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="flex h-screen">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'w-64' : 'w-20'
          } bg-slate-800 border-r border-slate-700 flex flex-col transition-all duration-300`}
        >
          {/* Logo */}
          <div className="h-16 flex items-center justify-center border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              {sidebarOpen && (
                <div>
                  <h1 className="text-white font-bold text-lg">Manus AI</h1>
                  <p className="text-slate-400 text-xs">Platform</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    activeView === item.id
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {sidebarOpen && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* Bottom Section */}
          <div className="p-4 border-t border-slate-700">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              {sidebarOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search modules, features..."
                  className="w-96 bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-primary-500"
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-slate-600 rounded text-xs text-slate-300">
                  ⌘K
                </kbd>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button className="relative text-slate-400 hover:text-white transition-colors">
                <Bell className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                  3
                </span>
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                {darkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
              </button>
              <div className="flex items-center gap-3 pl-4 border-l border-slate-700">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">M</span>
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">Manus Admin</p>
                  <p className="text-slate-400 text-xs">System Administrator</p>
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6 bg-slate-900">
            {activeView === 'dashboard' && <Dashboard />}
            {activeView === 'modules' && <ModuleExplorer />}
            {activeView === 'analytics' && <AnalyticsView />}
            {activeView === 'settings' && <SettingsView />}
          </div>
        </main>
      </div>
    </div>
  );
}

// Analytics View Component
function AnalyticsView() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Analytics & Reporting</h1>
        <div className="flex gap-2">
          <select className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
          </select>
          <button className="btn-primary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6">
        {[
          { label: 'Total Users', value: '12,458', change: '+12.5%', icon: Users, color: 'cyan' },
          { label: 'Active Sessions', value: '3,842', change: '+8.2%', icon: Activity, color: 'emerald' },
          { label: 'API Calls', value: '1.2M', change: '+23.1%', icon: Zap, color: 'violet' },
          { label: 'Error Rate', value: '0.12%', change: '-5.3%', icon: AlertCircle, color: 'rose' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="card">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-${stat.color}-500/20 flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 text-${stat.color}-400`} />
                </div>
                <span className={`badge ${stat.change.startsWith('+') ? 'badge-success' : 'badge-error'}`}>
                  {stat.change}
                </span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-slate-400 text-sm">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Request Volume</h3>
          <div className="h-64 flex items-end gap-2">
            {[65, 45, 78, 52, 90, 68, 85, 72, 88, 76, 92, 80].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-cyan-500 to-blue-500 rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-400">
            <span>Jan</span>
            <span>Feb</span>
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>Jun</span>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Module Usage Distribution</h3>
          <div className="flex items-center gap-8">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="#334155" strokeWidth="12" fill="none" />
                <circle cx="50" cy="50" r="40" stroke="#0ea5e9" strokeWidth="12" fill="none" strokeDasharray="125.6" strokeDashoffset="0" />
                <circle cx="50" cy="50" r="40" stroke="#8b5cf6" strokeWidth="12" fill="none" strokeDasharray="125.6" strokeDashoffset="87.9" />
                <circle cx="50" cy="50" r="40" stroke="#10b981" strokeWidth="12" fill="none" strokeDasharray="125.6" strokeDashoffset="100.5" />
              </svg>
            </div>
            <div className="space-y-3">
              {[
                { label: 'API Framework', color: 'bg-cyan-500', percent: 35 },
                { label: 'Auth & Security', color: 'bg-violet-500', percent: 25 },
                { label: 'Database', color: 'bg-emerald-500', percent: 20 },
                { label: 'Other', color: 'bg-slate-500', percent: 20 },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded ${item.color}`} />
                  <span className="text-slate-300 text-sm">{item.label}</span>
                  <span className="text-slate-500 text-sm ml-auto">{item.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Recent API Calls</h3>
        <div className="space-y-3">
          {[
            { method: 'GET', path: '/api/users', status: 200, time: '12ms', module: 'User Management' },
            { method: 'POST', path: '/api/auth/login', status: 200, time: '45ms', module: 'Authentication' },
            { method: 'GET', path: '/api/analytics', status: 200, time: '28ms', module: 'Analytics' },
            { method: 'POST', path: '/api/webhooks', status: 201, time: '67ms', module: 'Webhooks' },
            { method: 'PUT', path: '/api/settings', status: 200, time: '34ms', module: 'Settings' },
          ].map((call, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg">
              <span className={`badge ${call.method === 'GET' ? 'badge-info' : call.method === 'POST' ? 'badge-success' : 'badge-warning'}`}>
                {call.method}
              </span>
              <code className="text-slate-300 flex-1">{call.path}</code>
              <span className="text-slate-400 text-sm">{call.module}</span>
              <span className="text-slate-400 text-sm">{call.time}</span>
              <span className="badge badge-success">{call.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Settings View Component
function SettingsView() {
  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <div className="space-y-6">
        {[
          {
            title: 'General',
            description: 'Basic platform settings',
            icon: Settings,
            fields: ['Platform Name', 'Default Language', 'Timezone'],
          },
          {
            title: 'Security',
            description: 'Authentication and encryption',
            icon: Shield,
            fields: ['Password Policy', 'Session Timeout', '2FA'],
          },
          {
            title: 'Notifications',
            description: 'Email, SMS, and push settings',
            icon: Bell,
            fields: ['Email Templates', 'SMS Providers', 'Push Notifications'],
          },
          {
            title: 'API Keys',
            description: 'Manage API access',
            icon: Key,
            fields: ['API Key List', 'Key Rotation', 'Permissions'],
          },
        ].map((section, i) => {
          const Icon = section.icon;
          return (
            <div key={i} className="card">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center">
                  <Icon className="w-6 h-6 text-primary-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                  <p className="text-slate-400 text-sm mb-4">{section.description}</p>
                  <div className="grid grid-cols-3 gap-4">
                    {section.fields.map((field, j) => (
                      <div key={j}>
                        <label className="text-slate-400 text-sm mb-2 block">{field}</label>
                        <select className="input w-full">
                          <option>Enabled</option>
                          <option>Disabled</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-4">
        <button className="btn-secondary">Cancel</button>
        <button className="btn-primary">Save Changes</button>
      </div>
    </div>
  );
}

export default App;