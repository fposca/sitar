import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './auth/AuthProvider';
import { AudioEngineProvider } from './audio/AudioEngineProvider';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
       <AudioEngineProvider>
    <App />
    </AudioEngineProvider>
    </AuthProvider>

  </React.StrictMode>,
);
