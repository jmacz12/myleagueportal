import React from 'react';
import { Bell } from 'lucide-react'; // Clean, professional icon

interface NewsBannerProps {
  message: string | null | undefined;
  color?: string | null;
}

export default function NewsBanner({ message, color }: NewsBannerProps) {
  if (!message) return null;

  const bgStyle = color || '#5a7a2a';

  return (
    <div style={{ 
      width: '100%', 
      background: bgStyle,
      padding: '10px 16px', 
      borderBottom: '1px solid rgba(0,0,0,0.1)',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      zIndex: 50
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: '12px' 
      }}>
        <Bell size={16} color="#f2ead6" />
        <p style={{ 
          color: '#f2ead6', 
          fontWeight: '600', 
          textAlign: 'center', 
          fontSize: '13px',
          letterSpacing: '0.02em',
          margin: 0
        }}>
          {message}
        </p>
      </div>
    </div>
  );
}