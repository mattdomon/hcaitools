import { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Settings,
  Sun,
  Moon,
  MessageSquare,
  Users,
  CreditCard,
  Database,
  Mail,
  FileText,
  BarChart3,
  Search,
  ChevronRight,
  ChevronDown,
  Plus,
  Globe,
  User,
  Upload,
  Link,
  Brain,
  X,
  Cpu,
  Terminal,
  Circle,
} from 'lucide-react';
import UserCenter from './components/UserCenter';

type Language = 'en' | 'zh';
type Theme = 'light' | 'dark';

interface Project {
  id: string;
  name: string;
  icon: typeof MessageSquare;
  lastMessage?: string;
  time?: string;
}

interface ModelConfig {
  id: string;
  name: string;
  url: string;
  model: string;
  apiKey: string;
}

interface Connector {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: string | null;
}

const translations = {
  en: {
    search: 'Search...',
    newChat: 'New Chat',
    projects: 'Projects',
    settings: 'Settings',
    profile: 'Profile',
    logout: 'Log out',
    leads: 'Leads',
    payments: 'Payments',
    database: 'Database',
    mail: 'Mail',
    documents: 'Documents',
    analytics: 'Analytics',
    notifications: 'Notifications',
    whatCanIDo: 'What can I do for you?',
    createSlides: 'Create slides',
    buildWebsite: 'Build website',
    developApps: 'Develop desktop apps',
    design: 'Design',
    more: 'More',
  },
  zh: {
    search: '搜索...',
    newChat: '新对话',
    projects: '项目',
    settings: '设置',
    profile: '个人资料',
    logout: '退出登录',
    leads: '潜在客户',
    payments: '支付',
    database: '数据库',
    mail: '邮件',
    documents: '文档',
    analytics: '分析',
    notifications: '通知',
    whatCanIDo: '我能为你做什么？',
    createSlides: '创建幻灯片',
    buildWebsite: '构建网站',
    developApps: '开发桌面应用',
    design: '设计',
    more: '更多',
  },
};

const initialProjects: Project[] = [
  { id: '1', name: 'Website Redesign', icon: Globe, lastMessage: 'Updated the landing page', time: '2m ago' },
  { id: '2', name: 'Q4 Sales Report', icon: BarChart3, lastMessage: 'Generated quarterly analysis', time: '1h ago' },
  { id: '3', name: 'Client Onboarding', icon: Users, lastMessage: 'Sent welcome email sequence', time: '3h ago' },
  { id: '4', name: 'Product Launch', icon: Zap, lastMessage: 'Created presentation deck', time: '1d ago' },
];

function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('light');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [projects] = useState<Project[]>(initialProjects);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolData, setToolData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUserCenter, setShowUserCenter] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('auth_token');
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [models, setModels] = useState<ModelConfig[]>(() => {
    const saved = localStorage.getItem('model_list');
    return saved ? JSON.parse(saved) : [];
  });
  const [connectors] = useState<Connector[]>(() => {
    const saved = localStorage.getItem('connectors_list');
    return saved ? JSON.parse(saved) : [];
  });
  const [skills] = useState<{id: string; name: string; description: string}[]>([
    { id: '1', name: 'Web Builder', description: 'Build websites and web apps' },
    { id: '2', name: 'Slides Creator', description: 'Create presentations' },
    { id: '3', name: 'Data Analysis', description: 'Analyze data and generate insights' },
    { id: '4', name: 'Research', description: 'Conduct deep research' },
    { id: '5', name: 'PDF Generator', description: 'Generate PDF documents' },
  ]);
  const [scripts] = useState<{id: string; name: string; description: string}[]>([
    { id: '1', name: 'Python Script', description: 'Run Python code' },
    { id: '2', name: 'JavaScript', description: 'Run JS code' },
    { id: '3', name: 'Bash', description: 'Run shell commands' },
  ]);
  const [showConnectorsDropdown, setShowConnectorsDropdown] = useState(false);
  const [showModelsDropdown, setShowModelsDropdown] = useState(false);
  const [showDefaultModelDropdown, setShowDefaultModelDropdown] = useState(false);
  const [showSkillsDropdown, setShowSkillsDropdown] = useState(false);
  const [showScriptsDropdown, setShowScriptsDropdown] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [conversations, setConversations] = useState<{id: string; title: string; messages: {role: 'user' | 'assistant'; content: string}[]; createdAt: number}[]>(() => {
    const saved = localStorage.getItem('conversations');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(() => {
    const saved = localStorage.getItem('selected_model');
    return saved;
  });
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant'; content: string}[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{name: string; type: string; size: number; data: string}[]>([]);
  const [openclawStatus, setOpenclawStatus] = useState<{running: boolean; port: number; version: string}>({ running: false, port: 8080, version: '1.0.0' });
  const [useOpenClaw, setUseOpenClaw] = useState(false);

  const t = translations[language];

  useEffect(() => {
    const savedModels = localStorage.getItem('model_list');
    if (savedModels) {
      setModels(JSON.parse(savedModels));
    }
  }, []);

  const [, setForceUpdate] = useState(0);

  useEffect(() => {
    const handleStorageChange = () => {
      const savedModels = localStorage.getItem('model_list');
      if (savedModels) {
        setModels(JSON.parse(savedModels));
      }
      setForceUpdate(prev => prev + 1);
    };
    window.addEventListener('storage', handleStorageChange);
    
    const pollData = setInterval(() => {
      const savedModels = localStorage.getItem('model_list');
      if (savedModels) {
        setModels(JSON.parse(savedModels));
      }
    }, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollData);
    };
  }, []);

  useEffect(() => {
    if (selectedModelId) {
      localStorage.setItem('selected_model', selectedModelId);
    }
  }, [selectedModelId]);

  useEffect(() => {
    localStorage.setItem('conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    const fetchOpenClawStatus = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/openclaw/status');
        const data = await response.json();
        if (data.success) {
          setOpenclawStatus(data.status);
        }
      } catch (err) {
        console.error('Failed to fetch OpenClaw status:', err);
      }
    };
    fetchOpenClawStatus();
    const interval = setInterval(fetchOpenClawStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const selectedModel = models.find(m => m.id === selectedModelId);

  const createNewConversation = () => {
    const newId = Date.now().toString();
    setConversations(prev => [{
      id: newId,
      title: messageInput.slice(0, 30) || (language === 'en' ? 'New Chat' : '新对话'),
      messages: [],
      createdAt: Date.now()
    }, ...prev]);
    setCurrentConversationId(newId);
    setChatMessages([]);
    setMessageInput('');
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || isStreaming) return;

    const isOpenClawCommand = messageInput.startsWith('@openclaw ');
    const actualMessage = isOpenClawCommand ? messageInput.slice('@openclaw '.length) : messageInput;

    if (!isOpenClawCommand && !selectedModel) {
      alert(language === 'en' ? 'Please select a model first' : '请先选择一个模型');
      return;
    }

    let convId = currentConversationId;
    if (!convId) {
      convId = Date.now().toString();
      setConversations(prev => [{
        id: convId,
        title: messageInput.slice(0, 30) + '...',
        messages: [],
        createdAt: Date.now()
      }, ...prev]);
      setCurrentConversationId(convId);
    }

    const userMessage = messageInput;
    setMessageInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsStreaming(true);

    try {
      const endpoint = isOpenClawCommand ? '/api/openclaw/chat' : '/api/chat';
      const body = isOpenClawCommand
        ? { message: actualMessage }
        : { message: userMessage, modelConfig: selectedModel };

      const response = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      const assistantMessage = data.success ? (data.response || 'No response') : (data.error || 'Error: ' + data.error);
      
      setChatMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      
      if (convId) {
        setConversations(prev => prev.map(c => 
          c.id === convId 
            ? { 
                ...c, 
                messages: [...c.messages, { role: 'user', content: userMessage }, { role: 'assistant', content: assistantMessage }],
                title: c.messages.length === 0 ? userMessage.slice(0, 30) + '...' : c.title
              } 
            : c
        ));
      }
    } catch (err) {
      const errorMsg = 'Network error: ' + (err instanceof Error ? err.message : 'Unknown error');
      setChatMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
      if (convId) {
        setConversations(prev => prev.map(c => 
          c.id === convId 
            ? { ...c, messages: [...c.messages, { role: 'user', content: userMessage }, { role: 'assistant', content: errorMsg }] } 
            : c
        ));
      }
    }
    setIsStreaming(false);
  };

  const dropdownRef = useRef<HTMLDivElement>(null);
  const defaultModelDropdownRef = useRef<HTMLDivElement>(null);
  const skillsDropdownRef = useRef<HTMLDivElement>(null);
  const scriptsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isOutsideDefaultModel = defaultModelDropdownRef.current && !defaultModelDropdownRef.current.contains(event.target as Node);
      const isOutsideSkills = skillsDropdownRef.current && !skillsDropdownRef.current.contains(event.target as Node);
      const isOutsideScripts = scriptsDropdownRef.current && !scriptsDropdownRef.current.contains(event.target as Node);
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && isOutsideDefaultModel && isOutsideSkills && isOutsideScripts) {
        setShowConnectorsDropdown(false);
        setShowModelsDropdown(false);
        setShowDefaultModelDropdown(false);
        setShowSkillsDropdown(false);
        setShowScriptsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tools = [
    { id: 'leads', name: t.leads, icon: Users, color: 'bg-blue-500', endpoint: '/api/leads' },
    { id: 'payments', name: t.payments, icon: CreditCard, color: 'bg-violet-500', endpoint: '/api/payments/customers' },
    { id: 'database', name: t.database, icon: Database, color: 'bg-cyan-500', endpoint: '/api/database/tables' },
    { id: 'mail', name: t.mail, icon: Mail, color: 'bg-emerald-500', endpoint: '/api/mail/tasks' },
    { id: 'documents', name: t.documents, icon: FileText, color: 'bg-amber-500', endpoint: '/api/stories' },
    { id: 'analytics', name: t.analytics, icon: BarChart3, color: 'bg-rose-500', endpoint: '/api/dashboard/stats' },
  ];

  const handleToolClick = async (toolId: string, endpoint: string) => {
    setActiveTool(toolId);
    setLoading(true);
    setError(null);
    setToolData(null);

    try {
      const response = await fetch(`http://localhost:3000${endpoint}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setToolData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await response.json();
      if (data.success && data.token) {
        localStorage.setItem('auth_token', data.token);
        setAuthToken(data.token);
        setShowLoginModal(false);
        setLoginForm({ email: '', password: '' });
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch (err) {
      setLoginError('Network error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setAuthToken(null);
    setShowUserCenter(false);
  };

  const handleBackToHome = () => {
    setShowUserCenter(false);
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'bg-white' : 'bg-slate-900'}`}>
      <div className="flex h-screen">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'w-64' : 'w-20'
          } ${theme === 'light' ? 'bg-slate-50 border-r border-slate-200' : 'bg-slate-800 border-r border-slate-700'} flex flex-col transition-all duration-300`}
        >
          {/* Logo */}
          <div className={`h-14 flex items-center justify-between px-4 ${theme === 'light' ? 'border-b border-slate-200' : 'border-b border-slate-700'}`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              {sidebarOpen && (
                <span className={`font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  Manus
                </span>
              )}
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-1 rounded ${theme === 'light' ? 'hover:bg-slate-200' : 'hover:bg-slate-700'}`}
            >
              <ChevronRight className={`w-4 h-4 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {sidebarOpen && (
            <>
              {/* New Chat Button */}
              <div className="p-3">
                <button 
                  onClick={createNewConversation}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-700 hover:bg-slate-600 text-white'} transition-colors`}
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">{t.newChat}</span>
                </button>
              </div>

              {/* Search */}
              <div className="px-3 pb-2">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-700/50'}`}>
                  <Search className={`w-4 h-4 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`} />
                  <input
                    type="text"
                    placeholder={t.search}
                    className={`flex-1 bg-transparent text-sm outline-none ${theme === 'light' ? 'text-slate-700 placeholder-slate-400' : 'text-slate-300 placeholder-slate-500'}`}
                  />
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto px-3 py-2">
                <div className={`text-xs font-medium uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                  {language === 'en' ? 'Chats' : '对话'}
                </div>
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => {
                        setCurrentConversationId(conv.id);
                        setChatMessages(conv.messages);
                        setActiveProject(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                        currentConversationId === conv.id
                          ? theme === 'light'
                            ? 'bg-cyan-50 text-cyan-700'
                            : 'bg-slate-700/50 text-cyan-400'
                          : theme === 'light'
                            ? 'text-slate-600 hover:bg-slate-100'
                            : 'text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium truncate">{conv.title}</div>
                        <div className={`text-xs truncate ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                          {conv.messages.length} {language === 'en' ? 'messages' : '条消息'}
                        </div>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setConversations(prev => prev.filter(c => c.id !== conv.id));
                          if (currentConversationId === conv.id) {
                            setCurrentConversationId(null);
                            setChatMessages([]);
                          }
                        }}
                        className={`p-1 rounded hover:${theme === 'light' ? 'bg-slate-200' : 'bg-slate-600'}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {conversations.length === 0 && (
                    <div className={`text-sm py-4 text-center ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {language === 'en' ? 'No conversations yet' : '暂无对话'}
                    </div>
                  )}
                </div>
              </div>

              {/* Tools Section */}
              <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">
                <div className={`text-xs font-medium uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Tools
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {tools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => handleToolClick(tool.id, tool.endpoint)}
                        className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-colors ${
                          activeTool === tool.id
                            ? theme === 'light'
                              ? 'bg-cyan-50 text-cyan-700'
                              : 'bg-slate-700/50 text-cyan-400'
                            : theme === 'light'
                              ? 'text-slate-600 hover:bg-slate-100'
                              : 'text-slate-400 hover:bg-slate-700/50'
                        }`}
                      >
                        <div className={`w-6 h-6 ${tool.color} rounded-md flex items-center justify-center`}>
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-xs truncate">{tool.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Section - User Profile */}
              <div className={`p-3 border-t ${theme === 'light' ? 'border-slate-200' : 'border-slate-700'}`}>
                {authToken ? (
                  <div
                    onClick={() => setShowUserCenter(true)}
                    className={`flex items-center gap-3 p-2 rounded-lg ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-slate-700/50'} cursor-pointer`}
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                        {language === 'en' ? 'My Account' : '我的账户'}
                      </div>
                      <div className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {language === 'en' ? 'View profile' : '查看资料'}
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`} />
                  </div>
                ) : (
                  <div
                    onClick={() => setShowLoginModal(true)}
                    className={`flex items-center gap-3 p-2 rounded-lg ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-slate-700/50'} cursor-pointer`}
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                        {language === 'en' ? 'Sign In' : '登录'}
                      </div>
                      <div className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {language === 'en' ? 'Access your account' : '访问您的账户'}
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`} />
                  </div>
                )}
              </div>
            </>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Minimal Header */}
          <header className={`h-14 flex items-center justify-between px-6 ${theme === 'light' ? 'border-b border-slate-200' : 'border-b border-slate-700'}`}>
            <div className="flex items-center gap-4">
              <h1 className={`text-lg font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                {activeProject ? projects.find(p => p.id === activeProject)?.name : t.whatCanIDo}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleLanguage}
                className={`p-2 rounded-lg transition-colors ${theme === 'light' ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-slate-700 text-slate-400'}`}
                title={language === 'en' ? 'English' : '中文'}
              >
                <Globe className="w-5 h-5" />
              </button>
              <button
                onClick={() => setUseOpenClaw(!useOpenClaw)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${useOpenClaw ? (openclawStatus.running ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700') : (theme === 'light' ? 'bg-slate-100 text-slate-600' : 'bg-slate-700 text-slate-400')}`}
                title={language === 'en' ? 'OpenClaw' : 'OpenClaw'}
              >
                <Circle className={`w-2 h-2 ${openclawStatus.running ? 'fill-green-500 text-green-500' : 'fill-slate-400 text-slate-400'}`} />
                <span className="text-xs font-medium">OpenClaw</span>
              </button>
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition-colors ${theme === 'light' ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-slate-700 text-slate-400'}`}
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
            </div>
          </header>

          {/* Chat/Workspace Area */}
          <div className="flex-1 overflow-y-auto">
            {activeTool ? (
              <div className="h-full p-6">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${tools.find(t => t.id === activeTool)?.color} rounded-xl flex items-center justify-center`}>
                        {(() => {
                          const tool = tools.find(t => t.id === activeTool);
                          if (tool) {
                            const Icon = tool.icon;
                            return <Icon className="w-5 h-5 text-white" />;
                          }
                          return null;
                        })()}
                      </div>
                      <div>
                        <h2 className={`font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                          {tools.find(t => t.id === activeTool)?.name}
                        </h2>
                        <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                          {language === 'en' ? 'Data from backend API' : '后端 API 数据'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTool(null)}
                      className={`px-3 py-1.5 rounded-lg text-sm ${
                        theme === 'light'
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          : 'bg-slate-700 hover:bg-slate-600 text-white'
                      }`}
                    >
                      {language === 'en' ? 'Close' : '关闭'}
                    </button>
                  </div>

                  {loading && (
                    <div className="flex items-center justify-center h-64">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
                    </div>
                  )}

                  {error && (
                    <div className={`p-4 rounded-xl ${theme === 'light' ? 'bg-red-50 text-red-700' : 'bg-red-900/20 text-red-400'}`}>
                      {error}
                    </div>
                  )}

                  {toolData && !loading && (
                    <div className={`rounded-xl p-6 ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-800/50'}`}>
                      <pre className={`text-sm overflow-x-auto ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>
                        {JSON.stringify(toolData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ) : !activeProject ? (
              <div className="h-full flex flex-col items-center justify-center px-6">
                <div className={`text-4xl font-bold mb-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  {t.whatCanIDo}
                </div>
                
                {/* Quick Actions */}
                <div className="flex flex-wrap justify-center gap-3 mt-8 max-w-4xl">
                  <button className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-colors ${
                    theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}>
                    <FileText className="w-5 h-5" />
                    <span>{t.createSlides}</span>
                  </button>
                  <button className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-colors ${
                    theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}>
                    <Globe className="w-5 h-5" />
                    <span>{t.buildWebsite}</span>
                  </button>
                  <button className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-colors ${
                    theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}>
                    <Zap className="w-5 h-5" />
                    <span>{t.developApps}</span>
                  </button>
                  <button className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-colors ${
                    theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}>
                    <BarChart3 className="w-5 h-5" />
                    <span>{t.design}</span>
                  </button>
                  <button className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-colors ${
                    theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}>
                    <ChevronRight className="w-5 h-5" />
                    <span>{t.more}</span>
                  </button>
                </div>

                {/* Chat Messages Display */}
                {chatMessages.length > 0 && (
                  <div className={`w-full max-w-4xl mt-8 space-y-4 max-h-96 overflow-y-auto`}>
                    {chatMessages.map((msg, index) => (
                      <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                          msg.role === 'user'
                            ? 'bg-cyan-500 text-white'
                            : theme === 'light' ? 'bg-slate-200 text-slate-800' : 'bg-slate-700 text-white'
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input Area */}
                <div className={`w-full max-w-4xl mt-12 ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-800'} rounded-2xl p-4`}>
                  {/* Default Model Selector Above Input */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                      {language === 'en' ? 'Default Model:' : '默认模型:'}
                    </span>
                    <div className="relative" ref={defaultModelDropdownRef}>
                      <button 
                        onClick={() => { setShowDefaultModelDropdown(!showDefaultModelDropdown); setShowConnectorsDropdown(false); setShowModelsDropdown(false); }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          theme === 'light'
                            ? 'bg-cyan-100 hover:bg-cyan-200 text-cyan-700'
                            : 'bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-400'
                        }`}>
                        <Brain className="w-4 h-4" />
                        <span>{selectedModel ? (selectedModel.name || selectedModel.model) : (language === 'en' ? 'Select Model' : '选择模型')}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {showDefaultModelDropdown && (
                        <div 
                          className={`absolute top-full left-0 mt-1 w-64 rounded-lg shadow-lg overflow-hidden z-10 ${
                            theme === 'light' ? 'bg-white border border-slate-200' : 'bg-slate-800 border border-slate-700'
                          }`} 
                          onClick={(e) => { e.stopPropagation(); }}
                        >
                          <div className={`px-3 py-2 text-xs font-medium ${
                            theme === 'light' ? 'text-slate-500 bg-slate-50' : 'text-slate-400 bg-slate-700/50'
                          }`}>
                            {language === 'en' ? 'SELECT DEFAULT MODEL' : '选择默认模型'} (models: {models.length})
                          </div>
                          {models.length === 0 ? (
                            <div className={`px-3 py-2 text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                              {language === 'en' ? 'No models configured' : '暂无配置模型'}
                            </div>
                          ) : (
                            models.map(model => (
                              <button 
                                type="button"
                                key={model.id}
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  setSelectedModelId(model.id); 
                                  setShowDefaultModelDropdown(false); 
                                }}
                                className={`w-full text-left px-3 py-2 cursor-pointer hover:bg-slate-100 ${selectedModelId === model.id ? 'bg-cyan-50' : ''}`}
                              >
                                <div className={`text-sm font-medium ${theme === 'light' ? 'text-slate-700' : 'text-white'}`}>
                                  {model.name || model.model}
                                </div>
                                <div className={`text-xs ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {model.url}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <textarea
                    placeholder={t.search}
                    rows={3}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className={`w-full bg-transparent outline-none resize-none ${theme === 'light' ? 'text-slate-700 placeholder-slate-400' : 'text-white placeholder-slate-500'}`}
                  />
                  {uploadedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${theme === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-slate-700 text-slate-300'}`}>
                          <span className="max-w-[120px] truncate">{file.name}</span>
                          <button 
                            onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== index))}
                            className="hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-3" ref={dropdownRef}>
                      <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                        theme === 'light'
                          ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                      }`}>
                        <Upload className="w-4 h-4" />
                        {language === 'en' ? 'Upload' : '上传'}
                        <input 
                          type="file" 
                          multiple
                          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.md,.json"
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            files.forEach(file => {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const data = ev.target?.result as string;
                                setUploadedFiles(prev => [...prev, {
                                  name: file.name,
                                  type: file.type,
                                  size: file.size,
                                  data: data
                                }]);
                              };
                              reader.readAsDataURL(file);
                            });
                          }}
                        />
                      </label>
                      
                      {/* Connectors Dropdown */}
                      <div className="relative">
                        <button 
                          onClick={() => { setShowConnectorsDropdown(!showConnectorsDropdown); setShowModelsDropdown(false); }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            theme === 'light'
                              ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                          }`}>
                          <Link className="w-4 h-4" />
                          {language === 'en' ? 'Connectors' : '连接器'}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {showConnectorsDropdown && (
                          <div className={`absolute bottom-full left-0 mb-2 w-56 rounded-lg shadow-lg overflow-hidden ${
                            theme === 'light' ? 'bg-white border border-slate-200' : 'bg-slate-800 border border-slate-700'
                          }`}>
                            <div className={`px-3 py-2 text-xs font-medium ${
                              theme === 'light' ? 'text-slate-500 bg-slate-50' : 'text-slate-400 bg-slate-700/50'
                            }`}>
                              {language === 'en' ? 'CONNECTORS' : '连接器'}
                            </div>
                            {connectors.length === 0 ? (
                              <div className={`px-3 py-2 text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                {language === 'en' ? 'No connectors configured' : '暂无连接器'}
                              </div>
                            ) : (
                              connectors.map(connector => (
                                <div 
                                  key={connector.id} 
                                  onClick={() => { setMessageInput(prev => prev + (prev ? ' ' : '') + `@${connector.name}`); setShowConnectorsDropdown(false); }}
                                  className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${connector.status === 'connected' ? 'bg-green-500' : 'bg-slate-400'}`} />
                                    <span className={`text-sm ${theme === 'light' ? 'text-slate-700' : 'text-white'}`}>{connector.name}</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Models Dropdown */}
                      <div className="relative">
                        <button 
                          onClick={() => { setShowModelsDropdown(!showModelsDropdown); setShowConnectorsDropdown(false); setShowDefaultModelDropdown(false); }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            theme === 'light'
                              ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                          }`}>
                          <Brain className="w-4 h-4" />
                          {language === 'en' ? 'Models' : '模型'}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {showModelsDropdown && (
                          <div className={`absolute bottom-full left-0 mb-2 w-64 rounded-lg shadow-lg overflow-hidden ${
                            theme === 'light' ? 'bg-white border border-slate-200' : 'bg-slate-800 border border-slate-700'
                          }`}>
                            <div className={`px-3 py-2 text-xs font-medium ${
                              theme === 'light' ? 'text-slate-500 bg-slate-50' : 'text-slate-400 bg-slate-700/50'
                            }`}>
                              {language === 'en' ? 'AI MODELS' : 'AI 模型'}
                            </div>
                            {models.length === 0 ? (
                              <div className={`px-3 py-2 text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                {language === 'en' ? 'No models configured' : '暂无配置模型'}
                              </div>
                            ) : (
                              models.map(model => (
                                <div 
                                  key={model.id} 
                                  onClick={() => { setMessageInput(prev => prev + (prev ? ' ' : '') + `@${model.name || model.model}`); setShowModelsDropdown(false); }}
                                  className={`px-3 py-2 cursor-pointer hover:${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}
                                >
                                  <div className={`text-sm font-medium ${theme === 'light' ? 'text-slate-700' : 'text-white'}`}>
                                    {model.name || model.model}
                                  </div>
                                  <div className={`text-xs ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {model.url}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Skills Dropdown */}
                      <div className="relative" ref={skillsDropdownRef}>
                        <button 
                          onClick={() => { setShowSkillsDropdown(!showSkillsDropdown); setShowScriptsDropdown(false); setShowConnectorsDropdown(false); setShowModelsDropdown(false); }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            theme === 'light'
                              ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                          }`}>
                          <Cpu className="w-4 h-4" />
                          {language === 'en' ? 'Skills' : '技能'}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {showSkillsDropdown && (
                          <div className={`absolute bottom-full left-0 mb-2 w-64 rounded-lg shadow-lg overflow-hidden ${
                            theme === 'light' ? 'bg-white border border-slate-200' : 'bg-slate-800 border border-slate-700'
                          }`}>
                            <div className={`px-3 py-2 text-xs font-medium ${
                              theme === 'light' ? 'text-slate-500 bg-slate-50' : 'text-slate-400 bg-slate-700/50'
                            }`}>
                              {language === 'en' ? 'SKILLS' : '技能'}
                            </div>
                            {skills.length === 0 ? (
                              <div className={`px-3 py-2 text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                {language === 'en' ? 'No skills available' : '暂无技能'}
                              </div>
                            ) : (
                              skills.map(skill => (
                                <div 
                                  key={skill.id} 
                                  onClick={() => { setMessageInput(prev => prev + (prev ? ' ' : '') + `@${skill.name}`); setShowSkillsDropdown(false); }}
                                  className={`px-3 py-2 cursor-pointer hover:${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}
                                >
                                  <div className={`text-sm font-medium ${theme === 'light' ? 'text-slate-700' : 'text-white'}`}>
                                    {skill.name}
                                  </div>
                                  <div className={`text-xs ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {skill.description}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Scripts Dropdown */}
                      <div className="relative" ref={scriptsDropdownRef}>
                        <button 
                          onClick={() => { setShowScriptsDropdown(!showScriptsDropdown); setShowSkillsDropdown(false); setShowConnectorsDropdown(false); setShowModelsDropdown(false); }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            theme === 'light'
                              ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                          }`}>
                          <Terminal className="w-4 h-4" />
                          {language === 'en' ? 'Scripts' : '脚本'}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {showScriptsDropdown && (
                          <div className={`absolute bottom-full left-0 mb-2 w-64 rounded-lg shadow-lg overflow-hidden ${
                            theme === 'light' ? 'bg-white border border-slate-200' : 'bg-slate-800 border border-slate-700'
                          }`}>
                            <div className={`px-3 py-2 text-xs font-medium ${
                              theme === 'light' ? 'text-slate-500 bg-slate-50' : 'text-slate-400 bg-slate-700/50'
                            }`}>
                              {language === 'en' ? 'SCRIPTS' : '脚本'}
                            </div>
                            {scripts.length === 0 ? (
                              <div className={`px-3 py-2 text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                {language === 'en' ? 'No scripts available' : '暂无脚本'}
                              </div>
                            ) : (
                              scripts.map(script => (
                                <div 
                                  key={script.id} 
                                  onClick={() => { setMessageInput(prev => prev + (prev ? ' ' : '') + `@${script.name}`); setShowScriptsDropdown(false); }}
                                  className={`px-3 py-2 cursor-pointer hover:${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}
                                >
                                  <div className={`text-sm font-medium ${theme === 'light' ? 'text-slate-700' : 'text-white'}`}>
                                    {script.name}
                                  </div>
                                  <div className={`text-xs ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {script.description}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={handleSendMessage}
                      disabled={isStreaming || !messageInput.trim()}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isStreaming || !messageInput.trim()
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                      }`}
                    >
                      {isStreaming ? (language === 'en' ? 'Sending...' : '发送中...') : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full p-6">
                <div className={`max-w-3xl mx-auto ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-800/50'} rounded-2xl p-6`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 ${projects.find(p => p.id === activeProject)?.icon ? 'bg-cyan-500' : 'bg-slate-500'} rounded-xl flex items-center justify-center`}>
                      {(() => {
                        const project = projects.find(p => p.id === activeProject);
                        if (project) {
                          const Icon = project.icon;
                          return <Icon className="w-5 h-5 text-white" />;
                        }
                        return null;
                      })()}
                    </div>
                    <div>
                      <h2 className={`font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                        {projects.find(p => p.id === activeProject)?.name}
                      </h2>
                      <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {projects.find(p => p.id === activeProject)?.time}
                      </p>
                    </div>
                  </div>
                  <div className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                    {projects.find(p => p.id === activeProject)?.lastMessage}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-md rounded-2xl p-6 ${theme === 'light' ? 'bg-white' : 'bg-slate-800'}`}>
            <h2 className={`text-xl font-bold mb-6 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
              {language === 'en' ? 'Sign In' : '登录'}
            </h2>

            {loginError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                {loginError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className={`block text-sm mb-1 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                  Email
                </label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  placeholder="admin@manus.ai"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'light'
                      ? 'bg-slate-50 border-slate-200 text-slate-900'
                      : 'bg-slate-700 border-slate-600 text-white'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm mb-1 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                  Password
                </label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="••••••••"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'light'
                      ? 'bg-slate-50 border-slate-200 text-slate-900'
                      : 'bg-slate-700 border-slate-600 text-white'
                  }`}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowLoginModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg border ${
                  theme === 'light'
                    ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    : 'border-slate-600 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {language === 'en' ? 'Cancel' : '取消'}
              </button>
              <button
                onClick={handleLogin}
                disabled={loginLoading}
                className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loginLoading ? '...' : language === 'en' ? 'Sign In' : '登录'}
              </button>
            </div>

            <div className={`mt-4 text-center text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              {language === 'en' ? 'Default account:' : '默认账户：'} admin@manus.ai / admin123
            </div>
          </div>
        </div>
      )}

      {/* User Center Modal */}
      {showUserCenter && authToken && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <UserCenter
            theme={theme}
            language={language}
            onThemeChange={setTheme}
            onLanguageChange={setLanguage}
            onLogout={handleLogout}
            onBackToHome={handleBackToHome}
            token={authToken}
          />
        </div>
      )}
    </div>
  );
}

export default App;