import React from 'react'
import { Composition, getInputProps } from 'remotion'
import { Reel, calculateReelMetadata, type ReelProps } from './reel/Reel'

// One composition, "Reel". Its props are a project's spec with the brand merged in, and the CLI passes them:
//   promoreel render <project> --reel <id>      (renders)
//   promoreel studio <project> --reel <id>      (opens Remotion Studio on the same props)
// Studio without props shows a placeholder, because the spec, brand and media all live in the project folder.
const input = getInputProps() as Partial<ReelProps>

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    defaultProps={input as ReelProps}
    calculateMetadata={calculateReelMetadata}
    durationInFrames={900}
    fps={input.fps ?? 30}
    width={input.width ?? 1080}
    height={input.height ?? 1920}
  />
)
