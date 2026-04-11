import { useState, useEffect } from 'react';
import {
  User,
  Monitor,
  Bell,
  Settings,
  Trash2,
  Plus,
  LogOut,
  Globe2,
  AlertCircle,
  Clock,
  Zap,
  Cpu,
  Link,
  Puzzle,
  CreditCard,
  Mail,
  Database,
  Play,
  Pause,
  Edit,
  RefreshCw,
  ArrowLeft,
  Brain,
  X,
} from 'lucide-react';

type Language = 'en' | 'zh';
type Theme = 'light' | 'dark';
type TabType = 'account' | 'settings' | 'scheduled-tasks' | 'openclaw' | 'personalization' | 'skills' | 'connectors' | 'integrations' | 'model-config';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  lastName: string;
  role: string;
  status: string;
  emailVerified: boolean;
  profileImageUrl: string | null;
  lastLoginAt: string;
  createdAt: string;
}

interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  schedule: string;
  status: 'active' | 'paused' | 'error';
  lastRun: string | null;
  nextRun: string;
}

interface Connector {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: string | null;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  category: string;
}

interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  icon: string;
}

interface ModelItem {
  id: string;
  name: string;
  url: string;
  model: string;
  apiKey: string;
}

const translations = {
  en: {
    account: 'Account',
    settings: 'Settings',
    scheduledTasks: 'Scheduled Tasks',
    openclaw: 'OpenClaw',
    personalization: 'Personalization',
    skills: 'Skills',
    connectors: 'Connectors',
    integrations: 'Integrations',
    modelConfig: 'Model Config',
    personalInfo: 'Personal Information',
    email: 'Email',
    firstName: 'First Name',
    lastName: 'Last Name',
    role: 'Role',
    status: 'Status',
    memberSince: 'Member since',
    saveChanges: 'Save Changes',
    cancel: 'Cancel',
    changePassword: 'Change Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    passwordUpdated: 'Password updated successfully',
    general: 'General',
    security: 'Security',
    notifications: 'Notifications',
    appearance: 'Appearance',
    language: 'Language',
    timezone: 'Timezone',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    compactMode: 'Compact Mode',
    taskName: 'Task Name',
    schedule: 'Schedule',
    lastRun: 'Last Run',
    nextRun: 'Next Run',
    actions: 'Actions',
    enable: 'Enable',
    disable: 'Disable',
    edit: 'Edit',
    delete: 'Delete',
    pause: 'Pause',
    resume: 'Resume',
    openclawSettings: 'OpenClaw Settings',
    openclawDesc: 'Configure OpenClaw execution environment',
    executionMode: 'Execution Mode',
    local: 'Local',
    cloud: 'Cloud',
    maxConcurrency: 'Max Concurrency',
    timeout: 'Timeout (seconds)',
    personalizationTitle: 'Personalization Settings',
    personalizationDesc: 'Customize your AI assistant behavior',
    defaultTone: 'Default Tone',
    professional: 'Professional',
    friendly: 'Friendly',
    formal: 'Formal',
    defaultLanguage: 'Default Language',
    responseLength: 'Response Length',
    short: 'Short',
    medium: 'Medium',
    long: 'Long',
    skillsTitle: 'Skills & Capabilities',
    skillsDesc: 'Enable or disable AI skills',
    connectorsTitle: 'Connectors',
    connectorsDesc: 'Manage external service connections',
    connected: 'Connected',
    disconnected: 'Disconnected',
    connect: 'Connect',
    sync: 'Sync',
    reconnect: 'Reconnect',
    integrationsTitle: 'Integrations',
    integrationsDesc: 'Third-party integrations',
    enableIntegration: 'Enable',
    disableIntegration: 'Disable',
    logout: 'Log Out',
    verified: 'Verified',
    unverified: 'Unverified',
    active: 'Active',
    inactive: 'Inactive',
    admin: 'Admin',
    user: 'User',
    never: 'Never',
    credits: 'Credits',
    plan: 'Plan',
    teamMembers: 'Team Members',
    billing: 'Billing',
    apiKeys: 'API Keys',
    sessions: 'Sessions',
    preferences: 'Preferences',
  },
  zh: {
    account: '账户',
    settings: '设置',
    scheduledTasks: '定时任务',
    openclaw: 'OpenClaw',
    personalization: '个性化',
    skills: '技能',
    connectors: '连接器',
    integrations: '集成',
    modelConfig: '模型配置',
    personalInfo: '个人信息',
    email: '邮箱',
    firstName: '名',
    lastName: '姓',
    role: '角色',
    status: '状态',
    memberSince: '注册时间',
    saveChanges: '保存更改',
    cancel: '取消',
    changePassword: '修改密码',
    currentPassword: '当前密码',
    newPassword: '新密码',
    confirmPassword: '确认密码',
    passwordUpdated: '密码更新成功',
    general: '通用',
    security: '安全',
    notifications: '通知',
    appearance: '外观',
    language: '语言',
    timezone: '时区',
    theme: '主题',
    light: '浅色',
    dark: '深色',
    compactMode: '紧凑模式',
    taskName: '任务名称',
    schedule: '执行计划',
    lastRun: '上次执行',
    nextRun: '下次执行',
    actions: '操作',
    enable: '启用',
    disable: '禁用',
    edit: '编辑',
    delete: '删除',
    pause: '暂停',
    resume: '恢复',
    openclawSettings: 'OpenClaw 设置',
    openclawDesc: '配置 OpenClaw 执行环境',
    executionMode: '执行模式',
    local: '本地',
    cloud: '云端',
    maxConcurrency: '最大并发数',
    timeout: '超时时间（秒）',
    personalizationTitle: '个性化设置',
    personalizationDesc: '自定义 AI 助手行为',
    defaultTone: '默认语气',
    professional: '专业',
    friendly: '友好',
    formal: '正式',
    defaultLanguage: '默认语言',
    responseLength: '回复长度',
    short: '简短',
    medium: '中等',
    long: '详细',
    skillsTitle: '技能与能力',
    skillsDesc: '启用或禁用 AI 技能',
    connectorsTitle: '连接器',
    connectorsDesc: '管理外部服务连接',
    connected: '已连接',
    disconnected: '已断开',
    connect: '连接',
    sync: '同步',
    reconnect: '重新连接',
    integrationsTitle: '集成',
    integrationsDesc: '第三方集成',
    enableIntegration: '启用',
    disableIntegration: '禁用',
    logout: '退出登录',
    verified: '已验证',
    unverified: '未验证',
    active: '活跃',
    inactive: '不活跃',
    admin: '管理员',
    user: '用户',
    never: '从未',
    credits: '积分',
    plan: '订阅计划',
    teamMembers: '团队成员',
    billing: '账单',
    apiKeys: 'API 密钥',
    sessions: '会话',
    preferences: '偏好设置',
  },
};

interface UserCenterProps {
  theme: Theme;
  language: Language;
  onThemeChange: (theme: Theme) => void;
  onLanguageChange: (language: Language) => void;
  onLogout: () => void;
  onBackToHome: () => void;
  token: string | null;
}

export default function UserCenter({ theme, language, onThemeChange, onLanguageChange, onLogout, onBackToHome, token }: UserCenterProps) {
  const [activeTab, setActiveTab] = useState<TabType>('account');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editProfile, setEditProfile] = useState({ firstName: '', lastName: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>(() => {
    const saved = localStorage.getItem('scheduled_tasks');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Daily Report', description: 'Generate daily analytics report', schedule: '0 9 * * *', status: 'active', lastRun: '2026-04-12 09:00', nextRun: '2026-04-13 09:00' },
      { id: '2', name: 'Weekly Summary', description: 'Send weekly summary email', schedule: '0 10 * * 1', status: 'active', lastRun: '2026-04-06 10:00', nextRun: '2026-04-13 10:00' },
      { id: '3', name: 'Data Backup', description: 'Backup database to cloud', schedule: '0 2 * * *', status: 'paused', lastRun: '2026-04-11 02:00', nextRun: 'Paused' },
      { id: '4', name: 'User Sync', description: 'Sync users from SSO', schedule: '*/15 * * * *', status: 'error', lastRun: '2026-04-12 14:45', nextRun: 'Failed' },
    ];
  });

  useEffect(() => {
    localStorage.setItem('scheduled_tasks', JSON.stringify(scheduledTasks));
  }, [scheduledTasks]);

  const [openclawConfig, setOpenclawConfig] = useState(() => {
    const saved = localStorage.getItem('openclaw_config');
    return saved ? JSON.parse(saved) : {
      executionMode: 'local' as 'local' | 'cloud',
      maxConcurrency: 5,
      timeout: 300,
      token: '',
      apiUrl: 'http://localhost:18789',
      port: 18789,
    };
  });

  const [openclawStatus, setOpenclawStatus] = useState<{running: boolean; port: number; version: string; lastHeartbeat: string | null; authorized: boolean}>({
    running: false,
    port: 8080,
    version: '1.0.0',
    lastHeartbeat: null,
    authorized: false,
  });

  const fetchOpenclawStatus = async () => {
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

  const startOpenClaw = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/openclaw/start', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setOpenclawStatus(data.status);
      }
    } catch (err) {
      console.error('Failed to start OpenClaw:', err);
    }
  };

  const stopOpenClaw = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/openclaw/stop', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setOpenclawStatus(data.status);
      }
    } catch (err) {
      console.error('Failed to stop OpenClaw:', err);
    }
  };

  const saveOpenClawConfig = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/openclaw/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: openclawConfig.token,
          port: openclawConfig.port || 18789,
          apiUrl: openclawConfig.apiUrl || 'http://localhost:18789',
        }),
      });
      const data = await response.json();
      if (data.success) {
        console.log('OpenClaw config saved');
      }
    } catch (err) {
      console.error('Failed to save OpenClaw config:', err);
    }
  };

  useEffect(() => {
    fetchOpenclawStatus();
    const interval = setInterval(fetchOpenclawStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const [personalization, setPersonalization] = useState(() => {
    const saved = localStorage.getItem('personalization');
    return saved ? JSON.parse(saved) : {
      tone: 'professional' as 'professional' | 'friendly' | 'formal',
      defaultLanguage: 'en' as 'en' | 'zh',
      responseLength: 'medium' as 'short' | 'medium' | 'long',
    };
  });

  useEffect(() => {
    localStorage.setItem('openclaw_config', JSON.stringify(openclawConfig));
  }, [openclawConfig]);

  useEffect(() => {
    localStorage.setItem('personalization', JSON.stringify(personalization));
  }, [personalization]);

  const [skills, setSkills] = useState<Skill[]>(() => {
    const saved = localStorage.getItem('skills');
    return saved ? JSON.parse(saved) : [
      { id: 'webapp', name: 'Web App Builder', description: 'Build web applications from descriptions', enabled: true, icon: 'globe' },
      { id: 'slides', name: 'AI Slides', description: 'Create presentations automatically', enabled: true, icon: 'presentation' },
      { id: 'research', name: 'Wide Research', description: 'Deep research on any topic', enabled: true, icon: 'search' },
      { id: 'chat', name: 'AI Chat', description: 'Conversational AI assistant', enabled: true, icon: 'message' },
      { id: 'browser', name: 'Browser Operator', description: 'Control browser remotely', enabled: true, icon: 'monitor' },
      { id: 'mail', name: 'Mail Manus', description: 'Email automation', enabled: true, icon: 'mail' },
      { id: 'database', name: 'Database Manager', description: 'Database operations', enabled: false, icon: 'database' },
      { id: 'payments', name: 'Payments', description: 'Payment processing', enabled: false, icon: 'credit-card' },
    ];
  });

  useEffect(() => {
    localStorage.setItem('skills', JSON.stringify(skills));
  }, [skills]);

  const defaultConnectors: Connector[] = [
    { id: 'instagram', name: 'Instagram', description: '生成并发布 Instagram 帖子、限时动态或 Reels。', icon: 'instagram', status: 'disconnected', lastSync: null },
    { id: 'instagram-creator', name: 'Instagram Creator Marketplace', description: '寻找契合品牌影响力、领域与风格的创作者。', icon: 'instagram', status: 'disconnected', lastSync: null },
    { id: 'meta-ads', name: 'Meta Ads Manager', description: '自动化生成广告洞察与优化方案，以节省时间并最大化利润。', icon: 'meta', status: 'disconnected', lastSync: null },
    { id: 'browser', name: 'My Browser', description: '在你自己 的浏览器上访问网页。', icon: 'browser', status: 'disconnected', lastSync: null },
    { id: 'gmail', name: 'Gmail', description: '撰写邮件，搜索会话并快速生成摘要。', icon: 'gmail', status: 'disconnected', lastSync: null },
    { id: 'google-calendar', name: 'Google Calendar', description: '查看日程安排，优化时间与活动管理。', icon: 'google', status: 'disconnected', lastSync: null },
    { id: 'google-drive', name: 'Google Drive', description: '快速访问文件、智能搜索内容，并让 Manus 协助你更高效地管理文档。', icon: 'google', status: 'disconnected', lastSync: null },
    { id: 'outlook-mail', name: 'Outlook Mail', description: '在 Manus 中无缝写作、搜索并管理你的 Outlook 电子邮件。', icon: 'outlook', status: 'disconnected', lastSync: null },
    { id: 'outlook-calendar', name: 'Outlook Calendar', description: '只需一个提示即可安排、查看并管理你的 Outlook 日程。', icon: 'outlook', status: 'disconnected', lastSync: null },
    { id: 'github', name: 'GitHub', description: '管理代码仓库，协作开发与代码审查。', icon: 'github', status: 'disconnected', lastSync: null },
    { id: 'slack', name: 'Slack', description: '在 Manus 中读写 Slack 对话。', icon: 'slack', status: 'disconnected', lastSync: null },
    { id: 'notion', name: 'Notion', description: '搜索和更新内容，实现自动化流程。', icon: 'notion', status: 'disconnected', lastSync: null },
    { id: 'zapier', name: 'Zapier', description: '连接 Manus，并在数千个应用程序之间实现工作流程自动化。', icon: 'zapier', status: 'disconnected', lastSync: null },
    { id: 'asana', name: 'Asana', description: '使用 Asana 简化项目和任务管理。', icon: 'asana', status: 'disconnected', lastSync: null },
    { id: 'monday', name: 'monday.com', description: '管理任务、看板与项目工作流程。', icon: 'monday', status: 'disconnected', lastSync: null },
    { id: 'make', name: 'Make', description: '将自动化场景转化为AI工具，实现智能流程调用。', icon: 'make', status: 'disconnected', lastSync: null },
    { id: 'linear', name: 'Linear', description: '管理问题、项目和团队工作流进展。', icon: 'linear', status: 'disconnected', lastSync: null },
    { id: 'atlassian', name: 'Atlassian', description: '搜索、创建和管理 Jira、Confluence 和 Compass。', icon: 'atlassian', status: 'disconnected', lastSync: null },
  ];

  const [connectors, setConnectors] = useState<Connector[]>(() => {
    const saved = localStorage.getItem('connectors_list');
    return saved ? JSON.parse(saved) : defaultConnectors;
  });

  useEffect(() => {
    localStorage.setItem('connectors_list', JSON.stringify(connectors));
  }, [connectors]);

  const [integrations, setIntegrations] = useState<Integration[]>(() => {
    const saved = localStorage.getItem('integrations');
    return saved ? JSON.parse(saved) : [
      { id: 'zapier', name: 'Zapier', description: 'Automate workflows', icon: 'zapier', enabled: true, category: 'automation' },
      { id: 'webhook', name: 'Webhooks', description: 'Custom webhook triggers', icon: 'webhook', enabled: true, category: 'automation' },
      { id: 'api', name: 'REST API', description: 'Full API access', icon: 'api', enabled: true, category: 'developer' },
      { id: 'embed', name: 'Embed Widget', description: 'Embed in websites', icon: 'embed', enabled: false, category: 'embedding' },
      { id: 'chrome', name: 'Chrome Extension', description: 'Browser extension', icon: 'chrome', enabled: false, category: 'extension' },
      { id: 'desktop', name: 'Desktop App', description: 'Native desktop app', icon: 'desktop', enabled: false, category: 'app' },
    ];
  });

  useEffect(() => {
    localStorage.setItem('integrations', JSON.stringify(integrations));
  }, [integrations]);

  const [models, setModels] = useState<ModelItem[]>(() => {
    const saved = localStorage.getItem('model_list');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [
      { id: '1', name: 'MiniMax', url: 'https://api.minimax.chat/v1/text/chatcompletion_v2', model: 'MiniMax-Text-01', apiKey: '' }
    ];
  });

  const [showAddModel, setShowAddModel] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelItem | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [activeChatModel, setActiveChatModel] = useState<ModelItem | null>(null);

  const t = translations[language];

  useEffect(() => {
    localStorage.setItem('model_list', JSON.stringify(models));
  }, [models]);

  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token]);

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    if (!token) {
      throw new Error('No token available');
    }
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };
    const response = await fetch(`http://localhost:3000${url}`, { ...options, headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  };

  const fetchProfile = async () => {
    if (!token) return;
    try {
      const data = await fetchWithAuth('/api/profile');
      if (data.success && data.profile) {
        setProfile(data.profile);
        setEditProfile({ firstName: data.profile.name || '', lastName: data.profile.lastName || '' });
      }
    } catch (err) {
      // Silently fail - use default profile data
      console.log('Using default profile data');
    }
  };

  const updateProfile = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await fetchWithAuth('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editProfile),
      });
      if (data.success) {
        setProfile(prev => prev ? { ...prev, name: editProfile.firstName, lastName: editProfile.lastName } : null);
        setSuccess(language === 'en' ? 'Profile updated successfully' : '个人资料更新成功');
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError(language === 'en' ? 'Passwords do not match' : '密码不匹配');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth('/api/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      if (data.success) {
        setSuccess(t.passwordUpdated);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setError(data.error || 'Failed to change password');
      }
    } catch (err) {
      setError('Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading || !activeChatModel) return;
    const userMessage = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          modelConfig: activeChatModel,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response || 'No response' }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Error' }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Network error' }]);
    }
    setChatLoading(false);
  };

  const tabs = [
    { id: 'account' as TabType, label: t.account, icon: User },
    { id: 'settings' as TabType, label: t.settings, icon: Settings },
    { id: 'scheduled-tasks' as TabType, label: t.scheduledTasks, icon: Clock },
    { id: 'openclaw' as TabType, label: t.openclaw, icon: Zap },
    { id: 'personalization' as TabType, label: t.personalization, icon: Cpu },
    { id: 'skills' as TabType, label: t.skills, icon: Cpu },
    { id: 'connectors' as TabType, label: t.connectors, icon: Link },
    { id: 'integrations' as TabType, label: t.integrations, icon: Puzzle },
    { id: 'model-config' as TabType, label: t.modelConfig, icon: Brain },
  ];

  const getSkillIcon = (iconName: string) => {
    switch (iconName) {
      case 'globe': return <Globe2 className="w-5 h-5" />;
      case 'presentation': return <CreditCard className="w-5 h-5" />;
      case 'search': return <Bell className="w-5 h-5" />;
      case 'message': return <Mail className="w-5 h-5" />;
      case 'monitor': return <Monitor className="w-5 h-5" />;
      case 'mail': return <Mail className="w-5 h-5" />;
      case 'database': return <Database className="w-5 h-5" />;
      case 'credit-card': return <CreditCard className="w-5 h-5" />;
      default: return <Zap className="w-5 h-5" />;
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-900'}`}>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToHome}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              {language === 'en' ? 'Back' : '返回'}
            </button>
            <h1 className={`text-2xl font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
              {t.settings}
            </h1>
          </div>
          <button
            onClick={onLogout}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              theme === 'light' ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-red-900/20 hover:bg-red-900/30 text-red-400'
            }`}
          >
            <LogOut className="w-4 h-4" />
            {t.logout}
          </button>
        </div>

        <div className="flex gap-6">
          <div className={`w-56 rounded-xl ${theme === 'light' ? 'bg-white' : 'bg-slate-800'} p-3 h-fit`}>
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                      activeTab === tab.id
                        ? theme === 'light' ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-700/50 text-cyan-400'
                        : theme === 'light' ? 'text-slate-600 hover:bg-slate-50' : 'text-slate-400 hover:bg-slate-700/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className={`flex-1 rounded-xl ${theme === 'light' ? 'bg-white' : 'bg-slate-800'} p-6`}>
            {error && (
              <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                {success}
              </div>
            )}

            {activeTab === 'model-config' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>AI Model Configuration</h2>
                    <p className={`text-sm mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Manage your AI model connections</p>
                  </div>
                  <button
                    onClick={() => { setEditingModel({ id: '', name: '', url: '', model: '', apiKey: '' }); setShowAddModel(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />Add Model
                  </button>
                </div>
                <div className="space-y-3">
                  {models.length === 0 ? (
                    <div className={`text-center py-8 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>No models configured. Click "Add Model" to get started.</div>
                  ) : (
                    models.map((m) => (
                      <div key={m.id} className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${m.apiKey ? 'bg-green-500/20' : 'bg-slate-500/20'}`}>
                              <Brain className={`w-5 h-5 ${m.apiKey ? 'text-green-500' : 'text-slate-400'}`} />
                            </div>
                            <div>
                              <p className={`font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{m.name || m.model}</p>
                              <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{m.url}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setEditingModel(m); setShowAddModel(true); }} className={`p-2 rounded-lg ${theme === 'light' ? 'hover:bg-slate-200' : 'hover:bg-slate-600'}`} title="Edit"><Edit className="w-4 h-4" /></button>
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch('http://localhost:3000/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ message: 'Hi', modelConfig: m }) });
                                  const data = await response.json();
                                  setSuccess(data.success ? 'Connection successful!' : (data.error || 'Connection failed'));
                                  setError(null);
                                } catch { setError('Connection failed'); }
                              }}
                              className={`px-3 py-1.5 rounded-lg text-sm ${theme === 'light' ? 'bg-slate-200 hover:bg-slate-300' : 'bg-slate-600 hover:bg-slate-500'}`}
                            >Connect</button>
                            <button
                              onClick={() => { setActiveChatModel(m); setChatMessages([]); setChatInput(''); setShowChatModal(true); }}
                              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm"
                            >Chat</button>
                            <button onClick={() => { setModels(prev => prev.filter(x => x.id !== m.id)); }} className={`p-2 rounded-lg ${theme === 'light' ? 'hover:bg-red-50 text-red-600' : 'hover:bg-red-900/20 text-red-400'}`} title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'skills' && (
              <div className="space-y-6">
                <div>
                  <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t.skillsTitle}</h2>
                  <p className={`text-sm mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{t.skillsDesc}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {skills.map((skill) => (
                    <div key={skill.id} className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${skill.enabled ? 'bg-cyan-500/20 text-cyan-500' : 'bg-slate-300/20 text-slate-400'}`}>{getSkillIcon(skill.icon)}</div>
                          <span className={`font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{skill.name}</span>
                        </div>
                        <div className={`relative w-11 h-6 rounded-full transition-colors ${skill.enabled ? 'bg-cyan-500' : theme === 'light' ? 'bg-slate-300' : 'bg-slate-600'}`}>
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${skill.enabled ? 'left-6' : 'left-1'}`} />
                        </div>
                      </div>
                      <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{skill.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'connectors' && (
              <div className="space-y-6">
                <div>
                  <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t.connectorsTitle}</h2>
                  <p className={`text-sm mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{t.connectorsDesc}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {connectors.map((connector) => (
                    <div key={connector.id} className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${connector.status === 'connected' ? 'bg-green-500/20 text-green-500' : 'bg-slate-500/20 text-slate-400'}`}>
                            <Link className="w-4 h-4" />
                          </div>
                          <span className={`font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{connector.name}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          connector.status === 'connected' ? 'bg-green-100 text-green-700' : 
                          connector.status === 'error' ? 'bg-red-100 text-red-700' : 
                          theme === 'light' ? 'bg-slate-200 text-slate-600' : 'bg-slate-600 text-slate-300'
                        }`}>
                          {connector.status === 'connected' ? (language === 'en' ? 'Connected' : '已连接') : 
                           connector.status === 'error' ? (language === 'en' ? 'Error' : '错误') : 
                           (language === 'en' ? 'Disconnected' : '未连接')}
                        </span>
                      </div>
                      <p className={`text-sm mb-3 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{connector.description}</p>
                      <button 
                        onClick={() => {
                          if (connector.status === 'connected') {
                            setConnectors(prev => prev.map(c => c.id === connector.id ? { ...c, status: 'disconnected' } : c));
                          } else {
                            setConnectors(prev => prev.map(c => c.id === connector.id ? { ...c, status: 'connected' } : c));
                          }
                        }}
                        className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          connector.status === 'connected' 
                            ? (language === 'en' ? 'bg-red-100 hover:bg-red-200 text-red-700' : 'bg-red-900/20 hover:bg-red-900/30 text-red-400')
                            : (language === 'en' ? 'bg-cyan-500 hover:bg-cyan-600 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white')
                        }`}
                      >
                        {connector.status === 'connected' ? (language === 'en' ? 'Disconnect' : '断开连接') : (language === 'en' ? 'Connect' : '连接')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="space-y-6">
                <div>
                  <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t.account}</h2>
                  <p className={`text-sm mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Manage your account settings</p>
                </div>
                <div className={`p-6 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-cyan-500 flex items-center justify-center">
                      <span className="text-2xl text-white font-bold">{profile?.name?.charAt(0).toUpperCase() || 'A'}</span>
                    </div>
                    <div>
                      <p className={`font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{profile?.name || 'Admin User'}</p>
                      <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{profile?.email || 'admin@manus.ai'}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>Email</span>
                      <span className={`text-sm font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{profile?.email || 'admin@manus.ai'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>Plan</span>
                      <span className={`text-sm font-medium px-2 py-1 rounded-full bg-cyan-100 text-cyan-700`}>Pro</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>Member since</span>
                      <span className={`text-sm font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>2024-01-01</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div>
                  <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t.settings}</h2>
                  <p className={`text-sm mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Application settings</p>
                </div>
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{language === 'en' ? 'Dark Mode' : '深色模式'}</span>
                      <button 
                        onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
                        className={`w-11 h-6 rounded-full transition-colors ${theme === 'light' ? 'bg-slate-300' : 'bg-cyan-500'}`}
                      >
                        <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${theme === 'light' ? 'translate-x-1' : 'translate-x-6'}`} />
                      </button>
                    </div>
                    <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{language === 'en' ? 'Toggle between light and dark theme' : '在浅色和深色主题之间切换'}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{language === 'en' ? 'Language' : '语言'}</span>
                      <select 
                        value={language} 
                        onChange={(e) => onLanguageChange(e.target.value as 'en' | 'zh')}
                        className={`px-3 py-1 rounded-lg border text-sm ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-600 border-slate-500 text-white'}`}
                      >
                        <option value="en">English</option>
                        <option value="zh">中文</option>
                      </select>
                    </div>
                    <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{language === 'en' ? 'Select your preferred language' : '选择您的首选语言'}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{language === 'en' ? 'Notifications' : '通知'}</span>
                      <button className={`w-11 h-6 rounded-full bg-cyan-500`}>
                        <span className="block w-4 h-4 bg-white rounded-full translate-x-6" />
                      </button>
                    </div>
                    <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{language === 'en' ? 'Receive notifications for updates' : '接收更新通知'}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'scheduled-tasks' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t.scheduledTasks}</h2>
                    <p className={`text-sm mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Manage automated scheduled tasks</p>
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors">
                    <Plus className="w-4 h-4" />{language === 'en' ? 'Add Task' : '添加任务'}
                  </button>
                </div>
                <div className="space-y-3">
                  {scheduledTasks.map((task) => (
                    <div key={task.id} className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${task.status === 'active' ? 'bg-green-500/20 text-green-500' : task.status === 'error' ? 'bg-red-500/20 text-red-500' : 'bg-slate-500/20 text-slate-400'}`}>
                            <Clock className="w-4 h-4" />
                          </div>
                          <div>
                            <p className={`font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{task.name}</p>
                            <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{task.schedule}</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          task.status === 'active' ? 'bg-green-100 text-green-700' : 
                          task.status === 'error' ? 'bg-red-100 text-red-700' : 
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {task.status}
                        </span>
                      </div>
                      <p className={`text-sm mb-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{task.description}</p>
                      <div className="flex items-center gap-4 text-xs">
                        <span className={theme === 'light' ? 'text-slate-400' : 'text-slate-500'}>Last: {task.lastRun}</span>
                        <span className={theme === 'light' ? 'text-slate-400' : 'text-slate-500'}>Next: {task.nextRun}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'openclaw' && (
              <div className="space-y-6">
                <div>
                  <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t.openclawSettings}</h2>
                  <p className={`text-sm mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{t.openclawDesc}</p>
                </div>
                
                <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${openclawStatus.running ? 'bg-green-500' : 'bg-slate-400'}`} />
                        <span className={`font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                          {openclawStatus.running ? (language === 'en' ? 'Running' : '运行中') : (language === 'en' ? 'Stopped' : '已停止')}
                        </span>
                        {openclawStatus.running && (
                          <span className={`px-2 py-0.5 rounded text-xs ${openclawStatus.authorized ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {openclawStatus.authorized ? (language === 'en' ? 'Authorized' : '已授权') : (language === 'en' ? 'Unauthorized' : '未授权')}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {language === 'en' ? 'Port' : '端口'}: {openclawStatus.port} | Version: {openclawStatus.version}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!openclawStatus.running ? (
                        <button
                          onClick={startOpenClaw}
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          {language === 'en' ? 'Start' : '启动'}
                        </button>
                      ) : (
                        <button
                          onClick={stopOpenClaw}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          {language === 'en' ? 'Stop' : '停止'}
                        </button>
                      )}
                      <button
                        onClick={fetchOpenclawStatus}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${theme === 'light' ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-600 hover:bg-slate-500 text-white'}`}
                      >
                        {language === 'en' ? 'Refresh' : '刷新'}
                      </button>
                    </div>
                  </div>
                  {openclawStatus.lastHeartbeat && (
                    <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                      {language === 'en' ? 'Last heartbeat' : '最后心跳'}: {new Date(openclawStatus.lastHeartbeat).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{language === 'en' ? 'Execution Mode' : '执行模式'}</label>
                    <select 
                      value={openclawConfig.executionMode}
                      onChange={(e) => setOpenclawConfig({ ...openclawConfig, executionMode: e.target.value as 'local' | 'cloud' })}
                      className={`w-full px-3 py-2 rounded-lg border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-600 border-slate-500 text-white'}`}
                    >
                      <option value="local">{language === 'en' ? 'Local' : '本地'}</option>
                      <option value="cloud">{language === 'en' ? 'Cloud' : '云端'}</option>
                    </select>
                  </div>
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{language === 'en' ? 'Max Concurrency' : '最大并发数'}</label>
                    <input 
                      type="number" 
                      value={openclawConfig.maxConcurrency}
                      onChange={(e) => setOpenclawConfig({ ...openclawConfig, maxConcurrency: parseInt(e.target.value) || 1 })}
                      className={`w-full px-3 py-2 rounded-lg border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-600 border-slate-500 text-white'}`}
                      min="1"
                      max="20"
                    />
                  </div>
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{language === 'en' ? 'Timeout (seconds)' : '超时时间（秒）'}</label>
                    <input 
                      type="number" 
                      value={openclawConfig.timeout}
                      onChange={(e) => setOpenclawConfig({ ...openclawConfig, timeout: parseInt(e.target.value) || 30 })}
                      className={`w-full px-3 py-2 rounded-lg border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-600 border-slate-500 text-white'}`}
                      min="10"
                      max="600"
                    />
                  </div>
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{language === 'en' ? 'Gateway Token' : '网关令牌'}</label>
                    <input 
                      type="password" 
                      value={openclawConfig.token || ''}
                      onChange={(e) => setOpenclawConfig({ ...openclawConfig, token: e.target.value })}
                      placeholder={language === 'en' ? 'Enter your OpenClaw gateway token' : '输入您的 OpenClaw 网关令牌'}
                      className={`w-full px-3 py-2 rounded-lg border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-600 border-slate-500 text-white'}`}
                    />
                    <p className={`text-xs mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                      {language === 'en' ? 'Found in OpenClaw settings under Gateway > Authentication' : '在 OpenClaw 设置中的网关 > 身份验证下找到'}
                    </p>
                  </div>
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{language === 'en' ? 'API URL' : 'API 地址'}</label>
                    <input 
                      type="text" 
                      value={openclawConfig.apiUrl || 'http://localhost:18789'}
                      onChange={(e) => setOpenclawConfig({ ...openclawConfig, apiUrl: e.target.value })}
                      placeholder="http://localhost:18789"
                      className={`w-full px-3 py-2 rounded-lg border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-600 border-slate-500 text-white'}`}
                    />
                  </div>
                  <button
                    onClick={saveOpenClawConfig}
                    className={`w-full py-2 rounded-lg font-medium transition-colors ${
                      theme === 'light' 
                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {language === 'en' ? 'Save Configuration' : '保存配置'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'personalization' && (
              <div className="space-y-6">
                <div>
                  <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t.personalizationTitle}</h2>
                  <p className={`text-sm mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{t.personalizationDesc}</p>
                </div>
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{language === 'en' ? 'Tone' : '语气'}</label>
                    <select 
                      value={personalization.tone}
                      onChange={(e) => setPersonalization({ ...personalization, tone: e.target.value as 'professional' | 'friendly' | 'formal' })}
                      className={`w-full px-3 py-2 rounded-lg border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-600 border-slate-500 text-white'}`}
                    >
                      <option value="professional">{language === 'en' ? 'Professional' : '专业'}</option>
                      <option value="friendly">{language === 'en' ? 'Friendly' : '友好'}</option>
                      <option value="formal">{language === 'en' ? 'Formal' : '正式'}</option>
                    </select>
                  </div>
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{language === 'en' ? 'Default Language' : '默认语言'}</label>
                    <select 
                      value={personalization.defaultLanguage}
                      onChange={(e) => setPersonalization({ ...personalization, defaultLanguage: e.target.value as 'en' | 'zh' })}
                      className={`w-full px-3 py-2 rounded-lg border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-600 border-slate-500 text-white'}`}
                    >
                      <option value="en">{language === 'en' ? 'English' : '英文'}</option>
                      <option value="zh">{language === 'en' ? 'Chinese' : '中文'}</option>
                    </select>
                  </div>
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{language === 'en' ? 'Response Length' : '回复长度'}</label>
                    <select 
                      value={personalization.responseLength}
                      onChange={(e) => setPersonalization({ ...personalization, responseLength: e.target.value as 'short' | 'medium' | 'long' })}
                      className={`w-full px-3 py-2 rounded-lg border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-600 border-slate-500 text-white'}`}
                    >
                      <option value="short">{language === 'en' ? 'Short' : '简短'}</option>
                      <option value="medium">{language === 'en' ? 'Medium' : '中等'}</option>
                      <option value="long">{language === 'en' ? 'Long' : '详细'}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'integrations' && (
              <div className="space-y-6">
                <div>
                  <h2 className={`text-lg font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t.integrationsTitle || 'Integrations'}</h2>
                  <p className={`text-sm mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{t.integrationsDesc || 'Connect third-party services'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {integrations.map((integration) => (
                    <div key={integration.id} className={`p-4 rounded-lg ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${integration.enabled ? 'bg-cyan-500/20 text-cyan-500' : 'bg-slate-500/20 text-slate-400'}`}>
                            <Puzzle className="w-4 h-4" />
                          </div>
                          <span className={`font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{integration.name}</span>
                        </div>
                        <button 
                          onClick={() => setIntegrations(prev => prev.map(i => i.id === integration.id ? { ...i, enabled: !i.enabled } : i))}
                          className={`w-11 h-6 rounded-full transition-colors ${integration.enabled ? 'bg-cyan-500' : theme === 'light' ? 'bg-slate-300' : 'bg-slate-600'}`}
                        >
                          <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${integration.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{integration.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showChatModal && activeChatModel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-lg rounded-2xl ${theme === 'light' ? 'bg-white' : 'bg-slate-800'} overflow-hidden`}>
            <div className={`flex items-center justify-between p-4 border-b ${theme === 'light' ? 'border-slate-200' : 'border-slate-700'}`}>
              <h3 className={`font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Chat Test</h3>
              <button onClick={() => setShowChatModal(false)} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-slate-700'}`}><X className="w-5 h-5" /></button>
            </div>
            <div className={`p-4 border-b ${theme === 'light' ? 'border-slate-200' : 'border-slate-700'}`}>
              <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Model: {activeChatModel.model} | {activeChatModel.url}</p>
            </div>
            <div className="h-80 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && <div className={`text-center py-8 text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Start a conversation to test the model</div>}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${msg.role === 'user' ? 'bg-cyan-500 text-white' : theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-700 text-white'}`}><p className="text-sm whitespace-pre-wrap">{msg.content}</p></div>
                </div>
              ))}
              {chatLoading && <div className="flex justify-start"><div className={`px-4 py-2 rounded-2xl ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-700'}`}><div className="flex gap-1"><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" /><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} /><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} /></div></div></div>}
            </div>
            <div className={`p-4 border-t ${theme === 'light' ? 'border-slate-200' : 'border-slate-700'}`}>
              <div className="flex gap-2">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="Type a message..." className={`flex-1 px-3 py-2 rounded-lg border ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-700 border-slate-600 text-white'}`} />
                <button onClick={handleSendMessage} disabled={chatLoading || !chatInput.trim()} className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModel && editingModel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-md rounded-2xl ${theme === 'light' ? 'bg-white' : 'bg-slate-800'} p-6`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{models.find(m => m.id === editingModel.id) ? 'Edit Model' : 'Add Model'}</h3>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm mb-1 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Model Name</label>
                <input type="text" value={editingModel.name} onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })} className={`w-full px-3 py-2 rounded-lg border ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-700 border-slate-600 text-white'}`} placeholder="MiniMax" />
              </div>
              <div>
                <label className={`block text-sm mb-1 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>API URL</label>
                <input type="text" value={editingModel.url} onChange={(e) => setEditingModel({ ...editingModel, url: e.target.value })} className={`w-full px-3 py-2 rounded-lg border ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-700 border-slate-600 text-white'}`} placeholder="https://api.minimax.chat/v1/text/chatcompletion_v2" />
              </div>
              <div>
                <label className={`block text-sm mb-1 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Model</label>
                <input type="text" value={editingModel.model} onChange={(e) => setEditingModel({ ...editingModel, model: e.target.value })} className={`w-full px-3 py-2 rounded-lg border ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-700 border-slate-600 text-white'}`} placeholder="MiniMax-Text-01" />
              </div>
              <div>
                <label className={`block text-sm mb-1 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>API Key</label>
                <input type="password" value={editingModel.apiKey} onChange={(e) => setEditingModel({ ...editingModel, apiKey: e.target.value })} className={`w-full px-3 py-2 rounded-lg border ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-700 border-slate-600 text-white'}`} placeholder="Enter API key" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowAddModel(false); setEditingModel(null); }} className={`flex-1 px-4 py-2 rounded-lg border ${theme === 'light' ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-slate-600 text-slate-400 hover:bg-slate-700'}`}>Cancel</button>
              <button onClick={() => {
                if (models.find(m => m.id === editingModel.id)) {
                  setModels(prev => prev.map(m => m.id === editingModel.id ? editingModel : m));
                } else {
                  setModels(prev => [...prev, { ...editingModel, id: Date.now().toString() }]);
                }
                setShowAddModel(false);
                setEditingModel(null);
              }} className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}