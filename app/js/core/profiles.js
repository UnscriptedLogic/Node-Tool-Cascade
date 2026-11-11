'use strict';
/* ================= domain profiles =================
   A profile holds every word that depends on what the tree is about: the nouns the AI prompts use, the labels and
   examples in the UI, the starter tree, and what a project scan looks for. Nothing outside this file should say "game".
   Add a profile here and it shows up in Settings > Goal. */
const DOMAINS = {
  general:{
    label:'General', blurb:'Any decision, plan or idea.',
    treeName:'decision tree', person:'decision-maker', personFull:'decision-maker', subject:'project', subjectAn:'a project',
    audience:'the people affected', audienceOne:'person affected', feeling:'How people feel', loopDesc:'stages or phases of the work', causeHints:'priorities, timing, ownership, information, incentives and constraints', protoHint:'something to try or look at',
    contextLabel:'About the project', contextPlaceholder:'A small team is deciding how to run its next quarter. Eight people, two products, one shared roadmap.', contextHint:'What it is, who is involved, anything the AI can’t see in the tree.',
    pillarsLabel:'Principles and constraints', pillarsPlaceholder:'Nothing that needs new hires. Decisions made by the end of the month. Everyone can follow the reasoning.', pillarsHint:'Things the AI should respect when it suggests answers.',
    avoidPlaceholder:'Ideas that need a big budget. Anything we already tried last year.',
    goalPlaceholder:'Decide what the team works on this quarter and why',
    goalChips:['Decide what the team works on this quarter and why','Find out why the plan keeps slipping','Pick between two options without second-guessing it later'],
    askPlaceholder:'What is making progress feel slow?',
    blocks:{ fog:'Something about hiring we haven’t pinned down', loop:'Planning', question:'Should we do one big launch or several small ones?', answer:'Smaller launches are easier to learn from', emotion:'Anxious about committing too early', consequence:'Less time left for fixing what we already shipped', decision:'Ship the first small launch before the end of the month' },
    traceTip:'Trace back: why do people feel this?',
    projectNoun:'project', projectLead:'Point Cascade at a project folder and it learns from it.', projectPlaceholder:'/Users/you/Documents/MyProject',
    demoOpen:['Who is this for?','What should someone remember about it afterwards?','What would make you cut something?','What should the first week feel like?'],
    sample(){ return sampleTree([
      { t:'loop', x:'Project', k:'root', c:[
        { t:'loop', x:'Plan', k:'plan', c:[
          { t:'question', x:'Can everyone say what matters most this month?', k:'q2', c:[
            { t:'answer', x:'Goals exist but are not written down', c:[ { t:'emotion', x:'Uneasy about what to drop', mood:'tension' } ] } ] } ] },
        { t:'loop', x:'Do', k:'do', c:[
          { t:'question', x:'Why is progress slower than expected?', k:'q1', c:[
            { t:'answer', x:'Too many tasks run at the same time', c:[
              { t:'emotion', x:'Overwhelmed switching between tasks', mood:'confusion' },
              { t:'consequence', x:'Nothing gets finished' } ] },
            { t:'answer', x:'Priorities change every week', k:'a2', c:[ { t:'emotion', x:'Frustrated by constant restarts', mood:'frustration' } ] } ] } ] },
        { t:'loop', x:'Review', k:'review', c:[
          { t:'question', x:'Do reviews change what happens next?', k:'q3', c:[
            { t:'answer', x:'Notes are written and then ignored', c:[ { t:'emotion', x:'Interest fades after a few cycles', mood:'boredom' } ] } ] } ] } ] } ],
      [['plan','do','flow'],['do','review','flow'],['review','plan','flow'],['a2','q3','rel']]); }
  },
  product:{
    label:'Product', blurb:'A product, feature or service and the people who use it.',
    treeName:'product decision tree', person:'product thinker', personFull:'product thinker', subject:'product', subjectAn:'a product',
    audience:'users', audienceOne:'user', feeling:'User feeling', loopDesc:'stages of the user journey', causeHints:'flows, wording, defaults, timing, feedback and incentives', protoHint:'a prototype or real usage to look at',
    contextLabel:'About the product', contextPlaceholder:'A budgeting app for freelancers. Mobile first, a free tier, and about 5,000 weekly users.', contextHint:'Who it is for, the platform, the stage it is at.',
    pillarsLabel:'Principles and constraints', pillarsPlaceholder:'Works offline. No account needed for the first week. One thumb on a phone.', pillarsHint:'Things the AI should respect when it suggests answers.',
    avoidPlaceholder:'Dark patterns. Features that need a tutorial.',
    goalPlaceholder:'Get a new user to their first useful result in five minutes',
    goalChips:['Get a new user to their first useful result in five minutes','Make people come back without nagging them','Cut the steps between wanting something and getting it'],
    askPlaceholder:'What is making users drop off in the first week?',
    blocks:{ fog:'Something about pricing tiers we haven’t pinned down', loop:'Onboarding', question:'Would a shorter sign-up raise activation?', answer:'Users don’t know what to do after sign-up', emotion:'Frustrated by a setup that asks too much', consequence:'Fewer sign-ups reach the second week', decision:'Let people try the product before creating an account' },
    traceTip:'Trace back: why does the user feel this?',
    projectNoun:'product', projectLead:'Point Cascade at a product folder and it learns from it.', projectPlaceholder:'/Users/you/Documents/MyProduct',
    demoOpen:['Who is this for?','What should a user remember after one session?','What would make you cut a feature?','What should the first five minutes feel like?'],
    sample(){ return sampleTree([
      { t:'loop', x:'Product', k:'root', c:[
        { t:'loop', x:'Discover', k:'disc', c:[
          { t:'question', x:'Can people tell what it does from the first screen?', c:[
            { t:'answer', x:'The headline describes features, not outcomes', c:[ { t:'emotion', x:'Unsure whether it is for them', mood:'confusion' } ] } ] } ] },
        { t:'loop', x:'Try', k:'try', c:[
          { t:'question', x:'Why do new users stop after the first session?', k:'q1', c:[
            { t:'answer', x:'The first task takes too many steps', k:'a1', c:[
              { t:'emotion', x:'Frustrated by setup before any payoff', mood:'frustration' },
              { t:'consequence', x:'Fewer sign-ups reach the second week' } ] },
            { t:'answer', x:'No clear next step after sign-up', c:[ { t:'emotion', x:'Lost on an empty dashboard', mood:'confusion' } ] } ] } ] },
        { t:'loop', x:'Adopt', k:'adopt', c:[
          { t:'question', x:'Do reminders bring people back or push them away?', k:'q3', c:[
            { t:'answer', x:'Most alerts are generic', c:[ { t:'emotion', x:'Interest turns into ignoring them', mood:'boredom' } ] } ] } ] } ] } ],
      [['disc','try','flow'],['try','adopt','flow'],['adopt','disc','flow'],['a1','q3','rel']]); }
  },
  research:{
    label:'Research', blurb:'A study, an investigation or a piece of writing.',
    treeName:'research decision tree', person:'researcher', personFull:'researcher', subject:'study', subjectAn:'a study',
    audience:'participants and readers', audienceOne:'participant or reader', feeling:'Participant reaction', loopDesc:'phases of the study', causeHints:'method, sampling, measures, timing, bias and analysis', protoHint:'a pilot or some data to look at',
    contextLabel:'About the study', contextPlaceholder:'A survey of how remote teams handle handovers. Forty interviews planned, a literature review under way.', contextHint:'The field, the method, the stage you are at.',
    pillarsLabel:'Principles and constraints', pillarsPlaceholder:'Every claim traces to a source. Interviews under 45 minutes. No identifiable participants.', pillarsHint:'Things the AI should respect when it suggests answers.',
    avoidPlaceholder:'Claims the data cannot support. Leading questions.',
    goalPlaceholder:'Decide whether the evidence supports the main claim',
    goalChips:['Decide whether the evidence supports the main claim','Find the weakest assumption before collecting data','Choose a method that can actually answer the question'],
    askPlaceholder:'What is making the results hard to interpret?',
    blocks:{ fog:'Something about sampling we haven’t pinned down', loop:'Data collection', question:'Is the sample large enough to answer this?', answer:'The sample only covers people who already agree', emotion:'Doubtful about the headline result', consequence:'The finding may not hold outside this group', decision:'Add a second group before drawing conclusions' },
    traceTip:'Trace back: why do participants react this way?',
    projectNoun:'study', projectLead:'Point Cascade at a folder of notes, data and drafts and it learns from it.', projectPlaceholder:'/Users/you/Documents/MyStudy',
    demoOpen:['Who is this for?','What should a reader take away?','What would make you drop a hypothesis?','What would count as a surprising result?'],
    sample(){ return sampleTree([
      { t:'loop', x:'Study', k:'root', c:[
        { t:'loop', x:'Design', k:'design', c:[
          { t:'question', x:'Can this method actually answer the question?', k:'q1', c:[
            { t:'answer', x:'The survey measures opinion, not behaviour', k:'a1', c:[
              { t:'emotion', x:'Doubtful about the headline result', mood:'confusion' },
              { t:'consequence', x:'Findings may not hold outside the sample' } ] },
            { t:'answer', x:'Interviews would show behaviour but cost more time', c:[ { t:'emotion', x:'Torn between depth and speed', mood:'tension' } ] } ] } ] },
        { t:'loop', x:'Collect', k:'collect', c:[
          { t:'question', x:'Who is missing from the people we can reach?', k:'q2', c:[
            { t:'answer', x:'Recruitment runs through one mailing list', c:[ { t:'emotion', x:'Uneasy about who the results speak for', mood:'tension' } ] } ] } ] },
        { t:'loop', x:'Analyse', k:'analyse', c:[
          { t:'question', x:'What result would change our mind?', k:'q3', c:[
            { t:'answer', x:'We have not written that down yet', c:[ { t:'emotion', x:'Curious what the data will show', mood:'curiosity' } ] } ] } ] } ] } ],
      [['design','collect','flow'],['collect','analyse','flow'],['analyse','design','flow'],['a1','q2','rel']]); }
  },
  game:{
    label:'Game design', blurb:'A game and how it feels to play.',
    treeName:'game-design decision tree', person:'designer', personFull:'game designer', subject:'game', subjectAn:'a game',
    audience:'players', audienceOne:'player', feeling:'Player feeling', loopDesc:'stages of the game loop', causeHints:'level layout, pacing, mechanics, feedback, rewards and difficulty', protoHint:'something to look at or play',
    contextLabel:'About the game', contextPlaceholder:'A third-person exploration game with light combat. Players cross a large open world on foot.', contextHint:'Genre, camera, audience, anything the AI can’t see in the tree.',
    pillarsLabel:'Pillars and constraints', pillarsPlaceholder:'No fast travel in the first act. Sessions under 30 minutes. Playable on a gamepad.', pillarsHint:'Things the AI should respect when it suggests answers.',
    avoidPlaceholder:'Anything that needs a tutorial. Loot-box style rewards.',
    goalPlaceholder:'Make traversal feel like discovery, not a commute',
    goalChips:['Make traversal feel like discovery, not a commute','Raise tension without raising difficulty','Get a new player to their first fun moment in five minutes'],
    askPlaceholder:'What is making players bored while they travel?',
    blocks:{ fog:'Something about combat pacing we haven’t pinned down', loop:'Exploration', question:'Would a bigger map horizontally solve traversal issues?', answer:'Players don’t know where to go after the first area', emotion:'Frustrated by backtracking through empty terrain', consequence:'Fewer players reach the second biome', decision:'Add a glide ability before the first boss' },
    traceTip:'Trace back: why does the player feel this?',
    projectNoun:'game project', projectLead:'Point Cascade at a game project and it learns from it.', projectPlaceholder:'/Users/you/Games/MyProject',
    demoOpen:['Who is this game for?','What should a player remember after one session?','What would make you cut a feature?','What should the first ten minutes feel like?'],
    sample(){ return gameSample(); }
  }
};
const DEFAULT_DOMAIN = 'general';
const DOM = () => DOMAINS[PREFS.domain] || DOMAINS[DEFAULT_DOMAIN];
const isGameDomain = () => (PREFS.domain || DEFAULT_DOMAIN) === 'game';

// Builds {nodes,order,links,seq} from nested specs: {t:type, x:text, k:key, mood, c:[children]}; links reference keys.
function sampleTree(roots,linkSpecs){
  const nodes = {}, order = [], keys = {}; let n = 0;
  const add = (spec,parent) => {
    const id = 'n'+(++n); keys[spec.k || id] = id;
    nodes[id] = Object.assign({id,type:spec.t,text:spec.x,parent,ghost:false},spec.mood ? {mood:spec.mood} : {},spec.collapsed ? {collapsed:true} : {});
    order.push(id); (spec.c || []).forEach(c=>add(c,id));
  };
  roots.forEach(r=>add(r,null));
  return {nodes,order,links:(linkSpecs || []).map(([a,b,kind])=>({a:keys[a],b:keys[b],kind})),seq:n};
}
function gameSample(){
  const nodes = {}, order = [], links = []; let n = 0;
  const add = (type,text,parent,extra) => { const id = 'n'+(++n); nodes[id] = Object.assign({id,type,text,parent,ghost:false},extra||{}); order.push(id); return id; };
  const game = add('loop','Game',null);
  const core = add('loop','Core loop',game);
  const explore = add('loop','Explore',core);
  const combat = add('loop','Combat',core);
  const upgrade = add('loop','Upgrade',core);

  const q1 = add('question','Why does traversal feel slow?',explore);
  const a1 = add('answer','Points of interest sit far apart with nothing in between',q1);
  add('emotion','Bored crossing empty ground',a1,{mood:'boredom'});
  add('consequence','Players skip optional areas',a1);
  const a2 = add('answer','No movement abilities beyond walking',q1);
  add('emotion','Frustrated retracing the same routes',a2,{mood:'frustration'});

  const q2 = add('question','Can players read an enemy’s next move?',combat);
  const a3 = add('answer','Wind-ups are short and look alike',q2);
  add('emotion','Confused by sudden hits',a3,{mood:'confusion'});

  const q3 = add('question','Do upgrades change how the player moves?',upgrade);
  const a4 = add('answer','Most upgrades only raise numbers',q3);
  add('emotion','Delight fades after the first few',a4,{mood:'delight'});

  const meta = add('loop','Meta loop',game,{collapsed:true});
  const prog = add('loop','Progression',meta);
  add('question','Does campaign pacing hold across twenty hours?',prog);
  const soc = add('loop','Social',meta);
  add('question','Why would a friend come back tomorrow?',soc);

  links.push({a:explore,b:combat,kind:'flow'},{a:combat,b:upgrade,kind:'flow'},{a:upgrade,b:explore,kind:'flow'});
  links.push({a:a2,b:q3,kind:'rel'});
  return {nodes,order,links,seq:n};
}
