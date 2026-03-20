# Prompt Version Control

Version control system for AI prompts with diffing, rollback, and branching capabilities.

## Features

- **Version History** - Track every change to your prompts with messages
- **Semantic Diffing** - View changes at line, word, or character level
- **Rollback** - Revert to any previous version
- **Branching** - Create feature branches for prompt experiments
- **Merge** - Merge branches back into main
- **Import/Export** - Backup and restore prompt collections
- **TypeScript** - Full type safety

## Installation

```bash
npm install
npm run build
```

## Usage

```typescript
import { PromptVersionControl } from './dist/index.js';

const pvc = new PromptVersionControl({ storagePath: './prompt-store' });

// Create a new prompt
const prompt = pvc.createPrompt(
  'summarizer',
  'Summarize the following text in 3 sentences:',
  'Initial prompt'
);

// Update the prompt
const newVersion = pvc.update(
  prompt.id,
  'Summarize the following text concisely:',
  'Updated wording for clarity'
);

// Get version history
const history = pvc.getVersionHistory(prompt.id);

// View diff between versions
const changes = pvc.diffVersions(prompt.id, 1, 2, { type: 'words' });
changes.forEach(part => {
  console.log(`${part.added ? '+' : part.removed ? '-' : ' '} ${part.value}`);
});

// Rollback to previous version
pvc.rollback(prompt.id, 1);

// Create a branch for experimentation
pvc.createBranch(prompt.id, 'experiment');

// Switch to branch
const branchVersion = pvc.switchBranch(prompt.id, 'experiment');

// Merge branch back
pvc.mergeBranch(prompt.id, 'experiment', 'Merged experiment results');
```

## API

### `new PromptStore(config?)`

Create a new prompt store instance.

- `storagePath` - Path to store JSON files (default: `./prompt-store`)

### Prompt Methods

| Method | Description |
|--------|-------------|
| `createPrompt(name, content, message, metadata?)` | Create new prompt |
| `getPrompt(id)` | Get prompt by ID |
| `getPromptByName(name)` | Get prompt by name |
| `listPrompts()` | List all prompts |
| `update(id, content, message, metadata?)` | Update prompt (creates new version) |
| `deletePrompt(id)` | Delete a prompt |

### Version Methods

| Method | Description |
|--------|-------------|
| `getVersion(promptId, version)` | Get specific version |
| `getLatestVersion(promptId)` | Get latest version |
| `getVersionHistory(promptId)` | Get full version history |
| `diffVersions(promptId, from, to, options?)` | Get diff between versions |
| `rollback(promptId, version)` | Rollback to version |

### Branch Methods

| Method | Description |
|--------|-------------|
| `createBranch(promptId, name)` | Create new branch |
| `listBranches(promptId)` | List all branches |
| `switchBranch(promptId, name)` | Switch to branch |
| `mergeBranch(promptId, name, message)` | Merge branch |

### Diff Options

```typescript
interface DiffOptions {
  type?: 'lines' | 'words' | 'chars';  // Default: 'lines'
  ignoreWhitespace?: boolean;            // Default: false
}
```

## CLI Usage

```bash
# Run interactive CLI
npm start

# Development mode
npm run dev
```

## Example Workflow

```typescript
// 1. Create main prompt
const prompt = pvc.createPrompt('chatbot', 'You are a helpful assistant.');

// 2. Create experiment branch
pvc.createBranch(prompt.id, 'formal-version');

// 3. Update in branch
pvc.switchBranch(prompt.id, 'formal-version');
pvc.update(prompt.id, 'You are a formal, professional assistant.', 'Made more formal');

// 4. View changes
const changes = pvc.diffVersions(prompt.id, 1, 2);

// 5. Merge if good
pvc.mergeBranch(prompt.id, 'formal-version', 'Merged formal style');
```

## License

MIT
