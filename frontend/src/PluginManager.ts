import { onSetup } from "./Globals";
import { updateCanvas } from "./Manager";
import { GetPlugins } from "../wailsjs/go/main/App";

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  frontend: {
    entry: string;
    css?: string; // Optional explicit CSS path
  };
  backend: {
    main: string;
    port: number;
    route: string;
  };
}

const loadedPlugins = new Set<string>();
const loadedStyles = new Set<string>();

export async function loadCSS(url: string) {
  if (loadedStyles.has(url)) return;

  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.onload = () => {
      loadedStyles.add(url);
      console.log(`Plugin style loaded: ${url}`);
      resolve(true);
    };
    link.onerror = () => {
      // CSS loading error shouldn't stop plugin execution
      console.warn(`Optional plugin style failed to load: ${url}`);
      resolve(false);
    };
    document.head.appendChild(link);
  });
}

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
        let entryUrl = plugin.frontend.entry;

        // Only load CSS if explicitly specified in plugin.json
        if (plugin.frontend.css) {
          loadCSS(plugin.frontend.css);
        }

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
