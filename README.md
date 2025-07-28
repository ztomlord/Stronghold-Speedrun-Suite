# Stronghold Speedrun Suite

Standalone module for tracking and logging stronghold speedruns in screeps

## Room visuals

- Display stronghold details (Tier, deck)
- Display creep costs (spawn energy, body parts, boost costs)
- Display required RCL for spawn room
- Display run score
- Display time stamps for rampart kills and core kill

## Usage

Import the module in main and call the 'run' function somewhere in your main loop.  Set up global to allow console commands

```js
const strongholdSpeedrunSuite = require("stronghold.speedrun.suite");
global.strongholdSpeedrunSuite = strongholdSpeedrunSuite;
mainLoop() {
  // other code
  strongholdSpeedrunSuite.run();
}
```

Console commands:
- strongholdSpeedrunSuite.startSpeedrun(roomName,shardName)
- strongholdSpeedrunSuite.clearOldRuns(tickHistoryToKeep = -1)

Both of these commands can obviously be implemented in automation to track runs and clean history past a certain point, allowing background run tracking on world.  It should be noted that calling startSpeedrun on an existing run will simply create a new entry with reset cost tracking and stop tracking the old run. (it will still be in memory, just no longer tracked)

## Arguments for run(args)

- mainPanelPos:{x:0,y:0}
- secondaryPanelPos:{x:0,y:0}
- hideMainPanel:true
- hideSecondaryPanel:true
- hideHUD:true

## Score calculation

score = floor(ticksToKill * (totalBodyparts + totalBoostProductionTime * 0.75));