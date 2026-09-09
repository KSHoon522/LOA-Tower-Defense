# 로타디 캐릭터 이미지 생성 프롬프트 가이드

스타크래프트 **카봇(Carbot) 스킨** 스타일의 카툰 그래픽을 목표로 하는 프롬프트 템플릿입니다.
아래 `{...}` 부분에 캐릭터 설명을 채워서 이미지 생성 AI(예: Midjourney, DALL-E, Stable Diffusion)에 사용하세요.

생성한 이미지는 `public/characters/` 폴더에 넣고, 에디터의 "이미지 경로" 필드에
`/characters/파일명.png`를 입력하면 게임에서 placeholder 대신 해당 이미지가 렌더링됩니다.

---

## 공통 스타일 정의 (모든 프롬프트 앞에 붙이기)

```
chibi cartoon game character in Carbot Animations style, thick black outlines,
flat cel shading, oversized head, tiny body, exaggerated cute proportions,
simple geometric shapes, vibrant saturated colors, white background,
game asset, centered, full body, front-facing 3/4 view
--no realistic, photorealistic, 3d render, gradient shading, text, watermark
```

한국어 모델용:
```
카봇 애니메이션 스타일의 치비 카툰 게임 캐릭터, 굵은 검은 외곽선, 플랫 셀 셰이딩,
큰 머리와 작은 몸, 과장된 귀여운 비율, 단순한 도형 기반, 선명한 채도 높은 색상,
흰 배경, 게임 에셋, 중앙 정렬, 전신, 정면 3/4 시점
```

---

## 1. 아군 캐릭터(타워) 프롬프트 템플릿

```
[공통 스타일] +
{직업/컨셉 설명}, {지역 테마 요소}, {등급 분위기}, {무기/도구},
idle pose, standing on small circular base
```

### 등급별 분위기 키워드

| 등급 | 키워드 |
|------|--------|
| 일반(common) | simple villager outfit, plain colors, humble equipment |
| 고급(uncommon) | sturdy adventurer gear, green accents |
| 희귀(rare) | polished armor, blue magical glow accents |
| 영웅(hero) | ornate armor, purple aura, cape, heroic pose |
| 전설(legendary) | radiant golden-orange aura, legendary weapon, epic silhouette |
| 에스더(esther) | divine cyan-white glow, floating relics, godlike presence, particle sparkles |

### 지역별 테마 키워드

| 지역 | 키워드 |
|------|--------|
| 슈샤이어 | snow, ice crystals, fur-lined coat, frost blue palette |
| 애니츠 | martial arts dojo, oriental robes, red-pink palette, bandages |
| 아르데타인 | steampunk machinery, guns, goggles, yellow-brass palette |
| 베른 | royal knight kingdom, heraldic emblem, purple-silver palette |
| 로헨델 | fairy forest, elf ears, nature spirits, green-teal palette |
| 파푸니카 | tropical island, sun motifs, flowers, orange palette |

### 예시 (설원의 여제 / 전설 / 슈샤이어)

```
chibi cartoon game character in Carbot Animations style, thick black outlines,
flat cel shading, oversized head, tiny body, white background, game asset,
ice empress with crystal crown, flowing frost-blue gown, snowflake staff,
snow and ice crystal effects, radiant golden-orange legendary aura,
idle pose, standing on small circular base
```

---

## 2. 적 캐릭터 프롬프트 템플릿

```
[공통 스타일] +
{몬스터 컨셉}, {위협 요소}, menacing but comically cute expression,
walking pose, side view
```

- 일반 몬스터: `small, weak-looking, comical` 추가
- 보스: `huge, imposing, screen-filling presence, dramatic lighting accents, boss monster` 추가

### 예시 (고대 수호 골렘 / 보스)

```
chibi cartoon game character in Carbot Animations style, thick black outlines,
flat cel shading, white background, game asset,
ancient stone guardian golem covered in moss and glowing runes,
huge imposing boss monster, cracked rock body, comically grumpy expression,
walking pose, side view
```

---

## 3. 공격 모션 (스프라이트 시트) 프롬프트 템플릿

```
[공통 스타일] +
{캐릭터 설명}, sprite sheet, 4 frames of attack animation in a horizontal row,
frame 1 wind-up, frame 2 strike, frame 3 follow-through, frame 4 return to idle,
consistent character size across frames
```

> 참고: 현재 엔진은 단일 이미지를 사용하며 공격 모션은 코드(반동+플래시)로 처리합니다.
> 스프라이트 시트 지원이 필요해지면 `render.ts`의 `drawShape`를 프레임 분할 방식으로 확장하면 됩니다.

---

## 4. 스킬/타격 이펙트 프롬프트 템플릿

```
cartoon game VFX sprite in Carbot Animations style, thick outlines, flat colors,
{이펙트 설명}, transparent background, game effect asset,
radial burst composition, single frame
```

### 예시

- 빙결: `ice explosion with snowflakes and frost shards, blue-white palette`
- 화염 광역: `fiery explosion with cartoon smoke puffs, orange-red palette`
- 치명타: `comic style impact star burst with "CRIT!" energy, yellow palette`
- 기절: `spinning stars and dizzy swirls, yellow palette`

---

## 5. 이미지 등록 워크플로우

1. 위 템플릿으로 이미지 생성 (권장: 512×512 PNG, 배경 투명 또는 흰색)
2. 파일을 `rotadi/public/characters/`에 저장 (예: `frostqueen.png`)
3. `/editor/towers` 또는 `/editor/enemies`에서 해당 캐릭터의 **이미지 경로**에 `/characters/frostqueen.png` 입력 후 저장
4. 게임을 새로 시작하면 placeholder 도형 대신 이미지가 렌더링됨

> 팁: 등급/지역이 잘 드러나도록 등급 키워드와 지역 키워드를 항상 함께 넣는 것이 좋습니다.
> 시리즈 일관성을 위해 같은 시드(seed)나 스타일 레퍼런스 기능을 사용하는 것을 추천합니다.
