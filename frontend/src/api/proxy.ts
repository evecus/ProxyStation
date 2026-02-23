import api from './client'

export type TransparentMode = 'off' | 'tproxy' | 'redirect'
export type ProxyScope = 'local' | 'router' // local=仅本机, router=本机+局域网

export interface ProxyStatus {
  running: boolean
  coreType: string
  coreVersion: string
  mode: string
  mixedPort: number
  socksPort: number
  allowLan: boolean
  tunEnabled: boolean
  transparentMode: TransparentMode
  proxyScope: ProxyScope
  uptime: number
}

export interface ProxyConfig {
  mixedPort: number
  socksPort: number
  redirPort: number
  tproxyPort: number
  allowLan: boolean
  ipv6: boolean
  mode: string
  logLevel: string
  externalController: string
  tunEnabled: boolean
  tunStack: string
  transparentMode: TransparentMode
  proxyScope: ProxyScope
  autoStart: boolean
  autoStartDelay: number
}

export const proxyApi = {
  getStatus: () => api.get<ProxyStatus>('/proxy/status'),
  start: () => api.post('/proxy/start'),
  stop: () => api.post('/proxy/stop'),
  restart: () => api.post('/proxy/restart'),
  setMode: (mode: string) => api.put('/proxy/mode', { mode }),
  setTransparentMode: (mode: TransparentMode, scope: ProxyScope) =>
    api.put('/proxy/transparent', { mode, scope }),
  getConfig: () => api.get<ProxyConfig>('/proxy/config'),
  updateConfig: (config: ProxyConfig) => api.put('/proxy/config', config),
}
