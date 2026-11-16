export { legacy } from "./bootstrap.ts";
export * from "./runtime.tsx";

import { initialize } from "./bootstrap.ts";

if (document.getElementById("stage")) initialize();

import "../app/css/base.css";
import "../app/css/rail.css";
import "../app/css/blocks.css";
import "../app/css/stage.css";
import "../app/css/hud.css";
import "../app/css/goal-settings.css";
import "../app/css/map.css";
import "../app/css/ask.css";
import "../app/css/interaction.css";
import "../app/css/look-editor.css";
import "../app/css/project.css";
import "../app/css/library.css";
import "../app/css/mobile.css";
