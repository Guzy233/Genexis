package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type PluginFrontend struct {
	Entry string `json:"entry"`
	CSS   string `json:"css"`
}

type PluginBackend struct {
	Main  string `json:"main"`
	Port  int    `json:"port"`
	Route string `json:"route"`
}

type PluginMetadata struct {
	ID       string         `json:"id"`
	Name     string         `json:"name"`
	Version  string         `json:"version"`
	Frontend PluginFrontend `json:"frontend"`
	Backend  PluginBackend  `json:"backend"`
}

type PluginInstance struct {
	Metadata PluginMetadata
	Cmd      *exec.Cmd
	Proxy    *httputil.ReverseProxy
}

type PluginManager struct {
	Plugins  []PluginInstance
	RouteMap map[string]*httputil.ReverseProxy
	mu       sync.RWMutex
}

var GlobalPluginManager = &PluginManager{}

type App struct {
	ctx       context.Context
	configDir string
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// 获取当前工作目录（在开发模式下通常是项目根目录）
	cwd, _ := os.Getwd()

	// 获取配置文件目录
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = os.TempDir()
	}
	a.configDir = filepath.Join(configDir, "Genexis")
	os.MkdirAll(a.configDir, 0755)

	// 扫描并启动插件
	a.initPlugins(cwd)
}

func (a *App) initPlugins(baseDir string) {
	GlobalPluginManager.mu.Lock()
	GlobalPluginManager.RouteMap = make(map[string]*httputil.ReverseProxy)
	GlobalPluginManager.mu.Unlock()

	pluginsDir := filepath.Join(baseDir, "plugins")
	entries, err := os.ReadDir(pluginsDir)
	if err != nil {
		fmt.Printf("Error reading plugins dir: %v\n", err)
		return
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		pluginPath := filepath.Join(pluginsDir, entry.Name())
		absPluginPath, _ := filepath.Abs(pluginPath)
		metaPath := filepath.Join(absPluginPath, "plugin.json")
		if _, err := os.Stat(metaPath); os.IsNotExist(err) {
			continue
		}

		data, err := os.ReadFile(metaPath)
		if err != nil {
			fmt.Printf("Error reading plugin.json in %s: %v\n", entry.Name(), err)
			continue
		}

		var meta PluginMetadata
		if err := json.Unmarshal(data, &meta); err != nil {
			fmt.Printf("Error parsing plugin.json in %s: %v\n", entry.Name(), err)
			continue
		}

		// 启动后端
		var cmd *exec.Cmd
		if meta.Backend.Main != "" {
			backendPath := filepath.Join(absPluginPath, meta.Backend.Main)

			// 在 Windows 上，这种相对/绝对路径的处理需要非常小心
			if strings.HasSuffix(backendPath, ".go") {
				cmd = exec.Command("go", "run", "main.go")
				cmd.Dir = absPluginPath
			} else {
				// 确保后端可执行文件存在
				if _, err := os.Stat(backendPath); err == nil {
					cmd = exec.Command(backendPath)
					cmd.Dir = absPluginPath
				} else {
					fmt.Printf("Plugin backend executable not found: %s\n", backendPath)
					continue
				}
			}

			// 注入端口环境变量
			cmd.Env = append(os.Environ(), fmt.Sprintf("PORT=%d", meta.Backend.Port))

			// 重定向输出到主进程
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr

			err := cmd.Start()
			if err != nil {
				fmt.Printf("Failed to start plugin backend %s: %v\n", meta.ID, err)
			} else {
				fmt.Printf("Plugin backend %s started on port %d (Path: %s)\n", meta.ID, meta.Backend.Port, backendPath)
			}
		}

		// 创建代理
		var proxy *httputil.ReverseProxy
		if meta.Backend.Port != 0 {
			target, _ := url.Parse(fmt.Sprintf("http://localhost:%d", meta.Backend.Port))
			proxy = httputil.NewSingleHostReverseProxy(target)
			// 修正路径转发
			originalDirector := proxy.Director
			proxy.Director = func(req *http.Request) {
				originalDirector(req)
				req.URL.Path = strings.TrimPrefix(req.URL.Path, meta.Backend.Route)
				if !strings.HasPrefix(req.URL.Path, "/") {
					req.URL.Path = "/" + req.URL.Path
				}
			}
		}

		GlobalPluginManager.mu.Lock()
		GlobalPluginManager.Plugins = append(GlobalPluginManager.Plugins, PluginInstance{
			Metadata: meta,
			Cmd:      cmd,
			Proxy:    proxy,
		})
		if meta.Backend.Route != "" && proxy != nil {
			GlobalPluginManager.RouteMap[meta.Backend.Route] = proxy
		}
		GlobalPluginManager.mu.Unlock()
	}
}

func (a *App) GetPlugins() []PluginMetadata {
	GlobalPluginManager.mu.RLock()
	defer GlobalPluginManager.mu.RUnlock()

	var metas []PluginMetadata
	for _, p := range GlobalPluginManager.Plugins {
		metas = append(metas, p.Metadata)
	}
	return metas
}

func (a *App) shutdown(ctx context.Context) {
	GlobalPluginManager.mu.Lock()
	defer GlobalPluginManager.mu.Unlock()

	for _, p := range GlobalPluginManager.Plugins {
		if p.Cmd != nil && p.Cmd.Process != nil {
			fmt.Printf("Stopping plugin backend: %s\n", p.Metadata.ID)
			p.Cmd.Process.Kill()
		}
	}
}

// ==================== 原有方法 ====================

func (a *App) GetConfigPath() string {
	return filepath.Join(a.configDir, "config.json")
}

func (a *App) ReadConfig() (string, error) {
	configPath := a.GetConfigPath()
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		emptyConfig := make(map[string]interface{})
		data, _ := json.Marshal(emptyConfig)
		return string(data), nil
	}
	data, err := os.ReadFile(configPath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (a *App) WriteConfig(configData string) error {
	configPath := a.GetConfigPath()
	os.MkdirAll(a.configDir, 0755)
	var prettyJSON bytes.Buffer
	if err := json.Indent(&prettyJSON, []byte(configData), "", "  "); err != nil {
		return err
	}
	return os.WriteFile(configPath, prettyJSON.Bytes(), 0644)
}

func (a *App) Quit() {
	runtime.Quit(a.ctx)
}

func (a *App) Minimize() {
	runtime.WindowMinimise(a.ctx)
}

func (a *App) Maximize() {
	if runtime.WindowIsMaximised(a.ctx) {
		runtime.WindowUnmaximise(a.ctx)
	} else {
		runtime.WindowMaximise(a.ctx)
	}
}

func (a *App) IsMaximized() bool {
	return runtime.WindowIsMaximised(a.ctx)
}

func (a *App) SaveFile(data string, defaultFilename string) (string, error) {
	if defaultFilename == "" {
		defaultFilename = "untitled.exis"
	}
	filePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "另存为",
		DefaultFilename: defaultFilename,
		Filters: []runtime.FileFilter{
			{DisplayName: "Genexis Files (*.exis)", Pattern: "*.exis"},
			{DisplayName: "All Files (*.*)", Pattern: "*.*"},
		},
	})
	if err != nil || filePath == "" {
		return filePath, err
	}
	err = os.WriteFile(filePath, []byte(data), 0644)
	return filePath, err
}

func (a *App) SaveFileDirect(data string, filePath string) error {
	if filePath == "" {
		return os.ErrInvalid
	}
	return os.WriteFile(filePath, []byte(data), 0644)
}

func (a *App) LoadFile() (string, error) {
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "打开文件",
		Filters: []runtime.FileFilter{
			{DisplayName: "Genexis Files (*.exis)", Pattern: "*.exis"},
			{DisplayName: "All Files (*.*)", Pattern: "*.*"},
		},
	})
	if err != nil || filePath == "" {
		return "", err
	}
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	type FileResult struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	jsonResult, _ := json.Marshal(FileResult{Path: filePath, Content: string(data)})
	return string(jsonResult), nil
}

func (a *App) OpenFolder() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Folder",
	})
}

// ==================== 工作区相关方法 ====================

type FileEntry struct {
	RelativePath string      `json:"path"`
	Name         string      `json:"name"`
	IsDirectory  bool        `json:"isDirectory"`
	Children     []FileEntry `json:"children,omitempty"`
}

// ListDirectory 递归列出目录树，只返回 .exis 文件和子目录（排除 . 开头的文件/目录）
func (a *App) ListDirectory(dirPath string) (string, error) {
	entries, err := a.listDirRecursive(dirPath, "")
	if err != nil {
		return "", err
	}
	result, _ := json.Marshal(entries)
	return string(result), nil
}

func (a *App) listDirRecursive(basePath string, relPath string) ([]FileEntry, error) {
	fullPath := basePath
	if relPath != "" {
		fullPath = filepath.Join(basePath, relPath)
	}

	dirEntries, err := os.ReadDir(fullPath)
	if err != nil {
		return nil, err
	}

	result := make([]FileEntry, 0)
	for _, entry := range dirEntries {
		name := entry.Name()
		// 排除 . 开头的文件和目录
		if strings.HasPrefix(name, ".") {
			continue
		}

		childRelPath := name
		if relPath != "" {
			childRelPath = filepath.Join(relPath, name)
		}
		// 统一使用正斜杠
		childRelPath = filepath.ToSlash(childRelPath)

		if entry.IsDir() {
			children, err := a.listDirRecursive(basePath, childRelPath)
			if err != nil {
				continue
			}
			// 只包含有 .exis 文件的目录
			if len(children) > 0 {
				result = append(result, FileEntry{
					RelativePath: childRelPath,
					Name:         name,
					IsDirectory:  true,
					Children:     children,
				})
			}
		} else if strings.HasSuffix(name, ".exis") {
			result = append(result, FileEntry{
				RelativePath: childRelPath,
				Name:         name,
				IsDirectory:  false,
			})
		}
	}
	return result, nil
}

// ReadWorkspaceConfig 读取工作区根目录下的 .exis-workspace.json
func (a *App) ReadWorkspaceConfig(rootPath string) (string, error) {
	configPath := filepath.Join(rootPath, ".exis-workspace.json")
	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return "{}", nil
		}
		return "", err
	}
	return string(data), nil
}

// WriteWorkspaceConfig 写入工作区配置
func (a *App) WriteWorkspaceConfig(rootPath string, jsonData string) error {
	configPath := filepath.Join(rootPath, ".exis-workspace.json")
	var prettyJSON bytes.Buffer
	if err := json.Indent(&prettyJSON, []byte(jsonData), "", "  "); err != nil {
		return err
	}
	return os.WriteFile(configPath, prettyJSON.Bytes(), 0644)
}

// LoadFileDirect 按路径直接加载文件（不弹对话框）
func (a *App) LoadFileDirect(filePath string) (string, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	type FileResult struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	jsonResult, _ := json.Marshal(FileResult{Path: filePath, Content: string(data)})
	return string(jsonResult), nil
}

// CreateDirectory 创建目录（含父目录）
func (a *App) CreateDirectory(dirPath string) error {
	return os.MkdirAll(dirPath, 0755)
}

// DeleteFile 删除文件
func (a *App) DeleteFile(filePath string) error {
	return os.Remove(filePath)
}

// RenamePath 重命名文件或目录
func (a *App) RenamePath(oldPath string, newPath string) error {
	return os.Rename(oldPath, newPath)
}

// FileExists 检查文件是否存在
func (a *App) FileExists(filePath string) (bool, error) {
	_, err := os.Stat(filePath)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}
