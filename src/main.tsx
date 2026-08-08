import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

import './styles/main.css'
import './styles/components.css'
import './styles/animations.css'

// Pages serves the app from /<repo>/, so the router has to be told where its
// routes start; Vite's BASE_URL carries the same value the build was given.
const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
