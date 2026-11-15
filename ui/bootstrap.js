import { connect } from './bridge.js';
import * as constants from './legacy/core/constants.js';
import * as analytics from './legacy/core/analytics.js';
import * as profiles from './legacy/core/profiles.js';
import * as mindsetSchema from './legacy/core/mindsets.js';
import * as mindsetPresets from './legacy/core/mindset-presets.js';
import * as mindsetConversion from './legacy/core/mindset-conversion.js';
import * as model from './legacy/core/state.js';
import * as dom from './legacy/core/dom.js';
import * as tree from './legacy/core/tree.js';
import * as look from './legacy/canvas/look.js';
import * as view from './legacy/canvas/view.js';
import * as layout from './legacy/canvas/layout.js';
import * as edges from './legacy/canvas/edges.js';
import * as hud from './legacy/ui/hud.js';
import * as actions from './legacy/ui/actions.js';
import * as prompts from './legacy/ai/prompts.js';
import * as compose from './legacy/ui/compose.js';
import * as interaction from './legacy/canvas/interaction.js';
import * as controls from './legacy/ui/controls.js';
import * as transport from './legacy/ai/transport.js';
import * as server from './legacy/core/server.js';
import * as settings from './legacy/ui/settings.js';
import * as chatExchange from './legacy/features/chat-exchange.js';
import * as responsive from './legacy/ui/responsive.js';
import * as map from './legacy/features/map.js';
import * as ask from './legacy/features/ask.js';
import * as lookEditor from './legacy/ui/look-editor.js';
import * as project from './legacy/features/project.js';
import * as library from './legacy/features/library.js';
import * as mindsets from './legacy/features/mindsets.js';
import * as converter from './legacy/features/mindset-converter.js';
import * as boot from './legacy/boot.js';

const modules = [
  constants, analytics, profiles, mindsetSchema, mindsetPresets, mindsetConversion, model, dom, tree, look, view, layout, edges, hud, actions, prompts, compose, interaction, controls, transport, server, settings, chatExchange, responsive, map, ask, lookEditor, project, library, mindsets, converter, boot
];
// Live bindings connect the islands and the jsdom harness without app globals.
export const legacy={};
for(const module of modules){
  for(const name of Object.keys(module)){
    if(name==='initialize'||name==='state') continue;
    Object.defineProperty(legacy,name,{enumerable:true,get:()=>module[name]});
  }
  for(const name of Object.keys(module.state||{})){
    Object.defineProperty(legacy,name,{enumerable:true,get:()=>module.state[name],set:value=>{module.state[name]=value;}});
  }
}

export function initialize(){
  connect({actions:legacy});
  // Initialize side effects explicitly after module definitions have loaded.
  for(const module of modules) module.initialize();
}
