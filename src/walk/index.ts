// The walk style: a voiced feature walk over drawn screens. timeline.ts lays a cut out from the voice, plan.ts turns it
// into on-screen moments, audio.ts into the music bed's job, and Walk.tsx draws it.
export { Walk, calculateWalkMetadata, type WalkProps } from './Walk'
export { buildWalkTimeline, walkWarnings, DEFAULT_WALK_BPM, WALK_PACE, type WalkTimeline, type WalkWords } from './timeline'
export { buildWalkPlan, chainPos, stepAt, type WalkPlan, type StepPlan } from './plan'
export { walkAudioJob, walkBedFile } from './audio'
