import { useState } from 'react';
import {
  Shield,
  CreditCard,
  Database,
  MessageSquare,
  Zap,
  Lock,
  FileText,
  Workflow,
  Mail,
  Globe,
  Key,
  BarChart3,
  Search,
  Webhook,
  Layers,
  GitBranch,
  Share2,
  HardDrive,
  Server,
  Play,
  CheckCircle,
  ChevronRight,
  ChevronDown,
  Code,
  Users,
  Activity,
  TrendingUp,
  Building,
  Link,
  Clipboard,
  Timer,
} from 'lucide-react';

const modules = [
  {
    category: 'Authentication & Security',
    items: [
      { id: 'userManagement', name: 'User Management', icon: Users, status: 'active', description: 'User registration, profiles, and account management', endpoints: 24 },
      { id: 'authentication', name: 'Authentication', icon: Shield, status: 'active', description: 'JWT tokens, OAuth 2.0, SSO integration', endpoints: 18 },
      { id: 'oauth', name: 'OAuth & SSO', icon: Key, status: 'active', description: 'Social login, identity federation, SAML', endpoints: 12 },
      { id: 'security', name: 'Security & Encryption', icon: Lock, status: 'active', description: 'AES-256, hashing, key management', endpoints: 15 },
      { id: 'apiKeys', name: 'API Key Management', icon: Key, status: 'active', description: 'Key generation, rotation, scoped permissions', endpoints: 8 },
    ],
  },
  {
    category: 'Data & Storage',
    items: [
      { id: 'database', name: 'Database', icon: Database, status: 'active', description: 'PostgreSQL schema, migrations, CRUD operations', endpoints: 32 },
      { id: 'crudGenerator', name: 'CRUD Generator', icon: Layers, status: 'active', description: 'Auto-generated CRUD interfaces with validation', endpoints: 16 },
      { id: 'cache', name: 'Cache Manager', icon: HardDrive, status: 'active', description: 'In-memory cache with TTL, Redis support', endpoints: 10 },
      { id: 'fileManager', name: 'File Manager', icon: FileText, status: 'active', description: 'Upload, download, folder structure, versioning', endpoints: 14 },
      { id: 'cloudStorage', name: 'Cloud Storage', icon: Server, status: 'active', description: 'S3, Google Cloud, Azure integration', endpoints: 12 },
      { id: 'timeSeries', name: 'Time Series DB', icon: Activity, status: 'active', description: 'Metrics, aggregation, retention policies', endpoints: 9 },
      { id: 'graphDB', name: 'Graph Database', icon: GitBranch, status: 'active', description: 'Neo4j-style queries, traversal, path finding', endpoints: 11 },
    ],
  },
  {
    category: 'Integrations',
    items: [
      { id: 'payments', name: 'Payments', icon: CreditCard, status: 'active', description: 'Stripe integration, subscriptions, refunds', endpoints: 28 },
      { id: 'slack', name: 'Slack Integration', icon: MessageSquare, status: 'active', description: 'Messaging, notifications, workflows', endpoints: 22 },
      { id: 'email', name: 'Email Service', icon: Mail, status: 'active', description: 'SMTP, SendGrid, Mailgun support', endpoints: 10 },
      { id: 'sms', name: 'SMS Service', icon: MessageSquare, status: 'active', description: 'Twilio, Vonage, AWS SNS', endpoints: 8 },
      { id: 'webhooks', name: 'Webhook Manager', icon: Webhook, status: 'active', description: 'Event delivery, retry logic, signatures', endpoints: 6 },
      { id: 'socialMedia', name: 'Social Media', icon: Share2, status: 'active', description: 'Twitter, Facebook, Instagram APIs', endpoints: 18 },
    ],
  },
  {
    category: 'AI & Automation',
    items: [
      { id: 'chatbot', name: 'AI Chatbot', icon: MessageSquare, status: 'active', description: 'LLM integration, intent recognition, tool calling', endpoints: 15 },
      { id: 'workflow', name: 'Workflow Automation', icon: Workflow, status: 'active', description: 'Visual flow builder, triggers, actions', endpoints: 20 },
      { id: 'formBuilder', name: 'Form Builder', icon: Layers, status: 'active', description: 'Drag-drop fields, validation, conditional logic', endpoints: 12 },
      { id: 'search', name: 'Search & Filtering', icon: Search, status: 'active', description: 'Full-text search, faceted filtering, geo-search', endpoints: 14 },
    ],
  },
  {
    category: 'Analytics & Monitoring',
    items: [
      { id: 'analytics', name: 'Analytics & Reporting', icon: BarChart3, status: 'active', description: 'Event tracking, dashboards, reports', endpoints: 25 },
      { id: 'logging', name: 'Logging & Monitoring', icon: Activity, status: 'active', description: 'Structured logging, metrics, alerting', endpoints: 14 },
      { id: 'auditTrail', name: 'Audit Trail', icon: Shield, status: 'active', description: 'GDPR, HIPAA, SOC2 compliance', endpoints: 10 },
    ],
  },
  {
    category: 'API & Infrastructure',
    items: [
      { id: 'apiFramework', name: 'REST API Framework', icon: Zap, status: 'active', description: 'Routing, middleware, rate limiting', endpoints: 45 },
      { id: 'apiGateway', name: 'API Gateway', icon: Zap, status: 'active', description: 'Load balancing, service discovery', endpoints: 20 },
      { id: 'rateLimiter', name: 'Rate Limiting', icon: Shield, status: 'active', description: 'Token bucket, sliding window', endpoints: 6 },
    ],
  },
  {
    category: 'Advanced Features',
    items: [
      { id: 'i18n', name: 'Internationalization', icon: Globe, status: 'active', description: 'Multi-language, RTL, formatting', endpoints: 8 },
      { id: 'pdf', name: 'PDF Generation', icon: FileText, status: 'active', description: 'HTML to PDF, templates, encryption', endpoints: 8 },
      { id: 'video', name: 'Video Streaming', icon: Play, status: 'active', description: 'Transcoding, HLS, adaptive bitrate', endpoints: 12 },
      { id: 'web3', name: 'Web3 & Blockchain', icon: Lock, status: 'active', description: 'Wallets, smart contracts, NFTs', endpoints: 15 },
      { id: 'multiTenant', name: 'Multi-Tenant', icon: Building, status: 'active', description: 'Tenant isolation, billing', endpoints: 14 },
    ],
  },
];

export default function ModuleExplorer() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Authentication & Security');
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredModules = modules
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  return (
    <div className="h-full flex gap-6">
      {/* Left Panel - Module List */}
      <div className="w-96 flex flex-col bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-primary-500"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex-1 overflow-auto">
          {filteredModules.map((category) => (
            <div key={category.category}>
              <button
                onClick={() =>
                  setExpandedCategory(expandedCategory === category.category ? null : category.category)
                }
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-700/50 hover:bg-slate-700 transition-colors"
              >
                <span className="text-slate-300 text-sm font-medium">{category.category}</span>
                {expandedCategory === category.category ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {expandedCategory === category.category && (
                <div className="divide-y divide-slate-700">
                  {category.items.map((module) => {
                    const Icon = module.icon;
                    return (
                      <button
                        key={module.id}
                        onClick={() => setSelectedModule(module)}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors ${
                          selectedModule?.id === module.id ? 'bg-primary-600/20 border-l-2 border-primary-500' : ''
                        }`}
                      >
                        <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-slate-300" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-white text-sm font-medium">{module.name}</p>
                          <p className="text-slate-400 text-xs">{module.endpoints} endpoints</p>
                        </div>
                        <span className="badge badge-success text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {module.status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Module Details */}
      <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
        {selectedModule ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                    {(() => {
                      const Icon = selectedModule.icon;
                      return <Icon className="w-8 h-8 text-white" />;
                    })()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedModule.name}</h2>
                    <p className="text-slate-400 mt-1">{selectedModule.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary flex items-center gap-2">
                    <Link className="w-4 h-4" />
                    Docs
                  </button>
                  <button className="btn-primary flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    API Reference
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 mt-6">
                {[
                  { label: 'Endpoints', value: selectedModule.endpoints, icon: Zap },
                  { label: 'Uptime', value: '99.9%', icon: Activity },
                  { label: 'Latency', value: '45ms', icon: Timer },
                  { label: 'Requests', value: '12.4K', icon: TrendingUp },
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className="bg-slate-700/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                        <Icon className="w-4 h-4" />
                        {stat.label}
                      </div>
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tabs */}
            <div className="px-6 border-b border-slate-700 flex gap-4">
              {['Overview', 'Endpoints', 'Examples', 'Logs'].map((tab, i) => (
                <button
                  key={tab}
                  className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                    i === 0
                      ? 'border-primary-500 text-primary-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {/* Endpoints */}
              <div className="space-y-4">
                {[
                  { method: 'GET', path: '/api/v1/' + selectedModule.id, description: 'List all ' + selectedModule.name.toLowerCase() },
                  { method: 'POST', path: '/api/v1/' + selectedModule.id, description: 'Create new ' + selectedModule.name.toLowerCase().slice(0, -1) },
                  { method: 'GET', path: '/api/v1/' + selectedModule.id + '/{id}', description: 'Get ' + selectedModule.name.toLowerCase().slice(0, -1) + ' by ID' },
                  { method: 'PUT', path: '/api/v1/' + selectedModule.id + '/{id}', description: 'Update ' + selectedModule.name.toLowerCase().slice(0, -1) },
                  { method: 'DELETE', path: '/api/v1/' + selectedModule.id + '/{id}', description: 'Delete ' + selectedModule.name.toLowerCase().slice(0, -1) },
                ].map((endpoint, i) => (
                  <div
                    key={i}
                    className="bg-slate-700/50 rounded-lg p-4 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`badge ${
                          endpoint.method === 'GET'
                            ? 'badge-info'
                            : endpoint.method === 'POST'
                            ? 'badge-success'
                            : endpoint.method === 'PUT'
                            ? 'badge-warning'
                            : 'badge-error'
                        }`}
                      >
                        {endpoint.method}
                      </span>
                      <code className="text-cyan-400 flex-1">{endpoint.path}</code>
                    </div>
                    <p className="text-slate-400 text-sm mt-2 ml-16">{endpoint.description}</p>
                  </div>
                ))}
              </div>

              {/* Code Example */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-white mb-4">Example Request</h3>
                <div className="bg-slate-900 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                    <span className="text-slate-400 text-sm">bash</span>
                    <button className="text-slate-400 hover:text-white">
                      <Clipboard className="w-4 h-4" />
                    </button>
                  </div>
                  <pre className="p-4 text-sm overflow-x-auto">
                    <code className="text-slate-300">
{`curl -X GET "https://api.manus.ai/v1/${selectedModule.id}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"

Response:
{
  "data": [
    {
      "id": "${selectedModule.id.slice(0, 4)}_abc123",
      "name": "Example",
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "per_page": 20
  }
}`}
                    </code>
                  </pre>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Layers className="w-10 h-10 text-slate-500" />
              </div>
              <p className="text-slate-400">Select a module to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}