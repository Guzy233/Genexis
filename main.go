package main

import (
	"embed"
	"net/http"
	"net/http/httputil"
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
		Title:  "Genexis",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
			Middleware: func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					GlobalPluginManager.mu.RLock()
					path := r.URL.Path
					var proxy *httputil.ReverseProxy
					for {
						if p, ok := GlobalPluginManager.RouteMap[path]; ok {
							proxy = p
							break
						}
						lastSlash := strings.LastIndex(path, "/")
						if lastSlash <= 0 {
							break
						}
						path = path[:lastSlash]
					}

					if proxy != nil {
						GlobalPluginManager.mu.RUnlock()
						proxy.ServeHTTP(w, r)
						return
					}
					GlobalPluginManager.mu.RUnlock()

					if strings.HasPrefix(r.URL.Path, "/plugins/") {
						filePath := strings.TrimPrefix(r.URL.Path, "/")
						if _, err := os.Stat(filePath); err == nil {
							w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0")
							w.Header().Set("Pragma", "no-cache")
							w.Header().Set("Expires", "0")
							http.ServeFile(w, r, filePath)
							return
						}
					}

					// 3. 其他请求交给 Wails 默认处理
					next.ServeHTTP(w, r)
				})
			},
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
