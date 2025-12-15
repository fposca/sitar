import React from 'react';
import { AudioEngineProvider, useAudioEngine } from './audio/AudioEngineProvider';
import BackingTrackPanel from './components/BackingTrackPanel';
import GuitarInputPanel from './components/GuitarInputPanel';
import DelayPanel from './components/DelayPanel';
import RecordingPanel from './components/RecordingPanel';
import AmpPanel from './components/AmpPanel';
import neonboy from '../src/assets/neonboy.png';
import MetronomePanel from './components/MetronomePanel';
import OfflineSitarPanel from './ui/OfflineSitarPanel';

const NeonSitarLayout: React.FC = () => {
  const { status } = useAudioEngine();

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
        <header style={{ marginBottom: '0.5rem' }}>
          <h1
            style={{
              fontSize: '1.8rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              position:'absolute',
              right:'15%'
            }}
          >
          <img style={{width: '250px'}} src={neonboy}></img>
          </h1>
          <p style={{ opacity: 0.8, marginTop: '0.25rem' }}>{status}</p>
        </header>

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: '1.5rem',
            // si querés que nunca se rompa en mobile, podés quitar el flexWrap
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
            <BackingTrackPanel />
            <GuitarInputPanel />
            <DelayPanel />
            <MetronomePanel />
            <RecordingPanel />
            <OfflineSitarPanel />
          </div>

          {/* Columna derecha: el ampli ocupa todo el resto */}
          <div
            style={{
              flex: 1,
              minWidth: '0', // importante para que el flex pueda encogerse bien
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
