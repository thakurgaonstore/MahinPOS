import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 20px',
          maxWidth: '600px',
          margin: '60px auto',
          textAlign: 'center',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
          border: '1px solid #fee2e2'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '20px', color: '#991b1b', marginBottom: '8px' }}>একটি ত্রুটি ঘটেছে</h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
            অ্যাপ্লিকেশনে সাময়িক সমস্যা হয়েছে। পৃষ্ঠাটি রিলোড করুন।
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            পুনরায় লোড করুন (Reload)
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
