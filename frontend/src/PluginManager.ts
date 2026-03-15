import { onSetup } from "./Globals";

export interface Plugin {
  id: string;
  name: string;
  entry?: string; // Path to the JS bundle
}

const loadedPlugins = new Set<string>();

export async function loadPlugin(url: string) {
  if (loadedPlugins.has(url)) return;

  try {
    const script = document.createElement("script");
    script.src = url;
    script.type = "module";

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

// In Wails, we might want to fetch a list of plugins from the backend
export async function autoLoadPlugins() {
  // This could be a call to a Go function like App.GetPlugins()
  // For now, it's a placeholder.
  console.log("Auto-loading plugins...");
}

onSetup(() => {
  autoLoadPlugins();
  return () => { };
});
