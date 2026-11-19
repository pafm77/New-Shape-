import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#121214] text-[#F4F4F5] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-[#EF4444]/60 bg-[#1B1B1E] p-5 space-y-2">
            <h1 className="text-lg font-bold text-[#EF4444]">Erro na aplicação</h1>
            <p className="text-xs text-[#A1A1AA] break-words">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 rounded-xl bg-[#EAB308] px-4 py-2 text-xs font-bold text-[#121214]"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
