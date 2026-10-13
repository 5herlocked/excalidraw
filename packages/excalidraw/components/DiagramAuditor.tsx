import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import { EVENT, KEYS, addEventListener } from "@excalidraw/common";
import {
  getCommonBounds,
  getBoundTextElement,
  getUnconnectedArrows,
  makeNextSelectedElementIds,
} from "@excalidraw/element";
import type { UnconnectedArrow } from "@excalidraw/element";

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
        {results.map((result, index) => {
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

          return (
            <button
              type="button"
              key={result.element.id}
              className={clsx("layer-ui__diagram-auditor-result", {
                active: focusIndex === index,
              })}
              onClick={() => focusResult(index)}
              ref={(node) => {
                if (focusIndex === index) {
                  node?.scrollIntoView({ behavior: "auto", block: "nearest" });
                }
              }}
            >
              <span className="result-title">{resultTitle}</span>
              <span className="result-detail">{endpointLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
