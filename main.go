package main

import (
	"embed"
	"net/http"
	"os"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "MindGraph3",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
			Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// 动态检测插件路由
				GlobalPluginManager.mu.RLock()
				var targetProxy *http.Handler
				for _, p := range GlobalPluginManager.Plugins {
					if p.Metadata.Backend.Route != "" && strings.HasPrefix(r.URL.Path, p.Metadata.Backend.Route) {
						if p.Proxy != nil {
							var h http.Handler = p.Proxy
							targetProxy = &h
						}
						break
					}
				}
				GlobalPluginManager.mu.RUnlock()

				if targetProxy != nil {
					(*targetProxy).ServeHTTP(w, r)
					return
				}

				// 处理插件静态文件
				if strings.HasPrefix(r.URL.Path, "/plugins/") {
					// 去掉开头的 /plugins/ 并在本地查找
					filePath := strings.TrimPrefix(r.URL.Path, "/")
					if _, err := os.Stat(filePath); err == nil {
						http.ServeFile(w, r, filePath)
						return
					}
				}

				// 其他请求交给默认处理（如静态资源）
				http.NotFound(w, r)
			}),
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
		Frameless: true,
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
