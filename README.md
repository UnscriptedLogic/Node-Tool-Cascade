# Cascade

> **A tool to help you find and ask better questions to get better answers**

You ever had those moments where you had a question and realized that you had 2 prominent answers and they both contradict each other? Well this tool helps you expand on both those answers as well as opening up more questions because of those answers

## Tech stack

- **Runtime:** Node.js 18+ with no runtime dependencies (built-in modules only).
- **Frontend:** a single-file vanilla HTML, CSS and JavaScript app (`app/app.html`), no framework and no build step
  for the local app.
- **AI providers:** OpenRouter, ChatGPT plan, Anthropic API, OpenAI API, or any OpenAI-compatible endpoint
  (Ollama, LM Studio, Groq).
- **Testing:** Node's built-in test runner with jsdom and local mock providers.
- **CI and hosting:** GitHub Actions, with the static web build deployed to GitHub Pages.
