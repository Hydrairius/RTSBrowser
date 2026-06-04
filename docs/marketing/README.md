# Marketing captures — Vertex (RTSBrowser)



Automated screenshots and a gameplay recording for social posts (LinkedIn, etc.).



## Generate assets



From the repo root (starts dev server + client if not already running):



```bash

# Full-screen PNGs (title → setup → match → victory)

npm run capture:marketing



# Gameplay video with tab audio (opens a visible Chromium window)

npm run capture:marketing:video



# Both

npm run capture:marketing:all

```



Outputs land in this folder:



| File | Contents |

|------|----------|

| `01-title.png` | Main menu / brand |

| `02-skirmish-setup.png` | Faction pick (Triad vs Block) |

| `03-match-base.png` | Early skirmish at HQ |

| `04-match-production.png` | Generator, barracks, troops moving |

| `05-victory.png` | Victory results screen |

| `vertex-gameplay.webm` | Faction pick → generator/workers → barracks → troops (with audio when headed) |



Screenshots use **1920×1080** with `fullPage: true` so nothing is clipped.



## Why your video had no sound



Playwright’s built-in `recordVideo` captures **video frames only** — it never records browser tab audio ([upstream limitation](https://github.com/microsoft/playwright/issues/4870)).



The marketing video script instead uses **Chrome tab capture** (`getDisplayMedia` with `audio: true`) while running **headed** (a visible browser window). That muxes game SFX and music into `vertex-gameplay.webm`.



If you need a silent capture in CI, set `CAPTURE_HEADLESS=1` (falls back to Playwright video, no audio).



### Audio checklist



1. Run `npm run capture:marketing:video` locally (headed by default).

2. Let the script start — it auto-selects the **Vertex** tab when possible.

3. If Chrome still prompts to share the tab, choose **This tab** and enable **Share tab audio**.

4. Ensure game Settings → Audio is not muted.



## Video storyboard



1. Skirmish setup — pick factions  

2. Match — build **generator**, train **extra workers** at HQ  

3. Build **barracks** (workers rallied to the site so it finishes)  

4. Move **workers**, assign them to the generator, train **Strikers**  
5. March troops east and **attack the enemy HQ**; camera follows selected units  



## LinkedIn tips



- **Carousel:** `02`, `04`, and `05` — setup, action, payoff.

- **Single hero image:** `04-match-production.png`

- **Video:** Upload `vertex-gameplay.webm`, or convert to MP4:



  ```bash

  ffmpeg -i vertex-gameplay.webm -c:v libx264 -crf 23 -pix_fmt yuv420p vertex-gameplay.mp4

  ```



## Tooling



Playwright spec: [e2e/capture-marketing.spec.ts](../../e2e/capture-marketing.spec.ts). Tab audio helper: [e2e/helpers/tab-video.ts](../../e2e/helpers/tab-video.ts).

