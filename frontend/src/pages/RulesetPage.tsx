import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Globe, Shield, Loader2, Check, X, Clock, Settings, Plus, Trash2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'

interface RuleFile {
  name: string
  url: string
  path: string
  description: string
  size: number
  updatedAt: string
  status: 'pending' | 'downloading' | 'completed' | 'failed'
}

interface CustomRuleEntry {
  name: string
  url: string
  behavior: string
  format: string
  description: string
}

interface RuleSetConfig {
  autoUpdate: boolean
  updateInterval: number
  lastUpdate: string
  githubProxy: string
  githubProxies: string[]
  customProxies: string[]
}

// 默认 GitHub 代理列表
const defaultGitHubProxies = [
  'https://ghfast.top',
  'https://ghproxy.link',
  'https://gh-proxy.com',
  'https://ghps.cc',
]

// API 基础路径
const API_BASE = '/api'

export default function RulesetPage() {
  const { t } = useTranslation()
  const { themeStyle } = useThemeStore()
  const [geoFiles, setGeoFiles] = useState<RuleFile[]>([])
  const [providerFiles, setProviderFiles] = useState<RuleFile[]>([])
  const [customRules, setCustomRules] = useState<CustomRuleEntry[]>([])
  const [customFiles, setCustomFiles] = useState<RuleFile[]>([])
  const [config, setConfig] = useState<RuleSetConfig>({
    autoUpdate: true,
    updateInterval: 1,
    lastUpdate: '',
    githubProxy: '',
    githubProxies: defaultGitHubProxies,
    customProxies: [],
  })
  const [newProxy, setNewProxy] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [saving, setSaving] = useState(false)
  // 新增自定义规则表单
  const [showAddForm, setShowAddForm] = useState(false)
  const [newRule, setNewRule] = useState<CustomRuleEntry>({ name: '', url: '', behavior: 'domain', format: 'mrs', description: '' })
  const [addingRule, setAddingRule] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    loadData()
    const interval = setInterval(checkStatus, 3000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [geoRes, providerRes, configRes, customRes] = await Promise.all([
        fetch(`${API_BASE}/ruleset/geo`).then(r => r.json()),
        fetch(`${API_BASE}/ruleset/providers`).then(r => r.json()),
        fetch(`${API_BASE}/ruleset/config`).then(r => r.json()),
        fetch(`${API_BASE}/ruleset/custom`).then(r => r.json()),
      ])
      setGeoFiles(geoRes.data || [])
      setProviderFiles(providerRes.data || [])
      setCustomRules(customRes.data?.entries || [])
      setCustomFiles(customRes.data?.files || [])
      const loadedConfig = configRes.data || {}
      setConfig({
        autoUpdate: loadedConfig.autoUpdate ?? true,
        updateInterval: loadedConfig.updateInterval ?? 1,
        lastUpdate: loadedConfig.lastUpdate ?? '',
        githubProxy: loadedConfig.githubProxy ?? '',
        githubProxies: loadedConfig.githubProxies?.length ? loadedConfig.githubProxies : defaultGitHubProxies,
        customProxies: loadedConfig.customProxies ?? [],
      })
    } catch {
      // Ignore errors
    } finally {
      setLoading(false)
    }
  }

  const checkStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/ruleset/status`)
      const data = await res.json()
      const status = data.data || {}
      if (!status.updating && updating) {
        loadData()
      }
      setUpdating(status.updating)
    } catch {
      // Ignore
    }
  }

  const handleUpdateAll = async () => {
    try {
      setUpdating(true)
      await fetch(`${API_BASE}/ruleset/update`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubProxy: config.githubProxy })
      })
      alert(t('ruleset.updateStarted') || '开始更新规则文件')
    } catch {
      alert(t('common.error') || '启动更新失败')
      setUpdating(false)
    }
  }

  const handleSaveConfig = async () => {
    try {
      setSaving(true)
      await fetch(`${API_BASE}/ruleset/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      alert(t('common.success') || '配置已保存')
    } catch {
      alert(t('common.error') || '保存配置失败')
    } finally {
      setSaving(false)
    }
  }

  const handleAddCustomRule = async () => {
    if (!newRule.name || !newRule.url) {
      setAddError('名称和 URL 不能为空')
      return
    }
    try {
      setAddingRule(true)
      setAddError('')
      const res = await fetch(`${API_BASE}/ruleset/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      })
      const data = await res.json()
      if (data.code !== 0) {
        setAddError(data.message || '添加失败')
        return
      }
      setNewRule({ name: '', url: '', behavior: 'domain', format: 'mrs', description: '' })
      setShowAddForm(false)
      loadData()
    } catch {
      setAddError('请求失败，请重试')
    } finally {
      setAddingRule(false)
    }
  }

  const handleDeleteCustomRule = async (name: string) => {
    if (!confirm(`确定要删除规则 "${name}" 吗？`)) return
    try {
      await fetch(`${API_BASE}/ruleset/custom/${encodeURIComponent(name)}`, { method: 'DELETE' })
      loadData()
    } catch {
      alert('删除失败')
    }
  }

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '-'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />
      case 'downloading':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'failed':
        return <X className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const completedCount = [...geoFiles, ...providerFiles, ...customFiles].filter(f => f.status === 'completed').length
  const totalCount = geoFiles.length + providerFiles.length + customRules.length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn(
            'text-lg font-semibold',
            themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
          )}>{t('ruleset.title') || '规则集'}</h2>
          <p className={cn(
            'text-sm mt-1',
            themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400'
          )}>
            已下载 {completedCount}/{totalCount} 个规则文件
            {config.lastUpdate && ` · 最后更新: ${config.lastUpdate}`}
          </p>
        </div>
        <button
          onClick={handleUpdateAll}
          disabled={updating}
          className="control-btn primary text-xs"
        >
          {updating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Download className="w-3 h-3" />
          )}
          {updating ? (t('common.updating') || '更新中...') : (t('ruleset.updateAll') || '全部更新')}
        </button>
      </div>

      {/* 配置区域 */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Settings className={cn(
            'h-5 w-5',
            themeStyle === 'apple-glass' ? 'text-slate-600' : 'text-slate-300'
          )} />
          <span className={cn(
            'font-medium',
            themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
          )}>{t('ruleset.settings') || '更新设置'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoUpdate}
              onChange={(e) => setConfig({ ...config, autoUpdate: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className={cn(
              'text-sm',
              themeStyle === 'apple-glass' ? 'text-slate-700' : 'text-slate-300'
            )}>{t('ruleset.autoUpdate') || '自动更新'}</span>
          </label>
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-sm whitespace-nowrap',
              themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400'
            )}>{t('ruleset.interval') || '更新间隔'}:</span>
            <select
              value={config.updateInterval}
              onChange={(e) => setConfig({ ...config, updateInterval: Number(e.target.value) })}
              className="form-input text-sm py-1.5 w-24"
            >
              <option value={1}>1 天</option>
              <option value={2}>2 天</option>
              <option value={3}>3 天</option>
              <option value={5}>5 天</option>
              <option value={7}>7 天</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-sm whitespace-nowrap',
              themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400'
            )}>GitHub代理:</span>
            {config.githubProxy === '__custom__' ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newProxy}
                  onChange={(e) => setNewProxy(e.target.value)}
                  placeholder="https://proxy.example.com"
                  className="form-input text-sm py-1.5 w-48"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (newProxy && newProxy.startsWith('https://')) {
                      const proxies = [...(config.customProxies || []), newProxy]
                      setConfig({ ...config, customProxies: proxies, githubProxy: newProxy })
                      setNewProxy('')
                    }
                  }}
                  disabled={!newProxy || !newProxy.startsWith('https://')}
                  className={cn(
                    'control-btn text-xs px-3 whitespace-nowrap',
                    newProxy && newProxy.startsWith('https://') ? 'primary' : 'secondary opacity-50'
                  )}
                >
                  确定
                </button>
                <button
                  onClick={() => {
                    setConfig({ ...config, githubProxy: '' })
                    setNewProxy('')
                  }}
                  className="control-btn secondary text-xs px-2 whitespace-nowrap"
                >
                  取消
                </button>
              </div>
            ) : (
              <select
                value={config.githubProxy}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setConfig({ ...config, githubProxy: '__custom__' })
                  } else {
                    setConfig({ ...config, githubProxy: e.target.value })
                    setNewProxy('')
                  }
                }}
                className="form-input text-sm py-1.5 w-48"
              >
                <option value="">直连(无代理)</option>
                {config.githubProxies?.filter(p => p).map(proxy => (
                  <option key={proxy} value={proxy}>{proxy.replace('https://', '')}</option>
                ))}
                {config.customProxies?.map(proxy => (
                  <option key={proxy} value={proxy}>★ {proxy.replace('https://', '')}</option>
                ))}
                <option value="__custom__">+ 添加自定义...</option>
              </select>
            )}
          </div>
          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="control-btn secondary text-xs whitespace-nowrap"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            {t('common.save') || '保存设置'}
          </button>
        </div>
      </div>

      {/* GEO 数据库 */}
      <div className="glass-card overflow-hidden">
        <div className={cn(
          'px-4 py-3 border-b flex items-center gap-2',
          themeStyle === 'apple-glass' ? 'border-black/5' : 'border-white/5'
        )}>
          <Globe className="h-5 w-5 text-blue-500" />
          <span className={cn(
            'font-medium',
            themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
          )}>GEO 数据库</span>
          <span className={cn(
            'text-xs',
            themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400'
          )}>({geoFiles.length})</span>
        </div>
        <div className={cn(
          'divide-y',
          themeStyle === 'apple-glass' ? 'divide-black/5' : 'divide-white/5'
        )}>
          {geoFiles.map((file) => (
            <div key={file.name} className={cn(
              'px-4 py-3 flex items-center justify-between',
              themeStyle === 'apple-glass' ? 'hover:bg-black/5' : 'hover:bg-white/5'
            )}>
              <div className="flex items-center gap-3">
                {getStatusIcon(file.status)}
                <div>
                  <div className={cn(
                    'font-medium text-sm',
                    themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
                  )}>{file.name}</div>
                  <div className={cn(
                    'text-xs',
                    themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400'
                  )}>{file.description}</div>
                </div>
              </div>
              <div className={cn(
                'text-right text-sm',
                themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400'
              )}>
                <div>{formatSize(file.size)}</div>
                {file.updatedAt && (
                  <div className="text-xs">{file.updatedAt}</div>
                )}
              </div>
            </div>
          ))}
          {geoFiles.length === 0 && (
            <div className={cn(
              'px-4 py-8 text-center text-sm',
              themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400'
            )}>
              {t('ruleset.noGeoFiles') || '暂无 GEO 数据文件'}
            </div>
          )}
        </div>
      </div>

      {/* 规则提供者 */}
      <div className="glass-card overflow-hidden">
        <div className={cn(
          'px-4 py-3 border-b flex items-center gap-2',
          themeStyle === 'apple-glass' ? 'border-black/5' : 'border-white/5'
        )}>
          <Shield className="h-5 w-5 text-green-500" />
          <span className={cn(
            'font-medium',
            themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
          )}>{t('ruleset.providers') || '规则提供者'}</span>
          <span className={cn(
            'text-xs',
            themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400'
          )}>({providerFiles.length})</span>
        </div>
        <div className={cn(
          'grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0',
          themeStyle === 'apple-glass' ? 'divide-black/5' : 'divide-white/5'
        )}>
          {providerFiles.map((file, index) => (
            <div 
              key={file.name} 
              className={cn(
                'px-4 py-3 flex items-center justify-between',
                themeStyle === 'apple-glass' ? 'hover:bg-black/5' : 'hover:bg-white/5',
                index % 2 === 0 && themeStyle === 'apple-glass' ? 'md:border-r md:border-black/5' : '',
                index % 2 === 0 && themeStyle !== 'apple-glass' ? 'md:border-r md:border-white/5' : '',
                index >= 2 && themeStyle === 'apple-glass' ? 'md:border-t md:border-black/5' : '',
                index >= 2 && themeStyle !== 'apple-glass' ? 'md:border-t md:border-white/5' : ''
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                {getStatusIcon(file.status)}
                <div className="min-w-0">
                  <div className={cn(
                    'font-medium text-sm truncate',
                    themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
                  )}>{file.name}</div>
                  <div className={cn(
                    'text-xs truncate',
                    themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400'
                  )}>{file.description}</div>
                </div>
              </div>
              <div className={cn(
                'text-right text-sm flex-shrink-0 ml-2',
                themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400'
              )}>
                {formatSize(file.size)}
              </div>
            </div>
          ))}
          {providerFiles.length === 0 && (
            <div className={cn(
              'col-span-2 px-4 py-8 text-center text-sm',
              themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400'
            )}>
              {t('ruleset.noProviders') || '暂无规则提供者'}
            </div>
          )}
        </div>
      </div>

      {/* 自定义规则集 */}
      <div className="glass-card overflow-hidden">
        <div className={cn(
          'px-4 py-3 border-b flex items-center justify-between',
          themeStyle === 'apple-glass' ? 'border-black/5' : 'border-white/5'
        )}>
          <div className="flex items-center gap-2">
            <Plus className={cn('h-5 w-5', themeStyle === 'apple-glass' ? 'text-purple-500' : 'text-purple-400')} />
            <span className={cn('font-medium', themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white')}>
              自定义规则集
            </span>
            <span className={cn('text-xs', themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400')}>
              ({customRules.length})
            </span>
          </div>
          <button
            onClick={() => { setShowAddForm(!showAddForm); setAddError('') }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              themeStyle === 'apple-glass'
                ? 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20'
                : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            添加规则
          </button>
        </div>

        {/* 添加表单 */}
        {showAddForm && (
          <div className={cn(
            'p-4 border-b space-y-3',
            themeStyle === 'apple-glass' ? 'bg-purple-500/5 border-black/5' : 'bg-purple-500/10 border-white/5'
          )}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={cn('text-xs font-medium block mb-1', themeStyle === 'apple-glass' ? 'text-slate-600' : 'text-slate-300')}>
                  规则名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={e => setNewRule({ ...newRule, name: e.target.value.replace(/\s/g, '-') })}
                  placeholder="my-custom-rule"
                  className="form-input text-sm w-full"
                />
              </div>
              <div>
                <label className={cn('text-xs font-medium block mb-1', themeStyle === 'apple-glass' ? 'text-slate-600' : 'text-slate-300')}>
                  下载 URL <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newRule.url}
                  onChange={e => setNewRule({ ...newRule, url: e.target.value })}
                  placeholder="https://example.com/rule.mrs"
                  className="form-input text-sm w-full"
                />
              </div>
              <div>
                <label className={cn('text-xs font-medium block mb-1', themeStyle === 'apple-glass' ? 'text-slate-600' : 'text-slate-300')}>
                  规则类型 (Behavior)
                </label>
                <select
                  value={newRule.behavior}
                  onChange={e => setNewRule({ ...newRule, behavior: e.target.value })}
                  className="form-input text-sm w-full"
                >
                  <option value="domain">domain（域名）</option>
                  <option value="ipcidr">ipcidr（IP 段）</option>
                  <option value="classical">classical（经典）</option>
                </select>
              </div>
              <div>
                <label className={cn('text-xs font-medium block mb-1', themeStyle === 'apple-glass' ? 'text-slate-600' : 'text-slate-300')}>
                  文件格式 (Format)
                </label>
                <select
                  value={newRule.format}
                  onChange={e => setNewRule({ ...newRule, format: e.target.value })}
                  className="form-input text-sm w-full"
                >
                  <option value="mrs">mrs（Mihomo 二进制）</option>
                  <option value="yaml">yaml</option>
                  <option value="text">text</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={cn('text-xs font-medium block mb-1', themeStyle === 'apple-glass' ? 'text-slate-600' : 'text-slate-300')}>
                  描述（可选）
                </label>
                <input
                  type="text"
                  value={newRule.description}
                  onChange={e => setNewRule({ ...newRule, description: e.target.value })}
                  placeholder="规则描述..."
                  className="form-input text-sm w-full"
                />
              </div>
            </div>
            {addError && (
              <div className="flex items-center gap-2 text-red-500 text-xs">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {addError}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddCustomRule}
                disabled={addingRule || !newRule.name || !newRule.url}
                className="control-btn primary text-xs"
              >
                {addingRule ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                确认添加
              </button>
              <button
                onClick={() => { setShowAddForm(false); setAddError('') }}
                className="control-btn secondary text-xs"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 自定义规则列表 */}
        <div className={cn('divide-y', themeStyle === 'apple-glass' ? 'divide-black/5' : 'divide-white/5')}>
          {customRules.map((rule, idx) => {
            const file = customFiles[idx]
            return (
              <div key={rule.name} className={cn(
                'px-4 py-3 flex items-center justify-between gap-3',
                themeStyle === 'apple-glass' ? 'hover:bg-black/5' : 'hover:bg-white/5'
              )}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {file ? getStatusIcon(file.status) : <Clock className="h-4 w-4 text-gray-400" />}
                  <div className="min-w-0">
                    <div className={cn('font-medium text-sm truncate', themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white')}>
                      {rule.name}
                      <span className={cn('ml-2 text-xs font-normal px-1.5 py-0.5 rounded', themeStyle === 'apple-glass' ? 'bg-purple-500/10 text-purple-600' : 'bg-purple-500/20 text-purple-300')}>
                        {rule.behavior}
                      </span>
                      <span className={cn('ml-1 text-xs font-normal px-1.5 py-0.5 rounded', themeStyle === 'apple-glass' ? 'bg-slate-500/10 text-slate-500' : 'bg-slate-500/20 text-slate-400')}>
                        {rule.format}
                      </span>
                    </div>
                    <div className={cn('text-xs truncate mt-0.5', themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400')}>
                      {rule.description || rule.url}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {file && (
                    <span className={cn('text-xs', themeStyle === 'apple-glass' ? 'text-slate-400' : 'text-slate-500')}>
                      {formatSize(file.size)}
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteCustomRule(rule.name)}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      themeStyle === 'apple-glass' ? 'text-red-500 hover:bg-red-500/10' : 'text-red-400 hover:bg-red-500/20'
                    )}
                    title="删除此规则"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
          {customRules.length === 0 && (
            <div className={cn('px-4 py-8 text-center text-sm', themeStyle === 'apple-glass' ? 'text-slate-400' : 'text-slate-500')}>
              暂无自定义规则集，点击右上角「添加规则」添加
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
