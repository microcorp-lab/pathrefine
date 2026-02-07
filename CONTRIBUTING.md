# Contributing to PathRefine

Thank you for your interest in contributing to PathRefine! We welcome contributions from the community.

## 🎯 What We're Looking For

We welcome the following types of contributions:

### ✅ Accepted Contributions
- 🐛 **Bug fixes** - Fix issues in the free tier functionality
- 📝 **Documentation** - Improve README, add code comments, create tutorials
- 🌍 **Translations** - Help translate the UI to other languages
- ✨ **Free tier features** - Enhancements to existing free features
- 🧪 **Tests** - Add unit tests or integration tests
- ♿ **Accessibility** - Improve keyboard navigation, screen reader support
- 🎨 **UI/UX improvements** - Better user experience (within free tier scope)

### ❌ Not Accepted
- PRO feature implementations (these are developed separately)
- Major architectural changes without prior discussion
- Features that would cannibalize the PRO tier

## 🚀 Getting Started

### 1. Fork and Clone

```bash
# Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/pathrefine.git
cd pathrefine
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create a Branch

```bash
git checkout -b fix/issue-description
# or
git checkout -b feature/new-feature-name
```

### 4. Make Your Changes

- Write clean, readable code
- Follow existing code style
- Add comments for complex logic
- Test your changes thoroughly

### 5. Test Your Changes

```bash
# Run development server
npm run dev

# Run tests
npm test

# Run linter
npm run lint

# Build to check for compilation errors
npm run build
```

### 6. Commit Your Changes

```bash
git add .
git commit -m "Fix: Description of what you fixed"
# or
git commit -m "Feature: Description of new feature"
```

Use clear, descriptive commit messages:
- `Fix: Correct Smart Heal gap detection`
- `Feature: Add undo/redo keyboard shortcuts`
- `Docs: Update installation instructions`
- `Test: Add unit tests for path simplification`

### 7. Push and Create Pull Request

```bash
git push origin your-branch-name
```

Then go to GitHub and create a Pull Request from your fork to the main repository.

## 📋 Pull Request Guidelines

### PR Description Should Include:
- **What** - What does this PR do?
- **Why** - Why is this change needed?
- **How** - How does it work?
- **Testing** - How did you test this?
- **Screenshots** - If UI changes, include before/after screenshots

### Example PR Description:

```markdown
## What
Fixes Smart Heal to correctly detect gaps smaller than 0.5px

## Why
Users reported that tiny gaps weren't being closed, causing rendering issues

## How
- Modified gap detection threshold in smartHeal.ts
- Added tolerance parameter for edge cases
- Improved distance calculation accuracy

## Testing
- Tested with various SVGs containing small gaps
- Verified no regression with larger gaps
- Added unit test for edge case

## Screenshots
[Before] - Gaps remain
[After] - Gaps closed correctly
```

## 🎨 Code Style

### TypeScript
- Use TypeScript's strict mode
- Define types for all function parameters and return values
- Prefer `interface` over `type` for object shapes
- Use descriptive variable names

```typescript
// ✅ Good
function simplifyPath(path: Path, tolerance: number): Path {
  // ...
}

// ❌ Bad
function sp(p: any, t: any) {
  // ...
}
```

### React Components
- Use functional components with hooks
- Keep components focused and small
- Extract reusable logic into custom hooks
- Use memo() for expensive components

```typescript
// ✅ Good
export const ToolButton: React.FC<ToolButtonProps> = ({ icon, label, onClick }) => {
  return (
    <button onClick={onClick} title={label}>
      {icon}
    </button>
  );
};

// ❌ Bad - Too complex, needs to be split
export const ToolButton = (props: any) => {
  // 200 lines of mixed logic...
};
```

### File Organization
```
src/
├── components/        # React components
│   └── MyComponent/
│       ├── MyComponent.tsx
│       └── MyComponent.test.tsx
├── engine/           # Core SVG algorithms
├── store/            # Zustand state management
├── types/            # TypeScript type definitions
└── utils/            # Helper functions
```

## 🧪 Testing

We use Vitest for testing:

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:ui

# Run with coverage
npm run test:coverage
```

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { simplifyPath } from './pathEditor';

describe('simplifyPath', () => {
  it('should reduce anchor points', () => {
    const path = createTestPath(); // Helper function
    const result = simplifyPath(path, 1.0);
    
    expect(result.segments.length).toBeLessThan(path.segments.length);
  });

  it('should preserve path shape', () => {
    const path = createTestPath();
    const result = simplifyPath(path, 0.1);
    
    expect(pathsAreSimilar(path, result)).toBe(true);
  });
});
```

## 🐛 Reporting Bugs

Found a bug? [Open an issue](https://github.com/microcorp-lab/pathrefine/issues) with:

### Bug Report Template
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g. macOS 14.0]
- Browser: [e.g. Chrome 120]
- Version: [e.g. 1.0.0]

**Additional context**
Any other relevant information.
```

## 💡 Feature Requests

Have an idea for a free-tier feature? [Open a discussion](https://github.com/microcorp-lab/pathrefine/discussions) first to get feedback before implementing.

### Good Feature Requests:
- ✅ "Add grid snapping for precise point placement"
- ✅ "Support importing SVG from clipboard"
- ✅ "Add dark mode support"

### Features for PRO Tier:
- ❌ "Add AI-powered path optimization" (Advanced algorithm)
- ❌ "Export to React components" (Framework export is PRO)
- ❌ "Batch processing" (PRO workflow feature)

## 📦 Project Structure

```
pathrefine/
├── src/
│   ├── components/      # React UI components
│   ├── engine/          # Core SVG algorithms
│   │   ├── parser.ts    # SVG parsing and serialization
│   │   ├── pathEditor.ts # Path manipulation functions
│   │   ├── pathMath.ts   # Bezier curve mathematics
│   │   ├── smartHeal.ts  # Smart Heal algorithm
│   │   └── ...
│   ├── store/           # Zustand state management
│   ├── types/           # TypeScript definitions
│   └── utils/           # Helper functions
├── public/              # Static assets
└── tests/               # Test files
```

## 🔄 Development Workflow

1. **Check issues** - See if someone is already working on it
2. **Discuss major changes** - Open an issue or discussion first
3. **Write code** - Keep commits atomic and well-described
4. **Test thoroughly** - Manual testing + automated tests
5. **Update docs** - If behavior changes, update README
6. **Submit PR** - Fill out the template completely

## 🤔 Questions?

- **Technical questions:** [GitHub Discussions](https://github.com/microcorp-lab/pathrefine/discussions)
- **Bug reports:** [GitHub Issues](https://github.com/microcorp-lab/pathrefine/issues)
- **General inquiries:** hello@pathrefine.dev

## 📜 Code of Conduct

Be respectful, inclusive, and professional. We're all here to build something great together.

- ✅ Be welcoming and friendly
- ✅ Be patient with newcomers
- ✅ Provide constructive feedback
- ✅ Accept constructive criticism gracefully

- ❌ No harassment or discrimination
- ❌ No trolling or insulting comments
- ❌ No spam or self-promotion

## 🎉 Recognition

Contributors who make significant improvements will be:
- Listed in the README
- Mentioned in release notes
- Given credit in commit messages

---

**Thank you for contributing to PathRefine!** 🙏

Your efforts help make SVG editing more accessible to everyone.
