const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Game State
let lastTime = 0;

// Player State
const player = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2, // Facing up
    rotationSpeed: 3.0,  // radians per second
    acceleration: 200,   // pixels per second squared
    maxSpeed: 400,
    friction: 0.5,       // Space friction (optional, EV has some)
    radius: 30,          // For collision
    hull: 100,
    shields: 100,
    energy: 100,
    phaserCooldown: 0,
    torpedoCooldown: 0,
    score: 0,
    credits: 1000,
    dockedAt: null, // null if flying, or reference to celestial body
    currentSystem: 'Sol', // The star system the player is currently in
    targetSystem: null,   // Selected on map for warp
    cargoSpace: 50,
    cargo: {
        'Food': 0,
        'Medical Supplies': 0,
        'Dilithium': 0,
        'Romulan Ale': 0 // Contraband
    },
    shipType: 'Galaxy Class', // Default
    phaserDamage: 10,
    torpedoDamage: 40,
    maxHull: 100,
    maxShields: 100,
    maxEnergy: 100,
    activeMissions: []
};

const SHIPS = [
    { name: 'Runabout', price: 5000, cargo: 20, hull: 50, shields: 50, energy: 50, speed: 500, accel: 300, turn: 4.0, radius: 15 },
    { name: 'Defiant Class', price: 25000, cargo: 30, hull: 150, shields: 200, energy: 150, speed: 600, accel: 400, turn: 5.0, radius: 20 },
    { name: 'Galaxy Class', price: 50000, cargo: 50, hull: 100, shields: 100, energy: 100, speed: 400, accel: 200, turn: 3.0, radius: 30 }
];

const UPGRADES = [
    { name: 'Enhanced Shields', type: 'shields', value: 50, price: 2000, desc: 'Adds +50 to maximum shields.' },
    { name: 'Reinforced Hull', type: 'hull', value: 50, price: 1500, desc: 'Adds +50 to maximum hull integrity.' },
    { name: 'Additional Cargo Pods', type: 'cargo', value: 20, price: 3000, desc: 'Adds +20 to cargo capacity.' },
    { name: 'Pulse Phasers', type: 'phaser', value: 5, price: 4000, desc: 'Adds +5 damage to phasers.' },
    { name: 'Quantum Torpedoes', type: 'torpedo', value: 20, price: 6000, desc: 'Adds +20 damage to torpedoes.' }
];

const SYSTEMS = {
    'Sol': { x: 100, y: 100, color: '#ffff99', bodies: [
        { x: 0, y: 0, radius: 80, type: 'starbase', color: '#708090', name: 'Earth Spacedock', economy: { 'Food': 1.0, 'Medical Supplies': 1.0, 'Dilithium': 1.0, 'Romulan Ale': 3.0 } }
    ]},
    'Qo\'noS': { x: 300, y: -200, color: '#ff6666', bodies: [
        { x: 0, y: 0, radius: 300, type: 'gas_giant', color: '#D2B48C', rings: true, name: 'Qo\'noS Prime', economy: { 'Food': 1.2, 'Medical Supplies': 1.0, 'Dilithium': 0.8, 'Romulan Ale': 1.5 } }
    ]},
    'Epsilon Eridani': { x: -200, y: 150, color: '#99ccff', bodies: [
        { x: 0, y: 0, radius: 150, type: 'terrestrial', color: '#4169E1', name: 'Risa', economy: { 'Food': 0.8, 'Medical Supplies': 1.2, 'Dilithium': 1.5, 'Romulan Ale': 0.5 } }
    ]},
    'Bajor': { x: 150, y: 400, color: '#ffcc99', bodies: [
        { x: 0, y: 0, radius: 80, type: 'starbase', color: '#708090', name: 'Deep Space Station 9', economy: { 'Food': 1.0, 'Medical Supplies': 0.9, 'Dilithium': 1.0, 'Romulan Ale': 2.0 } }
    ]}
};

const MISSIONS = [
    { title: 'Urgent Medical Delivery', type: 'delivery', target: 'Risa', reward: 1500, desc: 'Deliver urgently needed medical supplies to Risa. Cannot fail.' },
    { title: 'Diplomatic Courier', type: 'delivery', target: 'Qo\'noS Prime', reward: 2000, desc: 'Transport a Federation diplomat to Qo\'noS. Time sensitive.' },
    { title: 'Resupply Station', type: 'delivery', target: 'Deep Space Station 9', reward: 1000, desc: 'Haul equipment parts to DS9.' }
];

const COMMODITIES = [
    { name: 'Food', basePrice: 50, variance: 20 },
    { name: 'Medical Supplies', basePrice: 150, variance: 50 },
    { name: 'Dilithium', basePrice: 500, variance: 200 },
    { name: 'Romulan Ale', basePrice: 1000, variance: 500 } // Highly variable
];

// Game State Enum
const GameState = {
    PLAYING: 0,
    DOCKED: 1,
    MAP: 2,
    GAME_OVER: 3
};
let currentState = GameState.PLAYING;

// Combat Entities
const projectiles = [];
const enemies = [];
const particles = [];

// Environment Entities (Loaded dynamically based on system)
let celestialBodies = SYSTEMS[player.currentSystem].bodies;

// Spawn some initial enemies
for (let i = 0; i < 5; i++) {
    spawnEnemy();
}

function spawnEnemy() {
    enemies.push({
        x: player.x + (Math.random() * 2000 - 1000) + 1000,
        y: player.y + (Math.random() * 2000 - 1000) + 1000,
        vx: 0,
        vy: 0,
        angle: 0,
        radius: 25,
        hull: 50,
        shields: 50,
        type: Math.random() > 0.5 ? 'romulan' : 'klingon',
        cooldown: 0
    });
}

// Camera State (centered on player)
const camera = {
    x: 0,
    y: 0
};

// Stars State
const stars = [];
for (let i = 0; i < 200; i++) {
    stars.push({
        x: Math.random() * 2000 - 1000,
        y: Math.random() * 2000 - 1000,
        z: Math.random() * 2 + 0.1, // parallax layer
        size: Math.random() * 2 + 1
    });
}

// Input State
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false,
    ShiftLeft: false,
    ShiftRight: false,
    KeyL: false,
    KeyM: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
    if (e.code === 'Space' || e.key === ' ') keys.Space = true;

    // Single press actions
    if (e.code === 'KeyL' && currentState === GameState.PLAYING) {
        attemptDocking();
    }
    if (e.code === 'KeyM' && currentState === GameState.PLAYING) {
        openMap();
    }
    if (e.code === 'KeyJ' && currentState === GameState.PLAYING) {
        attemptWarp();
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
    if (e.code === 'Space' || e.key === ' ') keys.Space = false;
});

// Main Loop
function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const deltaTime = (timestamp - lastTime) / 1000; // in seconds
    lastTime = timestamp;

    update(deltaTime);
    draw(ctx);

    requestAnimationFrame(gameLoop);
}

function update(dt) {
    if (currentState === GameState.GAME_OVER) return; // Don't process anything if game over
    if (currentState !== GameState.PLAYING) return;   // Don't process input/movement if in menus

    // Handle turning
    if (keys.ArrowLeft) {
        player.angle -= player.rotationSpeed * dt;
    }
    if (keys.ArrowRight) {
        player.angle += player.rotationSpeed * dt;
    }

    // Handle thrust
    if (keys.ArrowUp) {
        player.vx += Math.cos(player.angle) * player.acceleration * dt;
        player.vy += Math.sin(player.angle) * player.acceleration * dt;
    }

    // Apply friction (space drag for playability)
    player.vx -= player.vx * player.friction * dt;
    player.vy -= player.vy * player.friction * dt;

    // Limit speed
    const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
    if (speed > player.maxSpeed) {
        const ratio = player.maxSpeed / speed;
        player.vx *= ratio;
        player.vy *= ratio;
    }

    // Update position
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Update camera to center on player
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;

    // Distance / Context checks
    let nearBody = false;
    for (let body of celestialBodies) {
        let dist = Math.sqrt(Math.pow(player.x - body.x, 2) + Math.pow(player.y - body.y, 2));
        if (dist < body.radius + 150) {
            document.getElementById('messageLog').innerText = `Press 'L' to dock at ${body.name}`;
            nearBody = true;
            break;
        }
    }

    // Check warp bounds
    let distFromCenter = Math.sqrt(player.x*player.x + player.y*player.y);
    if (!nearBody) {
        if (distFromCenter > 3000) {
            if (player.targetSystem) {
                document.getElementById('messageLog').innerText = `Leaving system edge. Press 'J' to warp to ${player.targetSystem}.`;
            } else {
                document.getElementById('messageLog').innerText = `Leaving system edge. Press 'M' to select a warp destination.`;
            }
        } else if (document.getElementById('messageLog').innerText.includes("Press 'L'") || document.getElementById('messageLog').innerText.includes("warp")) {
             document.getElementById('messageLog').innerText = "";
        }
    }

    // Cooldowns
    if (player.phaserCooldown > 0) player.phaserCooldown -= dt;
    if (player.torpedoCooldown > 0) player.torpedoCooldown -= dt;
    if (player.energy < player.maxEnergy) player.energy = Math.min(player.maxEnergy, player.energy + 10 * dt);
    if (player.shields < player.maxShields && player.energy > 50) player.shields = Math.min(player.maxShields, player.shields + 2 * dt);

    // Firing Weapons
    if (keys.Space && player.phaserCooldown <= 0 && player.energy >= 5) {
        player.energy -= 5;
        player.phaserCooldown = 0.2;
        projectiles.push({
            x: player.x + Math.cos(player.angle) * 30,
            y: player.y + Math.sin(player.angle) * 30,
            vx: player.vx + Math.cos(player.angle) * 800,
            vy: player.vy + Math.sin(player.angle) * 800,
            type: 'phaser',
            color: '#ff8800',
            life: 1.0,
            damage: 10,
            owner: 'player'
        });
    }

    if ((keys.ShiftLeft || keys.ShiftRight) && player.torpedoCooldown <= 0 && player.energy >= 20) {
        player.energy -= 20;
        player.torpedoCooldown = 1.0;
        projectiles.push({
            x: player.x + Math.cos(player.angle) * 30,
            y: player.y + Math.sin(player.angle) * 30,
            vx: player.vx + Math.cos(player.angle) * 500,
            vy: player.vy + Math.sin(player.angle) * 500,
            type: 'torpedo',
            color: '#ff0000',
            life: 2.0,
            damage: 40,
            owner: 'player'
        });
    }

    // Update Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) {
            projectiles.splice(i, 1);
            continue;
        }

        // Collision with enemies
        if (p.owner === 'player') {
            for (let j = enemies.length - 1; j >= 0; j--) {
                let e = enemies[j];
                let dx = p.x - e.x;
                let dy = p.y - e.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < e.radius) {
                    // Hit!
                    if (e.shields > 0) {
                        e.shields -= p.damage;
                        if (e.shields < 0) {
                            e.hull += e.shields;
                            e.shields = 0;
                        }
                    } else {
                        e.hull -= p.damage;
                    }
                    createParticles(p.x, p.y, p.color, 10);
                    projectiles.splice(i, 1);

                    if (e.hull <= 0) {
                        createParticles(e.x, e.y, '#ffffff', 50);
                        createParticles(e.x, e.y, '#ff8800', 30);
                        enemies.splice(j, 1);
                        player.score += 100;
                        spawnEnemy(); // Keep the universe populated
                    }
                    break;
                }
            }
        } else if (p.owner === 'enemy') {
            // Collision with player
            let dx = p.x - player.x;
            let dy = p.y - player.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < player.radius) {
                if (player.shields > 0) {
                    player.shields -= p.damage;
                    if (player.shields < 0) {
                        player.hull += player.shields;
                        player.shields = 0;
                    }
                } else {
                    player.hull -= p.damage;
                }
                createParticles(p.x, p.y, p.color, 10);
                projectiles.splice(i, 1);

                if (player.hull <= 0) {
                    // Game Over
                    player.hull = 0;
                    document.getElementById('messageLog').innerText = "Vessel destroyed. Game Over.";
                    currentState = GameState.GAME_OVER;
                    createParticles(player.x, player.y, '#ffffff', 50);
                    createParticles(player.x, player.y, '#ff0000', 50);
                }
                break;
            }
        }
    }

    // Update Enemies
    for (let e of enemies) {
        let dx = player.x - e.x;
        let dy = player.y - e.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        let targetAngle = Math.atan2(dy, dx);

        // Turn towards player
        let angleDiff = targetAngle - e.angle;
        // Normalize angleDiff
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        e.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 2.0 * dt);

        // Move towards player if far, stop if close
        if (dist > 300) {
            e.vx += Math.cos(e.angle) * 150 * dt;
            e.vy += Math.sin(e.angle) * 150 * dt;
        } else if (dist < 150) {
            // Evade
             e.vx -= Math.cos(e.angle) * 100 * dt;
             e.vy -= Math.sin(e.angle) * 100 * dt;
        }

        e.vx -= e.vx * 0.5 * dt;
        e.vy -= e.vy * 0.5 * dt;

        e.x += e.vx * dt;
        e.y += e.vy * dt;

        // Firing
        if (e.cooldown > 0) e.cooldown -= dt;
        if (dist < 500 && Math.abs(angleDiff) < 0.2 && e.cooldown <= 0) {
            e.cooldown = 1.0;
            projectiles.push({
                x: e.x + Math.cos(e.angle) * 20,
                y: e.y + Math.sin(e.angle) * 20,
                vx: e.vx + Math.cos(e.angle) * 600,
                vy: e.vy + Math.sin(e.angle) * 600,
                type: 'disruptor',
                color: '#00ff00',
                life: 1.5,
                damage: 15,
                owner: 'enemy'
            });
        }
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }

    // Update UI
    document.getElementById('healthBar').innerText = `Hull: ${Math.max(0, Math.floor(player.hull))} / ${player.maxHull}`;
    document.getElementById('healthBar').style.width = `${Math.min(100, Math.max(0, (player.hull / player.maxHull) * 100))}%`;
    document.getElementById('shieldBar').innerText = `Shields: ${Math.max(0, Math.floor(player.shields))} / ${player.maxShields}`;
    document.getElementById('shieldBar').style.width = `${Math.min(100, Math.max(0, (player.shields / player.maxShields) * 100))}%`;
    document.getElementById('energyBar').innerText = `Auxiliary Power: ${Math.floor(player.energy)} / ${player.maxEnergy}`;
    document.getElementById('energyBar').style.width = `${Math.min(100, (player.energy / player.maxEnergy) * 100)}%`;
    document.getElementById('scoreDisplay').innerText = `Score: ${player.score}`;
    document.getElementById('creditsDisplay').innerText = `Credits: ${player.credits} cr`;
}

// Warp Logic
function attemptWarp() {
    let distFromCenter = Math.sqrt(player.x*player.x + player.y*player.y);
    if (distFromCenter > 3000) {
        if (player.targetSystem) {
            if (player.energy >= 20) {
                player.energy -= 20;
                // Execute Warp
                document.getElementById('messageLog').innerText = `Warping to ${player.targetSystem}...`;

                // Visual warp effect
                createParticles(player.x, player.y, '#ffffff', 100);

                player.currentSystem = player.targetSystem;
                player.targetSystem = null;
                celestialBodies = SYSTEMS[player.currentSystem].bodies;

                // Reset position to center of new system
                player.x = 0;
                player.y = 0;
                player.vx = 0;
                player.vy = 0;

                // Clear old system enemies and projectiles
                enemies.length = 0;
                projectiles.length = 0;
                for (let i = 0; i < 5; i++) spawnEnemy();
            } else {
                document.getElementById('messageLog').innerText = `Not enough auxiliary power to warp. Need 20%.`;
            }
        } else {
            document.getElementById('messageLog').innerText = `No warp destination selected. Press 'M' to open map.`;
        }
    }
}

// Map Logic
function openMap() {
    currentState = GameState.MAP;
    document.getElementById('mapOverlay').classList.remove('hidden');
    drawMap();
}

function closeMap() {
    currentState = GameState.PLAYING;
    document.getElementById('mapOverlay').classList.add('hidden');
}
window.closeMap = closeMap;

function drawMap() {
    const mapCanvas = document.getElementById('mapCanvas');
    mapCanvas.width = 600;
    mapCanvas.height = 400;
    const mctx = mapCanvas.getContext('2d');

    mctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);

    // Draw connections (hypothetical warp lanes)
    mctx.strokeStyle = '#334455';
    mctx.lineWidth = 1;
    let sysNames = Object.keys(SYSTEMS);
    for (let i=0; i<sysNames.length; i++) {
        for (let j=i+1; j<sysNames.length; j++) {
            let s1 = SYSTEMS[sysNames[i]];
            let s2 = SYSTEMS[sysNames[j]];
            mctx.beginPath();
            mctx.moveTo(s1.x + 300, s1.y + 200);
            mctx.lineTo(s2.x + 300, s2.y + 200);
            mctx.stroke();
        }
    }

    // Draw systems
    for (let sysName in SYSTEMS) {
        let sys = SYSTEMS[sysName];
        let sx = sys.x + 300; // Center offset
        let sy = sys.y + 200;

        mctx.fillStyle = sys.color;
        mctx.beginPath();
        mctx.arc(sx, sy, 8, 0, Math.PI*2);
        mctx.fill();

        if (sysName === player.currentSystem) {
            mctx.strokeStyle = '#00ff00';
            mctx.lineWidth = 2;
            mctx.beginPath();
            mctx.arc(sx, sy, 12, 0, Math.PI*2);
            mctx.stroke();
        } else if (sysName === player.targetSystem) {
             mctx.strokeStyle = '#ffff00';
            mctx.lineWidth = 2;
            mctx.beginPath();
            mctx.arc(sx, sy, 12, 0, Math.PI*2);
            mctx.stroke();
        }

        mctx.fillStyle = '#fff';
        mctx.font = '14px Arial';
        mctx.textAlign = 'center';
        mctx.fillText(sysName, sx, sy + 25);
    }
}

// Handle map clicks
document.getElementById('mapCanvas').addEventListener('click', (e) => {
    if (currentState !== GameState.MAP) return;

    const rect = e.target.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    for (let sysName in SYSTEMS) {
        let sys = SYSTEMS[sysName];
        let sx = sys.x + 300;
        let sy = sys.y + 200;

        let dist = Math.sqrt(Math.pow(clickX - sx, 2) + Math.pow(clickY - sy, 2));
        if (dist < 20) {
            if (sysName !== player.currentSystem) {
                player.targetSystem = sysName;
                document.getElementById('messageLog').innerText = `Navigational computer laid in course for ${sysName}.`;
                drawMap(); // redraw selection
            }
            break;
        }
    }
});


// Docking Logic
function attemptDocking() {
    for (let body of celestialBodies) {
        let dist = Math.sqrt(Math.pow(player.x - body.x, 2) + Math.pow(player.y - body.y, 2));
        if (dist < body.radius + 150) {
            // Success
            currentState = GameState.DOCKED;
            player.dockedAt = body;
            player.vx = 0;
            player.vy = 0;

            // Show UI
            document.getElementById('dockingMenu').classList.remove('hidden');
            document.getElementById('dockedLocationName').innerText = body.name;
            switchTab('spaceport');

            let desc = body.type === 'starbase' ?
                "Welcome to the station promenade. You can refuel and repair here." :
                "Welcome to the planetary spaceport. How can we help you?";
            document.getElementById('spaceportDescription').innerText = desc;

            populateCommodities();
            populateMissions();
            populateShipyard();
            populateOutfitter();
            checkMissions();
            break;
        }
    }
}

function undock() {
    currentState = GameState.PLAYING;
    player.dockedAt = null;
    document.getElementById('dockingMenu').classList.add('hidden');
    document.getElementById('messageLog').innerText = "Undocking complete. Engaging thrusters.";
}

// UI Functions for Docking Menu
function switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    // Show selected tab
    document.getElementById('tab-' + tabId).classList.add('active');
}

window.switchTab = switchTab;
window.undock = undock;

function refuel() {
    if (player.energy < player.maxEnergy && player.credits >= 50) {
        player.credits -= 50;
        player.energy = player.maxEnergy;
        document.getElementById('messageLog').innerText = "Auxiliary power fully recharged.";
        updateUI(); // Force update while paused
    }
}

function repair() {
    if (player.hull < player.maxHull && player.credits >= 100) {
        player.credits -= 100;
        player.hull = player.maxHull;
        document.getElementById('messageLog').innerText = `Hull integrity restored to ${player.maxHull}.`;
        updateUI(); // Force update while paused
    }
}

window.refuel = refuel;
window.repair = repair;

function getUsedCargo() {
    let used = 0;
    for (let item in player.cargo) {
        used += player.cargo[item];
    }
    return used;
}

function populateCommodities() {
    if (!player.dockedAt) return;

    let html = `<h3>Cargo Space: ${getUsedCargo()} / ${player.cargoSpace}</h3>`;
    html += `<table style="width:100%; text-align:left;">
                <tr><th>Commodity</th><th>Price</th><th>In Cargo</th><th>Action</th></tr>`;

    for (let comm of COMMODITIES) {
        // Calculate price based on base price, variance, and local economy modifier
        let econMod = player.dockedAt.economy[comm.name] || 1.0;
        let price = Math.floor(comm.basePrice * econMod + (Math.random() * comm.variance - comm.variance/2));
        price = Math.max(1, price); // no negative prices

        // Store current price on the planet so buying/selling is consistent while docked
        if (!player.dockedAt.currentPrices) player.dockedAt.currentPrices = {};
        if (!player.dockedAt.currentPrices[comm.name]) player.dockedAt.currentPrices[comm.name] = price;
        price = player.dockedAt.currentPrices[comm.name];

        let owned = player.cargo[comm.name];

        html += `<tr>
                    <td>${comm.name}</td>
                    <td>${price} cr</td>
                    <td>${owned}</td>
                    <td>
                        <button class="action-btn" style="padding: 5px 10px; margin: 0;" onclick="buyCommodity('${comm.name}', ${price})">Buy</button>
                        <button class="action-btn" style="padding: 5px 10px; margin: 0; background-color: #cc6666;" onclick="sellCommodity('${comm.name}', ${price})">Sell</button>
                    </td>
                 </tr>`;
    }
    html += `</table>`;
    document.getElementById('commodityList').innerHTML = html;
}

function buyCommodity(name, price) {
    if (player.credits >= price && getUsedCargo() < player.cargoSpace) {
        player.credits -= price;
        player.cargo[name]++;
        populateCommodities(); // refresh UI
        updateUI();
    } else if (getUsedCargo() >= player.cargoSpace) {
        document.getElementById('messageLog').innerText = "Not enough cargo space.";
    } else {
        document.getElementById('messageLog').innerText = "Not enough credits.";
    }
}

function sellCommodity(name, price) {
    if (player.cargo[name] > 0) {
        player.credits += price;
        player.cargo[name]--;
        populateCommodities(); // refresh UI
        updateUI();
    }
}

window.buyCommodity = buyCommodity;
window.sellCommodity = sellCommodity;

// Shipyard Logic
function populateShipyard() {
    let html = `<h3>Current Ship: ${player.shipType}</h3>`;
    html += `<table style="width:100%; text-align:left;">
                <tr><th>Ship Class</th><th>Price</th><th>Action</th></tr>`;

    for (let ship of SHIPS) {
        html += `<tr>
                    <td>${ship.name} (Cargo: ${ship.cargo}, Spd: ${ship.speed})</td>
                    <td>${ship.price} cr</td>
                    <td>`;
        if (player.shipType !== ship.name) {
            html += `<button class="action-btn" style="padding: 5px 10px; margin: 0;" onclick="buyShip('${ship.name}')">Buy</button>`;
        } else {
             html += `<i>Owned</i>`;
        }
        html += `</td></tr>`;
    }
    html += `</table>`;
    document.getElementById('tab-shipyard').innerHTML = html;
}

function buyShip(shipName) {
    let ship = SHIPS.find(s => s.name === shipName);
    if (!ship) return;

    // Calculate trade in value (half price of current ship base price)
    let currentShipBase = SHIPS.find(s => s.name === player.shipType);
    let tradeIn = currentShipBase ? currentShipBase.price / 2 : 0;

    let cost = ship.price - tradeIn;

    if (player.credits >= cost) {
        if (getUsedCargo() > ship.cargo) {
            document.getElementById('messageLog').innerText = "Must sell cargo first. New ship has less capacity.";
            return;
        }

        player.credits -= cost;
        player.shipType = ship.name;
        player.cargoSpace = ship.cargo;
        player.maxHull = ship.hull;
        player.hull = ship.hull;
        player.maxShields = ship.shields;
        player.shields = ship.shields;
        player.maxEnergy = ship.energy;
        player.energy = ship.energy;
        player.maxSpeed = ship.speed;
        player.acceleration = ship.accel;
        player.rotationSpeed = ship.turn;
        player.radius = ship.radius;

        document.getElementById('messageLog').innerText = `Purchased ${ship.name}. Transferred command.`;
        populateShipyard();
        updateUI();
    } else {
        document.getElementById('messageLog').innerText = `Not enough credits. (Need ${cost} cr after trade-in)`;
    }
}
window.buyShip = buyShip;

// Outfitter Logic
function populateOutfitter() {
    let html = `<h3>Upgrades</h3>`;
    html += `<table style="width:100%; text-align:left;">
                <tr><th>Upgrade</th><th>Price</th><th>Action</th></tr>`;

    for (let upg of UPGRADES) {
        html += `<tr>
                    <td><strong>${upg.name}</strong><br><small>${upg.desc}</small></td>
                    <td>${upg.price} cr</td>
                    <td>
                        <button class="action-btn" style="padding: 5px 10px; margin: 0;" onclick="buyUpgrade('${upg.name}')">Install</button>
                    </td>
                 </tr>`;
    }
    html += `</table>`;
    document.getElementById('tab-outfitter').innerHTML = html;
}

function buyUpgrade(upgradeName) {
    let upg = UPGRADES.find(u => u.name === upgradeName);
    if (!upg) return;

    if (player.credits >= upg.price) {
        player.credits -= upg.price;
        if (upg.type === 'shields') { player.maxShields += upg.value; player.shields = player.maxShields; }
        if (upg.type === 'hull') { player.maxHull += upg.value; player.hull = player.maxHull; }
        if (upg.type === 'cargo') { player.cargoSpace += upg.value; populateCommodities(); }
        if (upg.type === 'phaser') { player.phaserDamage += upg.value; }
        if (upg.type === 'torpedo') { player.torpedoDamage += upg.value; }

        document.getElementById('messageLog').innerText = `Installed ${upg.name}.`;
        updateUI();
    } else {
        document.getElementById('messageLog').innerText = "Not enough credits.";
    }
}
window.buyUpgrade = buyUpgrade;

// Mission Board Logic
function populateMissions() {
    let html = `<h3>Active Missions</h3>`;
    if (player.activeMissions.length === 0) {
        html += `<p><i>No active missions.</i></p>`;
    } else {
        html += `<ul>`;
        for (let m of player.activeMissions) {
            html += `<li><strong>${m.title}</strong> - Deliver to ${m.target} for ${m.reward} cr.</li>`;
        }
        html += `</ul>`;
    }

    html += `<h3>Available Missions</h3>`;
    html += `<table style="width:100%; text-align:left;">
                <tr><th>Mission</th><th>Reward</th><th>Action</th></tr>`;

    for (let mission of MISSIONS) {
        // Don't show missions destined for the current planet
        if (mission.target === player.dockedAt.name) continue;
        // Don't show missions already accepted
        if (player.activeMissions.find(m => m.title === mission.title)) continue;

        html += `<tr>
                    <td><strong>${mission.title}</strong><br><small>${mission.desc}</small><br><i>Destination: ${mission.target}</i></td>
                    <td>${mission.reward} cr</td>
                    <td>
                        <button class="action-btn" style="padding: 5px 10px; margin: 0;" onclick="acceptMission('${mission.title}')">Accept</button>
                    </td>
                 </tr>`;
    }
    html += `</table>`;
    document.getElementById('tab-missions').innerHTML = html;
}

function acceptMission(title) {
    let mission = MISSIONS.find(m => m.title === title);
    if (mission) {
        player.activeMissions.push(mission);
        document.getElementById('messageLog').innerText = `Mission accepted: ${mission.title}.`;
        populateMissions();
    }
}
window.acceptMission = acceptMission;

function checkMissions() {
    if (!player.dockedAt) return;

    // Check if any active delivery missions have reached their destination
    for (let i = player.activeMissions.length - 1; i >= 0; i--) {
        let m = player.activeMissions[i];
        if (m.type === 'delivery' && m.target === player.dockedAt.name) {
            player.credits += m.reward;
            document.getElementById('messageLog').innerText = `Mission Complete: ${m.title}! Earned ${m.reward} cr.`;
            player.activeMissions.splice(i, 1);
            updateUI();
        }
    }
}


function updateUI() {
    document.getElementById('healthBar').innerText = `Hull: ${Math.max(0, Math.floor(player.hull))} / ${player.maxHull}`;
    document.getElementById('healthBar').style.width = `${Math.min(100, Math.max(0, (player.hull / player.maxHull) * 100))}%`;
    document.getElementById('shieldBar').innerText = `Shields: ${Math.max(0, Math.floor(player.shields))} / ${player.maxShields}`;
    document.getElementById('shieldBar').style.width = `${Math.min(100, Math.max(0, (player.shields / player.maxShields) * 100))}%`;
    document.getElementById('energyBar').innerText = `Aux. Power: ${Math.floor(player.energy)} / ${player.maxEnergy}`;
    document.getElementById('energyBar').style.width = `${Math.min(100, (player.energy / player.maxEnergy) * 100)}%`;
    document.getElementById('creditsDisplay').innerText = `Credits: ${player.credits} cr`;
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 100 + 50;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: color,
            life: Math.random() * 0.5 + 0.1
        });
    }
}

function draw(ctx) {
    if (currentState === GameState.MAP) return; // Don't draw game world if map is open

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Draw starfield with parallax
    drawStars(ctx);

    // Move canvas to camera position for world objects
    ctx.translate(-camera.x, -camera.y);

    // Render environment
    for (let body of celestialBodies) {
        drawCelestialBody(ctx, body);
    }

    // Render enemies
    for (let e of enemies) {
        drawEnemy(ctx, e);
    }

    // Render player
    if (player.hull > 0) {
        drawPlayer(ctx);
        // Draw player shields
        if (player.shields > 0) {
            ctx.strokeStyle = `rgba(51, 204, 255, ${player.shields / 200})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // Render projectiles
    for (let p of projectiles) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        if (p.type === 'torpedo') {
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            // Torpedo glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            // Phasers / Disruptors (lines)
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); // Stretch based on velocity
            ctx.stroke();
        }
    }

    // Render particles
    for (let p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life * 2);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    ctx.restore();
}

function drawEnemy(ctx, e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);

    if (e.type === 'romulan') {
        // Romulan Warbird (Green, broad wings)
        ctx.fillStyle = '#225522';
        ctx.strokeStyle = '#338833';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(25, 0); // Nose
        ctx.lineTo(-5, 20); // Right wing tip
        ctx.lineTo(-15, 20);
        ctx.lineTo(-10, 5); // Inner wing
        ctx.lineTo(-20, 5); // Tail
        ctx.lineTo(-20, -5);
        ctx.lineTo(-10, -5);
        ctx.lineTo(-15, -20); // Left wing tip
        ctx.lineTo(-5, -20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Romulan Bridge / Decal
        ctx.fillStyle = '#55aa55';
        ctx.beginPath();
        ctx.arc(10, 0, 3, 0, Math.PI*2);
        ctx.fill();

    } else if (e.type === 'klingon') {
        // Klingon Bird of Prey (Greenish-brown, swept forward wings)
        ctx.fillStyle = '#444422';
        ctx.strokeStyle = '#666633';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(20, 0); // Nose
        ctx.lineTo(0, 5); // Neck
        ctx.lineTo(-10, 25); // Right wing tip (swept forward)
        ctx.lineTo(-15, 25);
        ctx.lineTo(-10, 5); // Wing base
        ctx.lineTo(-20, 0); // Aft
        ctx.lineTo(-10, -5);
        ctx.lineTo(-15, -25); // Left wing tip
        ctx.lineTo(-10, -25);
        ctx.lineTo(0, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Red disruptor cannons on wing tips
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(-12, 25, 2, 0, Math.PI*2);
        ctx.arc(-12, -25, 2, 0, Math.PI*2);
        ctx.fill();
    }

    ctx.restore();

    // Draw enemy shields
    if (e.shields > 0) {
        ctx.strokeStyle = `rgba(100, 255, 100, ${e.shields / 100})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawCelestialBody(ctx, body) {
    ctx.save();
    ctx.translate(body.x, body.y);

    if (body.type === 'gas_giant' || body.type === 'terrestrial') {
        // Draw Planet
        let gradient = ctx.createRadialGradient(-body.radius/3, -body.radius/3, body.radius/10, 0, 0, body.radius);
        gradient.addColorStop(0, body.color);
        gradient.addColorStop(1, '#000000'); // Shadow side

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, body.radius, 0, Math.PI * 2);
        ctx.fill();

        if (body.rings) {
            ctx.save();
            ctx.scale(1, 0.3); // Flatten to make rings look 3D
            ctx.strokeStyle = 'rgba(210, 180, 140, 0.5)';
            ctx.lineWidth = 20;
            ctx.beginPath();
            ctx.arc(0, 0, body.radius + 100, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(210, 180, 140, 0.3)';
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.arc(0, 0, body.radius + 150, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    } else if (body.type === 'starbase') {
        // Draw Deep Space 9 style station
        ctx.strokeStyle = body.color;
        ctx.fillStyle = '#A0B0C0';
        ctx.lineWidth = 2;

        // Central Core
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner Ring
        ctx.beginPath();
        ctx.arc(0, 0, 80, 0, Math.PI * 2);
        ctx.stroke();

        // Outer Ring (Docking Pylons)
        ctx.beginPath();
        ctx.arc(0, 0, 150, 0, Math.PI * 2);
        ctx.stroke();

        // Pylons
        for (let i = 0; i < 3; i++) {
            ctx.save();
            ctx.rotate((i * 120 * Math.PI) / 180);

            // Upper Pylons
            ctx.beginPath();
            ctx.moveTo(0, 80);
            ctx.lineTo(10, 150);
            ctx.lineTo(-10, 150);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Lower Pylons
            ctx.beginPath();
            ctx.moveTo(0, 30);
            ctx.lineTo(20, 80);
            ctx.lineTo(-20, 80);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    }

    // Name Tag
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(body.name, 0, body.radius + 30);

    ctx.restore();
}

function drawStars(ctx) {
    ctx.fillStyle = '#fff';
    for (let star of stars) {
        // Wrap stars around the screen based on camera movement and parallax depth
        let sx = (star.x - camera.x / star.z) % canvas.width;
        let sy = (star.y - camera.y / star.z) % canvas.height;

        if (sx < 0) sx += canvas.width;
        if (sy < 0) sy += canvas.height;

        ctx.beginPath();
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawPlayer(ctx) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // Enterprise-D Style (Saucer + Engineering Hull + Nacelles)
    ctx.fillStyle = '#C8D0D8'; // Hull grey
    ctx.strokeStyle = '#8090A0';
    ctx.lineWidth = 2;

    // Engineering Hull
    ctx.beginPath();
    ctx.ellipse(-10, 0, 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Saucer Section (Front)
    ctx.beginPath();
    ctx.ellipse(15, 0, 20, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bridge (small dome)
    ctx.fillStyle = '#E0E8F0';
    ctx.beginPath();
    ctx.arc(15, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    // Deflector Dish
    ctx.fillStyle = '#33CCFF';
    ctx.beginPath();
    ctx.ellipse(-5, 0, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Port Nacelle Pylon
    ctx.strokeStyle = '#607080';
    ctx.beginPath();
    ctx.moveTo(-15, 5);
    ctx.lineTo(-20, 15);
    ctx.stroke();

    // Starboard Nacelle Pylon
    ctx.beginPath();
    ctx.moveTo(-15, -5);
    ctx.lineTo(-20, -15);
    ctx.stroke();

    // Nacelles
    ctx.fillStyle = '#90A0B0';
    // Port
    ctx.beginPath();
    ctx.roundRect(-30, 12, 25, 6, 3);
    ctx.fill();
    ctx.stroke();
    // Starboard
    ctx.beginPath();
    ctx.roundRect(-30, -18, 25, 6, 3);
    ctx.fill();
    ctx.stroke();

    // Bussard Collectors (Red front of nacelles)
    ctx.fillStyle = '#FF3333';
    ctx.beginPath();
    ctx.arc(-7, 15, 3, -Math.PI/2, Math.PI/2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-7, -15, 3, -Math.PI/2, Math.PI/2);
    ctx.fill();

    // Warp Plasma Grilles (Blue side of nacelles)
    ctx.fillStyle = '#3399FF';
    ctx.fillRect(-25, 13, 15, 2);
    ctx.fillRect(-25, -17, 15, 2);

    // Impulse Engines (Red back of saucer)
    if (keys.ArrowUp) {
        ctx.fillStyle = '#FF9933'; // Active impulse
        // Thrust trail
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-40, -10);
        ctx.lineTo(-40, 10);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    } else {
        ctx.fillStyle = '#FF3333'; // Idle impulse
    }
    ctx.beginPath();
    ctx.fillRect(0, -5, 4, 10);

    ctx.restore();
}

// Start game
requestAnimationFrame(gameLoop);
