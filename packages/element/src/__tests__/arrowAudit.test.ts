import { DEFAULT_ZOOM } from "@excalidraw/common";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { getNormalizedZoom } from "@excalidraw/excalidraw/scene";

import {
  fixArrowBinding,
  getSuggestedBindingsForArrow,
  getUnconnectedArrows,
} from "..";
import { Scene } from "../Scene";

import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  NonDeleted,
} from "../types";

describe("arrow audit", () => {
  it("reports non-deleted arrows with missing bindings", () => {
    const unbound = API.createElement({ type: "arrow" });
    const halfBound = API.createElement({
      type: "arrow",
      startBinding: {
        elementId: "target",
        fixedPoint: [0.5, 0.5],
        mode: "orbit",
      },
    });
    const degenerate = API.createElement({
      type: "arrow",
      points: [pointFrom<LocalPoint>(0, 0)],
    });
    const deleted = {
      ...API.createElement({ type: "arrow" }),
      isDeleted: true as const,
    };
    const scene = new Scene([unbound, halfBound, degenerate, deleted], {
      skipValidation: true,
    });

    expect(
      getUnconnectedArrows(scene.getElementsMapIncludingDeleted()).map(
        ({ element, startUnbound, endUnbound }) => ({
          id: element.id,
          startUnbound,
          endUnbound,
        }),
      ),
    ).toEqual([
      { id: unbound.id, startUnbound: true, endUnbound: true },
      { id: halfBound.id, startUnbound: false, endUnbound: true },
      { id: degenerate.id, startUnbound: true, endUnbound: true },
    ]);
  });

  it("suggests nearby binding targets only for unbound endpoints", () => {
    const startTarget = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const endTarget = API.createElement({
      type: "ellipse",
      x: 200,
      y: 0,
      width: 100,
      height: 100,
    });
    const arrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 50,
      width: 100,
      height: 0,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 0),
      ],
    }) as NonDeleted<ExcalidrawArrowElement>;
    const scene = new Scene([startTarget, endTarget, arrow], {
      skipValidation: true,
    });

    expect(
      getSuggestedBindingsForArrow(
        arrow,
        scene.getNonDeletedElementsMap(),
        DEFAULT_ZOOM,
      ),
    ).toEqual({ start: startTarget, end: endTarget });
  });

  it("returns null for endpoints that are already bound", () => {
    const target = API.createElement({
      type: "rectangle",
      x: 200,
      y: 0,
      width: 100,
      height: 100,
    });
    const arrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 50,
      width: 100,
      height: 0,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 0),
      ],
      startBinding: {
        elementId: target.id,
        fixedPoint: [0.5, 0.5],
        mode: "orbit",
      },
    }) as NonDeleted<ExcalidrawArrowElement>;
    const scene = new Scene([target, arrow], { skipValidation: true });

    expect(
      getSuggestedBindingsForArrow(
        arrow,
        scene.getNonDeletedElementsMap(),
        DEFAULT_ZOOM,
      ),
    ).toEqual({ start: null, end: target });
  });

  it("returns null when an unbound endpoint is far from any target", () => {
    const target = API.createElement({
      type: "rectangle",
      x: 500,
      y: 500,
      width: 100,
      height: 100,
    });
    const arrow = API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      width: 100,
      height: 0,
    }) as NonDeleted<ExcalidrawArrowElement>;
    const scene = new Scene([target, arrow], { skipValidation: true });

    expect(
      getSuggestedBindingsForArrow(
        arrow,
        scene.getNonDeletedElementsMap(),
        DEFAULT_ZOOM,
      ),
    ).toEqual({ start: null, end: null });
  });

  it("uses the zoom-dependent binding distance for suggestions", () => {
    const target = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const arrow = API.createElement({
      type: "arrow",
      x: 115,
      y: 50,
      width: 100,
      height: 0,
    }) as NonDeleted<ExcalidrawArrowElement>;
    const scene = new Scene([target, arrow], { skipValidation: true });
    expect(
      getSuggestedBindingsForArrow(
        arrow,
        scene.getNonDeletedElementsMap(),
        { value: getNormalizedZoom(0.5) },
      ).start,
    ).toBe(target);
    expect(
      getSuggestedBindingsForArrow(
        arrow,
        scene.getNonDeletedElementsMap(),
        { value: getNormalizedZoom(2) },
      ).start,
    ).toBeNull();
  });

  it("prefers the highest opaque target when candidates overlap", () => {
    const backTarget = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const frontTarget = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "blue",
      fillStyle: "solid",
    });
    const arrow = API.createElement({
      type: "arrow",
      x: 50,
      y: 50,
      width: 100,
      height: 0,
    }) as NonDeleted<ExcalidrawArrowElement>;
    const scene = new Scene([backTarget, frontTarget, arrow], {
      skipValidation: true,
    });

    expect(
      getSuggestedBindingsForArrow(
        arrow,
        scene.getNonDeletedElementsMap(),
        DEFAULT_ZOOM,
      ).start,
    ).toBe(frontTarget);
  });

  it("binds the requested endpoint and updates the target", () => {
    const target = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    }) as NonDeleted<ExcalidrawBindableElement>;
    const arrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 50,
      width: 100,
      height: 0,
    }) as NonDeleted<ExcalidrawArrowElement>;
    const scene = new Scene([target, arrow], { skipValidation: true });

    fixArrowBinding(arrow, target, "start", scene);

    expect(arrow.startBinding?.elementId).toBe(target.id);
    expect(target.boundElements).toContainEqual({ id: arrow.id, type: "arrow" });
  });

  it("binds the end endpoint", () => {
    const target = API.createElement({
      type: "rectangle",
      x: 200,
      y: 0,
      width: 100,
      height: 100,
    }) as NonDeleted<ExcalidrawBindableElement>;
    const arrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 50,
      width: 100,
      height: 0,
    }) as NonDeleted<ExcalidrawArrowElement>;
    const scene = new Scene([target, arrow], { skipValidation: true });

    fixArrowBinding(arrow, target, "end", scene, DEFAULT_ZOOM, "inside");

    expect(arrow.endBinding?.elementId).toBe(target.id);
    expect(arrow.endBinding?.mode).toBe("inside");
    expect(arrow.startBinding).toBeNull();
    expect(target.boundElements).toContainEqual({ id: arrow.id, type: "arrow" });
  });

  it("binds elbow arrow endpoints using fixed-point calculation", () => {
    const target = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    }) as NonDeleted<ExcalidrawBindableElement>;
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 100,
      y: 50,
      width: 100,
      height: 100,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 0),
        pointFrom<LocalPoint>(100, 100),
      ],
    }) as NonDeleted<ExcalidrawArrowElement>;
    const scene = new Scene([target, arrow], { skipValidation: true });

    fixArrowBinding(arrow, target, "start", scene);

    expect(arrow.startBinding).toEqual(
      expect.objectContaining({
        elementId: target.id,
        fixedPoint: expect.any(Array),
        mode: "orbit",
      }),
    );
    expect(arrow.startBinding?.fixedPoint).toHaveLength(2);
    expect(target.boundElements).toContainEqual({ id: arrow.id, type: "arrow" });
  });
});
