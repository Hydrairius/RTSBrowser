import { unlockAndSyncLandingMusic, withUiClick } from "../audio/index.js";
import { GAME_TAGLINE, GAME_TITLE } from "../brand.js";
import type { JourneyRouter } from "../navigation/router.js";
import { button, el } from "../ui/dom.js";
import { createJourneyBackdrop } from "../ui/journey-shell.js";
import { GAME_VERSION, VERSION_UPDATES } from "../version-updates.js";

function createUpdatesPanel(): HTMLElement {
  const overlay = el("div", "title-updates-overlay hidden");
  overlay.tabIndex = -1;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "title-updates-heading");

  const panel = el("div", "title-updates-panel");
  const header = el("div", "title-updates-header");
  const heading = el("h2", "title-updates-heading", ["Latest updates"]);
  heading.id = "title-updates-heading";
  header.append(
    el("div", "title-updates-kicker", ["Version tracker"]),
    heading,
  );

  const closeBtn = button("Close", "title-updates-close");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close updates");

  const body = el("div", "title-updates-body");
  for (const update of VERSION_UPDATES) {
    const item = el("article", "title-update-item");
    const meta = el("div", "title-update-meta");
    meta.append(
      el("span", "title-update-version", [update.version]),
      el("span", "title-update-date", [update.date]),
    );

    const list = el("ul", "title-update-list");
    for (const highlight of update.highlights) {
      list.append(el("li", undefined, [highlight]));
    }

    item.append(meta, el("h3", "title-update-title", [update.title]), list);
    body.append(item);
  }

  const close = () => {
    overlay.classList.add("hidden");
  };

  closeBtn.onclick = (e) => {
    e.stopPropagation();
    close();
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  panel.append(header, closeBtn, body);
  overlay.append(panel);
  return overlay;
}

export function mountTitle(root: HTMLElement, router: JourneyRouter): void {
  root.replaceChildren();

  const glyphs = el("div", "title-glyphs");
  glyphs.append(
    el("span", "title-glyph title-glyph-triad", ["\u25b3"]),
    el("span", "title-glyph title-glyph-loop", ["\u25cb"]),
    el("span", "title-glyph title-glyph-block", ["\u25a1"]),
  );

  const logo = el("div", "title-logo");
  logo.append(
    glyphs,
    el("h1", "brand", [GAME_TITLE]),
    el("p", "brand-tag", [GAME_TAGLINE]),
  );

  const factions = el("div", "title-factions");
  factions.append(
    el("span", "title-faction title-faction-triad", ["Triad"]),
    el("span", "title-faction-sep"),
    el("span", "title-faction title-faction-loop", ["Loop"]),
    el("span", "title-faction-sep"),
    el("span", "title-faction title-faction-block", ["Block"]),
  );

  const cta = el("div", "title-cta");
  const playBtn = button("Play", "btn-primary btn-lg title-play-btn");
  const settingsBtn = button("Settings", "btn-secondary title-settings-btn");
  const updatesBtn = button(`Updates ${GAME_VERSION}`, "title-updates-btn");

  const menuActions = el("div", "title-menu-actions");
  menuActions.append(playBtn, settingsBtn);

  const updatesPanel = createUpdatesPanel();

  cta.append(
    menuActions,
    el("div", "title-version-row", [
      el("p", "screen-hint", ["Local skirmish vs AI \u00b7 v0 preview"]),
      updatesBtn,
    ]),
  );

  const screen = el("section", "screen screen-title");
  screen.append(createJourneyBackdrop(), logo, factions, cta, updatesPanel);

  playBtn.onclick = (e) => {
    e.stopPropagation();
    withUiClick(() => router.dispatch("play-v0"))();
  };

  settingsBtn.onclick = (e) => {
    e.stopPropagation();
    withUiClick(() => router.dispatch("open-settings"))();
  };

  updatesBtn.onclick = (e) => {
    e.stopPropagation();
    withUiClick(() => {
      updatesPanel.classList.remove("hidden");
      updatesPanel.focus();
    })();
  };

  screen.addEventListener("click", unlockAndSyncLandingMusic, { once: true });

  root.append(screen);
}
