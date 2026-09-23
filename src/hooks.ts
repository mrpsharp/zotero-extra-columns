import { initLocale } from "./utils/locale";
import { refreshColumns, unregisterColumns } from "./modules/columns";
import {
  onSettingsLoad,
  registerSettingsPane,
  unregisterSettingsPane,
} from "./modules/settings";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  await registerSettingsPane();
  await refreshColumns();

  // Mark initialized as true to confirm plugin loading status
  // outside of the plugin (e.g. scaffold testing process)
  addon.data.initialized = true;
}

// Columns are registered with the item tree rather than with a window, so
// there is nothing to set up or tear down per main window.
async function onMainWindowLoad(_win: _ZoteroTypes.MainWindow): Promise<void> {}

async function onMainWindowUnload(_win: Window): Promise<void> {}

function onShutdown(): void {
  unregisterSettingsPane();
  void unregisterColumns();
  ztoolkit.unregisterAll();
  // Remove addon object
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

/**
 * Dispatcher for settings pane events. Hooks only dispatch; the work belongs
 * in the module the event concerns.
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      onSettingsLoad(data.window);
      break;
    default:
      return;
  }
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onPrefsEvent,
};
