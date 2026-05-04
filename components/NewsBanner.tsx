import React from 'react';

interface NewsBannerProps {
  message: string | null | undefined;
}

export default function NewsBanner({ message }: NewsBannerProps) {
  if (!message) return null;

  return (
    <div style={{ 
      width: '100%', 
      background: '#5a7a2a', // Accent green
      padding: '12px 16px', 
      borderBottom: '1px solid #1a1a0a',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      zIndex: 50
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: '10px' 
      }}>
        <span style={{ fontSize: '18px' }}>📢</span>
        <p style={{ 
          color: '#f2ead6', // Khaki background color for text
          fontWeight: '700', 
          textAlign: 'center', 
          textTransform: 'uppercase', 
          fontSize: '13px',
          letterSpacing: '0.05em',
          margin: 0
        }}>
          {message}
        </p>
      </div>
    </div>
  );
}