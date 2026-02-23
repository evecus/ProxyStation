import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Settings, Server, Shield, Zap, Globe, RefreshCw, 
  RotateCcw, Monitor, Smartphone, Minimize2, ChevronDown, ChevronUp,
  Loader2, Network, Lock, Plus, Trash2, Radio, Shuffle, Laptop, Router
} from 'lucide-react'
import { proxySettingsApi, ProxySettings, SettingsPreset, AuthUser } from '@/api/proxySettings'
import { proxyApi, TransparentMode, ProxyScope } from '@/api/proxy'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'

// 设置分组组件
function SettingsSection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = true,
  themeStyle
}: { 
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
  themeStyle: string
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between p-4 transition-colors',
          themeStyle === 'apple-glass' 
            ? 'hover:bg-black/5' 
            : 'hover:bg-white/5'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            themeStyle === 'apple-glass'
              ? 'bg-blue-500/10 text-blue-600'
              : 'bg-cyan-500/20 text-cyan-400'
          )}>
            <Icon className="w-4 h-4" />
          </div>
          <span className={cn(
            'font-medium text-sm',
            themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
          )}>{title}</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div className={cn(
          'p-4 pt-0 space-y-4',
          themeStyle === 'apple-glass' ? 'border-t border-black/5' : 'border-t border-white/5'
        )}>
          {children}
        </div>
      )}
    </div>
  )
}

// 表单控件组件
function FormField({ 
  label, 
  description, 
  children,
  themeStyle
}: { 
  label: React.ReactNode
  description?: string
  children: React.ReactNode
  themeStyle: string
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 py-2">
      <div className="flex-1 min-w-0">
        <div className={cn(
          'text-sm font-medium',
          themeStyle === 'apple-glass' ? 'text-slate-700' : 'text-slate-200'
        )}>{label}</div>
        {description && (
          <div className={cn(
            'text-xs mt-0.5',
            themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400'
          )}>{description}</div>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

// 开关组件
function Toggle({ 
  checked, 
  onChange,
  themeStyle
}: { 
  checked: boolean
  onChange: (checked: boolean) => void
  themeStyle: string
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-11 h-6 rounded-full transition-colors',
        checked 
          ? themeStyle === 'apple-glass' ? 'bg-blue-500' : 'bg-cyan-500'
          : themeStyle === 'apple-glass' ? 'bg-slate-300' : 'bg-slate-600'
      )}
    >
      <div className={cn(
        'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
        checked ? 'translate-x-[22px]' : 'translate-x-0.5'
      )} />
    </button>
  )
}

// 选择器组件
function Select({ 
  value, 
  onChange, 
  options,
  themeStyle
}: { 
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  themeStyle: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'px-3 py-1.5 rounded-lg text-sm border appearance-none cursor-pointer min-w-[120px]',
        themeStyle === 'apple-glass'
          ? 'bg-white/60 border-black/10 text-slate-700'
          : 'bg-white/10 border-white/10 text-white'
      )}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} className="bg-slate-800 text-white">
          {opt.label}
        </option>
      ))}
    </select>
  )
}

// 数字输入组件
function NumberInput({ 
  value, 
  onChange, 
  min = 0, 
  max,
  themeStyle,
  disabled = false
}: { 
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  themeStyle: string
  disabled?: boolean
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      disabled={disabled}
      className={cn(
        'px-3 py-1.5 rounded-lg text-sm border w-24 text-center transition-opacity',
        themeStyle === 'apple-glass'
          ? 'bg-white/60 border-black/10 text-slate-700'
          : 'bg-white/10 border-white/10 text-white',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    />
  )
}

// 文本输入组件
function TextInput({ 
  value, 
  onChange,
  placeholder,
  themeStyle
}: { 
  value: string
  onChange: (value: string) => void
  placeholder?: string
  themeStyle: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'px-3 py-1.5 rounded-lg text-sm border w-full sm:w-48',
        themeStyle === 'apple-glass'
          ? 'bg-white/60 border-black/10 text-slate-700 placeholder:text-slate-400'
          : 'bg-white/10 border-white/10 text-white placeholder:text-slate-500'
      )}
    />
  )
}

export default function ProxySettingsPage() {
  const { t } = useTranslation()
  const { themeStyle } = useThemeStore()
  const [settings, setSettings] = useState<ProxySettings | null>(null)
  const [presets, setPresets] = useState<SettingsPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [transparentMode, setTransparentMode] = useState<TransparentMode>('off')
  const [proxyScope, setProxyScope] = useState<ProxyScope>('local')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [settingsData, presetsData, statusData] = await Promise.all([
        proxySettingsApi.getSettings(),
        proxySettingsApi.getPresets(),
        proxyApi.getStatus().catch(() => null)
      ])
      setSettings(settingsData)
      setPresets(presetsData)
      if (statusData?.transparentMode) {
        setTransparentMode(statusData.transparentMode as TransparentMode)
      }
      if (statusData?.proxyScope) {
        setProxyScope(statusData.proxyScope as ProxyScope)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  // 当代理模式或作用域变化时，同步设置并通知后端应用 nft 规则
  const handleModeOrScopeChange = async (
    newMode: TransparentMode,
    newScope: ProxyScope
  ) => {
    setTransparentMode(newMode)
    setProxyScope(newScope)

    try {
      await proxyApi.setTransparentMode(newMode, newScope)

      if (!settings) return
      const newSettings = { ...settings }

      // 根据代理作用域同步 allowLan
      newSettings.allowLan = newScope === 'router'

      // 根据代理模式开关对应端口
      switch (newMode) {
        case 'off':
          newSettings.mixedPortEnabled = true
          newSettings.redirPortEnabled = false
          newSettings.tproxyPortEnabled = false
          break
        case 'tproxy':
          newSettings.mixedPortEnabled = true
          newSettings.redirPortEnabled = false
          newSettings.tproxyPortEnabled = true
          break
        case 'redirect':
          newSettings.mixedPortEnabled = true
          newSettings.redirPortEnabled = true
          newSettings.tproxyPortEnabled = false
          break
      }

      setSettings(newSettings)
      autoSave(newSettings)
    } catch (error) {
      console.error('Failed to set transparent mode:', error)
    }
  }

  // 自动保存（防抖）
  const autoSave = useCallback(async (newSettings: ProxySettings) => {
    try {
      setSaving(true)
      await proxySettingsApi.updateSettings(newSettings)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }, [])

  const handleReset = async () => {
    try {
      setLoading(true)
      const data = await proxySettingsApi.resetSettings()
      setSettings(data)
    } catch (error) {
      console.error('Failed to reset settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyPreset = async (presetId: string) => {
    try {
      setLoading(true)
      const data = await proxySettingsApi.applyPreset(presetId)
      setSettings(data)
    } catch (error) {
      console.error('Failed to apply preset:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateSettings = <K extends keyof ProxySettings>(key: K, value: ProxySettings[K]) => {
    if (!settings) return
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => autoSave(newSettings), 500)
  }

  const updateDNS = <K extends keyof ProxySettings['dns']>(key: K, value: ProxySettings['dns'][K]) => {
    if (!settings) return
    const newSettings = { ...settings, dns: { ...settings.dns, [key]: value } }
    setSettings(newSettings)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => autoSave(newSettings), 500)
  }

  const updateSniffer = <K extends keyof ProxySettings['sniffer']>(key: K, value: ProxySettings['sniffer'][K]) => {
    if (!settings) return
    const newSettings = { ...settings, sniffer: { ...settings.sniffer, [key]: value } }
    setSettings(newSettings)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => autoSave(newSettings), 500)
  }

  const getPresetIcon = (icon: string) => {
    switch (icon) {
      case 'server': return Server
      case 'monitor': return Monitor
      case 'smartphone': return Smartphone
      case 'minimize-2': return Minimize2
      default: return Settings
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // 模式按钮样式辅助
  const modeBtn = (active: boolean, color: 'purple' | 'orange' | 'slate') => {
    const colorMap = {
      purple: active ? 'bg-purple-500 text-white shadow-sm' : '',
      orange: active ? 'bg-orange-500 text-white shadow-sm' : '',
      slate: active ? (themeStyle === 'apple-glass' ? 'bg-slate-500 text-white shadow-sm' : 'bg-slate-500 text-white') : '',
    }
    return cn(
      'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
      active
        ? colorMap[color]
        : themeStyle === 'apple-glass'
          ? 'text-slate-600 hover:bg-black/5'
          : 'text-slate-400 hover:bg-white/10'
    )
  }

  const scopeBtn = (active: boolean) => cn(
    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-1 justify-center',
    active
      ? themeStyle === 'apple-glass'
        ? 'bg-blue-500 text-white shadow-sm'
        : 'bg-cyan-500 text-white shadow-sm'
      : themeStyle === 'apple-glass'
        ? 'text-slate-600 hover:bg-black/5'
        : 'text-slate-400 hover:bg-white/10'
  )

  return (
    <div className="space-y-4 sm:space-y-6 pb-20">
      {/* 顶部操作栏 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className={cn(
            'text-lg font-semibold',
            themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
          )}>{t('proxySettings.title')}</h2>
          <p className={cn(
            'text-sm mt-1',
            themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400'
          )}>{t('proxySettings.description')}</p>
        </div>
        
        <div className="flex items-center gap-3">
          {saving && (
            <span className={cn('text-xs flex items-center gap-1', themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400')}>
              <Loader2 className="w-3 h-3 animate-spin" />
              {t('proxySettings.saving')}
            </span>
          )}
          
          <button
            onClick={handleReset}
            className={cn(
              'flex items-center gap-1.5 px-3 rounded-lg border h-8 text-xs font-medium transition-all',
              themeStyle === 'apple-glass'
                ? 'bg-white/40 border-black/10 text-slate-600 hover:bg-white/60'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
            )}
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">{t('proxySettings.reset')}</span>
          </button>
        </div>
      </div>

      {/* 透明代理模式 + 作用域 选择卡片 */}
      <div className="glass-card p-4 space-y-3">
        {/* 第一行：代理模式（协议选择） */}
        <div>
          <div className={cn('text-xs font-medium mb-2 px-1', themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400')}>
            代理模式
          </div>
          <div className={cn(
            'flex items-center gap-1 p-1 rounded-xl border',
            themeStyle === 'apple-glass'
              ? 'bg-black/5 border-black/10'
              : 'bg-white/5 border-white/10'
          )}>
            {/* TProxy 模式 */}
            <button
              onClick={() => handleModeOrScopeChange('tproxy', proxyScope)}
              className={modeBtn(transparentMode === 'tproxy', 'purple')}
              title="TProxy - nftables TPROXY，支持 UDP，推荐"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>TProxy</span>
            </button>

            {/* Redirect 模式 */}
            <button
              onClick={() => handleModeOrScopeChange('redirect', proxyScope)}
              className={modeBtn(transparentMode === 'redirect', 'orange')}
              title="Redirect - nftables REDIRECT，仅支持 TCP"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Redir</span>
            </button>

            {/* 关闭透明代理（仅系统代理） */}
            <button
              onClick={() => handleModeOrScopeChange('off', proxyScope)}
              className={modeBtn(transparentMode === 'off', 'slate')}
              title="关闭透明代理，仅使用系统代理 / Mixed Port"
            >
              <span>关闭</span>
            </button>
          </div>

          {/* 当前模式提示 */}
          {transparentMode !== 'off' && (
            <div className={cn(
              'mt-2 text-xs px-3 py-1.5 rounded-lg',
              transparentMode === 'tproxy'
                ? themeStyle === 'apple-glass' ? 'bg-purple-500/10 text-purple-600' : 'bg-purple-500/20 text-purple-300'
                : themeStyle === 'apple-glass' ? 'bg-orange-500/10 text-orange-600' : 'bg-orange-500/20 text-orange-300'
            )}>
              {transparentMode === 'tproxy'
                ? '✓ TProxy 模式：已通过 nftables 添加 TPROXY 规则和策略路由，支持 TCP+UDP'
                : '✓ Redir 模式：已通过 nftables 添加 REDIRECT 规则和策略路由，仅 TCP'}
            </div>
          )}
        </div>

        {/* 第二行：代理作用域 */}
        <div>
          <div className={cn('text-xs font-medium mb-2 px-1', themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400')}>
            代理范围
          </div>
          <div className={cn(
            'flex items-center gap-1 p-1 rounded-xl border',
            themeStyle === 'apple-glass'
              ? 'bg-black/5 border-black/10'
              : 'bg-white/5 border-white/10',
            transparentMode === 'off' && 'opacity-50 pointer-events-none'
          )}>
            {/* 仅本机 */}
            <button
              onClick={() => handleModeOrScopeChange(transparentMode, 'local')}
              className={scopeBtn(proxyScope === 'local')}
              title="仅代理本机流量（Output 链）"
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>本机代理</span>
            </button>

            {/* 路由器（本机+局域网） */}
            <button
              onClick={() => handleModeOrScopeChange(transparentMode, 'router')}
              className={scopeBtn(proxyScope === 'router')}
              title="代理本机 + 局域网设备流量（Prerouting + Output 链）"
            >
              <Router className="w-3.5 h-3.5" />
              <span>路由器代理</span>
            </button>
          </div>
          {transparentMode === 'off' && (
            <div className={cn('mt-1.5 text-xs px-1', themeStyle === 'apple-glass' ? 'text-slate-400' : 'text-slate-500')}>
              选择代理模式后可设置代理范围
            </div>
          )}
          {transparentMode !== 'off' && proxyScope === 'router' && (
            <div className={cn(
              'mt-2 text-xs px-3 py-1.5 rounded-lg',
              themeStyle === 'apple-glass' ? 'bg-blue-500/10 text-blue-600' : 'bg-cyan-500/20 text-cyan-300'
            )}>
              ✓ 路由器模式：已开启 allow-lan，Prerouting 链代理局域网设备，Output 链代理本机
            </div>
          )}
        </div>
      </div>

      {/* 预设选择 */}
      <div className="glass-card p-4">
        <div className={cn(
          'text-sm font-medium mb-3',
          themeStyle === 'apple-glass' ? 'text-slate-700' : 'text-slate-200'
        )}>{t('proxySettings.presets')}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {presets.map(preset => {
            const PresetIcon = getPresetIcon(preset.icon)
            return (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset.id)}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl transition-all border',
                  themeStyle === 'apple-glass'
                    ? 'bg-white/50 border-black/10 hover:bg-white/80 hover:border-blue-500/30'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-cyan-500/30'
                )}
              >
                <PresetIcon className={cn(
                  'w-5 h-5 sm:w-6 sm:h-6',
                  themeStyle === 'apple-glass' ? 'text-blue-500' : 'text-cyan-400'
                )} />
                <div className="text-center">
                  <div className={cn(
                    'text-xs sm:text-sm font-medium',
                    themeStyle === 'apple-glass' ? 'text-slate-700' : 'text-white'
                  )}>{t(`proxySettings.preset.${preset.id}`)}</div>
                  <div className={cn(
                    'text-[10px] sm:text-xs mt-0.5 hidden sm:block',
                    themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400'
                  )}>{t(`proxySettings.preset.${preset.id}Desc`)}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 端口设置 - 只保留 mixed / redir / tproxy */}
      <SettingsSection title={t('proxySettings.ports')} icon={Network} themeStyle={themeStyle}>
        {/* 混合端口 */}
        <div className={cn('flex items-center gap-3 p-3 rounded-lg border mb-2', themeStyle === 'apple-glass' ? 'bg-white/40 border-black/5' : 'bg-white/5 border-white/10')}>
          <Toggle checked={settings.mixedPortEnabled} onChange={(v) => updateSettings('mixedPortEnabled', v)} themeStyle={themeStyle} />
          <div className="flex-1 min-w-0">
            <div className={cn('text-sm font-medium', themeStyle === 'apple-glass' ? 'text-slate-700' : 'text-slate-200')}>{t('proxySettings.mixedPort')}</div>
            <div className={cn('text-xs', themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400')}>{t('proxySettings.mixedPortDesc')}</div>
          </div>
          <NumberInput value={settings.mixedPort} onChange={(v) => updateSettings('mixedPort', v)} min={1} max={65535} themeStyle={themeStyle} disabled={!settings.mixedPortEnabled} />
        </div>
        
        {/* 透明代理端口 (Redir) */}
        <div className={cn('flex items-center gap-3 p-3 rounded-lg border mb-2', themeStyle === 'apple-glass' ? 'bg-white/40 border-black/5' : 'bg-white/5 border-white/10')}>
          <Toggle checked={settings.redirPortEnabled} onChange={(v) => updateSettings('redirPortEnabled', v)} themeStyle={themeStyle} />
          <div className="flex-1 min-w-0">
            <div className={cn('text-sm font-medium', themeStyle === 'apple-glass' ? 'text-slate-700' : 'text-slate-200')}>{t('proxySettings.redirPort')}</div>
            <div className={cn('text-xs', themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400')}>{t('proxySettings.redirPortDesc')}</div>
          </div>
          <NumberInput value={settings.redirPort} onChange={(v) => updateSettings('redirPort', v)} min={1} max={65535} themeStyle={themeStyle} disabled={!settings.redirPortEnabled} />
        </div>
        
        {/* TProxy 端口 */}
        <div className={cn('flex items-center gap-3 p-3 rounded-lg border', themeStyle === 'apple-glass' ? 'bg-white/40 border-black/5' : 'bg-white/5 border-white/10')}>
          <Toggle checked={settings.tproxyPortEnabled} onChange={(v) => updateSettings('tproxyPortEnabled', v)} themeStyle={themeStyle} />
          <div className="flex-1 min-w-0">
            <div className={cn('text-sm font-medium', themeStyle === 'apple-glass' ? 'text-slate-700' : 'text-slate-200')}>{t('proxySettings.tproxyPort')}</div>
            <div className={cn('text-xs', themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400')}>{t('proxySettings.tproxyPortDesc')}</div>
          </div>
          <NumberInput value={settings.tproxyPort} onChange={(v) => updateSettings('tproxyPort', v)} min={1} max={65535} themeStyle={themeStyle} disabled={!settings.tproxyPortEnabled} />
        </div>
      </SettingsSection>

      {/* 认证设置 */}
      <SettingsSection title={t('proxySettings.auth')} icon={Lock} defaultOpen={false} themeStyle={themeStyle}>
        <div className={cn('text-xs mb-3', themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400')}>
          {t('proxySettings.authDesc')}
        </div>
        
        <div className="space-y-2">
          {(settings.authentication || []).map((user, index) => (
            <div 
              key={index} 
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border',
                themeStyle === 'apple-glass'
                  ? 'bg-white/40 border-black/5'
                  : 'bg-white/5 border-white/10'
              )}
            >
              <Toggle 
                checked={user.enabled || false} 
                onChange={(v) => {
                  const newAuth = [...(settings.authentication || [])]
                  newAuth[index] = { ...newAuth[index], enabled: v }
                  updateSettings('authentication', newAuth)
                }} 
                themeStyle={themeStyle} 
              />
              
              <input
                type="text"
                value={user.username}
                onChange={(e) => {
                  const newAuth = [...(settings.authentication || [])]
                  newAuth[index] = { ...newAuth[index], username: e.target.value }
                  updateSettings('authentication', newAuth)
                }}
                placeholder={t('proxySettings.username')}
                className={cn(
                  'flex-1 px-3 py-1.5 rounded-lg text-sm border bg-transparent',
                  themeStyle === 'apple-glass'
                    ? 'border-black/10 text-slate-700 placeholder:text-slate-400'
                    : 'border-white/10 text-white placeholder:text-slate-500'
                )}
              />
              
              <input
                type="password"
                value={user.password}
                onChange={(e) => {
                  const newAuth = [...(settings.authentication || [])]
                  newAuth[index] = { ...newAuth[index], password: e.target.value }
                  updateSettings('authentication', newAuth)
                }}
                placeholder={t('proxySettings.password')}
                className={cn(
                  'flex-1 px-3 py-1.5 rounded-lg text-sm border bg-transparent',
                  themeStyle === 'apple-glass'
                    ? 'border-black/10 text-slate-700 placeholder:text-slate-400'
                    : 'border-white/10 text-white placeholder:text-slate-500'
                )}
              />
              
              <button
                onClick={() => {
                  const newAuth = (settings.authentication || []).filter((_, i) => i !== index)
                  updateSettings('authentication', newAuth)
                }}
                className={cn(
                  'p-2 rounded-lg transition-colors flex-shrink-0',
                  themeStyle === 'apple-glass'
                    ? 'text-red-500 hover:bg-red-500/10'
                    : 'text-red-400 hover:bg-red-500/20'
                )}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        
        <button
          onClick={() => {
            const newAuth: AuthUser[] = [...(settings.authentication || []), { username: '', password: '', enabled: true }]
            updateSettings('authentication', newAuth)
          }}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mt-3',
            themeStyle === 'apple-glass'
              ? 'text-blue-600 hover:bg-blue-500/10'
              : 'text-cyan-400 hover:bg-cyan-500/20'
          )}
        >
          <Plus className="w-4 h-4" />
          {t('proxySettings.addUser')}
        </button>
        
        {(settings.authentication || []).some(u => u.enabled) && (
          <div className={cn(
            'mt-3 text-xs px-3 py-2 rounded-lg',
            themeStyle === 'apple-glass'
              ? 'bg-green-500/10 text-green-600'
              : 'bg-green-500/20 text-green-400'
          )}>
            {t('proxySettings.authActive')}
          </div>
        )}
      </SettingsSection>

      {/* 基础设置 */}
      <SettingsSection title={t('proxySettings.basic')} icon={Settings} themeStyle={themeStyle}>
        <FormField label={t('proxySettings.allowLan')} description={t('proxySettings.allowLanDesc')} themeStyle={themeStyle}>
          <Toggle checked={settings.allowLan} onChange={(v) => updateSettings('allowLan', v)} themeStyle={themeStyle} />
        </FormField>
        <FormField label={t('proxySettings.mode')} themeStyle={themeStyle}>
          <Select 
            value={settings.mode} 
            onChange={(v) => updateSettings('mode', v)}
            options={[
              { value: 'rule', label: t('proxySettings.modeRule') },
              { value: 'global', label: t('proxySettings.modeGlobal') },
              { value: 'direct', label: t('proxySettings.modeDirect') },
            ]}
            themeStyle={themeStyle}
          />
        </FormField>
        <FormField label={t('proxySettings.logLevel')} themeStyle={themeStyle}>
          <Select 
            value={settings.logLevel} 
            onChange={(v) => updateSettings('logLevel', v)}
            options={[
              { value: 'silent', label: 'Silent' },
              { value: 'error', label: 'Error' },
              { value: 'warning', label: 'Warning' },
              { value: 'info', label: 'Info' },
              { value: 'debug', label: 'Debug' },
            ]}
            themeStyle={themeStyle}
          />
        </FormField>
        <FormField label={t('proxySettings.ipv6')} description={t('proxySettings.ipv6Desc')} themeStyle={themeStyle}>
          <Toggle checked={settings.ipv6} onChange={(v) => updateSettings('ipv6', v)} themeStyle={themeStyle} />
        </FormField>
        <FormField 
          label={
            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <span className="whitespace-nowrap">{t('proxySettings.autoStart')}</span>
              {settings.autoStart && (
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className={cn('text-xs', themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400')}>{t('proxySettings.delay')}</span>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={settings.autoStartDelay}
                    onChange={(e) => updateSettings('autoStartDelay', parseInt(e.target.value) || 0)}
                    className="form-input w-14 text-center text-xs py-0.5"
                  />
                  <span className={cn('text-xs', themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400')}>{t('proxySettings.seconds')}</span>
                </div>
              )}
            </div>
          } 
          description={t('proxySettings.autoStartDesc')} 
          themeStyle={themeStyle}
        >
          <Toggle checked={settings.autoStart} onChange={(v) => updateSettings('autoStart', v)} themeStyle={themeStyle} />
        </FormField>
      </SettingsSection>

      {/* 性能优化 */}
      <SettingsSection title={t('proxySettings.performance')} icon={Zap} themeStyle={themeStyle}>
        <FormField label={t('proxySettings.unifiedDelay')} description={t('proxySettings.unifiedDelayDesc')} themeStyle={themeStyle}>
          <Toggle checked={settings.unifiedDelay} onChange={(v) => updateSettings('unifiedDelay', v)} themeStyle={themeStyle} />
        </FormField>
        <FormField label={t('proxySettings.tcpConcurrent')} description={t('proxySettings.tcpConcurrentDesc')} themeStyle={themeStyle}>
          <Toggle checked={settings.tcpConcurrent} onChange={(v) => updateSettings('tcpConcurrent', v)} themeStyle={themeStyle} />
        </FormField>
        <FormField label={t('proxySettings.findProcessMode')} description={t('proxySettings.findProcessModeDesc')} themeStyle={themeStyle}>
          <Select 
            value={settings.findProcessMode} 
            onChange={(v) => updateSettings('findProcessMode', v)}
            options={[
              { value: 'always', label: t('proxySettings.processAlways') },
              { value: 'strict', label: t('proxySettings.processStrict') },
              { value: 'off', label: t('proxySettings.processOff') },
            ]}
            themeStyle={themeStyle}
          />
        </FormField>
        <FormField label={t('proxySettings.globalFingerprint')} themeStyle={themeStyle}>
          <Select 
            value={settings.globalClientFingerprint} 
            onChange={(v) => updateSettings('globalClientFingerprint', v)}
            options={[
              { value: 'chrome', label: 'Chrome' },
              { value: 'firefox', label: 'Firefox' },
              { value: 'safari', label: 'Safari' },
              { value: 'edge', label: 'Edge' },
              { value: 'random', label: 'Random' },
            ]}
            themeStyle={themeStyle}
          />
        </FormField>
      </SettingsSection>

      {/* DNS 设置 */}
      <SettingsSection title={t('proxySettings.dns')} icon={Globe} defaultOpen={false} themeStyle={themeStyle}>
        <FormField label={t('proxySettings.dnsEnable')} themeStyle={themeStyle}>
          <Toggle checked={settings.dns.enable} onChange={(v) => updateDNS('enable', v)} themeStyle={themeStyle} />
        </FormField>
        <FormField label={t('proxySettings.dnsListen')} themeStyle={themeStyle}>
          <TextInput value={settings.dns.listen} onChange={(v) => updateDNS('listen', v)} placeholder="0.0.0.0:1053" themeStyle={themeStyle} />
        </FormField>
        <FormField label={t('proxySettings.enhancedMode')} description={t('proxySettings.enhancedModeDesc')} themeStyle={themeStyle}>
          <Select 
            value={settings.dns.enhancedMode} 
            onChange={(v) => updateDNS('enhancedMode', v)}
            options={[
              { value: 'fake-ip', label: 'Fake-IP' },
              { value: 'redir-host', label: 'Redir-Host' },
            ]}
            themeStyle={themeStyle}
          />
        </FormField>
        <FormField label={t('proxySettings.preferH3')} description={t('proxySettings.preferH3Desc')} themeStyle={themeStyle}>
          <Toggle checked={settings.dns.preferH3} onChange={(v) => updateDNS('preferH3', v)} themeStyle={themeStyle} />
        </FormField>
        <FormField label={t('proxySettings.respectRules')} description={t('proxySettings.respectRulesDesc')} themeStyle={themeStyle}>
          <Toggle checked={settings.dns.respectRules} onChange={(v) => updateDNS('respectRules', v)} themeStyle={themeStyle} />
        </FormField>
        <FormField label={t('proxySettings.cacheAlgorithm')} themeStyle={themeStyle}>
          <Select 
            value={settings.dns.cacheAlgorithm} 
            onChange={(v) => updateDNS('cacheAlgorithm', v)}
            options={[
              { value: 'lru', label: 'LRU' },
              { value: 'arc', label: 'ARC' },
            ]}
            themeStyle={themeStyle}
          />
        </FormField>
      </SettingsSection>

      {/* 嗅探设置 */}
      <SettingsSection title={t('proxySettings.sniffer')} icon={Shield} defaultOpen={false} themeStyle={themeStyle}>
        <FormField label={t('proxySettings.snifferEnable')} themeStyle={themeStyle}>
          <Toggle checked={settings.sniffer.enable} onChange={(v) => updateSniffer('enable', v)} themeStyle={themeStyle} />
        </FormField>
        <FormField label={t('proxySettings.overrideDest')} description={t('proxySettings.overrideDestDesc')} themeStyle={themeStyle}>
          <Toggle checked={settings.sniffer.overrideDest} onChange={(v) => updateSniffer('overrideDest', v)} themeStyle={themeStyle} />
        </FormField>
        <FormField label={t('proxySettings.sniffHttp')} themeStyle={themeStyle}>
          <Toggle checked={settings.sniffer.sniffHttp} onChange={(v) => updateSniffer('sniffHttp', v)} themeStyle={themeStyle} />
        </FormField>
        <FormField label={t('proxySettings.sniffTls')} themeStyle={themeStyle}>
          <Toggle checked={settings.sniffer.sniffTls} onChange={(v) => updateSniffer('sniffTls', v)} themeStyle={themeStyle} />
        </FormField>
        <FormField label={t('proxySettings.sniffQuic')} themeStyle={themeStyle}>
          <Toggle checked={settings.sniffer.sniffQuic} onChange={(v) => updateSniffer('sniffQuic', v)} themeStyle={themeStyle} />
        </FormField>
      </SettingsSection>

      {/* GEO 数据设置 */}
      <SettingsSection title={t('proxySettings.geodata')} icon={RefreshCw} defaultOpen={false} themeStyle={themeStyle}>
        <FormField label={t('proxySettings.geodataMode')} description={t('proxySettings.geodataModeDesc')} themeStyle={themeStyle}>
          <Toggle checked={settings.geodataMode} onChange={(v) => updateSettings('geodataMode', v)} themeStyle={themeStyle} />
        </FormField>
        <FormField label={t('proxySettings.geodataLoader')} themeStyle={themeStyle}>
          <Select 
            value={settings.geodataLoader} 
            onChange={(v) => updateSettings('geodataLoader', v)}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'memconservative', label: 'Memory Conservative' },
            ]}
            themeStyle={themeStyle}
          />
        </FormField>
        <FormField label={t('proxySettings.geositeMatcher')} description={t('proxySettings.geositeMatcherDesc')} themeStyle={themeStyle}>
          <Select 
            value={settings.geositeMatcher || 'succinct'} 
            onChange={(v) => updateSettings('geositeMatcher', v)}
            options={[
              { value: 'succinct', label: 'Succinct (推荐)' },
              { value: 'hybrid', label: 'Hybrid' },
            ]}
            themeStyle={themeStyle}
          />
        </FormField>
        <FormField label={t('proxySettings.geoAutoUpdate')} themeStyle={themeStyle}>
          <Toggle checked={settings.geoAutoUpdate} onChange={(v) => updateSettings('geoAutoUpdate', v)} themeStyle={themeStyle} />
        </FormField>
        <FormField label={t('proxySettings.geoUpdateInterval')} description={t('proxySettings.geoUpdateIntervalDesc')} themeStyle={themeStyle}>
          <NumberInput value={settings.geoUpdateInterval} onChange={(v) => updateSettings('geoUpdateInterval', v)} min={1} max={168} themeStyle={themeStyle} />
        </FormField>
        <FormField label={t('proxySettings.etagSupport')} description={t('proxySettings.etagSupportDesc')} themeStyle={themeStyle}>
          <Toggle checked={settings.etagSupport !== false} onChange={(v) => updateSettings('etagSupport', v)} themeStyle={themeStyle} />
        </FormField>
        <FormField label={t('proxySettings.globalUa')} description={t('proxySettings.globalUaDesc')} themeStyle={themeStyle}>
          <TextInput 
            value={settings.globalUa || 'clash.meta'} 
            onChange={(v) => updateSettings('globalUa', v)} 
            placeholder="clash.meta"
            themeStyle={themeStyle} 
          />
        </FormField>
      </SettingsSection>
    </div>
  )
}
