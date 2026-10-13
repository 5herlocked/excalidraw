import { DEFAULT_ZOOM } from "@excalidraw/common";

import { getHoveredElementForBinding } from "./collision";
import { bindBindingElement } from "./binding";
import { LinearElementEditor } from "./linearElementEditor";
import { isArrowElement } from "./typeChecks";
import { isNonDeletedElement } from ".";

import type { Zoom } from "@excalidraw/excalidraw/types";
import type {
  BindMode,
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  NonDeleted,
  NonDeletedSceneElementsMap,
} from "./types";
import type { Scene } from "./Scene";

export type UnconnectedArrow = {
  element: NonDeleted<ExcalidrawArrowElement>;
  startUnbound: boolean;
  endUnbound: boolean;
};

export type SuggestedArrowBindings = {
  start: NonDeleted<ExcalidrawBindableElement> | null;
  end: NonDeleted<ExcalidrawBindableElement> | null;
};

export const getUnconnectedArrows = (
  elementsMap: Readonly<ElementsMap>,
): UnconnectedArrow[] => {
  const result: UnconnectedArrow[] = [];

  for (const element of elementsMap.values()) {
    if (isArrowElement(element) && isNonDeletedElement(element)) {
      const startUnbound = !element.startBinding;
      const endUnbound = !element.endBinding;
      if (startUnbound || endUnbound) {
        result.push({ element, startUnbound, endUnbound });
      }
    }
  }

  return result;
};

export const getSuggestedBindingsForArrow = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  elementsMap: NonDeletedSceneElementsMap,
  zoom: Zoom,
): SuggestedArrowBindings => {
  const nonDeletedElements = Array.from(elementsMap.values());
  const getCandidate = (index: 0 | -1) =>
    // This uses the same binding-distance, occlusion, and candidate-priority
    // semantics as endpoint dragging; getHoveredElementForBinding delegates to
    // getBindingCandidates internally.
    getHoveredElementForBinding(
      LinearElementEditor.getPointAtIndexGlobalCoordinates(
        arrow,
        index,
        elementsMap,
      ),
      nonDeletedElements,
      elementsMap,
      zoom,
    );

  return {
    start: arrow.startBinding ? null : getCandidate(0),
    end: arrow.endBinding ? null : getCandidate(-1),
  };
};

export const fixArrowBinding = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  candidate: NonDeleted<ExcalidrawBindableElement>,
  startOrEnd: "start" | "end",
  scene: Scene,
  zoom: Zoom = DEFAULT_ZOOM,
  mode: BindMode = "orbit",
): void => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const focusPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    arrow,
    startOrEnd === "start" ? 0 : -1,
    elementsMap,
  );

  bindBindingElement(
    arrow,
    candidate,
    mode,
    startOrEnd,
    scene,
    zoom,
    focusPoint,
  );
};
