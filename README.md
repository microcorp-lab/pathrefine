# PathRefine - Open Source SVG Editor

> The free tier of  [PathRefine](https://pathrefine.dev), fully open source (MIT License).

PathRefine is the world's most intuitive browser-based SVG path editor. Edit anchor points, smooth curves, heal broken paths, and optimize your SVGs with real-time visual feedback.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 What's Included (Free Tier)

- ✅ **Interactive SVG Editing** - Drag points, add/delete anchors, adjust Bezier curves
- ✅ **Smart Heal** - Automatically close gaps and fix path topology
- ✅ **Polish Smooth** - Intelligent Bezier curve fitting for smoother paths
- ✅ **Path Simplification** - Reduce anchor points while preserving shape
- ✅ **Path Merging** - Combine multiple paths into one
- ✅ **PNG/JPG → SVG Conversion** - Trace images to vector graphics (powered by vtracer)
- ✅ **Real-time Code View** - See SVG code update as you edit
- ✅ **Perfect ViewBox** - Optimize SVG dimensions and viewBox
- ✅ **Keyboard Shortcuts** - Professional workflow with extensive shortcuts
- ✅ **Path Analysis** - Color-coded heat map showing path complexity

## 🔒 PRO Features (Hosted Version)

Upgrade to [PathRefine PRO](https://pathrefine.dev) for advanced features:

- **Auto-Refine** - One-click 4-step optimization pipeline (Smart Heal + Simplify + Organic Smooth + Micro-Simplify)
- **Organic Smooth** - Laplacian smoothing algorithm perfect for tablet/hand-drawn paths
- **Framework Exports** - Export optimized SVG components for React, Vue, Svelte, Angular
- **Auto-Colorize** - Convert colors to CSS variables for theme support
- **Priority Support** - Direct email support from the development team

👉 [Try PRO Version](https://pathrefine.dev)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/microcorp-lab/pathrefine.git
cd pathrefine

# Install dependencies
npm install

# Start development server
 npm run dev
```

The app will open at `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

## 🛠️ Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Monaco Editor** - Code editor
- **fit-curve** - Bezier curve fitting (Schneider's algorithm)
- **simplify-js** - Path simplification (Ramer-Douglas-Peucker)
- **vtracer** - Image to SVG tracing (WebAssembly)

## 📖 Features in Detail

### Smart Heal
Automatically detects and fixes common SVG issues:
- Closes small gaps between paths
- Removes duplicate points
- Fixes overlapping segments
- Bakes transforms into path data

### Polish Smooth
Uses Schneider's curve-fitting algorithm to:
- Optimize control point positions
- Convert straight lines to smooth curves
- Preserve sharp corners
- Maintain visual fidelity

### Path Simplification
Reduces anchor points using Ramer-Douglas-Peucker algorithm:
- Configurable tolerance (0.1% - 5%)
- Visual preview before applying
- Preserves shape accuracy

### Image Converter
Convert raster images to SVG paths:
- Supports PNG, JPG, WebP
- Configurable color tolerance and detail level
- Powered by vtracer (Rust → WebAssembly)

## 🎨 Use Cases

- **Icon Optimization** - Clean up exported icons from design tools
- **Logo Refinement** - Perfect curves and remove unnecessary points
- **Illustration Cleanup** - Fix hand-drawn paths from tablets
- **SVG Compression** - Reduce file size by simplifying paths
- **Path Learning** - Understand how SVG paths work with real-time visualization

## 🤝 Contributing

We welcome contributions! Here's how you can help:

- 🐛 **Bug Reports** - Found a bug? [Open an issue](https://github.com/microcorp-lab/pathrefine/issues)
- 📝 **Documentation** - Improve docs or add examples
- 🌍 **Translations** - Help translate the UI
- ✨ **Features** - Propose new free-tier features

### Development Guidelines

1. Fork this repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Make your changes and test thoroughly
4. Run tests: `npm test`
5. Lint code: `npm run lint`
6. Submit a pull request

**Note:** PRO features are developed separately in a private repository. This repo contains only the free tier code.

## 📄 License

**Free Tier (this repository):** MIT License - fully open source

**PRO Tier:** Proprietary - see [pricing](https://pathrefine.dev/pricing)

```
MIT License

Copyright (c) 2026 PathRefine Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🔗 Links

- **Website:** [pathrefine.dev](https://pathrefine.dev)
- **PRO Version:** [pathrefine.dev/pricing](https://pathrefine.dev/pricing)
- **GitHub:** [github.com/microcorp-lab/pathrefine](https://github.com/microcorp-lab/pathrefine)

## 💡 Acknowledgments

PathRefine builds on excellent open-source libraries:
- **fit-curve** by Philip J. Schneider - Bezier curve fitting
- **simplify-js** by Vladimir Agafonkin - Path simplification
- **vtracer** by visioncortex - Image tracing
- **React, TypeScript, Vite** - Modern web development tools

---

**Built with ❤️ by the PathRefine team**

_Star this repo if you find it useful!_ ⭐
