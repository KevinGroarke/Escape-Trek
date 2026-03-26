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
    score: 0
};

// Combat Entities
const projectiles = [];
const enemies = [];
const particles = [];

// Environment Entities
const celestialBodies = [
    {
        x: player.x + 800,
        y: player.y + 400,
        radius: 300,
        type: 'gas_giant',
        color: '#D2B48C',
        rings: true,
        name: 'Qo\'noS Prime'
    },
    {
        x: player.x - 1200,
        y: player.y - 800,
        radius: 150,
        type: 'terrestrial',
        color: '#4169E1',
        name: 'Risa'
    },
    {
        x: player.x + 200,
        y: player.y - 1500,
        radius: 80,
        type: 'starbase',
        color: '#708090',
        name: 'Deep Space Station 9'
    }
];

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
    ShiftRight: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
    if (e.code === 'Space' || e.key === ' ') keys.Space = true;
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

    // Cooldowns
    if (player.phaserCooldown > 0) player.phaserCooldown -= dt;
    if (player.torpedoCooldown > 0) player.torpedoCooldown -= dt;
    if (player.energy < 100) player.energy = Math.min(100, player.energy + 10 * dt);
    if (player.shields < 100 && player.energy > 50) player.shields = Math.min(100, player.shields + 2 * dt);

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
    document.getElementById('healthBar').innerText = `Hull: ${Math.max(0, Math.floor(player.hull))}%`;
    document.getElementById('healthBar').style.width = `${Math.max(0, player.hull)}%`;
    document.getElementById('shieldBar').innerText = `Shields: ${Math.max(0, Math.floor(player.shields))}%`;
    document.getElementById('shieldBar').style.width = `${Math.max(0, player.shields)}%`;
    document.getElementById('energyBar').innerText = `Auxiliary Power: ${Math.floor(player.energy)}%`;
    document.getElementById('energyBar').style.width = `${player.energy}%`;
    document.getElementById('scoreDisplay').innerText = `Score: ${player.score}`;
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
