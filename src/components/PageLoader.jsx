import React from 'react';

const PageLoader = ({ message = "লোড হচ্ছে..." }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh',
      width: '100%',
      gap: '16px'
    }}>
      <div style={{
        width: '42px',
        height: '42px',
        border: '3.5px solid #e2e8f0',
        borderTopColor: '#2563eb',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <p style={{
        color: '#64748b',
        fontSize: '14px',
        fontWeight: '500'
      }}>{message}</p>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PageLoader;
