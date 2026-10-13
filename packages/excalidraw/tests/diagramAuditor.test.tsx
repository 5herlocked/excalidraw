import React from "react";

import {
  DEFAULT_SIDEBAR,
  DIAGRAM_AUDITOR_TAB,
  KEYS,
} from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { fireEvent, render, waitFor } from "./test-utils";

const { h } = window;

describe("diagram auditor", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  it("lists unconnected arrows and selects and zooms to a result", async () => {
    const target = API.createElement({ type: "rectangle", id: "target" });
    const arrows = [
      API.createElement({ type: "arrow" }),
      API.createElement({
        type: "arrow",
        startBinding: {
          elementId: "target",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
      }),
    ];
    API.setElements([target, ...arrows]);
    const setViewport = jest.spyOn(h.app.viewport, "setViewport");

    API.setAppState({
      openSidebar: {
        name: DEFAULT_SIDEBAR.name,
        tab: DIAGRAM_AUDITOR_TAB,
      },
    });

    const auditor = await waitFor(() => {
      const element = h.app.excalidrawContainerValue.container?.querySelector(
        ".layer-ui__diagram-auditor",
      );
      expect(element).not.toBeNull();
      expect(element?.textContent).toContain("Both endpoints are unbound");
      expect(element?.textContent).toContain("End endpoint is unbound");
      return element!;
    });

    const results = auditor.querySelectorAll<HTMLButtonElement>(
      ".layer-ui__diagram-auditor-result",
    );
    expect(results).toHaveLength(2);

    fireEvent.click(results[0]);

    expect(h.state.selectedElementIds).toEqual({ [arrows[0].id]: true });
    expect(setViewport).toHaveBeenCalledWith(
      expect.objectContaining({
        fit: "scale-down",
        animation: { duration: 300 },
      }),
    );

    Keyboard.keyPress(KEYS.ARROW_DOWN, results[0]);
    expect(h.state.selectedElementIds).toEqual({ [arrows[1].id]: true });
  });
});
