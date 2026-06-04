import { unlockAndSyncLandingMusic, withUiClick } from "../audio/index.js";

import { GAME_TAGLINE, GAME_TITLE } from "../brand.js";

import type { JourneyRouter } from "../navigation/router.js";

import { button, el } from "../ui/dom.js";

import { createJourneyBackdrop } from "../ui/journey-shell.js";



export function mountTitle(root: HTMLElement, router: JourneyRouter): void {

  root.replaceChildren();



  const glyphs = el("div", "title-glyphs");

  glyphs.append(

    el("span", "title-glyph title-glyph-triad", ["△"]),

    el("span", "title-glyph title-glyph-loop", ["○"]),

    el("span", "title-glyph title-glyph-block", ["□"]),

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

  const menuActions = el("div", "title-menu-actions");
  menuActions.append(playBtn, settingsBtn);

  cta.append(
    menuActions,
    el("p", "screen-hint", ["Local skirmish vs AI · v0 preview"]),
  );



  const screen = el("section", "screen screen-title");

  screen.append(createJourneyBackdrop(), logo, factions, cta);



  playBtn.onclick = (e) => {
    e.stopPropagation();
    withUiClick(() => router.dispatch("play-v0"))();
  };

  settingsBtn.onclick = (e) => {
    e.stopPropagation();
    withUiClick(() => router.dispatch("open-settings"))();
  };



  screen.addEventListener("click", unlockAndSyncLandingMusic, { once: true });



  root.append(screen);

}

