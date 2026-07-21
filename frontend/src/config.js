// Centralized API Configuration for Bisa Main Nggak Ya
export const API_URL = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname.includes('bisamainnggak.com')
    ? 'https://api.bisamainnggak.com'
    : 'http://localhost:5000');
