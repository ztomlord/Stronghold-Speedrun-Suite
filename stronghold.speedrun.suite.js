'use strict';

const version = '1.00';
const swcEnEquivalent = {H:20,O:20,X:50,U:30,L:30,K:30,Z:30};

//valid args:
//mainPanelPos: {x:0,y:0}
//secondaryPanelPos {x:0,y:0}
//hideMainPanel
//hidesecondaryPanel
//hideHUD

const run = function(args = {}) {
    initializeMemoryStructure();
    
    let liveRunRooms = {};
    
    Memory.StrongholdSpeedrun.runs.forEach((item, index) =>{
        if(!liveRunRooms[item.roomName] && (item.startTick === -1 || Game.time - item.startTick < 70000))
        {
            liveRunRooms[item.roomName] = {};
            let room = Game.rooms[item.roomName];
            
            if(room)
            {
                updateRun(room,item);
            }
            
            if(!args.hideHUD)
            {
                displayHUD(item.roomName,item, args);
            }
        }
    });
}

const updateRun = function(room, run_mem)
{
    //update static data when available
    if(run_mem.startTick === -1)
    {
        if(room.find(FIND_MY_CREEPS).length>0 || room.find(FIND_NUKES).length>0)
        {
            run_mem.startTick = Game.time;
        }
        else
        {
            return; //run starts when first creep enters room or first nuke is fired
        }
    }
        
    //update score
    {
        let tempTime = Game.time - run_mem.startTick;
        if(run_mem.coreDown !== -1)
        {
            tempTime = run_mem.coreDown;
        }
        
        run_mem.score = Math.floor(tempTime * (run_mem.costs.bodyparts + run_mem.costs.labTime * 0.75));  //note 0.75 relates to 30/40 or how much boost to make a single body part vs how much boost is made per labTime tick in an rcl8 without juggling
    }
    
    if(run_mem.coreDown !== -1)
    {
        //run complete stop updating
        return;
    }
    
    if(run_mem.teir === -1)
    {
        let cores = room.find(FIND_HOSTILE_STRUCTURES,{ filter: (struc) => { return struc.structureType === STRUCTURE_INVADER_CORE && struc.level>0 && !struc.ticksToDeploy; } });
        if(cores.length>0)
        {
            run_mem.teir = cores[0].level;
        }
    }
    
    if(run_mem.defenderDeck === '' && run_mem.teir !== -1)
    {
        let cores = room.find(FIND_HOSTILE_STRUCTURES,{ filter: (struc) => { return struc.structureType === STRUCTURE_INVADER_CORE && struc.level>0; } });
        if(cores.length > 0) {
            let core = cores[0];
            
            if(run_mem.teir === 1)
            {
                run_mem.defenderDeck = '0,0,0';
            }
            
            if(run_mem.teir === 2)
            {
                run_mem.defenderDeck = '1,0,0';
            }
            
            if(run_mem.teir === 3)
            {
                run_mem.defenderDeck = '2,0,0';
            }
            
            if(run_mem.teir === 4)
            {
                let hostileCreeps = core.pos.findInRange(FIND_HOSTILE_CREEPS,2);
                if(hostileCreeps.length === 4)
                {
                    let melee = hostileCreeps.filter(crp=>crp.getActiveBodyparts(ATTACK)>5).length;
                    let ranged = hostileCreeps.filter(crp=>crp.getActiveBodyparts(RANGED_ATTACK)>5).length;
                    let fortifier = hostileCreeps.filter(crp=>crp.getActiveBodyparts(WORK)>5).length;
                    
                    run_mem.defenderDeck = melee +','+ranged+','+fortifier;
                }
            }
            
            if(run_mem.teir === 5)
            {
                let hostileCreeps = core.pos.findInRange(FIND_HOSTILE_CREEPS,2);
                if(hostileCreeps.length === 9)
                {
                    let melee = hostileCreeps.filter(crp=>crp.getActiveBodyparts(ATTACK)>5).length;
                    let ranged = hostileCreeps.filter(crp=>crp.getActiveBodyparts(RANGED_ATTACK)>5).length;
                    let fortifier = hostileCreeps.filter(crp=>crp.getActiveBodyparts(WORK)>5).length;
                    
                    run_mem.defenderDeck = melee +','+ranged+','+fortifier;
                }
            }
        }
    }
    
    
    //update per tick data
    
    const allDestroyed = room.getEventLog().filter(event => 
        event.event === EVENT_OBJECT_DESTROYED
    );
    
    //core down stamp
    for(let destruction of allDestroyed) {
        if(destruction.data && destruction.data.type === STRUCTURE_INVADER_CORE) {
            run_mem.coreDown = Game.time - run_mem.startTick;
            return;
        }
    }
    
    //ramp stamps
    for(let destruction of allDestroyed) {
        if(destruction.data && destruction.data.type === STRUCTURE_RAMPART) {
            run_mem.rampStamps.push(Game.time - run_mem.startTick);
        }
    }
    
    //damage
    run_mem.lastTickDamage = getFriendlyStructureDamage(room);
    run_mem.totalDamage += run_mem.lastTickDamage;
    
    //creep costs
    {
        let myCreeps = room.find(FIND_MY_CREEPS);
        myCreeps.forEach(creep=>{
            if(!run_mem.trackedCreepIDs[creep.id])
            {
                let mult = creep.ticksToLive / 1500;
                
                let enCost = getCreepCost_Energy(creep);
                run_mem.costs.energy += (mult * enCost);
                run_mem.costs.bodyparts += (mult * creep.body.length);
                
                let boostCosts = getCreepCost_Boosts(creep);
                run_mem.costs.rawMinerals += (mult * boostCosts.totalRawMinerals);
                run_mem.costs.labTime += (mult * boostCosts.totalLabTime);
                run_mem.costs.energyEquivalent += (mult * boostCosts.totalEnEquiv);
                
                if(boostCosts.totalRawMinerals > 0)
                {
                    run_mem.spawnRCL = Math.max(6,run_mem.spawnRCL);
                }
                
                let requiredRCL = estimateMinRCL(enCost);
                if(requiredRCL !== -1)
                {
                    run_mem.spawnRCL = Math.max(requiredRCL,run_mem.spawnRCL);
                }
                
                run_mem.trackedCreepIDs[creep.id] = {};
            }
        });
    }
    
    run_mem.spawnCount = Math.ceil((run_mem.costs.bodyparts / (Game.time - run_mem.startTick)) * 3); //each unpowered spawner produces 1 bodypart every 3 ticks so this is taking the total rate (bodyParts/totalTime) / (spawnerParts/tick)
    
    //nuke costs
    {
        let nukes = room.find(FIND_NUKES);
        nukes.forEach(nuke=>{
            if(!run_mem.trackedNukeIDs[nuke.id])
            {
                run_mem.costs.energy += NUKER_ENERGY_CAPACITY;
                
                let boostCosts = calculateBoostCost(RESOURCE_GHODIUM);
                
                run_mem.costs.rawMinerals += (NUKER_GHODIUM_CAPACITY * boostCosts.rawMinerals);
                run_mem.costs.labTime += (NUKER_GHODIUM_CAPACITY * boostCosts.labTime);
                run_mem.costs.energyEquivalent += (NUKER_GHODIUM_CAPACITY * boostCosts.enEquiv);
                
                run_mem.spawnRCL = 8;
                
                run_mem.trackedNukeIDs[nuke.id] = {};
            }
        });
    }
}

const estimateMinRCL = function(energyCost)
{
    for(let i = 1;i<=8;i++)
    {
        let spawnCapacity = EXTENSION_ENERGY_CAPACITY[i] * CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][i] + SPAWN_ENERGY_CAPACITY * CONTROLLER_STRUCTURES[STRUCTURE_SPAWN][i];
        if(energyCost <= spawnCapacity){return i;}
    }
    return -1;
}

const getCreepCost_Energy = function(creep){
    let totalCost = 0;
    
    for (const bodyPart of creep.body) {
        totalCost += BODYPART_COST[bodyPart.type];
    }
    
    return totalCost;
}

const getCreepCost_Boosts = function(creep) {
    // Count each boost type used
    const boostCounts = {};
    for (const bodyPart of creep.body) {
        if (bodyPart.boost) {
            boostCounts[bodyPart.boost] = (boostCounts[bodyPart.boost] || 0) + 1;
        }
    }
    
    let totalRawMinerals = 0;
    let totalLabTime = 0;
    let totalEnEquiv = 0;
    
    // Calculate cost for each unique boost type
    for (const [boostType, count] of Object.entries(boostCounts)) {
        const boostCost = calculateBoostCost(boostType);
        totalRawMinerals += boostCost.rawMinerals * count;
        totalLabTime += boostCost.labTime * count;
        totalEnEquiv += boostCost.enEquiv * count;
    }
    
    return {
        totalRawMinerals,
        totalLabTime,
        totalEnEquiv
    };
}

function calculateBoostCost(compound) {
   function getRawMineralCount(material) {
       // Base minerals
       if ([RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM, 
            RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST].includes(material)) {
           return 1;
       }
       
       // Find reaction that produces this compound
       for (const [component1, reactions] of Object.entries(REACTIONS)) {
           for (const [component2, result] of Object.entries(reactions)) {
               if (result === material) {
                   return getRawMineralCount(component1) + getRawMineralCount(component2);
               }
           }
       }
       
       return 0; // Unknown compound
   }
   
   function getEnEquivCount(material) {
       // Base minerals - use swcEnEquivalent value or 0 if not present
       if ([RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM, 
            RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST].includes(material)) {
           return swcEnEquivalent[material] || 0;
       }
       
       // Find reaction that produces this compound
       for (const [component1, reactions] of Object.entries(REACTIONS)) {
           for (const [component2, result] of Object.entries(reactions)) {
               if (result === material) {
                   return getEnEquivCount(component1) + getEnEquivCount(component2);
               }
           }
       }
       
       return 0; // Unknown compound
   }
   
   function getLabTime(material) {
       const visited = new Set();
       const queue = [material];
       let totalTime = 0;
       
       while (queue.length > 0) {
           const current = queue.shift();
           if (visited.has(current)) continue;
           visited.add(current);
           
           // Base minerals don't require lab time
           if ([RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM,
                RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST].includes(current)) {
               continue;
           }
           
           // Find reaction that produces this compound
           for (const [component1, reactions] of Object.entries(REACTIONS)) {
               for (const [component2, result] of Object.entries(reactions)) {
                   if (result === current) {
                       totalTime += REACTION_TIME[current] || 0;
                       // Add components to queue for processing
                       if (!visited.has(component1)) {
                           queue.push(component1);
                       }
                       if (!visited.has(component2)) {
                           queue.push(component2);
                       }
                       break;
                   }
               }
           }
       }
       
       return totalTime;
   }
   
   return {
       rawMinerals: getRawMineralCount(compound),
       labTime: getLabTime(compound),
       enEquiv: getEnEquivCount(compound)
   };
}

const getFriendlyStructureDamage = function(room) {
    const eventLog = room.getEventLog();
    let totalDamage = 0;
    
    // Filter for attack events where the attacker is a friendly creep
    // and the target is a structure
    for (const event of eventLog) {
        if (event.event === EVENT_ATTACK) {
            const attacker = Game.getObjectById(event.objectId);
            const target = Game.getObjectById(event.data.targetId);
            
            // Check if attacker is a friendly creep and target is a structure
            if (attacker && 
                attacker instanceof Creep && 
                attacker.my && 
                target && 
                target instanceof Structure) {
                
                totalDamage += event.data.damage;
            }
        }
    }
    
    return totalDamage;
}

const displayHUD = function(roomName, run_mem, args = {})
{
    let mainPanelPos = args.mainPanelPos || {x:1,y:1};
    let secondaryPanelPos = args.secondaryPanelPos || {x:40,y:1};
    
    if(!args.hideMainPanel)
    {
        const visual = new RoomVisual(roomName), x = mainPanelPos.x, y = mainPanelPos.y;
        let line = y;
        visual.text("Stronghold Speedrun "+version, x, line++, { align: "left" });
        visual.text("Score: "+run_mem.score, x, line++, { align: "left" });
        visual.text("Tier: "+run_mem.teir, x, line++, { align: "left" });
        visual.text("Deck (M,R,F): "+run_mem.defenderDeck, x, line++, { align: "left" });
        
        visual.text("DPT: "+run_mem.lastTickDamage, x, line++, { align: "left" });
        let tempTime = Game.time - run_mem.startTick;
        if(run_mem.coreDown !== -1){tempTime = run_mem.coreDown;}
        visual.text("Ave DPT: "+Math.floor(run_mem.totalDamage / tempTime), x, line++, { align: "left" });
        line++;
        visual.text("Costs:", x, line++, { align: "left" });
        visual.text("Energy: "+Math.floor(run_mem.costs.energy), x, line++, { align: "left" });
        visual.text("Body: "+Math.floor(run_mem.costs.bodyparts), x, line++, { align: "left" });
        visual.text("Mineral: "+Math.floor(run_mem.costs.rawMinerals), x, line++, { align: "left" });
        visual.text("Lab Time: "+Math.floor(run_mem.costs.labTime), x, line++, { align: "left" });
        visual.text("EnEquiv: "+Math.floor(run_mem.costs.energyEquivalent), x, line++, { align: "left" });
        
        line++;
        visual.text("Spawn Req:", x, line++, { align: "left" });
        visual.text("Min RCL: "+run_mem.spawnRCL, x, line++, { align: "left" });
        visual.text("Min Spawns: "+run_mem.spawnCount, x, line++, { align: "left" });
    }
    
    if(!args.hideSecondaryPanel)
    {
        const visual = new RoomVisual(roomName), x = secondaryPanelPos.x, y = secondaryPanelPos.y;
        let line = y;
        visual.text("Run Duration:", x, line++, { align: "left" });
        
        if(run_mem.startTick === -1)
        {
            visual.text("-1", x, line++, { align: "left" });
        }
        else
        {
            if(run_mem.coreDown === -1)
            {
                visual.text((Game.time - run_mem.startTick), x, line++, { align: "left" });
            }
            else
            {
                visual.text(run_mem.coreDown, x, line++, { align: "left" });
            }
        }
        
        visual.text("Destruction Stamps:", x, line++, { align: "left" });
        let rampIndex = 1;
        run_mem.rampStamps.forEach(stamp=>{
            visual.text(rampIndex + ' ramp '+stamp, x, line++, { align: "left" });
            rampIndex++;
        });
        
        if(run_mem.coreDown !== -1)
        {
            visual.text('core '+run_mem.coreDown, x, line++, { align: "left" });
        }
    }
}

const startSpeedrun = function(roomName, shardName)
{
    if(Game.shard.name !== shardName){return;}
    
    initializeMemoryStructure();
    
    let newRun = {
        roomName:roomName,
        startTick:-1,
        teir:-1,
        defenderDeck:'',
        totalDamage:0,
        lastTickDamage:0,
        costs:{energy:0, bodyparts:0, rawMinerals:0, labTime:0, energyEquivalent:0},
        trackedCreepIDs:{},
        trackedNukeIDs:{},
        rampStamps:[],
        spawnRCL:0,
        spawnCount:0,
        coreDown:-1,
        score:-1
    };
    Memory.StrongholdSpeedrun.runs.unshift(newRun);
}


const initializeMemoryStructure = function()
{
    if(typeof Memory.StrongholdSpeedrun === 'undefined')
    {
        Memory.StrongholdSpeedrun = {
            runs:[]
        }
    }
}

const clearOldRuns = function(ticksBackToKeep = -1)
{
    if(ticksBackToKeep === -1)
    {
        Memory.StrongholdSpeedrun = {
            runs:[]
        }
    }
    else
    {
        // Remove runs older than the cutoff tick
        Memory.StrongholdSpeedrun.runs = Memory.StrongholdSpeedrun.runs.filter(run => {
            // Keep runs that haven't started yet
            if(run.startTick === -1) return true;
            
            // Keep runs that started after the cutoff
            return run.startTick > Game.time - ticksBackToKeep;
        });
    }
}

const strongholdSpeedrunSuite = {
    run:run,
    startSpeedrun:startSpeedrun,
    clearOldRuns:clearOldRuns
}

module.exports = strongholdSpeedrunSuite;