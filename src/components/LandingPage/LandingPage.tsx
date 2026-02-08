import React from 'react';
import { Activity, Flame, Link2, Palette, Waves, Square, Zap, Code2, Image, Check, X, CheckCircle } from 'lucide-react';
import { LandingPageDemo } from './LandingPageDemo';

interface LandingPageProps {
  onGetStarted: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-bg-primary via-bg-secondary to-bg-primary">
      {/* Header with Logo */}
      <header className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center gap-3">
          <img src="/logo.svg?v=1" alt="PathRefine" className="h-10 w-10" />
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-accent-primary">PathRefine</span>
            <span className="text-sm text-text-secondary">.dev</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        <div className="text-center space-y-8">
          <div className="inline-block px-4 py-2 bg-accent-primary/10 border border-accent-primary/30 rounded-full text-sm text-accent-primary font-medium mb-4">
            ✨ 100% Free • No Signup • Works Offline
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold leading-tight">
            <span className="bg-gradient-to-r from-accent-primary via-purple-400 to-accent-secondary bg-clip-text text-transparent">
              The SVG Editor
            </span>
            <br />
            <span className="text-white">That Shows You</span>
            <br />
            <span className="text-white">Which Points Matter</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-text-secondary max-w-3xl mx-auto leading-relaxed">
            Color-coded point analysis • Intelligent optimization • Live code sync
          </p>
          
          <p className="text-lg text-text-secondary max-w-3xl mx-auto leading-relaxed">
            Stop guessing which points to remove. <span className="text-accent-primary font-semibold">PathRefine</span> analyzes your SVG paths and highlights safe-to-remove points in <span className="text-green-400">green</span>, critical corners in <span className="text-red-400">red</span>. Clean up auto-traced PNGs, optimize file sizes, and export production-ready React components—all in your browser.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <button
              onClick={onGetStarted}
              className="px-8 py-4 bg-gradient-to-r from-accent-primary to-purple-600 hover:from-accent-secondary hover:to-purple-500 text-white text-lg font-semibold rounded-lg transition-all transform hover:scale-105 shadow-xl shadow-accent-primary/30"
            >
              🚀 Start Editing Free
            </button>
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 bg-bg-tertiary hover:bg-border text-white text-lg font-semibold rounded-lg transition-colors border border-border hover:border-accent-primary/50"
            >
              See How It Works ↓
            </button>
          </div>

          <div className="pt-6 flex flex-wrap gap-6 justify-center text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span>No installation</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span>Privacy-first</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span>Works offline</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span>Open source</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Demo Section */}
      <div className="relative py-8">
        <LandingPageDemo />
      </div>

      {/* Problem/Solution Section */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Problem */}
          <div className="space-y-4">
            <div className="inline-block px-3 py-1 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400 flex items-center gap-2">
              <X className="w-4 h-4" /> The Problem
            </div>
            <h2 className="text-3xl font-bold text-white">Auto-Traced SVGs Are a Mess</h2>
            <div className="space-y-3 text-text-secondary">
              <div className="flex gap-3">
                <span className="text-red-400 text-xl font-bold">•</span>
                <span><strong className="text-white">Bloated file sizes:</strong> 10x larger than necessary</span>
              </div>
              <div className="flex gap-3">
                <span className="text-red-400 text-xl font-bold">•</span>
                <span><strong className="text-white">Uneditable paths:</strong> Thousands of unnecessary points</span>
              </div>
              <div className="flex gap-3">
                <span className="text-red-400 text-xl font-bold">•</span>
                <span><strong className="text-white">Shared edges:</strong> Moving one object leaves holes in others</span>
              </div>
              <div className="flex gap-3">
                <span className="text-red-400 text-xl font-bold">•</span>
                <span><strong className="text-white">No layer structure:</strong> Can't animate or edit individually</span>
              </div>
            </div>
            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
              <div className="text-sm text-red-300 font-mono break-all">
                &lt;path d="M10.2,15.3L10.25,15.35L10.3,15.4L10.35,15.45..." /&gt;
              </div>
              <div className="text-xs text-text-secondary mt-2 flex items-center gap-1">
                <span className="text-lg">😫</span> 4,823 points • 127KB • Impossible to edit
              </div>
            </div>
          </div>

          {/* Solution */}
          <div className="space-y-4">
            <div className="inline-block px-3 py-1 bg-green-500/10 border border-green-500/30 rounded text-sm text-green-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> The Solution
            </div>
            <h2 className="text-3xl font-bold text-white">PathRefine Cleans It Up</h2>
            <div className="space-y-3 text-text-secondary">
              <div className="flex gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                <span><strong className="text-white">Smart Heal:</strong> Remove 90% of points, keep the shape</span>
              </div>
              <div className="flex gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                <span><strong className="text-white">Path optimization:</strong> 10KB instead of 127KB</span>
              </div>
              <div className="flex gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                <span><strong className="text-white">Layer reconstruction:</strong> Proper z-index ordering</span>
              </div>
              <div className="flex gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                <span><strong className="text-white">Live preview:</strong> See changes instantly</span>
              </div>
            </div>
            <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
              <div className="text-sm text-green-300 font-mono">
                &lt;path d="M10,15 C12,16 14,16 16,15" /&gt;
              </div>
              <div className="text-xs text-text-secondary mt-2 flex items-center gap-1">
                 <span className="text-lg">✨</span> 68 points • 10KB • Easy to edit & animate
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Built for <span className="text-accent-primary">Speed</span> and <span className="text-accent-primary">Precision</span>
          </h2>
          <p className="text-xl text-text-secondary max-w-3xl mx-auto">
            All the tools you need to optimize, edit, and export production-ready SVGs
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Feature Card */}
          <div className="p-6 bg-bg-secondary border border-border rounded-lg hover:border-accent-primary/50 transition-colors">
            <div className="mb-4 flex justify-center text-accent-primary">
              <Image size={48} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">PNG to SVG Converter</h3>
            <p className="text-text-secondary">
              Upload any PNG/JPG and instantly convert to vector. Adjust quality settings with live preview.
            </p>
          </div>

          <div className="p-6 bg-bg-secondary border border-border rounded-lg hover:border-accent-primary/50 transition-colors">
            <div className="mb-4 flex justify-center text-accent-primary">
              <Activity size={48} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Smart Heal</h3>
            <p className="text-text-secondary">
              Intelligently remove unnecessary points while preserving shape. Reduces file size by 90%.
            </p>
          </div>

          <div className="p-6 bg-bg-secondary border border-border rounded-lg hover:border-accent-primary/50 transition-colors">
            <div className="mb-4 flex justify-center text-red-500">
              <Flame size={48} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Complexity Heatmap</h3>
            <p className="text-text-secondary">
              Visualize path complexity with color-coded overlay. Spot optimization opportunities instantly.
            </p>
          </div>

          <div className="p-6 bg-bg-secondary border border-border rounded-lg hover:border-accent-primary/50 transition-colors">
            <div className="mb-4 flex justify-center text-accent-primary">
              <Link2 size={48} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Code-Canvas Sync</h3>
            <p className="text-text-secondary">
              Click code to highlight on canvas. Click path to see code. Bidirectional synchronization.
            </p>
          </div>

          <div className="p-6 bg-bg-secondary border border-border rounded-lg hover:border-accent-primary/50 transition-colors">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-white mb-2">Optimization Score</h3>
            <p className="text-text-secondary">
              Real-time health check showing potential savings. Know exactly how bloated your SVG is.
            </p>
          </div>

          <div className="p-6 bg-bg-secondary border border-border rounded-lg hover:border-accent-primary/50 transition-colors">
            <div className="text-4xl mb-4">✂️</div>
            <h3 className="text-xl font-semibold text-white mb-2">Path Editor</h3>
            <p className="text-text-secondary">
              Interactive point editing with drag, add (Alt+Click), delete. Multi-select with Shift+Click.
            </p>
          </div>

          <div className="p-6 bg-bg-secondary border border-border rounded-lg hover:border-accent-primary/50 transition-colors">
            <div className="text-4xl mb-4">⚛️</div>
            <h3 className="text-xl font-semibold text-white mb-2">Framework Exports</h3>
            <p className="text-text-secondary">
              Export as React, Vue, Solid, or Svelte components. Not just SVG files—ready-to-use code.
            </p>
          </div>

          <div className="p-6 bg-bg-secondary border border-border rounded-lg hover:border-accent-primary/50 transition-colors">
            <div className="mb-4 flex justify-center text-accent-primary">
              <Waves size={48} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Smooth Path</h3>
            <p className="text-text-secondary">
              Advanced curve smoothing with live before/after preview. Smooth entire paths or just selected points.
            </p>
          </div>

          <div className="p-6 bg-bg-secondary border border-border rounded-lg hover:border-accent-primary/50 transition-colors">
            <div className="mb-4 flex justify-center text-accent-primary">
              <Palette size={48} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Auto-Colorize</h3>
            <p className="text-text-secondary">
              Convert colors to currentColor for CSS theming. Preview with light/dark themes before applying.
            </p>
          </div>

          <div className="p-6 bg-bg-secondary border border-border rounded-lg hover:border-accent-primary/50 transition-colors">
            <div className="mb-4 flex justify-center text-accent-primary">
              <Square size={48} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Perfect Square</h3>
            <p className="text-text-secondary">
              Center in 24×24 viewBox with adjustable padding. Live preview shows exact final result.
            </p>
          </div>

          <div className="p-6 bg-bg-secondary border border-border rounded-lg hover:border-accent-primary/50 transition-colors">
            <div className="mb-4 flex justify-center text-accent-primary">
              <Zap size={48} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Developer Tools</h3>
            <p className="text-text-secondary">
              Keyboard shortcuts, undo/redo, snap-to-grid, live code view. Built for speed.
            </p>
          </div>
        </div>
      </div>

      {/* Use Cases Section */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Perfect For</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-8 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg">
            <div className="mb-4 flex justify-center text-accent-primary">
              <Code2 size={40} strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-3">Web Developers</h3>
            <ul className="space-y-2 text-text-secondary">
              <li>• Clean up SVG icons for React/Vue components</li>
              <li>• Reduce bundle size for faster load times</li>
              <li>• Prepare SVGs for GSAP/Framer Motion animations</li>
              <li>• Export optimized code ready for production</li>
            </ul>
          </div>

          <div className="p-8 bg-gradient-to-br from-green-500/10 to-teal-500/10 border border-green-500/20 rounded-lg">
            <div className="mb-4 flex justify-center text-green-400">
              <Palette size={40} strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-3">Designers</h3>
            <ul className="space-y-2 text-text-secondary">
              <li>• Convert PNG logos to editable vectors</li>
              <li>• Fix messy auto-traced illustrations</li>
              <li>• Create smooth animations from static images</li>
              <li>• Prepare assets for handoff to developers</li>
            </ul>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="p-12 bg-gradient-to-r from-accent-primary/20 to-accent-secondary/20 border-2 border-accent-primary/30 rounded-2xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Stop Struggling with<br />Bloated SVGs
          </h2>
          <p className="text-xl text-text-secondary mb-10">
            Join developers who've optimized <span className="text-accent-primary font-semibold">thousands of SVGs</span> with PathRefine. 
            Start in seconds, no account needed.
          </p>
          <button
            onClick={onGetStarted}
            className="px-10 py-5 bg-gradient-to-r from-accent-primary to-purple-600 hover:from-accent-secondary hover:to-purple-500 text-white text-xl font-bold rounded-lg transition-all transform hover:scale-105 shadow-xl shadow-accent-primary/40"
          >
            🚀 Start Optimizing Free
          </button>
          <div className="mt-8 flex flex-wrap gap-6 justify-center text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              <span className="text-accent-primary">✓</span>
              <span>Works offline</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-accent-primary">✓</span>
              <span>100% browser-based</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-accent-primary">✓</span>
              <span>No data collection</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-accent-primary">✓</span>
              <span>Open source</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-text-secondary">
            <div>
              <span className="text-white font-semibold">PathRefine.dev</span> - The SVG Editor That Shows You Which Points Matter
            </div>
            <div className="flex gap-6">
              <a href="https://github.com/yourusername/pathrefine" className="hover:text-accent-primary transition-colors">
                GitHub
              </a>
              <a href="mailto:hello@pathrefine.dev" className="hover:text-accent-primary transition-colors">
                Contact
              </a>
              <a href="#" className="hover:text-accent-primary transition-colors">
                Documentation
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
