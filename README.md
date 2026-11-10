# Cascade

> **A game design tool to help you find and ask better questions to get better answers**

You ever had those moments where you had a question and realized that you had 2 prominent answers and they both contradict each other? Well this tool helps you expand on both those answers as well as opening up more questions because of those answers to settle the debate.

You give the application some background knowledge of your project, then drop in a question. Its more effective if they are yes and no type of questions. The A/B style. The AI, or whatever AI endpoint you decide to use, will often fork out 3 prominent branches:

- The A
- The B
- The Hybrid of both

And it'll try do that for every question you have. It essentially lets you get an overview of as many possible and potential branches to help you get as deep as you want to go with your initial question.

The fun part is you can ask questions separately and if it's related to an existing branch of questions, it can slot itself there and branch off.

The ultimate goal of the branching is to try and reach an emotion that lines up with what you want your players to feel and once you are happy with a particular line of branching, you can solidify all the branches you want and clear the rest of the ghost suggestions, leaving you with your finalized small linear graph on why you made that decision and why it was done that way.

I made this because I often found myself, and the teams I work in, having lots of questions and opinions on how things should be. Often we go around in circles and never really reach a point. Both sides make great points and both have their merits. This tool helps in a more granular level and perhaps find holes in our ideas before we spend resources on prototyping.

"To help you find better questions in order to reach better answers"

This is not an answering tool. It's a questioning tool. The AI doesn't agree with you, it just uses its power to ask more questions and poke you about your decisions.

Hope you find this useful!

## Tech stack

- **Runtime:** Node.js 18+ with no runtime dependencies (built-in modules only).
- **Frontend:** a single-file vanilla HTML, CSS and JavaScript app (`app/app.html`), no framework and no build step
  for the local app.
- **AI providers:** OpenRouter, ChatGPT plan, Anthropic API, OpenAI API, or any OpenAI-compatible endpoint
  (Ollama, LM Studio, Groq).
- **Testing:** Node's built-in test runner with jsdom and local mock providers.
- **CI and hosting:** GitHub Actions, with the static web build deployed to GitHub Pages.
