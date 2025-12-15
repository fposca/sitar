// src/App.tsx
import React from 'react';
import { useAuth } from './auth/AuthProvider';  // Importamos el useAuth
import LoginScreen from './ui/LoginScreen';  // Pantalla de login
import NeonSitarApp from './NeonSitarApp';  // Tu app actual

const App: React.FC = () => {
  const { user, loading } = useAuth();  // Usamos el contexto de autenticación

  // Mientras se carga la sesión, mostramos "Cargando..."
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#020617',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e5e7eb',
        }}
      >
        Cargando sesión...
      </div>
    );
  }

  // Si no hay usuario logueado, mostramos la pantalla de login
  if (!user) {
    return <LoginScreen />;
  }

  // Si el usuario está logueado, mostramos la app
  return (
    <div style={{ minHeight: '100vh', background: '#020617' }}>
      <div style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', color: '#9ca3af' }}>
       
      </div>

      <NeonSitarApp />  {/* Aquí va tu app actual */}
    </div>
  );
};

export default App;
