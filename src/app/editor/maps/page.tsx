"use client";

import { useEffect, useRef, useState } from "react";
import {
  EditorLayout,
  NumberField,
  TextField,
  useCrud,
} from "@/components/editor/crud";
import { MAX_PATHS, PATH_COLORS } from "@/game/constants";
import type { MapDef, TileType } from "@/game/types";

const TILE = 36;

const TILE_FILL: Record<TileType, string> = {
  empty: "#0b1220",
  buildable: "#16233a",
  path: "#3b3325",
  blocked: "#1c1017",
};

type Tool = "path" | "buildable" | "blocked" | "erase";

function makeTiles(cols: number, rows: number, prev?: TileType[][]): TileType[][] {
  return Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => prev?.[y]?.[x] ?? "empty")
  );
}

function blank(): MapDef {
  return {
    id: "",
    name: "",
    region: "",
    cols: 12,
    rows: 9,
    tiles: makeTiles(12, 9),
    paths: [[]],
    description: "",
  };
}

export default function MapsEditor() {
  const { items, save, remove, error, busy } = useCrud<MapDef>("maps");
  const [draft, setDraft] = useState<MapDef>(blank());
  const [isNew, setIsNew] = useState(true);
  const [tool, setTool] = useState<Tool>("path");
  const [activePath, setActivePath] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const set = <K extends keyof MapDef>(k: K, v: MapDef[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const resize = (cols: number, rows: number) => {
    cols = Math.max(4, Math.min(30, cols));
    rows = Math.max(4, Math.min(20, rows));
    setDraft((d) => ({
      ...d,
      cols,
      rows,
      tiles: makeTiles(cols, rows, d.tiles),
      paths: d.paths.map((p) => p.filter((pt) => pt.x < cols && pt.y < rows)),
    }));
  };

  // ---- 그리기 ----
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < draft.rows; y++) {
      for (let x = 0; x < draft.cols; x++) {
        ctx.fillStyle = TILE_FILL[draft.tiles[y]?.[x] ?? "empty"];
        ctx.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
      }
    }

    // 경로별 선 + 순서 표시
    draft.paths.forEach((path, pi) => {
      if (path.length === 0) return;
      const color = PATH_COLORS[pi % PATH_COLORS.length];
      const dim = pi !== activePath;

      ctx.strokeStyle = color;
      ctx.globalAlpha = dim ? 0.35 : 1;
      ctx.lineWidth = 2;
      ctx.beginPath();
      path.forEach((p, i) => {
        const cx = (p.x + 0.5) * TILE;
        const cy = (p.y + 0.5) * TILE;
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();

      path.forEach((p, i) => {
        const cx = (p.x + 0.5) * TILE;
        const cy = (p.y + 0.5) * TILE;
        ctx.fillStyle = i === 0 ? "#4ade80" : i === path.length - 1 ? "#f87171" : color;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), cx, cy);
      });
      ctx.globalAlpha = 1;
    });
  }, [draft, activePath]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE);
    const y = Math.floor((e.clientY - rect.top) / TILE);
    if (x < 0 || x >= draft.cols || y < 0 || y >= draft.rows) return;

    setDraft((d) => {
      const tiles = d.tiles.map((row) => [...row]);
      const paths = d.paths.map((p) => [...p]);

      if (tool === "path") {
        const path = paths[activePath] ?? [];
        const prev = path[path.length - 1];
        path.push({ x, y });
        if (prev) {
          let cx = prev.x;
          let cy = prev.y;
          while (cx !== x || cy !== y) {
            tiles[cy][cx] = "path";
            cx += Math.sign(x - cx);
            cy += Math.sign(y - cy);
          }
        }
        tiles[y][x] = "path";
        paths[activePath] = path;
      } else if (tool === "erase") {
        tiles[y][x] = "empty";
        for (let pi = 0; pi < paths.length; pi++) {
          paths[pi] = paths[pi].filter((p) => !(p.x === x && p.y === y));
        }
      } else {
        tiles[y][x] = tool;
      }
      return { ...d, tiles, paths };
    });
  };

  const addPath = () => {
    if (draft.paths.length >= MAX_PATHS) return;
    set("paths", [...draft.paths, []]);
    setActivePath(draft.paths.length);
    setTool("path");
  };

  const removePath = (pi: number) => {
    if (draft.paths.length <= 1) return;
    setDraft((d) => {
      const paths = d.paths.filter((_, i) => i !== pi);
      // 삭제된 경로의 타일 중 다른 경로가 쓰지 않는 타일은 정리
      const used = new Set(paths.flat().map((p) => `${p.x},${p.y}`));
      const removedTiles = new Set(d.paths[pi].map((p) => `${p.x},${p.y}`));
      const tiles = d.tiles.map((row, y) =>
        row.map((t, x) =>
          t === "path" && removedTiles.has(`${x},${y}`) && !used.has(`${x},${y}`)
            ? "empty"
            : t
        )
      );
      return { ...d, paths, tiles };
    });
    setActivePath(0);
  };

  const clearPath = (pi: number) => {
    setDraft((d) => {
      const paths = d.paths.map((p, i) => (i === pi ? [] : [...p]));
      const used = new Set(paths.flat().map((p) => `${p.x},${p.y}`));
      const removedTiles = new Set(d.paths[pi].map((p) => `${p.x},${p.y}`));
      const tiles = d.tiles.map((row, y) =>
        row.map((t, x) =>
          t === "path" && removedTiles.has(`${x},${y}`) && !used.has(`${x},${y}`)
            ? "empty"
            : t
        )
      );
      return { ...d, paths, tiles };
    });
  };

  /** 경로 인접 빈 타일을 건설 가능으로 자동 채우기 */
  const autoBuildable = () => {
    setDraft((d) => {
      const tiles = d.tiles.map((row) => [...row]);
      for (let y = 0; y < d.rows; y++) {
        for (let x = 0; x < d.cols; x++) {
          if (tiles[y][x] !== "empty") continue;
          let near = false;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              if (ny >= 0 && ny < d.rows && nx >= 0 && nx < d.cols && tiles[ny][nx] === "path") near = true;
            }
          }
          if (near) tiles[y][x] = "buildable";
        }
      }
      return { ...d, tiles };
    });
  };

  const valid = draft.id && draft.name && draft.paths.some((p) => p.length >= 2);

  return (
    <EditorLayout
      title="🗺️ 맵 에디터"
      error={error}
      list={
        <div className="space-y-1">
          <button
            className="btn btn-primary mb-2 w-full"
            onClick={() => {
              setDraft(blank());
              setIsNew(true);
              setActivePath(0);
            }}
          >
            + 새 맵
          </button>
          {items.map((m) => (
            <button
              key={m.id}
              className={`btn w-full text-left text-xs ${draft.id === m.id && !isNew ? "border-amber-500" : ""}`}
              onClick={() => {
                setDraft(structuredClone(m));
                setIsNew(false);
                setActivePath(0);
              }}
            >
              🗺️ {m.name}{" "}
              <span className="text-slate-500">
                ({m.cols}×{m.rows} · 경로 {m.paths.length})
              </span>
            </button>
          ))}
        </div>
      }
      form={
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <TextField label="ID (고유값)" value={draft.id} onChange={(v) => set("id", v)} placeholder="map-xxx" disabled={!isNew} />
            <TextField label="이름" value={draft.name} onChange={(v) => set("name", v)} />
            <TextField label="지역 (테마)" value={draft.region ?? ""} onChange={(v) => set("region", v || undefined)} />
            <NumberField label="가로 (칸)" value={draft.cols} onChange={(v) => resize(v, draft.rows)} />
            <NumberField label="세로 (칸)" value={draft.rows} onChange={(v) => resize(draft.cols, v)} />
          </div>

          {/* 경로 관리 */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-400">경로 ({draft.paths.length}/{MAX_PATHS}):</span>
            {draft.paths.map((p, pi) => (
              <span key={pi} className="flex items-center gap-1">
                <button
                  className={`btn ${activePath === pi && tool === "path" ? "border-amber-500 bg-amber-500/10" : ""}`}
                  style={{ color: PATH_COLORS[pi % PATH_COLORS.length] }}
                  onClick={() => {
                    setActivePath(pi);
                    setTool("path");
                  }}
                >
                  경로 {pi + 1} ({p.length})
                </button>
                <button className="btn px-1.5" title="이 경로 비우기" onClick={() => clearPath(pi)}>
                  ↺
                </button>
                {draft.paths.length > 1 && (
                  <button className="btn btn-danger px-1.5" title="경로 삭제" onClick={() => removePath(pi)}>
                    ×
                  </button>
                )}
              </span>
            ))}
            {draft.paths.length < MAX_PATHS && (
              <button className="btn" onClick={addPath}>
                + 경로 추가
              </button>
            )}
          </div>

          {/* 도구 */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-400">도구:</span>
            {(
              [
                ["path", "🚩 경로 그리기"],
                ["buildable", "🟦 건설 가능"],
                ["blocked", "⬛ 차단"],
                ["erase", "🧽 지우개"],
              ] as [Tool, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                className={`btn ${tool === t ? "border-amber-500 bg-amber-500/10" : ""}`}
                onClick={() => setTool(t)}
              >
                {label}
              </button>
            ))}
            <button className="btn" onClick={autoBuildable}>
              경로 주변 자동 건설타일
            </button>
          </div>

          <div className="overflow-auto rounded border border-slate-800 p-1">
            <canvas
              ref={canvasRef}
              width={draft.cols * TILE}
              height={draft.rows * TILE}
              className="cursor-crosshair"
              onClick={handleClick}
            />
          </div>
          <p className="text-[10px] text-slate-500">
            선택한 경로에 클릭 순서대로 웨이포인트가 추가됩니다. 첫 클릭 = 출발지(초록),
            마지막 클릭 = 도착지(빨강). 경로가 여러 개면 적들이 경로에 번갈아 배정됩니다.
          </p>

          <TextField label="설명" value={draft.description ?? ""} onChange={(v) => set("description", v)} />

          <div className="flex items-center gap-2">
            <button className="btn btn-primary" disabled={busy || !valid} onClick={() => save(draft, isNew).then((ok) => ok && setIsNew(false))}>
              {isNew ? "생성" : "수정 저장"}
            </button>
            {!isNew && (
              <button className="btn btn-danger" disabled={busy} onClick={() => remove(draft.id).then((ok) => { if (ok) { setDraft(blank()); setIsNew(true); } })}>
                삭제
              </button>
            )}
            {!valid && (
              <span className="text-xs text-slate-500">
                ID·이름 입력 + 웨이포인트 2개 이상인 경로 1개 이상 필요
              </span>
            )}
          </div>
        </div>
      }
    />
  );
}
