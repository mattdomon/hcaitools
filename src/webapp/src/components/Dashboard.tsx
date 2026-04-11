import {
  Activity,
  Users,
  Database,
  CreditCard,
  MessageSquare,
  Zap,
  Shield,
  Bell,
  FileText,
  Workflow,
  Mail,
  Globe,
  Key,
  BarChart3,
  Search,
  Webhook,
  Layers,
  HardDrive,
  Server,
  Play,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ArrowRight,
  Settings,
  Lock,
} from 'lucide-react';

const modules = [
  { id: 'authentication', name: 'Authentication', icon: Shield, color: 'from-emerald-500 to-teal-600', status: 'active', calls: '124.5K' },
  { id: 'payments', name: 'Payments', icon: CreditCard, color: 'from-violet-500 to-purple-600', status: 'active', calls: '89.2K' },
  { id: 'database', name: 'Database', icon: Database, color: 'from-blue-500 to-cyan-600', status: 'active', calls: '312.8K' },
  { id: 'crud', name: 'CRUD Generator', icon: Layers, color: 'from-amber-500 to-orange-600', status: 'active', calls: '156.3K' },
  { id: 'notifications', name: 'Notifications', icon: Bell, color: 'from-cyan-500 to-blue-600', status: 'active', calls: '234.7K' },
  { id: 'chatbot', name: 'AI Chatbot', icon: MessageSquare, color: 'from-indigo-500 to-violet-600', status: 'active', calls: '78.9K' },
  { id: 'analytics', name: 'Analytics', icon: BarChart3, color: 'from-green-500 to-emerald-600', status: 'active', calls: '198.4K' },
  { id: 'search', name: 'Search', icon: Search, color: 'from-red-500 to-pink-600', status: 'active', calls: '145.6K' },
  { id: 'webhooks', name: 'Webhooks', icon: Webhook, color: 'from-teal-500 to-cyan-600', status: 'active', calls: '67.2K' },
  { id: 'fileManager', name: 'File Manager', icon: FileText, color: 'from-yellow-500 to-amber-600', status: 'active', calls: '89.3K' },
  { id: 'formBuilder', name: 'Form Builder', icon: Layers, color: 'from-fuchsia-500 to-pink-600', status: 'active', calls: '56.7K' },
  { id: 'workflow', name: 'Workflow', icon: Workflow, color: 'from-cyan-500 to-blue-600', status: 'active', calls: '34.2K' },
  { id: 'apiFramework', name: 'API Framework', icon: Zap, color: 'from-orange-500 to-red-600', status: 'active', calls: '523.4K' },
  { id: 'email', name: 'Email Service', icon: Mail, color: 'from-blue-500 to-indigo-600', status: 'active', calls: '78.5K' },
  { id: 'rateLimiter', name: 'Rate Limiter', icon: Shield, color: 'from-red-500 to-orange-600', status: 'active', calls: '189.7K' },
  { id: 'cache', name: 'Cache Manager', icon: HardDrive, color: 'from-purple-500 to-violet-600', status: 'active', calls: '267.8K' },
  { id: 'logging', name: 'Logging', icon: Activity, color: 'from-slate-500 to-gray-600', status: 'active', calls: '445.2K' },
  { id: 'security', name: 'Security', icon: Lock, color: 'from-red-500 to-rose-600', status: 'active', calls: '134.6K' },
  { id: 'userManagement', name: 'User Management', icon: Users, color: 'from-blue-500 to-cyan-600', status: 'active', calls: '178.3K' },
  { id: 'i18n', name: 'Internationalization', icon: Globe, color: 'from-emerald-500 to-green-600', status: 'active', calls: '45.9K' },
  { id: 'cloudStorage', name: 'Cloud Storage', icon: Server, color: 'from-cyan-500 to-blue-600', status: 'active', calls: '134.7K' },
  { id: 'apiGateway', name: 'API Gateway', icon: Zap, color: 'from-yellow-500 to-amber-600', status: 'active', calls: '389.2K' },
  { id: 'oauth', name: 'OAuth & SSO', icon: Shield, color: 'from-violet-500 to-purple-600', status: 'active', calls: '67.4K' },
  { id: 'searchEngine', name: 'Search Engine', icon: Search, color: 'from-teal-500 to-cyan-600', status: 'active', calls: '156.8K' },
  { id: 'videoStreaming', name: 'Video Streaming', icon: Play, color: 'from-red-500 to-pink-600', status: 'active', calls: '89.3K' },
  { id: 'socialMedia', name: 'Social Media', icon: MessageSquare, color: 'from-blue-500 to-indigo-600', status: 'active', calls: '45.2K' },
  { id: 'eventSourcing', name: 'Event Sourcing', icon: Activity, color: 'from-amber-500 to-orange-600', status: 'active', calls: '34.7K' },
  { id: 'graphDB', name: 'Graph Database', icon: Activity, color: 'from-emerald-500 to-teal-600', status: 'active', calls: '23.9K' },
  { id: 'timeSeries', name: 'Time Series DB', icon: Activity, color: 'from-cyan-500 to-blue-600', status: 'active', calls: '178.4K' },
  { id: 'web3', name: 'Web3 & Blockchain', icon: Lock, color: 'from-violet-500 to-purple-600', status: 'active', calls: '12.3K' },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Manus AI Platform Overview</p>
        </div>
        <div className="flex items-center gap-4">
          <select className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm">
            <option>Last 24 hours</option>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
          </select>
          <button className="btn-primary flex items-center gap-2">
            <Play className="w-4 h-4" />
            Add Widget
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-6">
        <div className="card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-transparent rounded-bl-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-cyan-400" />
              </div>
              <span className="badge badge-success flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +12.5%
              </span>
            </div>
            <p className="text-3xl font-bold text-white">2.4M</p>
            <p className="text-slate-400 text-sm mt-1">API Calls Today</p>
          </div>
        </div>

        <div className="card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-bl-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-400" />
              </div>
              <span className="badge badge-success flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +8.3%
              </span>
            </div>
            <p className="text-3xl font-bold text-white">12,458</p>
            <p className="text-slate-400 text-sm mt-1">Active Users</p>
          </div>
        </div>

        <div className="card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/20 to-transparent rounded-bl-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-violet-500/20 rounded-xl flex items-center justify-center">
                <Database className="w-6 h-6 text-violet-400" />
              </div>
              <span className="badge badge-warning flex items-center gap-1">
                <TrendingDown className="w-3 h-3" /> -2.1%
              </span>
            </div>
            <p className="text-3xl font-bold text-white">156 GB</p>
            <p className="text-slate-400 text-sm mt-1">Data Processed</p>
          </div>
        </div>

        <div className="card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rose-500/20 to-transparent rounded-bl-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-rose-500/20 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-rose-400" />
              </div>
              <span className="badge badge-error flex items-center gap-1">
                <TrendingDown className="w-3 h-3" /> +0.8%
              </span>
            </div>
            <p className="text-3xl font-bold text-white">0.12%</p>
            <p className="text-slate-400 text-sm mt-1">Error Rate</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Module Status */}
        <div className="col-span-2 card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Module Status</h3>
            <button className="text-primary-400 text-sm hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {modules.slice(0, 12).map((module) => {
              const Icon = module.icon;
              return (
                <div
                  key={module.id}
                  className="bg-slate-800/50 rounded-xl p-4 hover:bg-slate-800 transition-colors cursor-pointer group"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${module.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-white font-medium text-sm">{module.name}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      {module.status}
                    </span>
                    <span className="text-xs text-slate-500">{module.calls}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* System Health */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-6">System Health</h3>
          <div className="space-y-6">
            {[
              { name: 'API Servers', status: 98, color: 'emerald' },
              { name: 'Database Cluster', status: 99, color: 'emerald' },
              { name: 'Cache Layer', status: 95, color: 'cyan' },
              { name: 'Message Queue', status: 97, color: 'emerald' },
              { name: 'Storage', status: 88, color: 'amber' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-300 text-sm">{item.name}</span>
                  <span className="text-slate-400 text-sm">{item.status}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-${item.color}-500 rounded-full`}
                    style={{ width: `${item.status}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Last Health Check</span>
              <span className="text-slate-300 text-sm">2 minutes ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-6">Recent Activity</h3>
          <div className="space-y-4">
            {[
              { user: 'John Doe', action: 'created API key', time: '2 min ago', icon: Key },
              { user: 'Sarah Chen', action: 'deployed workflow', time: '5 min ago', icon: Workflow },
              { user: 'Mike Ross', action: 'updated settings', time: '8 min ago', icon: Settings },
              { user: 'Emily Blunt', action: 'exported data', time: '12 min ago', icon: Database },
              { user: 'Alex Kim', action: 'invited team member', time: '15 min ago', icon: Users },
            ].map((activity, i) => {
              const Icon = activity.icon;
              return (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm">
                      <span className="font-medium">{activity.user}</span>{' '}
                      <span className="text-slate-400">{activity.action}</span>
                    </p>
                    <p className="text-slate-500 text-xs">{activity.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* API Usage Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-6">API Usage (24h)</h3>
          <div className="h-48 flex items-end gap-1">
            {[30, 45, 35, 55, 40, 65, 50, 75, 60, 85, 70, 90, 55, 80, 65, 95, 75, 88, 70, 92, 78, 85, 72, 80].map((value, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-cyan-500 to-blue-500 rounded-t transition-all hover:from-cyan-400 hover:to-blue-400"
                style={{ height: `${value}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-6">Quick Actions</h3>
          <div className="space-y-3">
            {[
              { label: 'Create New API Key', icon: Key, color: 'cyan' },
              { label: 'Deploy Workflow', icon: Play, color: 'emerald' },
              { label: 'View Logs', icon: Activity, color: 'violet' },
              { label: 'Generate Report', icon: BarChart3, color: 'amber' },
              { label: 'Manage Team', icon: Users, color: 'pink' },
            ].map((action, i) => {
              const Icon = action.icon;
              return (
                <button
                  key={i}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <div className={`w-10 h-10 bg-${action.color}-500/20 rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 text-${action.color}-400`} />
                  </div>
                  <span className="text-white font-medium">{action.label}</span>
                  <ArrowRight className="w-5 h-5 text-slate-500 ml-auto" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}