package proxy

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(dataDir string) *Handler {
	return &Handler{
		service: NewService(dataDir),
	}
}

// GetService 获取服务实例
func (h *Handler) GetService() *Service {
	return h.service
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	r.GET("/status", h.GetStatus)
	r.POST("/start", h.Start)
	r.POST("/stop", h.Stop)
	r.POST("/restart", h.Restart)
	r.PUT("/mode", h.SetMode)
	r.PUT("/transparent", h.SetTransparentMode) // 透明代理模式切换
	r.GET("/config", h.GetConfig)
	r.PUT("/config", h.UpdateConfig)
	r.POST("/generate", h.GenerateConfig)
	r.GET("/config/preview", h.GetConfigPreview)
	r.GET("/logs", h.GetLogs)

	// 配置模板管理
	r.GET("/template", h.GetConfigTemplate)
	r.PUT("/template/groups", h.UpdateProxyGroups)
	r.PUT("/template/rules", h.UpdateRules)
	r.PUT("/template/providers", h.UpdateRuleProviders)
	r.POST("/template/reset", h.ResetTemplate)

	// Sing-Box 配置生成
	r.POST("/singbox/generate", h.GenerateSingBoxConfig)
	r.GET("/singbox/preview", h.GetSingBoxConfigPreview)
	r.GET("/singbox/download", h.DownloadSingBoxConfig)

	// Sing-Box 模板管理
	r.GET("/singbox/template", h.GetSingBoxTemplate)
	r.PUT("/singbox/template", h.UpdateSingBoxTemplate)
	r.POST("/singbox/template/reset", h.ResetSingBoxTemplate)

	// Mihomo API 代理 (避免 CORS 问题)
	r.GET("/mihomo/proxies", h.ProxyMihomoGetProxies)
	r.GET("/mihomo/proxies/:name", h.ProxyMihomoGetProxy)
	r.PUT("/mihomo/proxies/:name", h.ProxyMihomoSelectProxy)
	r.GET("/mihomo/proxies/:name/delay", h.ProxyMihomoTestDelay)
}

func (h *Handler) GetStatus(c *gin.Context) {
	status := h.service.GetStatus()
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    status,
	})
}

func (h *Handler) Start(c *gin.Context) {
	if err := h.service.Start(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    1,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

func (h *Handler) Stop(c *gin.Context) {
	if err := h.service.Stop(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    1,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

func (h *Handler) Restart(c *gin.Context) {
	if err := h.service.Restart(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    1,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

func (h *Handler) SetMode(c *gin.Context) {
	var req struct {
		Mode string `json:"mode" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    1,
			"message": err.Error(),
		})
		return
	}

	if err := h.service.SetMode(req.Mode); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    1,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

// SetTransparentMode 设置透明代理模式并应用 nftables 规则
// mode: off (关闭), tproxy (TPROXY透明代理), redirect (REDIRECT重定向)
// scope: local (仅本机 Output 链), router (本机+局域网 Prerouting+Output 链)
func (h *Handler) SetTransparentMode(c *gin.Context) {
	var req struct {
		Mode  string `json:"mode"`
		Scope string `json:"scope"` // local | router
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    1,
			"message": err.Error(),
		})
		return
	}

	// 默认 scope 为 local
	if req.Scope == "" {
		req.Scope = "local"
	}

	// 保存模式到 service
	if err := h.service.SetTransparentMode(req.Mode, req.Scope); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    1,
			"message": err.Error(),
		})
		return
	}

	// 仅在 Linux 上操作 nftables
	if runtime.GOOS == "linux" {
		if err := h.applyNftRules(req.Mode, req.Scope); err != nil {
			// nft 规则失败不阻断响应，但在日志中记录
			fmt.Printf("⚠️ 应用 nftables 规则失败: %v\n", err)
			c.JSON(http.StatusOK, gin.H{
				"code":    2,
				"message": fmt.Sprintf("模式已保存，但 nftables 规则应用失败: %v", err),
				"data": gin.H{
					"mode":  req.Mode,
					"scope": req.Scope,
				},
			})
			return
		}
	}

	modeDesc := map[string]string{
		"off":      "透明代理已关闭，nftables 规则已清除",
		"tproxy":   "TProxy 模式已开启，nftables TPROXY 规则已应用",
		"redirect": "Redirect 模式已开启，nftables REDIRECT 规则已应用",
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": modeDesc[req.Mode],
		"data": gin.H{
			"mode":  req.Mode,
			"scope": req.Scope,
		},
	})
}

// applyNftRules 根据模式和作用域应用或清除 nftables 规则
func (h *Handler) applyNftRules(mode, scope string) error {
	// 先清除已有规则
	h.clearNftRules()

	if mode == "off" {
		fmt.Println("✓ nftables 透明代理规则已清除")
		return nil
	}

	// 获取当前端口配置
	cfg := h.service.GetConfig()
	var listenPort int
	if mode == "tproxy" {
		listenPort = cfg.TProxyPort
		if listenPort == 0 {
			listenPort = 7893
		}
	} else { // redirect
		listenPort = cfg.RedirPort
		if listenPort == 0 {
			listenPort = 7892
		}
	}

	// 生成 nftables 规则
	nftScript := h.buildNftScript(mode, scope, listenPort)

	// 执行 nft -f -
	cmd := exec.Command("nft", "-f", "-")
	cmd.Stdin = strings.NewReader(nftScript)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("nft 执行失败: %v, 输出: %s", err, string(output))
	}

	// 添加策略路由（tproxy 模式需要）
	if mode == "tproxy" {
		if err := h.setupPolicyRouting(); err != nil {
			return fmt.Errorf("策略路由设置失败: %v", err)
		}
	}

	// 启用 IP 转发（路由器模式需要）
	if scope == "router" {
		exec.Command("sysctl", "-w", "net.ipv4.ip_forward=1").Run()
		exec.Command("sysctl", "-w", "net.ipv6.conf.all.forwarding=1").Run()
		fmt.Println("✓ IP 转发已启用（路由器模式）")
	}

	fmt.Printf("✓ nftables %s 规则已应用（scope=%s, port=%d）\n", mode, scope, listenPort)
	return nil
}

// buildNftScript 生成 nftables 规则脚本
func (h *Handler) buildNftScript(mode, scope string, port int) string {
	const mark = 1
	const serverMark = 255
	const tableName = "inet proxystation"

	// prerouting 链（仅路由器模式需要，处理局域网设备流量）
	preroutingRules := ""
	if scope == "router" {
		if mode == "tproxy" {
			preroutingRules = fmt.Sprintf(`
    chain prerouting {
        type filter hook prerouting priority mangle; policy accept;

        # IPSec 不代理
        udp dport { 500, 4500, 1701 } return
        meta l4proto esp return

        # 已建立的 transparent socket 连接直接打标记
        meta l4proto { tcp, udp } socket transparent 1 meta mark set %d accept

        # 本地地址不代理
        ip daddr @local_nets return
        ip6 daddr @local_nets6 return

        # TCP/UDP 流量 TProxy 到 mihomo
        meta l4proto { tcp, udp } tproxy to :%d meta mark set %d accept
    }`, mark, port, mark)
		} else { // redirect
			preroutingRules = fmt.Sprintf(`
    chain prerouting {
        type filter hook prerouting priority mangle; policy accept;

        # IPSec 不代理
        udp dport { 500, 4500, 1701 } return
        meta l4proto esp return

        # 本地地址不代理
        ip daddr @local_nets return
        ip6 daddr @local_nets6 return

        # TCP 流量 REDIRECT 到 mihomo (redirect 不支持 UDP)
        meta l4proto tcp redirect to :%d
    }`, port)
		}
	}

	// output 链（本机流量，所有模式都需要）
	var outputRules string
	if mode == "tproxy" {
		outputRules = fmt.Sprintf(`
    chain output {
        type route hook output priority mangle; policy accept;

        # IPSec 不代理
        udp dport { 500, 4500, 1701 } return
        meta l4proto esp return

        # 本地地址不代理
        ip daddr @local_nets return
        ip6 daddr @local_nets6 return

        # 已标记的包跳过（避免循环）
        meta mark %d return

        # 入站服务端流量不代理（mark %d）
        meta mark %d return

        # 本机出站 TCP/UDP 打标记（触发重路由到 prerouting）
        meta l4proto { tcp, udp } meta mark set %d
    }`, mark, serverMark, serverMark, mark)
	} else { // redirect
		outputRules = fmt.Sprintf(`
    chain output {
        type route hook output priority mangle; policy accept;

        # IPSec 不代理
        udp dport { 500, 4500, 1701 } return
        meta l4proto esp return

        # 本地地址不代理
        ip daddr @local_nets return
        ip6 daddr @local_nets6 return

        # 已标记的包跳过（避免循环）
        meta mark %d return

        # 入站服务端流量不代理
        meta mark %d return

        # 本机出站 TCP REDIRECT 到 mihomo
        meta l4proto tcp redirect to :%d
    }`, mark, serverMark, port)
	}

	script := fmt.Sprintf(`table %s {
    set local_nets {
        type ipv4_addr
        flags interval
        elements = {
            0.0.0.0/8,
            10.0.0.0/8,
            100.64.0.0/10,
            127.0.0.0/8,
            169.254.0.0/16,
            172.16.0.0/12,
            192.168.0.0/16,
            224.0.0.0/4,
            240.0.0.0/4
        }
    }

    set local_nets6 {
        type ipv6_addr
        flags interval
        elements = {
            ::1/128,
            fc00::/7,
            fe80::/10,
            ff00::/8
        }
    }
%s
%s
}`, tableName, preroutingRules, outputRules)

	return script
}

// setupPolicyRouting 设置 tproxy 所需的策略路由
func (h *Handler) setupPolicyRouting() error {
	const tableID = 100
	const mark = 1

	// IPv4 策略路由
	exec.Command("ip", "rule", "add", "fwmark", fmt.Sprintf("%d", mark), "lookup", fmt.Sprintf("%d", tableID)).Run()
	if out, err := exec.Command("ip", "route", "add", "local", "0.0.0.0/0", "dev", "lo", "table", fmt.Sprintf("%d", tableID)).CombinedOutput(); err != nil {
		// 路由可能已存在，忽略 EEXIST
		if !strings.Contains(string(out), "exists") {
			return fmt.Errorf("添加 IPv4 策略路由失败: %v, %s", err, string(out))
		}
	}

	// IPv6 策略路由
	exec.Command("ip", "-6", "rule", "add", "fwmark", fmt.Sprintf("%d", mark), "table", fmt.Sprintf("%d", tableID)).Run()
	exec.Command("ip", "-6", "route", "add", "local", "::/0", "dev", "lo", "table", fmt.Sprintf("%d", tableID)).Run()

	fmt.Printf("✓ 策略路由已配置 (fwmark %d -> table %d)\n", mark, tableID)
	return nil
}

// clearNftRules 清除所有 nftables 规则和策略路由
func (h *Handler) clearNftRules() {
	const tableName = "inet proxystation"
	const tableID = 100
	const mark = 1

	// 删除 nftables 表
	exec.Command("nft", "delete", "table", tableName).Run()

	// 循环删除策略路由（可能有多条）
	for i := 0; i < 5; i++ {
		cmd := exec.Command("ip", "rule", "del", "fwmark", fmt.Sprintf("%d", mark), "lookup", fmt.Sprintf("%d", tableID))
		if err := cmd.Run(); err != nil {
			break
		}
	}
	exec.Command("ip", "route", "del", "local", "0.0.0.0/0", "dev", "lo", "table", fmt.Sprintf("%d", tableID)).Run()

	// IPv6
	for i := 0; i < 5; i++ {
		cmd := exec.Command("ip", "-6", "rule", "del", "fwmark", fmt.Sprintf("%d", mark), "table", fmt.Sprintf("%d", tableID))
		if err := cmd.Run(); err != nil {
			break
		}
	}
	exec.Command("ip", "-6", "route", "del", "local", "::/0", "dev", "lo", "table", fmt.Sprintf("%d", tableID)).Run()
}

func (h *Handler) GetConfig(c *gin.Context) {
	config := h.service.GetConfig()
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    config,
	})
}

func (h *Handler) UpdateConfig(c *gin.Context) {
	// 使用 map 接收部分更新
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    1,
			"message": err.Error(),
		})
		return
	}

	if err := h.service.PatchConfig(updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    1,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

func (h *Handler) GenerateConfig(c *gin.Context) {
	var req struct {
		Nodes []ProxyNode `json:"nodes"`
	}
	// 允许空 body，此时自动获取节点
	c.ShouldBindJSON(&req)

	var configPath string
	var err error

	if len(req.Nodes) == 0 {
		// 没有传节点，调用 regenerateConfig 自动获取所有节点
		configPath, err = h.service.RegenerateConfig()
	} else {
		// 使用传入的节点
		configPath, err = h.service.GenerateConfig(req.Nodes)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    1,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"configPath": configPath,
		},
	})
}

// GetConfigPreview 获取生成的 config.yaml 内容用于预览
func (h *Handler) GetConfigPreview(c *gin.Context) {
	content, err := h.service.GetConfigContent()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code":    0,
			"message": "success",
			"data": gin.H{
				"content": "// 配置文件未生成，请先点击「生成配置」按钮",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"content": content,
		},
	})
}

func (h *Handler) GetLogs(c *gin.Context) {
	// 获取参数
	limitStr := c.DefaultQuery("limit", "200")
	level := c.DefaultQuery("level", "all") // all, info, warn, error

	limit := 200
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	logs := h.service.GetLogs(limit)

	// 根据级别过滤
	var filteredLogs []string
	for _, log := range logs {
		switch level {
		case "error":
			if strings.Contains(log, "ERR") || strings.Contains(log, "FATA") || strings.Contains(log, "error") {
				filteredLogs = append(filteredLogs, log)
			}
		case "warn":
			if strings.Contains(log, "WARN") || strings.Contains(log, "warning") {
				filteredLogs = append(filteredLogs, log)
			}
		case "info":
			if strings.Contains(log, "INFO") || strings.Contains(log, "info") {
				filteredLogs = append(filteredLogs, log)
			}
		default:
			filteredLogs = append(filteredLogs, log)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    filteredLogs,
	})
}

// GetConfigTemplate 获取配置模板
func (h *Handler) GetConfigTemplate(c *gin.Context) {
	template := h.service.GetConfigTemplate()
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    template,
	})
}

// UpdateProxyGroups 更新代理组
func (h *Handler) UpdateProxyGroups(c *gin.Context) {
	var groups []ProxyGroupTemplate
	if err := c.ShouldBindJSON(&groups); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    1,
			"message": err.Error(),
		})
		return
	}

	if err := h.service.UpdateProxyGroups(groups); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    1,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

// UpdateRules 更新规则
func (h *Handler) UpdateRules(c *gin.Context) {
	var rules []RuleTemplate
	if err := c.ShouldBindJSON(&rules); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    1,
			"message": err.Error(),
		})
		return
	}

	if err := h.service.UpdateRules(rules); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    1,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

// UpdateRuleProviders 更新规则提供者
func (h *Handler) UpdateRuleProviders(c *gin.Context) {
	var providers []RuleProviderTemplate
	if err := c.ShouldBindJSON(&providers); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    1,
			"message": err.Error(),
		})
		return
	}

	if err := h.service.UpdateRuleProviders(providers); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    1,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

// ResetTemplate 重置配置模板为默认值
func (h *Handler) ResetTemplate(c *gin.Context) {
	h.service.ResetConfigTemplate()
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

// ========== Mihomo API 代理 (避免 CORS 问题) ==========

// ProxyMihomoGetProxies 代理获取所有代理组
func (h *Handler) ProxyMihomoGetProxies(c *gin.Context) {
	apiAddr := h.service.GetConfig().ExternalController
	if apiAddr == "" {
		apiAddr = "127.0.0.1:9090"
	}

	resp, err := http.Get("http://" + apiAddr + "/proxies")
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"code":    1,
			"message": "Mihomo API 不可用: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", body)
}

// ProxyMihomoGetProxy 代理获取单个代理组
func (h *Handler) ProxyMihomoGetProxy(c *gin.Context) {
	name := c.Param("name")
	apiAddr := h.service.GetConfig().ExternalController
	if apiAddr == "" {
		apiAddr = "127.0.0.1:9090"
	}

	resp, err := http.Get("http://" + apiAddr + "/proxies/" + name)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"code":    1,
			"message": "Mihomo API 不可用: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", body)
}

// ProxyMihomoSelectProxy 代理切换节点
func (h *Handler) ProxyMihomoSelectProxy(c *gin.Context) {
	name := c.Param("name")
	apiAddr := h.service.GetConfig().ExternalController
	if apiAddr == "" {
		apiAddr = "127.0.0.1:9090"
	}

	body, _ := io.ReadAll(c.Request.Body)
	req, _ := http.NewRequest("PUT", "http://"+apiAddr+"/proxies/"+name, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"code":    1,
			"message": "Mihomo API 不可用: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", respBody)
}

// ProxyMihomoTestDelay 代理测试节点延迟
func (h *Handler) ProxyMihomoTestDelay(c *gin.Context) {
	name := c.Param("name")
	url := c.Query("url")
	timeout := c.Query("timeout")

	if url == "" {
		url = "http://www.gstatic.com/generate_204"
	}
	if timeout == "" {
		timeout = "5000"
	}

	apiAddr := h.service.GetConfig().ExternalController
	if apiAddr == "" {
		apiAddr = "127.0.0.1:9090"
	}

	targetURL := fmt.Sprintf("http://%s/proxies/%s/delay?url=%s&timeout=%s", apiAddr, name, url, timeout)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(targetURL)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"code":    1,
			"message": "Mihomo API 不可用: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", body)
}

// ========== Sing-Box 1.12+ 配置生成 ==========

// GenerateSingBoxConfig 生成 Sing-Box 1.12+ 配置
func (h *Handler) GenerateSingBoxConfig(c *gin.Context) {
	var req struct {
		Mode           string `json:"mode"`           // tun, system
		FakeIP         bool   `json:"fakeip"`         // 启用 FakeIP
		MixedPort      int    `json:"mixedPort"`      // 混合代理端口
		HTTPPort       int    `json:"httpPort"`       // HTTP 代理端口
		SocksPort      int    `json:"socksPort"`      // SOCKS5 代理端口
		ClashAPIAddr   string `json:"clashApiAddr"`   // Clash API 地址
		ClashAPISecret string `json:"clashApiSecret"` // Clash API 密钥
		TUNStack       string `json:"tunStack"`       // TUN 栈类型
		TUNMTU         int    `json:"tunMtu"`         // TUN MTU
		DNSStrategy    string `json:"dnsStrategy"`    // DNS 策略
		LogLevel       string `json:"logLevel"`       // 日志级别
		// 性能优化
		AutoRedirect             bool `json:"autoRedirect"`             // Linux nftables
		StrictRoute              bool `json:"strictRoute"`              // 严格路由
		TCPFastOpen              bool `json:"tcpFastOpen"`              // TCP Fast Open
		TCPMultiPath             bool `json:"tcpMultiPath"`             // TCP Multi Path
		UDPFragment              bool `json:"udpFragment"`              // UDP 分片
		Sniff                    bool `json:"sniff"`                    // 流量嗅探
		SniffOverrideDestination bool `json:"sniffOverrideDestination"` // 覆盖目标地址
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		// 使用默认值
		req.Mode = "tun"
		req.MixedPort = 7890
	}

	// 构建选项
	opts := SingBoxGeneratorOptions{
		Mode:                     req.Mode,
		FakeIP:                   req.FakeIP,
		MixedPort:                req.MixedPort,
		HTTPPort:                 req.HTTPPort,
		SocksPort:                req.SocksPort,
		ClashAPIAddr:             req.ClashAPIAddr,
		ClashAPISecret:           req.ClashAPISecret,
		TUNStack:                 req.TUNStack,
		TUNMTU:                   req.TUNMTU,
		DNSStrategy:              req.DNSStrategy,
		LogLevel:                 req.LogLevel,
		AutoRedirect:             req.AutoRedirect,
		StrictRoute:              req.StrictRoute,
		TCPFastOpen:              req.TCPFastOpen,
		TCPMultiPath:             req.TCPMultiPath,
		UDPFragment:              req.UDPFragment,
		Sniff:                    req.Sniff,
		SniffOverrideDestination: req.SniffOverrideDestination,
	}

	// 获取所有节点
	nodes, err := h.service.GetAllNodes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    1,
			"message": "获取节点失败: " + err.Error(),
		})
		return
	}

	// 生成配置
	generator := NewSingboxGenerator(h.service.dataDir)
	config, err := generator.GenerateConfigV112(nodes, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    1,
			"message": "生成配置失败: " + err.Error(),
		})
		return
	}

	// 保存配置
	filePath, err := generator.SaveConfigV112(config, "singbox-config")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    1,
			"message": "保存配置失败: " + err.Error(),
		})
		return
	}

	// 使用 sing-box check 验证配置
	singboxPath := filepath.Join(h.service.dataDir, "cores", "sing-box")
	if _, err := os.Stat(singboxPath); err == nil {
		// sing-box 存在，进行配置验证
		checkCmd := exec.Command(singboxPath, "check", "-c", filePath)
		output, checkErr := checkCmd.CombinedOutput()
		if checkErr != nil {
			// 验证失败，返回错误信息
			errorMsg := string(output)
			if errorMsg == "" {
				errorMsg = checkErr.Error()
			}
			c.JSON(http.StatusOK, gin.H{
				"code":    2, // 使用 code 2 表示配置验证失败
				"message": "配置验证失败",
				"data": gin.H{
					"configPath":      filePath,
					"nodeCount":       len(nodes),
					"mode":            opts.Mode,
					"validationError": errorMsg,
				},
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"configPath": filePath,
			"nodeCount":  len(nodes),
			"mode":       opts.Mode,
		},
	})
}

// GetSingBoxConfigPreview 获取 Sing-Box 配置预览
func (h *Handler) GetSingBoxConfigPreview(c *gin.Context) {
	content, err := h.service.GetSingBoxConfigContent()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code":    0,
			"message": "success",
			"data": gin.H{
				"content": "// Sing-Box 配置文件未生成，请先点击「生成配置」按钮",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"content": content,
		},
	})
}

// DownloadSingBoxConfig 下载 Sing-Box 配置文件
func (h *Handler) DownloadSingBoxConfig(c *gin.Context) {
	content, err := h.service.GetSingBoxConfigContent()
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"code":    1,
			"message": "配置文件不存在",
		})
		return
	}

	c.Header("Content-Disposition", "attachment; filename=singbox-config.json")
	c.Header("Content-Type", "application/json")
	c.String(http.StatusOK, content)
}

// GetSingBoxTemplate 获取 Sing-Box 模板配置
func (h *Handler) GetSingBoxTemplate(c *gin.Context) {
	template := h.service.GetSingBoxTemplate()
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    template,
	})
}

// UpdateSingBoxTemplate 更新 Sing-Box 模板配置
func (h *Handler) UpdateSingBoxTemplate(c *gin.Context) {
	var template SingBoxTemplate
	if err := c.ShouldBindJSON(&template); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    1,
			"message": "参数错误: " + err.Error(),
		})
		return
	}

	if err := h.service.UpdateSingBoxTemplate(&template); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    1,
			"message": "保存失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

// ResetSingBoxTemplate 重置 Sing-Box 模板为默认值
func (h *Handler) ResetSingBoxTemplate(c *gin.Context) {
	h.service.ResetSingBoxTemplate()
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    h.service.GetSingBoxTemplate(),
	})
}
