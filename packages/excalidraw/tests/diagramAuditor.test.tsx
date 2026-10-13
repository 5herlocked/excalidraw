import React from "react";

import { pointFrom } from "@excalidraw/math";

import { DEFAULT_SIDEBAR, DIAGRAM_AUDITOR_TAB, KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { actionToggleDiagramAuditor } from "../actions";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { fireEvent, render, waitFor } from "./test-utils";

const { h } = window;

describe("diagram auditor", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  const openAuditor = async () => {
    API.setAppState({
      openSidebar: {
        name: DEFAULT_SIDEBAR.name,
        tab: DIAGRAM_AUDITOR_TAB,
      },
    });

    return waitFor(() => {
      const auditor =
        h.app.excalidrawContainerValue.container?.querySelector<HTMLElement>(
          ".layer-ui__diagram-auditor",
        );
      expect(auditor).not.toBeNull();
      return auditor!;
    });
  };

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

  it("fixes an individual arrow and makes the fix undoable", async () => {
    const targets = [
      API.createElement({ type: "rectangle", x: 0, y: 0 }),
      API.createElement({ type: "rectangle", x: 0, y: 300 }),
    ];
    const arrows = targets.map((target) =>
      API.createElement({
        type: "arrow",
        x: 100,
        y: target.y + 50,
        points: [pointFrom(0, 0), pointFrom(200, 0)],
      }),
    );
    API.setElements([...targets, ...arrows]);

    const auditor = await openAuditor();
    const fixButtons = await waitFor(() => {
      const buttons =
        auditor.querySelectorAll<HTMLButtonElement>(".fix-button");
      expect(buttons).toHaveLength(2);
      return buttons;
    });
    fireEvent.click(fixButtons[0]);

    const fixedArrow = await waitFor(() => {
      const fixed = arrows.find(
        (arrow) =>
          API.getElement(arrow).startBinding ||
          API.getElement(arrow).endBinding,
      );
      expect(fixed).toBeDefined();
      return fixed!;
    });
    const unfixedArrow = arrows.find((arrow) => arrow.id !== fixedArrow.id)!;
    {
      const binding =
        API.getElement(fixedArrow).startBinding ||
        API.getElement(fixedArrow).endBinding;
      expect(targets.map((target) => target.id)).toContain(binding?.elementId);
    }
    expect(API.getElement(unfixedArrow).startBinding).toBeNull();
    expect(API.getElement(unfixedArrow).endBinding).toBeNull();

    await waitFor(() => expect(API.getUndoStack().length).toBeGreaterThan(0));
  });

  it("fixes every fixable arrow", async () => {
    const targets = [
      API.createElement({ type: "rectangle", x: 0, y: 0 }),
      API.createElement({ type: "rectangle", x: 0, y: 300 }),
    ];
    const arrows = targets.map((target) =>
      API.createElement({
        type: "arrow",
        x: 100,
        y: target.y + 50,
        points: [pointFrom(0, 0), pointFrom(200, 0)],
      }),
    );
    API.setElements([...targets, ...arrows]);

    const auditor = await openAuditor();
    fireEvent.click(
      auditor.querySelector<HTMLButtonElement>(".fix-all-button")!,
    );

    await waitFor(() => {
      expect(API.getElement(arrows[0]).startBinding?.elementId).toBe(
        targets[0].id,
      );
      expect(API.getElement(arrows[1]).startBinding?.elementId).toBe(
        targets[1].id,
      );
    });
  });

  it("shows arrows without a nearby candidate as unfixable", async () => {
    const arrow = API.createElement({
      type: "arrow",
      x: 500,
      y: 500,
      points: [pointFrom(0, 0), pointFrom(100, 0)],
    });
    API.setElements([arrow]);

    const auditor = await openAuditor();
    await waitFor(() => {
      expect(auditor.querySelector(".unfixable")).not.toBeNull();
      expect(
        auditor.querySelector<HTMLButtonElement>(".fix-all-button")?.disabled,
      ).toBe(true);
    });
  });

  it("revalidates stale results before fixing", async () => {
    const target = API.createElement({ type: "rectangle", x: 0, y: 0 });
    const arrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 50,
      points: [pointFrom(0, 0), pointFrom(200, 0)],
    });
    API.setElements([target, arrow]);
    API.setAppState({ diagramAuditorAutoRescan: false });

    const auditor = await openAuditor();
    const fixButton = await waitFor(() => {
      const button = auditor.querySelector<HTMLButtonElement>(".fix-button");
      expect(button).not.toBeNull();
      return button!;
    });
    API.updateElement(target, { x: 1000, y: 1000 });
    fireEvent.click(fixButton);

    expect(API.getElement(arrow).startBinding).toBeNull();
    expect(API.getElement(arrow).endBinding).toBeNull();
  });

  it("toggles the auditor sidebar action", () => {
    API.setAppState({ openSidebar: null });

    API.executeAction(actionToggleDiagramAuditor);
    expect(h.state.openSidebar).toEqual({
      name: DEFAULT_SIDEBAR.name,
      tab: DIAGRAM_AUDITOR_TAB,
    });

    API.executeAction(actionToggleDiagramAuditor);
    expect(h.state.openSidebar).toBeNull();
  });
});
