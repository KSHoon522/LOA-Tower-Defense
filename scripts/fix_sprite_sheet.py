#!/usr/bin/env python3
"""
AI 생성 스프라이트 시트 정리 — 가짜 투명(체커보드 배경) 제거 + 균일 격자로 재배치

이미지 생성 AI가 "투명 배경"을 회색 체커보드 그림으로 그려 넣고, 프레임 간격도 제각각인 시트를
게임 렌더러(src/game/render.ts)가 읽는 형식(같은 크기 프레임, 줄마다 애니메이션 하나)으로 바꾼다.

1) 테두리에서 체커 두 색과 줄별 칸 크기를 추정
2) 테두리와 이어진 회색 영역 + 두 색이 섞인 배경 구멍을 투명 처리
   (은색 갑옷처럼 배경과 비슷한 색이어도 외곽선 안쪽은 지우지 않음)
3) 발광/이펙트 영역은 언블렌딩해 반투명으로 복원 — 밝은 핵심부는 선명하게, 옅은 빛은 칸 2개 폭 평균으로
   체커 무늬를 상쇄 (AI 이미지의 체커는 칸이 어긋나거나 크기가 섞여 있어 격자를 맞출 수 없음)
4) 줄마다 지정한 프레임 수로 나누고, 머리 위치를 기준점으로 모든 프레임을 같은 칸 크기에 정렬
5) 렌더러용 sprite 설정(JSON)을 출력

사용:
  python3 scripts/fix_sprite_sheet.py 입력.png 출력.png --rows 5,5,6,6 \\
      --anims idle,attack,skill,walk --fps 6,20,10,8 [--src /characters/출력.png]
필요: pip install pillow numpy
"""
import argparse
import json
from collections import deque

import numpy as np
from PIL import Image


# ------------------------------------------------------------
# 체커보드 추정
# ------------------------------------------------------------

def two_colors(border: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """테두리 픽셀을 밝기 기준 2-means로 나눠 어두운/밝은 체커 색 추정"""
    lum = border.mean(axis=1)
    lo, hi = np.percentile(lum, 25), np.percentile(lum, 75)
    c0 = border[lum <= lo].mean(axis=0)
    c1 = border[lum >= hi].mean(axis=0)
    for _ in range(10):
        d0 = np.linalg.norm(border - c0, axis=1)
        d1 = np.linalg.norm(border - c1, axis=1)
        m = d0 < d1
        c0, c1 = border[m].mean(axis=0), border[~m].mean(axis=0)
    return c0, c1


def run_lengths(line: np.ndarray) -> list[int]:
    """라벨(0/1/-1) 한 줄에서 단색 구간 길이"""
    out, start = [], 0
    for i in range(1, len(line) + 1):
        if i == len(line) or line[i] != line[start]:
            if line[start] >= 0:
                out.append(i - start)
            start = i
    return out


def square_size_per_row(lab: np.ndarray) -> np.ndarray:
    """줄마다 체커 칸 크기 추정 (생성 이미지는 위아래로 칸 크기가 다른 경우가 있음)"""
    H = lab.shape[0]
    size = np.full(H, np.nan)
    for y in range(H):
        runs = [r for r in run_lengths(lab[y]) if r >= 4]
        if len(runs) >= 10:
            size[y] = np.median(runs)
    known = np.nonzero(~np.isnan(size))[0]
    for y in range(H):
        if np.isnan(size[y]):
            size[y] = size[known[np.argmin(np.abs(known - y))]]
    return np.array([np.median(size[max(0, y - 12):y + 13]) for y in range(H)])


def box_mean(a: np.ndarray, r: int) -> np.ndarray:
    """(2r+1) 정사각 창 평균 (적분 영상)"""
    H, W = a.shape
    p = np.pad(a, ((r + 1, r), (r + 1, r)), mode="edge")
    c = p.cumsum(0).cumsum(1)
    k = 2 * r + 1
    return (c[k:k + H, k:k + W] - c[:H, k:k + W] - c[k:k + H, :W] + c[:H, :W]) / (k * k)


def local_background(img: np.ndarray, c0: np.ndarray, c1: np.ndarray, size: np.ndarray) -> np.ndarray:
    """
    픽셀마다 원래 체커 색(c0/c1) 추정 — 격자 맞추기 대신 국소 밝기 대비 사용.
    발광이 덮여 있어도 밝은 칸은 주변 평균보다 밝게 남으므로, 칸 크기 2배 창의 평균과 비교해 판정.
    (AI 이미지의 체커는 칸이 어긋나거나 크기가 섞여 있어 전역 격자가 맞지 않음)
    """
    L = img.mean(axis=2)
    H = L.shape[0]
    light = np.zeros(L.shape, bool)
    for r in sorted(set(int(round(s)) for s in size)):
        rows = np.abs(np.round(size) - r) < 0.5
        mean = box_mean(L, max(2, r))
        light[rows] = (L > mean)[rows]
    return np.where(light[..., None], c1, c0)


# ------------------------------------------------------------
# 배경 제거
# ------------------------------------------------------------

NEIGH8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def components(mask: np.ndarray) -> tuple[np.ndarray, int]:
    """8-연결 컴포넌트 라벨링 (scipy 없이)"""
    H, W = mask.shape
    lab = np.zeros((H, W), dtype=np.int32)
    n = 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]:
            continue
        n += 1
        lab[y0, x0] = n
        q = deque([(y0, x0)])
        while q:
            y, x = q.popleft()
            for dy, dx in NEIGH8:
                ny, nx = y + dy, x + dx
                if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n
                    q.append((ny, nx))
    return lab, n


def grow(seed: np.ndarray, allowed: np.ndarray) -> np.ndarray:
    """seed에서 시작해 allowed 픽셀을 따라 8-연결로 확장"""
    H, W = seed.shape
    out = seed & allowed
    q = deque(zip(*np.nonzero(out)))
    while q:
        y, x = q.popleft()
        for dy, dx in NEIGH8:
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and allowed[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                q.append((ny, nx))
    return out


def dilate(mask: np.ndarray) -> np.ndarray:
    out = mask.copy()
    out[1:] |= mask[:-1]
    out[:-1] |= mask[1:]
    out[:, 1:] |= mask[:, :-1]
    out[:, :-1] |= mask[:, 1:]
    return out


def erode(mask: np.ndarray, k: int) -> np.ndarray:
    out = mask
    for _ in range(k):
        out = ~dilate(~out)
    return out


def remove_background(img: np.ndarray, band: int = 14):
    H, W, _ = img.shape
    border = np.concatenate(
        [img[:band].reshape(-1, 3), img[-band:].reshape(-1, 3), img[:, :band].reshape(-1, 3), img[:, -band:].reshape(-1, 3)]
    )
    c0, c1 = two_colors(border)
    seg = c1 - c0
    tol = 0.35 * np.linalg.norm(seg)
    d0 = np.linalg.norm(img - c0, axis=2)
    d1 = np.linalg.norm(img - c1, axis=2)
    lab = np.where(d0 < tol, 0, np.where(d1 < tol, 1, -1))
    size = square_size_per_row(lab)

    # 체커 회색: 두 체커 색을 잇는 선 근처 (조금 더 어둡거나 밝은 칸 얼룩까지 허용)
    t = ((img - c0) @ seg) / (seg @ seg)
    proj = c0 + t[..., None] * seg
    gray_like = (np.linalg.norm(img - proj, axis=2) < 14) & (t > -0.35) & (t < 1.45)

    # 1) 테두리와 이어진 회색 영역
    edge = np.zeros((H, W), bool)
    edge[0] = edge[-1] = True
    edge[:, 0] = edge[:, -1] = True
    background = grow(edge, gray_like)

    # 2) 테두리와 떨어진 배경 구멍(팔과 몸 사이 등): 진짜 체커 칸(두 색 모두)이 들어 있을 때만
    #    — 칸 크기의 1/4만큼 깎아도 두 색 덩어리가 남아야 함
    #    (갑옷 문양처럼 회색 선으로 그린 부분이나 한 가지 회색 영역은 보존)
    comp, n = components(gray_like & ~background)
    for i in range(1, n + 1):
        m = comp == i
        ys, xs = np.nonzero(m)
        if len(ys) < 60:
            continue
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        sub, sub_lab = m[y0:y1, x0:x1], lab[y0:y1, x0:x1]
        k = max(2, int(np.median(size[y0:y1]) / 4))
        if erode(sub & (sub_lab == 0), k).any() and erode(sub & (sub_lab == 1), k).any():
            background[y0:y1, x0:x1] |= sub

    bg = local_background(img, c0, c1, size)

    # 3) 발광/이펙트: 배경과 이어진, 어두운 외곽선이 아닌 영역을 배경색 기준으로 언블렌딩
    L = img.mean(axis=2)
    outline = dilate(L < c0.mean() - 25)
    glow_like = ~background & ~outline & (img >= c0 - 8).all(axis=2)
    halo = grow(dilate(background), glow_like)

    alpha = np.ones((H, W))
    color = img.copy()
    alpha[background] = 0

    # 3-1) 선명한 언블렌딩: 국소 밝기 대비로 추정한 칸 색 기준 (밝은 핵심부는 칸 색 오차 영향이 작음)
    lift = np.clip(img - bg, 0, None)
    a_sharp = np.clip((lift / np.maximum(255 - bg, 1)).max(axis=2), 0, 1)
    c_sharp = np.clip(bg + (img - bg) / np.maximum(a_sharp, 1e-3)[..., None], 0, 255)

    # 3-2) 부드러운 언블렌딩: 체커 평균색 기준 차이를 칸 2개 폭으로 평균 → 밝은/어두운 칸이 상쇄되어 무늬가 사라짐
    #      캐릭터 픽셀은 평균에서 제외(정규화 합성곱), 옅은 가장자리까지 포함해 경계를 부드럽게
    #      (AI 이미지의 체커는 칸이 어긋나 있어 칸 색을 픽셀 단위로 정확히 알 수 없음)
    b_avg = (c0 + c1) / 2
    usable = background | halo
    region = halo.copy()
    for _ in range(int(np.median(size))):
        region = dilate(region) & usable
    lp = np.zeros_like(img)
    for r in sorted(set(int(round(v)) for v in size)):
        rows = np.abs(np.round(size) - r) < 0.5
        w = box_mean(usable.astype(float), r)
        for ch in range(3):
            m = box_mean((img[..., ch] - b_avg[ch]) * usable, r) / np.maximum(w, 1e-3)
            lp[rows, :, ch] = m[rows]
    a_soft = np.clip((lp / (255 - b_avg)).max(axis=2), 0, 1)
    c_soft = np.clip(b_avg + lp / np.maximum(a_soft, 1e-3)[..., None], 0, 255)

    # 어두운 칸으로 보든 밝은 칸으로 보든 알파가 같게 나오는 곳(채널이 포화된 밝은 핵심부)은 선명한 값,
    # 칸 색에 따라 달라지는 옅은/중간 빛은 부드러운 값 (여기서 칸 색을 틀리면 체커 무늬가 남음)
    a_dark = np.clip((np.clip(img - c0, 0, None) / (255 - c0)).max(axis=2), 0, 1)
    a_light = np.clip((np.clip(img - c1, 0, None) / (255 - c1)).max(axis=2), 0, 1)
    wgt = np.clip((0.08 - (a_dark - a_light)) / 0.05, 0, 1)
    a_mix = wgt * a_sharp + (1 - wgt) * a_soft
    # 색은 채널별로: 포화된 채널(≈255)만 선명한 값, 나머지 채널은 체커 무늬가 실려 있으므로 부드러운 값
    # (예: 청록 빛은 G·B가 포화돼 알파≈1이어도 R 채널에 칸 무늬가 남음)
    w_ch = np.clip((img - 245) / 8, 0, 1)
    c_mix = w_ch * c_sharp + (1 - w_ch) * c_soft
    alpha[region] = a_mix[region]
    color[region] = c_mix[region]

    # 4) 외곽선 안티에일리어싱(배경과 섞인 어두운 테두리 1px): 외곽선 색으로 언블렌딩
    ring = dilate(background) & ~background & ~halo
    K = np.array([20.0, 22.0, 30.0])
    diff = np.linalg.norm(img - bg, axis=2)
    a_ring = np.clip(diff / np.maximum(np.linalg.norm(K - bg, axis=2), 1), 0, 1)
    ring_color = np.clip(bg + (img - bg) / np.maximum(a_ring, 1e-3)[..., None], 0, 255)
    alpha[ring] = a_ring[ring]
    color[ring] = ring_color[ring]

    alpha[alpha < 0.06] = 0
    info = {"colors": [c0.round().tolist(), c1.round().tolist()],
            "square_sizes": sorted(set(float(s) for s in np.round(size, 1)))}
    return color, alpha, info


# ------------------------------------------------------------
# 프레임 분할 / 재배치
# ------------------------------------------------------------

def split_runs(profile: np.ndarray, n: int, thr: float = 0.5) -> list[tuple[int, int]]:
    """
    빈 구간(알파 합 ≤ thr)으로 나뉜 덩어리를 n개로 맞춤
    - 많으면 가장 가까운 이웃끼리 합치고(떨어진 이펙트 조각), 적으면 가장 넓은 덩어리를 가장 옅은 열에서 자름
    """
    occ = profile > thr
    runs, start = [], None
    for i, v in enumerate(occ):
        if v and start is None:
            start = i
        if not v and start is not None:
            runs.append([start, i])
            start = None
    if start is not None:
        runs.append([start, len(occ)])
    if not runs:
        raise SystemExit("이미지에 남은 내용이 없습니다")
    # 아주 작은 조각(잡음·떨어진 반짝이)은 개수에 넣지 않고 가장 가까운 이웃에 붙임
    total = float(profile.sum())
    while len(runs) > 1:
        mass = [float(profile[a:b].sum()) for a, b in runs]
        i = int(np.argmin(mass))
        if mass[i] >= total * 0.02:
            break
        left = runs[i][0] - runs[i - 1][1] if i > 0 else np.inf
        right = runs[i + 1][0] - runs[i][1] if i < len(runs) - 1 else np.inf
        j = i - 1 if left <= right else i + 1
        a, b = min(runs[i][0], runs[j][0]), max(runs[i][1], runs[j][1])
        runs[min(i, j):max(i, j) + 1] = [[a, b]]
    while len(runs) > n:
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]
        i = int(np.argmin(gaps))
        runs[i:i + 2] = [[runs[i][0], runs[i + 1][1]]]
    while len(runs) < n:
        i = int(np.argmax([b - a for a, b in runs]))
        a, b = runs[i]
        lo, hi = a + (b - a) // 5, b - (b - a) // 5
        cut = lo + int(np.argmin(profile[lo:hi]))
        runs[i:i + 1] = [[a, cut], [cut, b]]
    return [(a, b) for a, b in runs]


def frame_anchor(a: np.ndarray) -> tuple[float, float]:
    """프레임 기준점: 가장 큰 덩어리(캐릭터 몸)의 머리 중심 x, 몸 세로 중앙 y"""
    solid = a > 0.6
    lab, n = components(solid)
    if n == 0:
        return a.shape[1] / 2, a.shape[0] / 2
    sizes = np.bincount(lab.ravel())[1:]
    main = lab == (int(np.argmax(sizes)) + 1)
    ys, xs = np.nonzero(main)
    top, bottom = ys.min(), ys.max()
    head = main & (np.arange(a.shape[0])[:, None] <= top + (bottom - top) * 0.3)
    hx = np.nonzero(head)[1].mean()
    return float(hx), float((top + bottom) / 2)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--rows", required=True, help="줄별 프레임 수, 예: 5,5,6,6")
    ap.add_argument("--anims", default="idle,attack,skill,walk,death", help="줄 순서대로 애니메이션 이름")
    ap.add_argument("--fps", default="6,20,10,8,8", help="줄 순서대로 fps")
    ap.add_argument("--src", help="설정에 넣을 경로 (기본: /characters/<출력 파일명>)")
    ap.add_argument("--pad", type=int, default=6, help="칸 여백(px)")
    ap.add_argument("--debug", help="배경 제거 결과(재배치 전) 저장 경로")
    args = ap.parse_args()

    counts = [int(c) for c in args.rows.split(",")]
    names = args.anims.split(",")
    fps = [float(f) for f in args.fps.split(",")]

    img = np.asarray(Image.open(args.input).convert("RGB"), dtype=float)
    color, alpha, info = remove_background(img)
    H, W = alpha.shape
    rgba = np.dstack([color, alpha * 255]).round().astype(np.uint8)
    if args.debug:
        Image.fromarray(rgba, "RGBA").save(args.debug)

    # 줄 나누기 → 줄마다 프레임 나누기 (빈 줄/열 기준)
    frames = []  # (row, col, rgba crop, anchor x, anchor y)
    for r, (y0, y1) in enumerate(split_runs(alpha.sum(axis=1), len(counts))):
        n = counts[r]
        band = alpha[y0:y1]
        for c, (x0, x1) in enumerate(split_runs(band.sum(axis=0), n)):
            a = band[:, x0:x1]
            ys, xs = np.nonzero(a > 0.02)
            if len(ys) == 0:
                raise SystemExit(f"빈 프레임: 줄 {r + 1} 칸 {c + 1}")
            t, b, l, rt = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            crop = rgba[y0 + t:y0 + b, x0 + l:x0 + rt]
            ax, ay = frame_anchor(crop[..., 3] / 255)
            frames.append((r, c, crop, ax, ay))

    # 모든 프레임이 들어가는 칸 크기 (기준점을 칸 중앙에 둠)
    hw = max(max(ax, f.shape[1] - ax) for _, _, f, ax, _ in frames) + args.pad
    hh = max(max(ay, f.shape[0] - ay) for _, _, f, _, ay in frames) + args.pad
    cw, ch = int(np.ceil(hw * 2)), int(np.ceil(hh * 2))
    sheet = Image.new("RGBA", (cw * max(counts), ch * len(counts)), (0, 0, 0, 0))
    for r, c, f, ax, ay in frames:
        sheet.paste(Image.fromarray(f, "RGBA"), (int(round(c * cw + cw / 2 - ax)), int(round(r * ch + ch / 2 - ay))))
    sheet.save(args.output, optimize=True)

    # 렌더 배율 제안: 몸 폭이 타일의 약 75%가 되도록 (렌더러는 프레임 폭 = 타일 × 0.8 × scale)
    body_w = []
    for _, _, f, _, _ in frames:
        lab, n = components(f[..., 3] > 150)
        if n:
            sizes = np.bincount(lab.ravel())[1:]
            xs = np.nonzero(lab == int(np.argmax(sizes)) + 1)[1]
            body_w.append(xs.max() - xs.min() + 1)
    scale = round(0.75 / 0.8 * cw / float(np.median(body_w)), 2)

    src = args.src or f"/characters/{args.output.replace(chr(92), '/').split('/')[-1]}"
    config = {
        "src": src,
        "frameWidth": cw,
        "frameHeight": ch,
        "scale": scale,
        "facing": "right",
        "animations": {names[i]: {"row": i, "frames": counts[i], "fps": fps[i]} for i in range(len(counts))},
    }
    print(json.dumps({"checker": info, "sheet": [sheet.width, sheet.height], "sprite": config}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
