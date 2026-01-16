package main

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx     context.Context
	configDir string
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// 获取配置文件目录（使用用户数据目录）
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = os.TempDir()
	}
	a.configDir = filepath.Join(configDir, "MindGraph3")

	// 确保配置目录存在
	os.MkdirAll(a.configDir, 0755)
}

// GetConfigPath 获取配置文件路径
func (a *App) GetConfigPath() string {
	return filepath.Join(a.configDir, "config.json")
}

// ReadConfig 读取配置文件
func (a *App) ReadConfig() (string, error) {
	configPath := a.GetConfigPath()

	// 如果文件不存在，返回空对象
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

// WriteConfig 写入配置文件
func (a *App) WriteConfig(configData string) error {
	configPath := a.GetConfigPath()

	// 确保目录存在
	os.MkdirAll(a.configDir, 0755)

	// 格式化 JSON
	var prettyJSON bytes.Buffer
	if err := json.Indent(&prettyJSON, []byte(configData), "", "  "); err != nil {
		return err
	}

	return os.WriteFile(configPath, prettyJSON.Bytes(), 0644)
}

// 窗口控制方法
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

// SaveFile 保存文件（另存为，显示对话框）
func (a *App) SaveFile(data string, defaultFilename string) (string, error) {
	// 如果没有提供默认文件名，使用 mindgraph.json
	if defaultFilename == "" {
		defaultFilename = "mindgraph.json"
	}

	// 打开保存文件对话框
	filePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "另存为",
		DefaultFilename: defaultFilename,
		Filters: []runtime.FileFilter{
			{
				DisplayName: "JSON Files (*.json)",
				Pattern:     "*.json",
			},
			{
				DisplayName: "All Files (*.*)",
				Pattern:     "*.*",
			},
		},
	})

	if err != nil {
		return "", err
	}

	// 用户取消了对话框
	if filePath == "" {
		return "", nil
	}

	// 写入文件
	err = os.WriteFile(filePath, []byte(data), 0644)
	if err != nil {
		return "", err
	}

	return filePath, nil
}

// SaveFileDirect 直接保存到指定路径（不显示对话框）
func (a *App) SaveFileDirect(data string, filePath string) error {
	if filePath == "" {
		return os.ErrInvalid
	}

	// 写入文件
	err := os.WriteFile(filePath, []byte(data), 0644)
	if err != nil {
		return err
	}

	return nil
}

// LoadFile 加载文件
func (a *App) LoadFile() (string, error) {
	// 打开加载文件对话框
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "打开思维导图",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "JSON Files (*.json)",
				Pattern:     "*.json",
			},
			{
				DisplayName: "All Files (*.*)",
				Pattern:     "*.*",
			},
		},
	})

	if err != nil {
		return "", err
	}

	// 用户取消了对话框
	if filePath == "" {
		return "", nil
	}

	// 读取文件
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}

	// 返回 JSON 格式：{"path":"...","content":"..."}
	// 使用 json.Marshal 自动处理转义
	type FileResult struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	result := FileResult{
		Path:    filePath,
		Content: string(data),
	}
	jsonResult, err := json.Marshal(result)
	if err != nil {
		return "", err
	}
	return string(jsonResult), nil
}

// OpenFolder 打开文件夹选择对话框
func (a *App) OpenFolder() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Folder",
	})
}
