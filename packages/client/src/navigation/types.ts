export type ScreenId =
  | "title"
  | "settings"
  | "skirmish-setup"
  | "loading"
  | "match"
  | "results";

export type JourneyEvent =
  | "play-v0"
  | "open-settings"
  | "start-match"
  | "ready"
  | "match-ended"
  | "rematch"
  | "main-menu"
  | "back";