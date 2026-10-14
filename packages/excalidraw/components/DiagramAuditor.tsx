import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";

import { EVENT, KEYS, addEventListener } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  Scene,
  deepCopyElement,
  fixArrowBinding,
  getCommonBounds,
  getBoundTextElement,
  getSuggestedBindingsForArrow,
  getUnconnectedArrows,
  isArrowElement,
  isBindableElement,
  makeNextSelectedElementIds,
  newElementWith,
} from "@excalidraw/element";
import type { UnconnectedArrow } from "@excalidraw/element";
import type {
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { atom, useAtom } from "../editor-jotai";
import { useStable } from "../hooks/useStable";
import { t } from "../i18n";
import { useApp, useExcalidrawSetAppState } from "./App";
import { Button } from "./Button";
import { RetryIcon, collapseDownIcon, upIcon } from "./icons";

import "./DiagramAuditor.scss";

export const diagramAuditorItemInFocusAtom = atom<number | null>(null);

export const DiagramAuditor = () => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();
  const [results, setResults] = useState<UnconnectedArrow[]>([]);
  const [focusIndex, setFocusIndex] = useAtom(diagramAuditorItemInFocusAtom);
  const lastSceneNonceRef = useRef<number | undefined>(undefined);
  const resultsRef = useRef(results);
  const focusIndexRef = useRef(focusIndex);
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const sceneNonce = app.scene.getSceneNonce();

  resultsRef.current = results;
  focusIndexRef.current = focusIndex;

  const stableScanState = useStable({ app, setFocusIndex });
  const scan = () => {
    const nextResults = getUnconnectedArrows(
      stableScanState.app.scene.getNonDeletedElementsMap(),
    );
    setResults(nextResults);
    lastSceneNonceRef.current = stableScanState.app.scene.getSceneNonce();
    stableScanState.setFocusIndex((index) =>
      index !== null && index >= nextResults.length ? null : index,
    );
  };
  const stableScan = useStable({ scan });

  useEffect(() => {
    if (
      lastSceneNonceRef.current === undefined ||
      (app.state.diagramAuditorAutoRescan &&
        lastSceneNonceRef.current !== app.scene.getSceneNonce())
    ) {
      stableScan.scan();
    }
  }, [elementsMap, app.state.diagramAuditorAutoRescan, stableScan]);

  const focusResult = (index: number) => {
    const result = resultsRef.current[index];
    if (!result) {
      return;
    }

    setFocusIndex(index);
    setAppState((state) => ({
      selectedElementIds: makeNextSelectedElementIds(
        { [result.element.id]: true },
        state,
      ),
    }));
    app.viewport.setViewport({
      target: getCommonBounds([result.element]),
      fit: "scale-down",
      animation: { duration: 300 },
      offsets: { ui: true },
    });
  };

  const goToNextItem = () => {
    const currentResults = resultsRef.current;
    const currentIndex = focusIndexRef.current;
    if (currentResults.length) {
      focusResult(
        currentIndex === null ? 0 : (currentIndex + 1) % currentResults.length,
      );
    }
  };

  const goToPreviousItem = () => {
    const currentResults = resultsRef.current;
    const currentIndex = focusIndexRef.current;
    if (currentResults.length) {
      focusResult(
        currentIndex === null || currentIndex === 0
          ? currentResults.length - 1
          : currentIndex - 1,
      );
    }
  };

  const stableState = useStable({
    goToNextItem,
    goToPreviousItem,
    resultsLength: results.length,
  });

  useEffect(() => {
    const eventHandler = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof app.ownerWindow.HTMLElement &&
        target.closest(".layer-ui__diagram-auditor") &&
        stableState.resultsLength
      ) {
        if (event.key === KEYS.ENTER || event.key === KEYS.ARROW_DOWN) {
          event.preventDefault();
          event.stopPropagation();
          stableState.goToNextItem();
        } else if (event.key === KEYS.ARROW_UP) {
          event.preventDefault();
          event.stopPropagation();
          stableState.goToPreviousItem();
        }
      }
    };

    return addEventListener(app.ownerWindow, EVENT.KEYDOWN, eventHandler, {
      capture: true,
      passive: false,
    });
  }, [app, stableState]);

  useEffect(
    () => () => {
      setFocusIndex(null);
    },
    [setFocusIndex],
  );

  const resultCount = `${results.length} ${
    results.length === 1
      ? t("diagramAuditor.singleResult")
      : t("diagramAuditor.multipleResults")
  }`;

  const suggestions = useMemo(
    () =>
      results.map((result) => ({
        result,
        bindings: getSuggestedBindingsForArrow(
          result.element,
          elementsMap,
          app.state.zoom,
        ),
      })),
    [results, sceneNonce, app.state.zoom, app.scene],
  );
  const fixableCount = suggestions.filter(
    ({ bindings }) => bindings.start || bindings.end,
  ).length;

  const fixResults = (items: typeof suggestions) => {
    let fixed = false;
    const currentElements = app.scene
      .getElementsIncludingDeleted()
      .map((element) => deepCopyElement(element));
    const currentElementsMap = new Map(
      currentElements
        .filter((element) => !element.isDeleted)
        .map((element) => [element.id, element as NonDeletedExcalidrawElement]),
    ) as NonDeletedSceneElementsMap;
    const fixingScene = new Scene(currentElements, { skipValidation: true });
    const currentResults = new Map(
      getUnconnectedArrows(currentElementsMap).map((result) => [
        result.element.id,
        result,
      ]),
    );

    for (const { result } of items) {
      const currentResult = currentResults.get(result.element.id);
      if (!currentResult) {
        continue;
      }

      const bindings = getSuggestedBindingsForArrow(
        currentResult.element,
        currentElementsMap,
        app.state.zoom,
      );
      const arrow = currentElementsMap.get(currentResult.element.id);
      if (!arrow || !isArrowElement(arrow)) {
        continue;
      }

      if (bindings.start) {
        const candidate = currentElementsMap.get(bindings.start.id);
        if (candidate && isBindableElement(candidate)) {
          fixArrowBinding(
            arrow,
            candidate,
            "start",
            fixingScene,
            app.state.zoom,
          );
          fixed = true;
        }
      }
      if (bindings.end) {
        const candidate = currentElementsMap.get(bindings.end.id);
        if (candidate && isBindableElement(candidate)) {
          fixArrowBinding(arrow, candidate, "end", fixingScene, app.state.zoom);
          fixed = true;
        }
      }
    }

    if (fixed) {
      const fixedElementsMap = new Map(
        currentElements.map((element) => [element.id, element]),
      );
      const nextElements = app.scene
        .getElementsIncludingDeleted()
        .map((element) => {
          const fixedElement = fixedElementsMap.get(element.id);
          if (!fixedElement) {
            return element;
          }
          if (isArrowElement(element) && isArrowElement(fixedElement)) {
            return newElementWith(element, {
              startBinding: fixedElement.startBinding,
              endBinding: fixedElement.endBinding,
            });
          }
          return newElementWith(element, {
            boundElements: fixedElement.boundElements,
          });
        });
      app.syncActionResult({
        elements: nextElements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      scan();
    }
  };

  return (
    <div className="layer-ui__diagram-auditor">
      <div className="layer-ui__diagram-auditor-header">
        <div>
          <h3>{t("diagramAuditor.title")}</h3>
          <p>{t("diagramAuditor.description")}</p>
        </div>
        <Button className="rescan-button" onSelect={stableScan.scan}>
          {RetryIcon}
          <span>{t("diagramAuditor.rescan")}</span>
        </Button>
      </div>

      <label className="layer-ui__diagram-auditor-auto-rescan">
        <input
          type="checkbox"
          checked={app.state.diagramAuditorAutoRescan}
          onChange={(event) =>
            setAppState({ diagramAuditorAutoRescan: event.target.checked })
          }
        />
        {t("diagramAuditor.autoRescan")}
      </label>

      <div className="layer-ui__diagram-auditor-count">
        {results.length ? (
          <>
            <div>
              {focusIndex !== null ? `${focusIndex + 1} / ` : ""}
              {resultCount}
            </div>
            <Button
              className="fix-all-button"
              onSelect={() => fixResults(suggestions)}
              disabled={!fixableCount}
            >
              {t("diagramAuditor.fixAll")}
            </Button>
            <div className="result-nav">
              <Button className="result-nav-btn" onSelect={goToNextItem}>
                {collapseDownIcon}
              </Button>
              <Button className="result-nav-btn" onSelect={goToPreviousItem}>
                {upIcon}
              </Button>
            </div>
          </>
        ) : (
          <div className="empty-state">{t("diagramAuditor.noIssues")}</div>
        )}
      </div>

      <div className="layer-ui__diagram-auditor-results">
        {suggestions.map(({ result, bindings }, index) => {
          const boundText = getBoundTextElement(result.element, elementsMap);
          const resultTitle = boundText?.text.trim()
            ? boundText.text.trim()
            : t("diagramAuditor.arrowAt", {
                x: Math.round(result.element.x),
                y: Math.round(result.element.y),
              });
          const endpointLabel =
            result.startUnbound && result.endUnbound
              ? t("diagramAuditor.bothUnbound")
              : result.startUnbound
              ? t("diagramAuditor.startUnbound")
              : t("diagramAuditor.endUnbound");

          const isFixable = !!(bindings.start || bindings.end);

          return (
            <div
              key={result.element.id}
              className={clsx("layer-ui__diagram-auditor-result", {
                active: focusIndex === index,
              })}
              onClick={(event) => {
                if (!(event.target as HTMLElement).closest(".fix-button")) {
                  focusResult(index);
                }
              }}
              ref={(node) => {
                if (focusIndex === index) {
                  node?.scrollIntoView({ behavior: "auto", block: "nearest" });
                }
              }}
            >
              <button type="button" className="result-content">
                <span className="result-title">{resultTitle}</span>
                <span className="result-detail">{endpointLabel}</span>
              </button>
              {isFixable ? (
                <Button
                  className="fix-button"
                  onSelect={() => fixResults([{ result, bindings }])}
                >
                  {t("diagramAuditor.fix")}
                </Button>
              ) : (
                <span className="unfixable">
                  {t("diagramAuditor.unfixable")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
