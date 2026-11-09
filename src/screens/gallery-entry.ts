// A separate Remotion entry for the screen kit's gallery, so it stays out of the main Root: `npm run gallery`.
import React from 'react'
import { Composition, registerRoot } from 'remotion'
import { GALLERY_SECONDS, ScreenGallery } from './Gallery'

const FPS = 30

const GalleryRoot: React.FC = () =>
  React.createElement(
    React.Fragment,
    null,
    React.createElement(Composition, { id: 'ScreenGalleryTall', component: ScreenGallery, durationInFrames: GALLERY_SECONDS * FPS, fps: FPS, width: 1080, height: 1920 }),
    React.createElement(Composition, { id: 'ScreenGalleryWide', component: ScreenGallery, durationInFrames: GALLERY_SECONDS * FPS, fps: FPS, width: 1920, height: 1080 }),
  )

registerRoot(GalleryRoot)
