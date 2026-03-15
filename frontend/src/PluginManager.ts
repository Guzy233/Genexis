import { onSetup } from "./Globals";
import { updateCanvas } from "./Manager";
import { GetPlugins } from "../wailsjs/go/main/App";

export interface PluginMetadata {
    id: string;
    name: string;
    version: string;
    frontend: {
        entry: string;
    };
    backend: {
        main: string;
        port: number;
        route: string;
    };
}

const loadedPlugins = new Set<string>();

export async function loadPlugin(url: string) {
    if (loadedPlugins.has(url)) return;

    try {
        const script = document.createElement("script");
        script.src = url;

        return new Promise((resolve, reject) => {
            script.onload = () => {
                loadedPlugins.add(url);
                console.log(`Plugin loaded: ${url}`);
                resolve(true);
            };
            script.onerror = (e) => {
                console.error(`Failed to load plugin: ${url}`, e);
                reject(e);
            };
            document.head.appendChild(script);
        });
    } catch (err) {
        console.error(`Error loading plugin ${url}:`, err);
    }
}

export async function autoLoadPlugins() {
    console.log("Auto-loading plugins from backend...");
    try {
        const plugins: PluginMetadata[] = await GetPlugins();
        console.log("Discovered plugins:", plugins);
        for (const plugin of plugins) {
            if (plugin.frontend && plugin.frontend.entry) {
                // Determine the correct URL for the entry point
                // If it's a relative path in plugin.json, we might need to prefix it
                let entryUrl = plugin.frontend.entry;
                await loadPlugin(entryUrl);
            }
        }
        updateCanvas();
    } catch (err) {
        console.error("Failed to fetch plugins from backend:", err);
    }
}

onSetup(() => {
    autoLoadPlugins();
    return () => { };
});
