# Contributing to Cheezasha

Thank you for your interest in contributing to Cheezasha! This guide will help you get started with contributing to this Tampermonkey userscript for Milky Way Idle.

> **Note for AI Agents**: See [AGENTS.md](AGENTS.md) for AI-specific development guidelines.

## Quick Start

1. **Fork and clone the repository**

    ```bash
    git clone https://github.com/yourusername/Cheezasha.git # replace with your fork of https://github.com/Skillcheese/Cheezasha
    cd Cheezasha
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Create a feature branch**

    ```bash
    git checkout -b feature/your-feature-name
    ```

4. **Make your changes and test**

    ```bash
    npm test           # Run tests
    npm run build:dev  # Build dev standalone userscript
    npm run build      # Build production bundles
    npm run lint       # Check code quality
    ```

5. **Commit and push**

    ```bash
    git add .
    git commit -m "✨ feat: add your feature"
    git push origin feature/your-feature-name
    ```

6. **Open a Pull Request**

## Development Workflow

### Setting Up Your Environment

**Prerequisites:**

- **Node.js**: Version 16 or higher ([Download here](https://nodejs.org/))
- **Browser**: Chrome or Firefox
- **Tampermonkey**: Browser extension ([Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) | [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/))
- **Code Editor**: VS Code recommended ([Download here](https://code.visualstudio.com/))
    - Install ESLint extension for code quality
    - Install Prettier extension for formatting

### Building and Testing

1. **Build the dev standalone userscript**

    ```bash
    npm run build:dev
    ```

    This creates `dist/Cheezasha-dev.user.js`

2. **Install in Tampermonkey**
    - Open Tampermonkey dashboard
    - Click "+" to create new script
    - Copy contents of `dist/Cheezasha-dev.user.js`
    - Save

3. **Test in-game**
    - Visit <https://www.milkywayidle.com/game>
    - Your changes should be active

4. **Development mode** (auto-rebuild on save)

    ```bash
    npm run dev
    ```

    After each change, refresh the game page to see updates

### Running Tests

```bash
npm test                # Run all tests once
npm run test:watch      # Run tests in watch mode (re-runs on changes)
```

**Note**: Pre-commit hooks automatically run tests before each commit, so you'll know if something breaks!

## Code Guidelines

**Don't worry if you're new to coding!** Our automated tools (Prettier, ESLint) will help format your code correctly. Just focus on making your feature work, and the tools will handle the style.

### Basic Rules

- **Indentation**: 4 spaces (your editor can auto-format this)
- **Quotes**: Use single quotes `'like this'` not double quotes `"like this"`
- **Semicolons**: Add them at the end of statements `;`
- **File extensions**: Always include `.js` when importing files

### Naming Things

- **Files**: Use dashes between words: `my-feature.js`
- **Variables/Functions**: Use camelCase: `myFunction`, `itemCount`
- **Classes**: Use PascalCase: `DataManager`, `MyFeature`
- **Constants**: Use UPPER_SNAKE_CASE: `MAX_ITEMS`, `DEFAULT_VALUE`

### Common Patterns

**Getting game data:**

```javascript
import dataManager from './core/data-manager.js';

const itemDetails = dataManager.getItemDetails('/items/cheese');
```

**Saving settings:**

```javascript
import storage from './core/storage.js';

await storage.set('myFeatureSetting', true, 'settings');
const value = await storage.get('myFeatureSetting', 'settings', false);
```

**Error handling:**

```javascript
try {
    const result = await doSomething();
    return result;
} catch (error) {
    console.error('[MyFeature] Something went wrong:', error);
    return null;
}
```

> **For detailed code patterns and architecture**, see [AGENTS.md](AGENTS.md)

### Async/Await

Always use async/await, never `.then()` chains:

```javascript
// ✅ Good
async function initialize() {
    await storage.initialize();
    await config.initialize();
}

// ❌ Bad
function initialize() {
    storage.initialize().then(() => config.initialize());
}
```

### Error Handling

Use try-catch with module-prefixed console logging:

```javascript
try {
    const result = await someAsyncOperation();
    return result;
} catch (error) {
    console.error('[ModuleName] Operation failed:', error);
    return null;
}
```

### JSDoc Documentation

Document all public functions:

```javascript
/**
 * Calculate profit for a crafted item
 * @param {string} itemHrid - Item HRID (e.g., "/items/cheese")
 * @returns {Promise<Object|null>} Profit data or null if not craftable
 */
async calculateProfit(itemHrid) { }
```

## Architecture Patterns

### Singleton Pattern (Core Modules)

```javascript
class DataManager {
    constructor() {
        this.data = null;
    }
}
const dataManager = new DataManager();
export default dataManager;
```

### Feature Interface

```javascript
export default {
    name: 'Feature Name',
    initialize: async () => {
        /* setup */
    },
    cleanup: () => {
        /* teardown */
    },
};
```

### Data Access

Always use DataManager for game data:

```javascript
import dataManager from './core/data-manager.js';

const itemDetails = dataManager.getItemDetails(itemHrid);
const equipment = dataManager.getEquipment();
```

### Storage

Use the storage module for persistence:

```javascript
import storage from './core/storage.js';

await storage.set('key', value, 'storeName');
const value = await storage.get('key', 'storeName', defaultValue);
```

## Commit Message Guidelines

We use [conventional commits](https://www.conventionalcommits.org/) for automated changelog generation and releases:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style/formatting
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or fixing tests
- `chore`: Tooling, configuration

**Format**: `<type>: <description>`

**Examples**:

```
feat: add dungeon tracker feature
fix: resolve memory leak in rendering
docs: update API documentation
refactor: simplify error handling logic
```

> **Note**: Emojis are not allowed in commit messages (enforced by pre-commit hooks)

## Pull Request Process

1. **Update documentation** if you've added/changed features
2. **Add tests** for new functionality
3. **Ensure all tests pass** (`npm test`)
4. **Update MWI-TOOLS-CHANGELOG.md** with your changes
5. **Follow commit message conventions**
6. **Keep PRs focused** - one feature/fix per PR

### PR Title Format

Use the same format as commit messages:

```
feat: add dungeon tracker feature
```

### PR Description Template

```markdown
## Description

Brief description of what this PR does

## Changes

- List of changes made
- Another change

## Testing

How to test these changes

## Screenshots (if applicable)

Add screenshots for UI changes
```

## Release Process

Cheezasha uses an automated release system powered by [release-please](https://github.com/googleapis/release-please). This means **releases happen automatically** based on your commit messages - no manual version bumping required!

### How It Works

1. **You write code** and commit with conventional commit messages
2. **Release-please** analyzes commits and creates a release PR
3. **Maintainer merges** the release PR
4. **GitHub Actions** automatically:
    - Publishes the GitHub release
    - Builds production bundles (entrypoint + libraries)
    - Updates the `releases` branch with built artifacts
    - Pins entrypoint library URLs to the release commit SHA
    - Syncs version across all files

### Conventional Commits for Releases

Your commit messages determine what gets released and how the version number changes:

#### Version Bumps

| Commit Type | Version Change | Example                                     |
| ----------- | -------------- | ------------------------------------------- |
| `feat:`     | Minor (0.X.0)  | `feat: add dungeon tracker`                 |
| `fix:`      | Patch (0.0.X)  | `fix: resolve memory leak`                  |
| `perf:`     | Patch (0.0.X)  | `perf: optimize rendering`                  |
| `docs:`     | No release     | `docs: update API documentation`            |
| `chore:`    | No release     | `chore: update dependencies`                |
| `refactor:` | No release     | `refactor: simplify error handling`         |
| `test:`     | No release     | `test: add unit tests for formatters`       |
| `style:`    | No release     | `style: fix formatting`                     |
| Breaking    | Major (X.0.0)  | `feat!: redesign settings API` (note the !) |

#### Breaking Changes

To trigger a major version bump, add `!` after the type:

```
feat!: redesign settings API

BREAKING CHANGE: Settings API now uses async/await pattern
```

### Commit Message Format

```
<type>: <description>

[optional body]

[optional footer]
```

**Examples:**

```bash
# Feature (bumps minor version)
feat: add combat score to profile panels

# Bug fix (bumps patch version)
fix: correct efficiency calculation in time estimates

# Performance improvement (bumps patch version)
perf: optimize action panel rendering

# No release (documentation only)
docs: add release process documentation

# Breaking change (bumps major version)
feat!: redesign storage API

BREAKING CHANGE: Storage methods now return Promises
```

### The Release Workflow

#### 1. Development Phase

You develop features and commit with conventional commit messages:

```bash
git commit -m "feat: add marketplace filter feature"
git commit -m "fix: resolve tooltip positioning issue"
git push origin main
```

#### 2. Release PR Creation (Automatic)

When commits are pushed to `main`, release-please:

- Analyzes all commits since the last release
- Determines the next version number
- Creates/updates a release PR with:
    - Updated `CHANGELOG.md`
    - Updated version in `package.json`
    - Updated `.release-please-manifest.json`

The PR title will be: `chore(main): release X.X.X`

#### 3. Version Sync (Automatic)

When the release PR is created, a GitHub Action automatically:

- Runs `npm run version:sync` to update:
    - `userscript-header.txt` - `@version` tag
    - `README.md` - version badge and footer
    - `src/main.js` - `Cheezasha.version` property
- Formats all files with Prettier
- Commits changes to the release PR

#### 4. Release PR Review

A maintainer reviews the release PR:

- Check the changelog is accurate
- Verify version number is correct
- Ensure all version references are synced
- Confirm tests pass

#### 5. Merge and Publish (Automatic)

When the release PR is merged:

1. **GitHub Release** is created with tag `vX.X.X`
2. **Build process** runs:
    - `npm ci` - Install dependencies
    - `npm run build` - Build production bundles
3. **Asset upload** - `dist/Cheezasha.user.js` + `dist/libraries/*.user.js` attached to release
4. **Releases branch** updated:
    - Built artifacts committed to `releases` branch
    - Entrypoint @require URLs pinned to the release commit SHA
5. **Release published** - Draft status removed, release goes live

### Version Sync System

The `npm run version:sync` script keeps version numbers consistent across:

| File                       | Location                                           | Format                                   |
| -------------------------- | -------------------------------------------------- | ---------------------------------------- |
| `package.json`             | `version` field                                    | `"version": "0.7.0"`                     |
| `userscript-header.txt`    | `@version` tag                                     | `// @version 0.7.0`                      |
| `README.md`                | Badge                                              | `badge/version-0.7.0-orange`             |
| `README.md`                | Footer                                             | `**Version:** 0.7.0 (Pre-release)`       |
| `src/main.js`              | `Cheezasha.version`                                | `version: '0.7.0',`                      |
| `.release-please-*.json`   | Manifest                                           | `{ ".": "0.7.0" }`                       |
| `dist/Cheezasha.user.js`   | Built entrypoint (updated on next `npm run build`) | `// @version 0.7.0` + `version: '0.7.0'` |
| `dist/libraries/*.user.js` | Built libraries (updated on next `npm run build`)  | `// @version 0.7.0`                      |

**Source of truth**: `package.json` version field

### Manual Steps (Maintainers Only)

The only manual step is **merging the release PR**. Everything else is automated.

#### Publishing a Release

1. Wait for release-please to create the release PR
2. Review the PR (changelog, version number, tests)
3. Merge the PR
4. GitHub Actions handles the rest automatically

#### Emergency Manual Release

If automation fails, you can manually create a release:

```bash
# 1. Update version in package.json
npm version patch  # or minor, major

# 2. Sync versions across files
npm run version:sync

# 3. Build production bundles
npm run build

# 4. Commit and tag
git add .
git commit -m "chore(main): release X.X.X"
git tag vX.X.X
git push origin main --tags

# 5. Create GitHub release manually and upload dist/Cheezasha.user.js and dist/libraries/*.user.js
```

### Troubleshooting

#### Release PR Not Created

**Cause**: No release-worthy commits since last release (only `docs:`, `chore:`, etc.)

**Solution**: This is normal. Release PR will be created when you add `feat:` or `fix:` commits.

#### Version Not Synced

**Cause**: `version:sync` script failed or wasn't run

**Solution**:

```bash
npm run version:sync
git add .
git commit -m "chore: sync version across files"
git push
```

#### Build Failed in Release Workflow

**Cause**: Tests failing or build errors

**Solution**:

1. Check GitHub Actions logs for error details
2. Fix the issue in a new commit
3. Push to main - release-please will update the release PR

### Best Practices

✅ **Use conventional commits** - Ensures proper version bumping  
✅ **Keep commits atomic** - One logical change per commit  
✅ **Write clear descriptions** - Helps generate good changelogs  
✅ **Test before merging** - Pre-commit hooks help, but verify manually too  
✅ **Review release PRs carefully** - Changelog should accurately reflect changes

❌ **Don't manually edit version numbers** - Let release-please handle it  
❌ **Don't skip commit conventions** - Breaks automatic changelog generation  
❌ **Don't merge broken code** - Releases should always be stable

### Release Checklist (Maintainers)

Before merging a release PR:

- [ ] Changelog accurately reflects all changes
- [ ] Version number follows semver correctly
- [ ] All version references are synced (check the auto-commit)
- [ ] CI tests pass
- [ ] No breaking changes without major version bump
- [ ] Manual testing completed (if needed for critical changes)

After merging:

- [ ] GitHub release published successfully
- [ ] `Cheezasha.user.js` + libraries attached to release
- [ ] `releases` branch updated with pinned entrypoint

### Questions?

- **How do I know what version will be released?** Check the release PR title
- **Can I trigger a release manually?** No, releases are commit-driven only
- **What if I make a mistake in a commit message?** Amend before pushing, or add a new commit
- **Do I need to update CHANGELOG.md?** No, release-please generates it automatically
- **When will my feature be released?** When a maintainer merges the next release PR

## Adding New Features

### Before You Start

1. **Check if it already exists**
    - Search existing [issues](../../issues) and [pull requests](../../pulls)
    - Review [FEATURES.md](FEATURES.md) for similar functionality

2. **Discuss your idea** (optional but recommended)
    - Open an issue describing your feature
    - Get feedback from maintainers
    - Avoid duplicate work

### Creating Your Feature

**Basic structure:**

```
src/features/your-feature/
├── your-feature.js        # Main code
├── your-feature-ui.js     # UI elements (if needed)
```

**Example feature:**

```javascript
// src/features/my-feature/my-feature.js
export default {
    name: 'My Feature',

    initialize: async () => {
        console.log('[My Feature] Starting...');
        // Your feature code here
    },

    cleanup: () => {
        console.log('[My Feature] Cleaning up...');
        // Remove event listeners, etc.
    },
};
```

### Adding Settings

If your feature needs user settings, add them to `src/features/settings/settings-config.js`:

```javascript
{
    id: 'myFeature',
    label: 'My Feature',
    description: 'What your feature does',
    type: 'checkbox',  // or 'number', 'text', 'select'
    defaultValue: true,
    category: 'UI Enhancements'  // Choose appropriate category
}
```

### Testing Your Feature

1. **Manual testing** (required)
    - Build and install in Tampermonkey
    - Test in the actual game
    - Try edge cases (empty inventory, no items, etc.)

2. **Automated tests** (if applicable)
    - Add tests for utility functions
    - See existing tests in `tests/` folder for examples

> **Need help?** Look at existing features in `src/features/` for examples!
> src/features/your-feature/
> ├── your-feature.js # Main module
> ├── your-feature-ui.js # UI components (if needed)
> └── your-feature-storage.js # Storage logic (if needed)

````

### 3. Register Feature

Add to `src/core/feature-registry.js`:

```javascript
import yourFeature from '../features/your-feature/your-feature.js';

const features = [
    // ... existing features
    {
        key: 'yourFeature',
        name: 'Your Feature Name',
        category: 'Category',
        initialize: () => yourFeature.initialize(),
        async: false,
    },
];
````

### 4. Add Settings (if needed)

Add to `src/features/settings/settings-config.js`:

```javascript
{
    id: 'yourFeature',
    label: 'Your Feature',
    description: 'Description of your feature',
    type: 'checkbox',
    defaultValue: true,
    category: 'Category'
}
```

### 5. Write Tests

Create tests in `tests/your-feature.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import yourFeature from '../src/features/your-feature/your-feature.js';

describe('Your Feature', () => {
    it('should do something', () => {
        expect(yourFeature.doSomething()).toBe(expected);
    });
});
```

## Reporting Issues

### Bug Reports

Include:

- **Description**: Clear description of the bug
- **Steps to Reproduce**: Detailed steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: Browser, Tampermonkey version, Cheezasha version
- **Screenshots**: If applicable

### Feature Requests

Include:

- **Description**: Clear description of the feature
- **Use Case**: Why this feature is needed
- **Proposed Solution**: How you think it should work
- **Alternatives**: Other solutions you've considered

## Getting Help

- **Documentation**: Check [DOCUMENTATION.md](DOCUMENTATION.md)
- **Issues**: Search existing issues first
- **Discussions**: Use GitHub Discussions for questions
- **Code**: Review [AGENTS.md](AGENTS.md) for developer guide

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (CC-BY-NC-SA-4.0).

---

Thank you for contributing to Cheezasha! 🎉
