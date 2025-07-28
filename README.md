# Stronghold Speedrun Suite

Tool for tracking and logging stronghold speedruns in screeps

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

Console commands: startSpeedrun(roomName,shardName), clearOldRuns(tickHistoryToKeep = -1)

## Arguments for run(args)

- mainPanelPos:{x:0,y:0}
- secondaryPanelPos:{x:0,y:0}
- hideMainPanel:true
- hideSecondaryPanel:true
- hideHUD:true

## Score calculation

score = floor(ticksToKill * (totalBodyparts + totalBoostProductionTime * 0.75));