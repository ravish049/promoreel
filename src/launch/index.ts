// The launch style: a music-only launch film in 16:9, 9:16 and 1:1. plan.ts lays the scenes out on the beat and times
// every moment, layout.ts places things per format, audio.ts builds the music bed's job, and Launch.tsx draws it.
export { Launch, calculateLaunchMetadata, type LaunchProps } from './Launch'
export { buildLaunchPlan, buildLaunchTimeline, counterAt, DEFAULT_LAUNCH_BPM, type LaunchPlan, type LaunchTimeline } from './plan'
export { launchLayout, type LaunchLayout } from './layout'
export { launchAudioJob, launchBedFile, LAUNCH_SFX, LAUNCH_SFX_DIR } from './audio'
