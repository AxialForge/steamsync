import React from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import { StoreProvider } from './state/store.jsx'
import { App } from './components/App.jsx'

createRoot(document.getElementById('root')).render(
  <StoreProvider>
    <App />
  </StoreProvider>
)
