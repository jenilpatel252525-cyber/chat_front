import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { EncryptionProvider } from "./context/EncryptionContext";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EncryptionProvider>
      <App />
    </EncryptionProvider>
  </StrictMode>,
)
