// Used by `promoreel studio` (the Remotion CLI). Renders go through the Node API in cli/commands/render.ts, which sets the
// same options itself. All options: https://remotion.dev/docs/config
import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
Config.setDefaultPremountInSeconds(2)
