# Claude Instructions for Cheezasha

This file contains general workflow and behavioral guidelines for AI assistants working on this project.

## General Workflow Rules

### Git & Version Control

- **Always rebase, never merge**: When pulling changes, always use `git pull --rebase`

### Code Changes

- **Never add code without approval**: Only add debuggers without approval; all other code requires explicit user permission
- **Always build after implementing**: Run `npm run build:dev` immediately after every approved code change

### Communication

- **No time estimates**: Never give estimates for how long something will take

## Project-Specific Context

### Versioning (release-please)

- The version in `package.json` and `src/main.js` (`cheezashaRoot.version`) is bumped by
  **release-please**, not by hand. A `fix:`/`feat:`/etc. commit pushed to `main` makes
  release-please open (or update) a `chore(main): release X.Y.Z` PR; merging that PR is what
  actually bumps the version files on `main` (via the `Format Release Please` workflow's
  `npm run version:sync` step) and cuts the tag/release.
- **Before trusting the local version number or building a release artifact**, run
  `git pull --rebase origin main` — if a release PR merged upstream since your last fetch (e.g.
  from a previous session or CI), your local `package.json`/`src/main.js` will still show the old
  version until you pull, even though your commit itself is already in place.
- After `git push origin main`, expect release-please to open a new release PR shortly after
  (poll with `gh pr list` / `gh pr checks <n>`). Merging it (squash, matching prior release PRs)
  triggers `release.yml`, which builds the production bundles and publishes the (non-draft)
  GitHub release with the userscript asset attached.

### Recent Breaking Changes

**February 21, 2026 Game Update:**

- Game removed `__reactFiber$...` keys from DOM elements
- Chat commands `/item` and `/mp` no longer work (game core inaccessible via old method)
- Marketplace navigation required new approach using `_reactRootContainer`

**React Fiber Navigation Pattern:**

```javascript
const rootEl = document.getElementById('root');
const rootFiber = rootEl?._reactRootContainer?.current || rootEl?._reactRootContainer?._internalRoot?.current;

function find(fiber) {
    if (!fiber) return null;
    if (fiber.stateNode?.handleGoToMarketplace) return fiber.stateNode;
    return find(fiber.child) || find(fiber.sibling);
}
```

This approach traverses the React fiber tree to find game methods without depending on obfuscated property names.

### Common Bugs to Watch For

1. **Pricing mode not passed through**: Always ensure `pricingMode` is included in calculator return objects and passed to display formatters
2. **MutationObserver missing attributes**: When watching for item changes, include `attributes: true` and `attributeFilter` for SVG href changes
3. **Early returns in switch statements**: Use variable assignment instead of returning directly in switch cases
4. **Unreachable code after return**: Lint will catch console.logs after return statements

## Technical Details

For code style, architecture patterns, build commands, and technical guidelines, see:

@AGENTS.md
