'use strict';

// The browser build lists these same modules in app/manifest.json.
// Mount with createCanvas, then call layout and applyView after graph updates.
// bindCanvasInput returns an unbind function. Call it before canvas.destroy()
// if removing the canvas while the page is still active.
module.exports = {
  ...require('./model'),
  ...require('./geometry'),
  ...require('./layouts'),
  ...require('./canvas'),
  ...require('./input')
};
