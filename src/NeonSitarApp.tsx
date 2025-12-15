// src/NeonSitarApp.tsx
import React from 'react';
import { AudioEngineProvider, useAudioEngine } from './audio/AudioEngineProvider';
import BackingTrackPanel from './components/BackingTrackPanel';
import GuitarInputPanel from './components/GuitarInputPanel';
import RecordingPanel from './components/RecordingPanel';
import AmpPanel from './components/AmpPanel';
import neonboy from '../src/assets/neonboy.png';
import MetronomePanel from './components/MetronomePanel';
import OfflineSitarPanel from './ui/OfflineSitarPanel';
import { useAuth } from './auth/AuthProvider'; // 👈 NUEVO

const NeonSitarLayout: React.FC = () => {
  const { status } = useAudioEngine();
  const { user, logout } = useAuth(); // 👈 NUEVO

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: '#020617',
        color: '#f5f5f5',
        fontFamily: 'system-ui, sans-serif',
        padding: '2rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        {/* HEADER */}
        <header
          style={{
            marginBottom: '0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          {/* Logo + estado del motor */}
          <div>
            <img
              style={{
                width: '250px',
                filter: 'drop-shadow(0 0 14px rgba(236,72,153,0.7))',
              }}
              src={neonboy}
              alt="NeonBoy"
            />
            <p style={{ opacity: 0.8, marginTop: '0.25rem', fontSize: '0.8rem' }}>
              {status}
            </p>
          </div>

          {/* Info de usuario + botón de logout */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: '0.85rem',
            }}
          >
            {user && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600 }}>
                  {user.displayName ?? user.email}
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                  Sesión Neon Sitar
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={logout}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: 999,
                border: '1px solid #4b5563',
                background: '#111827',
                color: '#e5e7eb',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              🚪 <span>Salir</span>
            </button>
          </div>
        </header>

        {/* CONTENIDO */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: '1.5rem',
            flexWrap: 'nowrap',
          }}
        >
          {/* Columna izquierda fija */}
          <div
            style={{
              flex: 0,
              width: '340px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
             <GuitarInputPanel />
            <BackingTrackPanel />
           
            <MetronomePanel />
            <RecordingPanel />
            <OfflineSitarPanel />
          </div>

          {/* Columna derecha: el ampli ocupa todo el resto */}
          <div
            style={{
              flex: 1,
              minWidth: '0',
            }}
          >
            <AmpPanel />
          </div>
        </div>
      </div>
    </div>
  );
};

const NeonSitarApp: React.FC = () => {
  return (
    <AudioEngineProvider>
      <NeonSitarLayout />
    </AudioEngineProvider>
  );
};

export default NeonSitarApp;
