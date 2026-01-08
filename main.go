package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
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
			Assets:  assets,
			Handler: &FileLoader{},
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

const baseDir = "C:\\Users\\fulen\\Desktop\\.minecraft\\versions\\testcm\\resource_exports"

type FileLoader struct{}

func (h *FileLoader) ServeHTTP(res http.ResponseWriter, req *http.Request) {
	path := req.URL.Path

	// 去除path后缀
	path = strings.TrimSuffix(path, ".png")

	fullPath := filepath.Join(baseDir, path, "icons\\atlas.png")

	// 4. 读取并发送文件
	fileData, err := os.ReadFile(fullPath)
	if err != nil {
		fmt.Println("load failed:", fullPath)
		res.WriteHeader(http.StatusNotFound)
		return
	}
	fmt.Println("load successed:", fullPath)

	res.Write(fileData)
}

type Rect struct {
	X, Y, W, H int
}

var ResourceRegistry = make(map[string]Rect)

func loadRects() error {
	// rootPath := ""
	entries, err := os.ReadDir(baseDir)
	if err != nil {
		return err
	}
	for i, entry := range entries {
		if i == 30 {
			// fmt.Printf("loaded: %d", i)i
			return nil
		}
		if entry.IsDir() {
			modName := entry.Name()
			jsonPath := filepath.Join(baseDir, modName, "icons\\data.min.json")

			// 读取并解析 json
			data, err := os.ReadFile(jsonPath)
			if err != nil {
				continue
			}
			var rawData map[string][4]int
			json.Unmarshal(data, &rawData)

			for itemID, coords := range rawData {
				ResourceRegistry[itemID] =

					Rect{
						X: coords[0],
						Y: coords[1],
						W: coords[2],
						H: coords[3],
					}

			}
		}
	}
	return nil
}
