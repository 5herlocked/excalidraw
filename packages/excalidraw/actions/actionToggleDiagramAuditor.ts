import { DEFAULT_SIDEBAR, DIAGRAM_AUDITOR_TAB } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { alertTriangleIcon } from "../components/icons";

import { register } from "./register";

export const actionToggleDiagramAuditor = register({
  name: "diagramAuditor",
  icon: alertTriangleIcon,
  keywords: ["diagram", "audit", "arrow", "binding"],
  label: "diagramAuditor.title",
  viewMode: true,
  trackEvent: { category: "menu", action: "toggleDiagramAuditor" },
  perform(elements, appState) {
    return {
      appState: {
        openSidebar:
          appState.openSidebar?.name === DEFAULT_SIDEBAR.name &&
          appState.openSidebar.tab === DIAGRAM_AUDITOR_TAB
            ? null
            : {
                name: DEFAULT_SIDEBAR.name,
                tab: DIAGRAM_AUDITOR_TAB,
              },
        openDialog: null,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});
