import { Controllers } from "../Globals";
import { openItemListPanel } from "../TopLayer/ItemListPanel";

// 监听打开物品列表面板事件
const onOpenItemList = () => {
  openItemListPanel();
};

Controllers.push({
  Begin: () => {
    window.addEventListener("open-item-list", onOpenItemList);
  },
  End: () => {
    window.removeEventListener("open-item-list", onOpenItemList);
  },
});
