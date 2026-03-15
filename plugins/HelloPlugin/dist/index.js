(function() {
  "use strict";
  window.MindGraph["Globals"]["anchors_rect"];
  window.MindGraph["Globals"]["idFromEvent"];
  window.MindGraph["Globals"]["Coms"];
  window.MindGraph["Globals"]["topLayer"];
  window.MindGraph["Globals"]["Controllers"];
  window.MindGraph["Globals"]["onSetups"];
  const onSetup = window.MindGraph["Globals"]["onSetup"];
  window.MindGraph["Globals"]["setCanvasInstance"];
  window.MindGraph["Globals"]["clearCanvasInstance"];
  const registerKeyAction = window.MindGraph["Controllers_Keyboard"]["registerKeyAction"];
  window.MindGraph["Controllers_Keyboard"]["getBinding"];
  const objects = window.MindGraph["Manager"]["objects"];
  window.MindGraph["Manager"]["store"];
  window.MindGraph["Manager"]["canvasUpdater"];
  window.MindGraph["Manager"]["updateCanvas"];
  window.MindGraph["Manager"]["tabsUpdater"];
  window.MindGraph["Manager"]["registerOnFileLoaded"];
  window.MindGraph["Manager"]["registerOnFileSaved"];
  window.MindGraph["Manager"]["registerOnBeforeSave"];
  window.MindGraph["Manager"]["registerOnTabCreated"];
  window.MindGraph["Manager"]["getActiveTab"];
  window.MindGraph["Manager"]["getAllTabs"];
  window.MindGraph["Manager"]["saveHistory"];
  window.MindGraph["Manager"]["undo"];
  window.MindGraph["Manager"]["redo"];
  window.MindGraph["Manager"]["canUndo"];
  window.MindGraph["Manager"]["canRedo"];
  window.MindGraph["Manager"]["switchTab"];
  window.MindGraph["Manager"]["switchTabById"];
  window.MindGraph["Manager"]["closeTab"];
  window.MindGraph["Manager"]["closeTabById"];
  window.MindGraph["Manager"]["createNewTab"];
  window.MindGraph["Manager"]["getFilenameFromPath"];
  window.MindGraph["Manager"]["saveDataToFile"];
  window.MindGraph["Manager"]["loadDataFromFile"];
  window.MindGraph["Manager"]["saveFile"];
  window.MindGraph["Manager"]["saveFileAs"];
  window.MindGraph["Manager"]["loadFile"];
  window.MindGraph["Manager"]["hasUnsavedChanges"];
  window.MindGraph["Manager"]["newFile"];
  window.MindGraph["Manager"]["getCurrentFilePath"];
  window.MindGraph["Manager"]["managerAdd"];
  window.MindGraph["Manager"]["managerUpdateId"];
  window.MindGraph["Manager"]["managerUpdate"];
  window.MindGraph["Manager"]["managerUpdateAtom"];
  window.MindGraph["Manager"]["managerDeleteId"];
  window.MindGraph["Manager"]["managerDeleteIdWithEdges"];
  window.MindGraph["Manager"]["clearTabs"];
  console.log("[HelloPlugin] \u811A\u672C\u5F00\u59CB\u89E3\u6790...");
  onSetup(() => {
    console.log("[HelloPlugin] \u6B63\u5728\u6267\u884C Setup \u521D\u59CB\u5316 (\u753B\u5E03\u5DF2\u5C31\u4F4D)");
    registerKeyAction({
      action: "plugin.hello_world.toast",
      handler: () => {
        const nodeCount = Object.keys(objects).length;
        alert(`\u4F60\u597D\uFF01\u6765\u81EA\u63D2\u4EF6\u7684\u95EE\u5019\u3002
\u5F53\u524D\u753B\u5E03\u4E0A\u6709 ${nodeCount} \u4E2A\u5BF9\u8C61\u3002`);
      },
      settings: {
        id: "plugin.hello_world.toast",
        category: "\u793A\u4F8B\u63D2\u4EF6",
        title: "\u6253\u4E2A\u62DB\u547C",
        type: "key",
        defaultValue: "Ch",
        value: "Ch",
        description: "\u6309\u4E0B Ctrl + H \u89E6\u53D1\u63D2\u4EF6\u5F39\u7A97"
      }
    });
    console.log("[HelloPlugin] \u5FEB\u6377\u952E Ctrl+H \u5DF2\u6CE8\u518C");
    return () => {
      console.log("[HelloPlugin] \u63D2\u4EF6\u5DF2\u5378\u8F7D\u6E05\u7406");
    };
  });
})();
//# sourceMappingURL=index.js.map
