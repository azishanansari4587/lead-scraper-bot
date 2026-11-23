import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from './Button';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '48px 24px',
            maxWidth: '600px',
            margin: '40px auto',
            textAlign: 'center',
            background: 'var(--surface-elevated, #111827)',
            borderRadius: 'var(--radius-lg, 12px)',
            border: '1px solid var(--border-color, #1F2937)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: 'var(--danger-text, #EF4444)'
            }}
          >
            <AlertTriangle size={24} />
          </div>

          <h2 style={{ fontSize: 'var(--font-xl, 20px)', color: 'var(--text-primary, #F9FAFB)', marginBottom: '8px' }}>
            {this.props.title || 'An unexpected error occurred in this module'}
          </h2>

          <p style={{ color: 'var(--text-secondary, #9CA3AF)', fontSize: 'var(--font-sm, 14px)', marginBottom: '24px', lineHeight: 1.5 }}>
            {this.state.error?.message || 'Something went wrong while rendering this section.'}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Button variant="primary" icon={RefreshCw} onClick={this.handleReset}>
              Reload Module
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
