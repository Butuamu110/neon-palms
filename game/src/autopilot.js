// The autopilot: a patient virtual driver who plays mission 1 — "Fresh Off the Bus" —
// through the real input path, so a headless run can prove the game is winnable end to end.
// It walks to Zora, takes the job, walks to the garage, takes the Comet, and drives the
// avenue grid to the marina and back, pressing only the virtual keys a human would. When
// the job lands (or the clock runs out) it writes the verdict to document.title.

// Waypoints sit on ROAD CENTRES: avenues x = i*710 + 75 (2205, 2915, 3635…), streets
// y = j*570 + 75 (1785, 2925…). (A "correction" that moved them to 1860/3000 put the
// car on the BLOCK strip among the warehouses — the blocks start at +150, not +0.)
const ROUTE_OUT = [[2205, 1785], [2915, 1785], [2915, 2355], [2915, 2925], [3635, 2925], [3900, 3200]];
const ROUTE_BACK = [[3635, 2925], [2915, 2925], [2915, 2355], [2915, 1785], [2205, 1785], [1900, 1700]];

export function createAutopilot(game) {
  const input = game.input;
  let phase = 'accept';
  let wpIndex = 0;
  let route = ROUTE_OUT;
  let elapsed = 0;
  let done = false;
  let inactiveTicks = 0;
  let stuckTimer = 0;
  let lastX = 0;
  let lastY = 0;

  function setKeys(codes) {
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) input.setVirtual(code, codes.includes(code));
  }

  let walkStuck = 0;
  let walkLastX = 0;
  let walkLastY = 0;
  let detourTicks = 0;
  let detourCode = 'KeyD';

  function walkToward(x, y) {
    const p = game.player;
    const dx = x - p.x;
    const dy = y - p.y;
    // Wall-following: the garage Comet sits in a lot behind a building line, and a
    // straight diagonal wedges Rio against the wall (the near-axis key drops out under
    // its dead-zone, so he pushes the bricks forever). If he has barely moved, detour
    // sideways — toward the target's side — until the way north opens up.
    const moved = Math.hypot(p.x - walkLastX, p.y - walkLastY);
    walkLastX = p.x;
    walkLastY = p.y;
    if (detourTicks > 0) {
      detourTicks -= 1;
      setKeys([detourCode]);
      return Math.hypot(dx, dy);
    }
    if (moved < 0.8) walkStuck += 1;
    else walkStuck = 0;
    if (walkStuck > 30) {
      walkStuck = 0;
      detourTicks = 34;
      detourCode = Math.abs(dy) >= Math.abs(dx) ? (dx >= 0 ? 'KeyD' : 'KeyA') : (dy >= 0 ? 'KeyS' : 'KeyW');
      setKeys([detourCode]);
      return Math.hypot(dx, dy);
    }
    const codes = [];
    if (Math.abs(dx) > 12) codes.push(dx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(dy) > 12) codes.push(dy > 0 ? 'KeyS' : 'KeyW');
    setKeys(codes);
    return Math.hypot(dx, dy);
  }

  let maneuver = 0;
  let anchorX = null;
  let anchorY = 0;
  let anchorAge = 0;
  let lastWedgeX = null;
  let lastWedgeY = 0;
  let aimOffset = 0;
  let aimOffsetTicks = 0;

  function driveToward(x, y) {
    const car = game.player.car;
    if (!car) return 0;
    // A repeated wedge at the same spot (a palm, a parked car, a stalled taxi exactly
    // on the racing line) defeats back-and-forth escapes: the swing returns to the same
    // line and re-hits it. Shift the AIM sideways for a while instead — an overtake
    // line — alternating sides each time the same spot wedges the car again.
    let ax = x;
    let ay = y;
    if (aimOffsetTicks > 0) {
      aimOffsetTicks -= 1;
      const bearing = Math.atan2(y - car.y, x - car.x);
      ax = x + Math.cos(bearing + Math.PI / 2) * aimOffset;
      ay = y + Math.sin(bearing + Math.PI / 2) * aimOffset;
    }
    const want = Math.atan2(ay - car.y, ax - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const dist = Math.hypot(x - car.x, y - car.y);
    // Escape maneuver, judged on NET displacement over a 45-tick window: collision
    // jitter makes per-tick movement useless (the car grinds a building corner, moving
    // every tick and going nowhere). Net < 6 units in the window while the target is
    // still far means wedged: back out with hard lock, then swing in on a new line.
    if (maneuver > 0) {
      maneuver -= 1;
      if (maneuver > 26) setKeys(['KeyS', diff > 0 ? 'KeyD' : 'KeyA']);
      else setKeys(['KeyW', diff > 0 ? 'KeyD' : 'KeyA']);
      return dist;
    }
    anchorAge += 1;
    if (anchorX === null || anchorAge >= 26) {
      if (anchorX !== null && dist > 130 && Math.hypot(car.x - anchorX, car.y - anchorY) < 5) {
        maneuver = 40;
        anchorX = null;
        anchorAge = 0;
        if (lastWedgeX !== null && Math.hypot(car.x - lastWedgeX, car.y - lastWedgeY) < 80) {
          aimOffset = aimOffset === 55 ? -55 : 55;
          aimOffsetTicks = 420;
        }
        lastWedgeX = car.x;
        lastWedgeY = car.y;
        setKeys(['KeyS', diff > 0 ? 'KeyD' : 'KeyA']);
        return dist;
      }
      anchorX = car.x;
      anchorY = car.y;
      anchorAge = 0;
    }
    const codes = [];
    // A tight steering dead-zone: at 0.25 rad the car would cruise a full lane off the
    // aim line forever — parallel to the street, inside the block strip, grinding
    // corners. At 0.06 it corrects continuously and holds the road centre.
    if (diff > 0.06) codes.push('KeyD');
    else if (diff < -0.06) codes.push('KeyA');
    // Cruise, don't charge: contact damage scales with closing speed, and a wrecked
    // Comet fails the job. Above ~185 u/s the car coasts until drag bleeds it down —
    // unless the bust clock is running, when standing still is the one fatal move and
    // the cap lifts to escape speed.
    // Pre-emptive pace too: a unit inside 300 units is about to be a problem at the
    // next slow corner, so the car keeps its speed up before the bust clock starts.
    let nearestUnit = Infinity;
    for (const unit of game.police.units) {
      const d = Math.hypot(unit.car.x - car.x, unit.car.y - car.y);
      if (d < nearestUnit) nearestUnit = d;
    }
    const cap = game.police.stars > 0 || game.police.bust > 0.15 || nearestUnit < 300 ? 320 : 185;
    const speed = Math.hypot(car.vx, car.vy);
    if (Math.abs(diff) < 1.15) {
      if (speed < cap) codes.push('KeyW');
    } else if (Math.abs(diff) > 2.6) codes.push('KeyS');
    setKeys(codes);
    return dist;
  }

  function finish(win, note) {
    if (done) return;
    done = true;
    input.clearVirtual();
    const errors = (window.__errors || []).length;
    document.title = win
      ? `AUTOPILOT WIN mission=1 cash=${game.cash} rep=${game.rep} errors=${errors}`
      : `AUTOPILOT FAIL ${note} errors=${errors}`;
    window.__autopilotDone = true;
  }

  return {
    get done() { return done; },
    tick() {
      if (done) return;
      elapsed += 1 / 60;
      if (elapsed > 300) {
        finish(false, `timeout phase=${phase}`);
        return;
      }
      const missions = game.missions;
      if (missions.index >= 1) {
        finish(true);
        return;
      }
      // A mission lands a frame or two after the E press that accepts it (and a stage
      // hand-off can blink inactive between frames): only a SUSTAINED inactive stretch
      // means the job truly failed — bust, wasted, or a blown timer.
      if (!missions.active && phase !== 'accept') {
        inactiveTicks += 1;
        if (inactiveTicks > 120) {
          finish(false, `mission-failed phase=${phase} over=${game.overKind}`);
          return;
        }
      } else inactiveTicks = 0;
      const p = game.player;
      if (phase === 'accept') {
        const offer = missions.offerPoint();
        if (!offer) return;
        if (walkToward(offer.x, offer.y) < 40) {
          setKeys([]);
          input.pressVirtual('KeyE');
          phase = 'garage';
        }
        return;
      }
      if (phase === 'garage') {
        const garage = game.city.poi('garage');
        if (!p.car) {
          if (walkToward(game.starterCar.x, game.starterCar.y) < 55) {
            setKeys([]);
            input.pressVirtual('KeyE');
          }
        } else {
          void garage;
          phase = 'out';
          wpIndex = 0;
          route = ROUTE_OUT;
        }
        return;
      }
      if (phase === 'out' || phase === 'back') {
        const [wx, wy] = route[wpIndex];
        const d = driveToward(wx, wy);
        if (d < 110) {
          wpIndex += 1;
          if (wpIndex >= route.length) {
            if (phase === 'out') {
              phase = 'wait-drop';
            } else {
              phase = 'wait-end';
            }
          }
        }
        return;
      }
      if (phase === 'wait-drop') {
        // The deliver stage completes on arrival; the director turns us home. Never
        // sit still for a tailing unit: if the bust clock is running, keep rolling
        // toward the marina point until the stage flips.
        if (missions.active && missions.active.stageIdx >= 2) {
          phase = 'back';
          wpIndex = 0;
          route = ROUTE_BACK;
        } else if (game.police.bust > 0.1 && p.car) {
          driveToward(3900, 3200);
        } else setKeys([]);
        return;
      }
      if (phase === 'wait-end') {
        setKeys([]);
      }
    },
  };
}
