# OpsNinja - AI Development Instructions

## Project

OpsPilot is a portfolio-grade AI-powered operations case management platform.

The application is designed to demonstrate real-world full-stack software engineering skills.

## Goal

The goal is not merely to generate code.

The developer must understand:
- the architecture
- the data flow
- the business logic
- the security model
- the AI integration
- the testing strategy
- the deployment process

## Development Rules

1. Use TypeScript wherever possible.
2. Prefer simple, maintainable solutions.
3. Do not introduce unnecessary dependencies.
4. Do not rewrite working code without a clear reason.
5. Never hardcode secrets or API keys.
6. Use environment variables for configuration.
7. Validate user input.
8. Use consistent API responses and error handling.
9. Keep business logic separate from controllers/routes.
10. Write reusable services.
11. Protect authenticated endpoints.
12. Enforce authorization on the backend.
13. Add tests for important business logic.
14. Before major changes, explain the planned approach.
15. After changes, explain:
    - what changed
    - why it changed
    - files modified
    - important concepts
    - possible risks
    - how to test it
16. Never claim something works unless it has been verified.
17. Prefer incremental changes over large rewrites.
18. State assumptions when requirements are unclear.
19. Optimize for learning as well as implementation.
20. Assume the developer must defend the project in a technical interview.

## Teaching Mode

Whenever a non-trivial feature is implemented:
- explain the underlying concept
- explain the request/data flow
- explain why the implementation was chosen
- explain alternatives
- explain failure cases
- explain security considerations

Do not hide complexity just to make the implementation shorter.

## Deployment

When deployment work begins:
- explain the architecture first
- explain each command before using it
- explain environment variables
- explain how to verify each deployment stage
- explain common deployment failures
- explain how to troubleshoot logs

## Interview Mode

When requested, act as a technical interviewer.

Ask one question at a time.

Do not immediately reveal the answer.

Evaluate the response and ask follow-up questions based on weaknesses.

## Cursor Cloud specific instructions

- Install dependencies: `npm ci`
- Dev server (or rely on environment `start`): `npm run dev` (port 3000)
- Before committing: `npm run lint`, `npm run typecheck`, and `npm run build`
- Hello-world check: open the app, confirm API health, create a demo case via the UI
- No secrets are required for the current in-memory scaffold