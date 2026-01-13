package main

import (
	"embed"
	"net/http"
	"net/http/httputil"
	"net/url"
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

	target, _ := url.Parse("http://localhost:29991")
	proxy := httputil.NewSingleHostReverseProxy(target)

	// 自定义代理逻辑
	proxyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 移除 /reciper 前缀，模拟 Vite 的 rewrite 功能
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/reciper")
		proxy.ServeHTTP(w, r)
	})

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "MindGraph3",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
			Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if strings.HasPrefix(r.URL.Path, "/reciper") {
					proxyHandler.ServeHTTP(w, r)
					return
				}
				// 其他请求交给默认处理（如静态资源）
				http.NotFound(w, r)
			}),
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
		Frameless: true,
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
