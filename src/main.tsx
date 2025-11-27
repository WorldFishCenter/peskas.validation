import React from 'react';
import ReactDOM from 'react-dom/client';
import './utils/axiosConfig'; // Configure axios interceptors first
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
); 