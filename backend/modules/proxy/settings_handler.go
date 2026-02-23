package proxy

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"
)

// SettingsHandler 代理设置处理器
type SettingsHandler struct {
	dataDir      string
	settings     *ProxySettings
	mu           sync.RWMutex
	proxyService *Service // 代理服务引用，用于同步配置
}

// NewSettingsHandler 创建设置处理器
func NewSettingsHandler(dataDir string) *SettingsHandler {
	h := &SettingsHandler{
		dataDir:  dataDir,
		settings: GetDefaultProxySettings(),
	}
	// 加载已保存的设置
	h.loadSettings()
	return h
}

// SetProxyService 设置代理服务引用
func (h *SettingsHandler) SetProxyService(s *Service) {
	h.proxyService = s
}

// RegisterRoutes 注册路由
func (h *SettingsHandler) RegisterRoutes(r *gin.RouterGroup) {
	r.GET("/settings", h.GetSettings)
	r.PUT("/settings", h.UpdateSettings)
	r.POST("/settings/reset", h.ResetSettings)
}

// settingsFilePath 获取设置文件路径
func (h *SettingsHandler) settingsFilePath() string {
	return filepath.Join(h.dataDir, "proxy_settings.yaml")
}

// loadSettings 加载设置
func (h *SettingsHandler) loadSettings() error {
	h.mu.Lock()
	defer h.mu.Unlock()

	data, err := os.ReadFile(h.settingsFilePath())
	if err != nil {
		if os.IsNotExist(err) {
			// 文件不存在，使用默认设置
			return nil
		}
		return err
	}

	var settings ProxySettings
	if err := yaml.Unmarshal(data, &settings); err != nil {
		return err
	}

	// 设置默认值（旧配置文件可能缺少新字段）
	if settings.AutoStartDelay == 0 {
		settings.AutoStartDelay = 15 // 默认延迟 15 秒
	}

	h.settings = &settings
	return nil
}

// saveSettings 保存设置
func (h *SettingsHandler) saveSettings() error {
	data, err := yaml.Marshal(h.settings)
	if err != nil {
		return err
	}

	// 确保目录存在
	dir := filepath.Dir(h.settingsFilePath())
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(h.settingsFilePath(), data, 0644)
}

// GetSettings 获取当前设置
func (h *SettingsHandler) GetSettings(c *gin.Context) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": h.settings,
	})
}

// UpdateSettings 更新设置
func (h *SettingsHandler) UpdateSettings(c *gin.Context) {
	var settings ProxySettings
	if err := c.ShouldBindJSON(&settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    1,
			"message": "Invalid settings: " + err.Error(),
		})
		return
	}

	h.mu.Lock()
	h.settings = &settings
	err := h.saveSettings()
	h.mu.Unlock()

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    1,
			"message": "Failed to save settings: " + err.Error(),
		})
		return
	}

	// 同步到 proxy 服务
	if h.proxyService != nil {
		h.proxyService.PatchConfig(map[string]interface{}{
			"autoStart":      settings.AutoStart,
			"autoStartDelay": float64(settings.AutoStartDelay),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "Settings updated successfully",
	})
}

// ResetSettings 重置为默认设置
func (h *SettingsHandler) ResetSettings(c *gin.Context) {
	h.mu.Lock()
	h.settings = GetDefaultProxySettings()
	err := h.saveSettings()
	h.mu.Unlock()

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    1,
			"message": "Failed to save settings: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "Settings reset to defaults",
		"data":    h.settings,
	})
}

// GetCurrentSettings 获取当前设置（供其他模块调用）
func (h *SettingsHandler) GetCurrentSettings() *ProxySettings {
	h.mu.RLock()
	defer h.mu.RUnlock()

	// 返回副本
	data, _ := json.Marshal(h.settings)
	var copy ProxySettings
	json.Unmarshal(data, &copy)
	return &copy
}


