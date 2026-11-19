import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class FirestoreErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Unexpected application error.',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; operationType?: string };
        if (parsed?.error) {
          friendly = `Cloud sync permission error (${parsed.operationType || 'read/write'}): ${parsed.error}`;
        }
      } catch {
        // use raw message
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] text-[#1C1917] p-6">
          <div className="max-w-md w-full bg-white border border-[#E6DFD5] rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3 text-[#6B1118]">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-bold">Grade 9 Hub — Recovery Notice</h2>
            </div>
            <p className="text-sm text-[#57534E] leading-relaxed break-words">
              {friendly}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#6B1118] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Grade 9 Hub</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
