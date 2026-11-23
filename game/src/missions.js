// The NEON PALMS campaign: fifteen jobs for Madame Zora Vane and the Solstice Crew, from
// grocery runs to the Neon Crown grand prix, written as data and run by a small director.
// The director offers the next job at its giver's marker, walks the stage list (drives,
// pickups, collections, checkpoint races, shootouts, a car to steal, a tail to wreck, one
// long escape), feeds the HUD its JOB panel text, pays out in cash and REP, and remembers
// how a job failed so the city can gossip about it. Stage kinds:
//   goto / deliver / escape — reach the point (deliver expects the car, escape starts hot)
//   collect — touch every marked point      race — touch the checkpoints in order
//   shoot — put every spawned gunman down   steal — get into the marked car
//   chase — wreck the marked car, or pin it still against a wall

export function createMissions() {
  const list = buildCampaign();
  return {
    list,
    index: 0,
    active: null,
    lastFail: '',

    get done() {
      return this.index >= list.length;
    },

    current() {
      return this.done ? null : list[this.index];
    },

    /** Where the next job is offered, or null when the campaign is finished. */
    offerPoint() {
      const mission = this.current();
      if (!mission || this.active) return null;
      return mission.acceptAt;
    },

    accept(game) {
      const mission = this.current();
      if (!mission || this.active) return false;
      this.active = {
        mission,
        stageIdx: 0,
        stage: null,
        entities: [],
        got: 0,
        cp: 0,
        pinTimer: 0,
        timeLeft: mission.stages[0].time || 0,
        passenger: null,
      };
      game.showDialogue(mission.intro);
      this.enterStage(game);
      game.stats.jobsTaken += 1;
      return true;
    },

    enterStage(game) {
      const a = this.active;
      const stage = a.mission.stages[a.stageIdx];
      a.stage = stage;
      a.got = 0;
      a.cp = 0;
      a.pinTimer = 0;
      a.timeLeft = stage.time || 0;
      a.entities = game.spawnStageEntities(stage, a);
      if (stage.heat) game.police.heat = Math.max(game.police.heat, stage.heat);
      if (stage.tod !== undefined) game.tod = stage.tod;
      if (stage.line) game.showDialogue(stage.line);
    },

    completeStage(game) {
      const a = this.active;
      a.stageIdx += 1;
      if (a.stageIdx >= a.mission.stages.length) {
        this.completeMission(game);
        return;
      }
      this.enterStage(game);
    },

    completeMission(game) {
      const mission = this.active.mission;
      game.earn(mission.pay);
      game.rep += mission.rep;
      game.stats.jobsDone += 1;
      game.showBanner('MISSION PASSED', mission.title, mission.pay, mission.rep);
      game.showDialogue(mission.outro);
      game.audio.success();
      this.index += 1;
      this.active = null;
    },

    fail(game, reason) {
      if (!this.active) return;
      this.lastFail = reason;
      game.showBanner('MISSION FAILED', reason, 0, 0);
      game.audio.fail();
      // Stage entities (gunmen, target cars) fold back into the city as ambient life.
      for (const entity of this.active.entities) {
        if (entity.kind === 'shooter' && !entity.ref.dead) entity.ref.kind = 'walker';
        if (entity.kind === 'targetCar') entity.ref.driver = 'traffic';
      }
      this.active = null;
    },

    onPlayerDown(game) {
      if (this.active) this.fail(game, game.player.dead ? 'Rio went down mid-job.' : 'The PD took Rio mid-job.');
    },

    /** The gold marker the world and the map should draw, if any. */
    target() {
      const a = this.active;
      if (a) {
        const stage = a.stage;
        if (stage.kind === 'race') return { x: stage.checkpoints[a.cp][0], y: stage.checkpoints[a.cp][1], label: stage.label };
        if (stage.kind === 'collect') {
          const left = stage.points.find((pt, i) => !a['got' + i]);
          if (left) return { x: left[0], y: left[1], label: stage.label };
        }
        if (stage.kind === 'chase' || stage.kind === 'steal') {
          const car = a.entities.find((e) => e.kind === 'targetCar');
          if (car) return { x: car.ref.x, y: car.ref.y, label: stage.label };
        }
        if (stage.x !== undefined) return { x: stage.x, y: stage.y, label: stage.label };
        return null;
      }
      const mission = this.current();
      if (mission) return { x: mission.acceptAt.x, y: mission.acceptAt.y, label: `Meet ${mission.giver}` };
      return null;
    },

    /** JOB panel text for the HUD. */
    progress() {
      const a = this.active;
      if (!a) {
        if (this.done) return { job: 'STORY COMPLETE', title: 'NEON CROWN', stage: 'Palmera is yours. Free roam.', frac: 1, next: 'The city keeps turning: races, shops, trouble.' };
        const mission = this.current();
        return {
          job: `JOB ${this.index + 1}/15`,
          title: mission.title,
          stage: `Meet ${mission.giver}`,
          frac: 0,
          next: mission.teaser,
        };
      }
      const stage = a.stage;
      let frac = 0;
      if (stage.kind === 'race') frac = a.cp / stage.checkpoints.length;
      else if (stage.kind === 'collect') frac = a.got / stage.points.length;
      else if (stage.kind === 'shoot') {
        const total = a.entities.filter((e) => e.kind === 'shooter').length || 1;
        const down = a.entities.filter((e) => e.kind === 'shooter' && e.ref.dead).length;
        frac = down / total;
      } else if (a.mission.stages.length > 1) frac = a.stageIdx / a.mission.stages.length;
      let stageText = stage.label;
      if (stage.kind === 'race') stageText = `${stage.label} — checkpoint ${a.cp + 1}/${stage.checkpoints.length}`;
      if (stage.kind === 'collect') stageText = `${stage.label} — ${a.got}/${stage.points.length}`;
      if (a.timeLeft > 0) stageText += ` — ${Math.ceil(a.timeLeft)}s`;
      return {
        job: `JOB ${this.index + 1}/15`,
        title: a.mission.title,
        stage: stageText,
        frac,
        next: stage.hint || '',
      };
    },

    update(dt, game) {
      const a = this.active;
      if (!a) return;
      const stage = a.stage;
      const p = game.player;
      if (a.timeLeft > 0) {
        a.timeLeft -= dt;
        if (a.timeLeft <= 0) {
          this.fail(game, 'Out of time. The job walks away.');
          return;
        }
      }
      // The passenger, when a stage carries one, rides or follows.
      if (a.passenger && !a.passenger.dead) {
        if (p.car) {
          a.passenger.x = p.car.x;
          a.passenger.y = p.car.y;
          a.passenger.hidden = true;
        } else {
          a.passenger.hidden = false;
          const d = Math.hypot(p.x - a.passenger.x, p.y - a.passenger.y);
          if (d > 30) {
            a.passenger.x += ((p.x - a.passenger.x) / d) * 150 * dt;
            a.passenger.y += ((p.y - a.passenger.y) / d) * 150 * dt;
            a.passenger.angle = Math.atan2(p.y - a.passenger.y, p.x - a.passenger.x);
          }
        }
      }
      const reach = (x, y, radius) => Math.hypot(p.x - x, p.y - y) < radius;
      switch (stage.kind) {
        case 'goto':
          if (reach(stage.x, stage.y, 80)) this.completeStage(game);
          break;
        case 'deliver':
          if (p.car && reach(stage.x, stage.y, 92)) this.completeStage(game);
          break;
        case 'escape':
          if (reach(stage.x, stage.y, 92)) this.completeStage(game);
          break;
        case 'collect': {
          let all = true;
          stage.points.forEach((pt, i) => {
            if (a['got' + i]) return;
            if (reach(pt[0], pt[1], 92)) {
              a['got' + i] = true;
              a.got += 1;
              game.audio.pickup();
              game.spawnSparks(pt[0], pt[1], 6);
            } else all = false;
          });
          if (all) this.completeStage(game);
          break;
        }
        case 'race': {
          const cp = stage.checkpoints[a.cp];
          if (cp && reach(cp[0], cp[1], 105)) {
            a.cp += 1;
            game.audio.pickup();
            if (a.cp >= stage.checkpoints.length) this.completeStage(game);
          }
          break;
        }
        case 'shoot': {
          const shooters = a.entities.filter((e) => e.kind === 'shooter');
          if (shooters.length > 0 && shooters.every((e) => e.ref.dead)) this.completeStage(game);
          break;
        }
        case 'steal': {
          const car = a.entities.find((e) => e.kind === 'targetCar');
          if (car && p.car === car.ref) this.completeStage(game);
          break;
        }
        case 'chase': {
          const car = a.entities.find((e) => e.kind === 'targetCar');
          if (!car) {
            this.completeStage(game);
            break;
          }
          const target = car.ref;
          const speed = Math.hypot(target.vx, target.vy);
          if (target.health <= 20 || target.wreck) {
            this.completeStage(game);
          } else if (speed < 12 && Math.hypot(p.x - target.x, p.y - target.y) < 78) {
            a.pinTimer += dt;
            if (a.pinTimer > 2.2) this.completeStage(game);
          } else {
            a.pinTimer = 0;
          }
          break;
        }
        default:
          break;
      }
    },
  };
}

const Z = (text) => ({ who: 'ZORA', text });
const R = (text) => ({ who: 'RIO', text });
const P = (text) => ({ who: 'PAZ', text });
const L = (text) => ({ who: 'LUCIA', text });
const T = (text) => ({ who: 'TOM\u00c1S', text });
const A = (text) => ({ who: 'AITANA', text });
const D = (text) => ({ who: 'DISPATCH', text });

function buildCampaign() {
  const club = { x: 1850, y: 1676, name: 'Club Solstice' };
  const garage = { x: 2040, y: 1676, name: 'Garage Solstice' };
  const marina = { x: 3900, y: 3220, name: 'Port Azure Marina' };
  const safehouse = { x: 430, y: 560, name: 'Safehouse Brisa' };
  const meet = { x: 1200, y: 2150, name: 'Midnight Meet' };
  const resort = { x: 3050, y: 330, name: 'Hotel Marea' };
  const vesper = { x: 1200, y: 2050, name: 'Vesper Clubhouse' };

  return [
    {
      title: 'Fresh Off the Bus', giver: 'Madame Zora', acceptAt: club, pay: 600, rep: 45,
      teaser: 'A woman in pink neon is waiting to size you up.',
      intro: [Z('So. The famous Rio C\u00e1rdenas, with one bag and no car.'), R('The car is the part I was hoping you could help with.'), Z('Paz keeps a Comet for runners. Take it. Drive Lucia to the marina — gently.')],
      stages: [
        { kind: 'goto', x: garage.x, y: garage.y, label: 'Take the Comet at Garage Solstice', hint: 'Press E at the gold Comet.' },
        { kind: 'deliver', x: marina.x, y: marina.y, label: 'Drive Lucia to Port Azure Marina', hint: 'She bruises. The car may.', passenger: true },
        { kind: 'goto', x: club.x, y: club.y, label: 'Return to Club Solstice', hint: 'Zora pays in person.' },
      ],
      outro: [L('He drives like the street owes him money. I like it.'), Z('Then Palmera will too. Welcome to the Solstice Crew.')],
    },
    {
      title: 'Grocery Getter', giver: 'Madame Zora', acceptAt: club, pay: 500, rep: 40,
      teaser: 'Three bodegas, three bags, no questions.',
      intro: [Z('The club eats, Rio. Three bodegas in the Quarter owe us groceries — the paper-bag kind.'), R('And if they argue?'), Z('Then smile. You are the smile of this crew now.')],
      stages: [
        { kind: 'collect', points: [[1200, 1128], [2205, 1128], [1850, 560]], label: 'Collect the three bags', hint: 'Gold markers, kerbside. Drive through them.' },
        { kind: 'deliver', x: club.x, y: club.y, label: 'Bring the bags to Club Solstice', hint: 'Mind the eggs. There are no eggs. Mind them anyway.' },
      ],
      outro: [Z('Warm, unbroken, and nobody called the police. You are learning.')],
    },
    {
      title: 'Taxi for the Devil', giver: 'Madame Zora', acceptAt: club, pay: 900, rep: 60,
      teaser: 'An accountant who knows too much needs the marina.',
      intro: [Z('Tom\u00e1s Rey cooked books for the Vespers. Now he cooks for us — if he lives.'), T('There is a car outside. It has been outside for two days. I counted.'), R('Then we drive fast, se\u00f1or. Get in.')],
      stages: [
        { kind: 'goto', x: resort.x, y: resort.y, label: 'Pick up Tom\u00e1s at Hotel Marea', hint: 'He is the one sweating through a suit.' },
        { kind: 'deliver', x: marina.x, y: marina.y, label: 'Get Tom\u00e1s to the marina boat', hint: 'A Vesper tail is behind you. Do not stop.', passenger: true, tail: true },
      ],
      outro: [T('I saw my life. It was mostly spreadsheets.'), Z('He lives, the books are ours. Good driving, wheelman.')],
    },
    {
      title: 'First Blood Neon', giver: 'Madame Zora', acceptAt: club, pay: 800, rep: 70,
      teaser: 'Vesper scouts are watching the club. Unwatch them.',
      intro: [Z('Three Vesper boys are parked up the Mile taking photographs of my door.'), R('You want the camera?'), Z('I want the photographers to develop a sudden fear of photography.')],
      stages: [
        { kind: 'shoot', spots: [[2500, 1748], [2620, 1806], [2740, 1752]], weapon: 'smg', label: 'Run off the Vesper scouts', hint: 'Slot 3 if you bought the SMG. Fists if you are feeling historical.' },
        { kind: 'goto', x: club.x, y: club.y, label: 'Report back to Zora', hint: 'Wipe your shoes. It is a nice club.' },
      ],
      outro: [Z('The Mile breathes again. The Vespers will answer, but not tonight.')],
    },
    {
      title: 'Harbour Lights', giver: 'Paz Ibarra', acceptAt: garage, pay: 1100, rep: 80,
      teaser: 'A crate fell off a boat. Paz wants it before customs wakes.',
      intro: [P('A marine engine, still in its crate, sitting on the marina quay like a lost dog.'), R('And the police?'), P('Asleep. Until you start the car, probably. Bring it to my garage.')],
      stages: [
        { kind: 'collect', points: [[3900, 3180]], label: 'Take the crate at the marina', hint: 'It is heavy. The car will forgive you.' },
        { kind: 'escape', x: garage.x, y: garage.y, label: 'Lose the heat, deliver to Garage Solstice', hint: 'Repaint at Spray & Pay if it gets loud.', heat: 210 },
      ],
      outro: [P('Beautiful. This engine sings in a boat by Friday.'), Z('And Paz sings at the club. Everyone wins.')],
    },
    {
      title: 'Cielo Run', giver: 'Paz Ibarra', acceptAt: meet, pay: 1000, rep: 85,
      teaser: 'The Midnight Meet wants a hill time. The hills want respect.',
      intro: [P('The Meet runs a hill ladder, Rio. Cielo Heights, five gates, my stopwatch.'), R('And the prize?'), P('Money. And the hill crowd saying your name right.')],
      stages: [
        { kind: 'race', checkpoints: [[785, 645], [785, 75], [2205, 75], [2205, 645], [430, 560]], label: 'Cielo Run', hint: 'Gold rings. Order matters. So does not dying.' },
      ],
      outro: [P('The hill says C\u00e1rdenas now. I heard it myself.')],
    },
    {
      title: 'The Accountant\u2019s Ledger', giver: 'Madame Zora', acceptAt: club, pay: 1400, rep: 90,
      teaser: 'A gold limo in Coral Beach is full of Vesper paper.',
      intro: [Z('The Vespers keep their real books in a gold Aurum, parked at the Marea like a trophy.'), R('You want the car, or the books?'), Z('I want the car. The books are a bonus. The look on their faces is the tip.')],
      stages: [
        { kind: 'steal', x: resort.x, y: resort.y, model: 'lux', color: '#c8a028', label: 'Steal the gold Aurum Limo', hint: 'It is the gold one. It is always the gold one.' },
        { kind: 'deliver', x: garage.x, y: garage.y, label: 'Deliver the limo to Garage Solstice', hint: 'Paz will crack it like an egg.' },
      ],
      outro: [Z('Ledgers, names, dates. Dante Ferro keeps very tidy sins.')],
    },
    {
      title: 'Static', giver: 'Madame Zora', acceptAt: club, pay: 1300, rep: 95,
      teaser: 'A Vesper stash house in the Flats is broadcasting. Silence it.',
      intro: [Z('The Vespers run a radio stash out of the Flats — guns in, gossip out.'), R('How loud do you want it?'), Z('Loud enough that Dante hears the silence after.')],
      stages: [
        { kind: 'shoot', spots: [[1150, 1980], [1260, 2030], [1180, 2120], [1300, 2100]], weapon: 'smg', label: 'Clear the stash house guard', hint: 'Four guns. Count them twice.' },
        { kind: 'collect', points: [[1200, 2050], [1240, 2080]], label: 'Take the stash radios', hint: 'Crates by the door.' },
      ],
      outro: [D('...static...'), Z('That is the sound of the Flats changing owners.')],
    },
    {
      title: 'Midnight Milk Run', giver: 'Paz Ibarra', acceptAt: marina, pay: 1600, rep: 100,
      teaser: 'One cooler, one sleeping city, one clock.',
      intro: [P('Medicine for a rich man\u2019s mother, landed at midnight, needed in Cielo before it warms.'), R('How long do I have?'), P('Long enough if you are who Zora says. Short if you are not.')],
      stages: [
        { kind: 'collect', points: [[3900, 3180]], label: 'Take the cooler at the marina', hint: 'Keep it cold. Drive like winter.' },
        { kind: 'deliver', x: safehouse.x, y: safehouse.y, label: 'Deliver to Safehouse Brisa — fast', hint: 'The clock on the JOB panel is real.', time: 150 },
      ],
      outro: [P('Cold as the sea it crossed. The hill owes us now.')],
    },
    {
      title: 'VIP Escort', giver: 'Madame Zora', acceptAt: club, pay: 1800, rep: 110,
      teaser: 'Aitana Mar sings at the Solstice tonight — if she arrives.',
      intro: [Z('Aitana Mar, the voice of Coral Beach, sings my stage tonight.'), A('The Vespers offered me a contract too. Their pen was a knife.'), R('Then we take the loud way home. Stay down when I say.')],
      stages: [
        { kind: 'goto', x: resort.x, y: resort.y, label: 'Collect Aitana at Hotel Marea', hint: 'She travels with one bag and forty opinions.' },
        { kind: 'shoot', spots: [[2500, 1748], [2620, 1806], [2740, 1752]], weapon: 'rifle', label: 'Ambush on the Mile — protect Aitana', hint: 'They chose the place. Bad choice.', passenger: true },
        { kind: 'deliver', x: club.x, y: club.y, label: 'Bring Aitana to Club Solstice', hint: 'The stage is lit. So is she.', passenger: true },
      ],
      outro: [A('You drive like a song with no chorus. I adore it.'), Z('Tonight the Mile hears her. Tomorrow it hears of you.')],
    },
    {
      title: 'Grand Theft Marina', giver: 'Paz Ibarra', acceptAt: garage, pay: 2200, rep: 120,
      teaser: 'Two rich toys sleep at the marina. Paz has the keys to neither.',
      intro: [P('A Comet and a Vader, marina lot, owners at sea until Sunday.'), R('Both of them?'), P('Both. I am redecorating the garage with other people\u2019s taste.')],
      stages: [
        { kind: 'steal', x: marina.x, y: marina.y, model: 'comet', color: '#2456c8', label: 'Steal the blue Comet at the marina', hint: 'First toy. The blue one.' },
        { kind: 'deliver', x: garage.x, y: garage.y, label: 'Park the Comet at Garage Solstice', hint: 'One down.' },
        { kind: 'steal', x: marina.x, y: marina.y, model: 'vader', color: '#15151c', label: 'Steal the black Vader at the marina', hint: 'Second toy. It growls.' },
        { kind: 'deliver', x: garage.x, y: garage.y, label: 'Park the Vader at Garage Solstice', hint: 'Paz is grinning already.' },
      ],
      outro: [P('My garage has never looked this expensive. Neither have I.')],
    },
    {
      title: 'Heat Signature', giver: 'Madame Zora', acceptAt: club, pay: 2000, rep: 130,
      teaser: 'The PD wants a face for the poster. Give them a ghost instead.',
      intro: [Z('Interdiction printed your face tonight, Rio. Four stars of it.'), R('And I do what with my fame?'), Z('You run it into the ground. The safehouse. Do not stop for autographs.')],
      stages: [
        { kind: 'escape', x: safehouse.x, y: safehouse.y, label: 'Escape to Safehouse Brisa', hint: 'Four stars. Alleys are doors. Use them.', heat: 410 },
      ],
      outro: [Z('The poster comes down tomorrow. Ghosts do not pose.')],
    },
    {
      title: 'Vesper\u2019s Last Party', giver: 'Madame Zora', acceptAt: club, pay: 2600, rep: 150,
      teaser: 'Dante is throwing a party at his clubhouse. Crash it permanently.',
      intro: [Z('Dante Ferro is celebrating the ledger he does not know he lost.'), R('How many candles?'), Z('Six guns, last count. Blow them all out, Rio.')],
      stages: [
        { kind: 'shoot', spots: [[1120, 1980], [1200, 1960], [1290, 1990], [1150, 2120], [1240, 2130], [1330, 2060]], weapon: 'rifle', label: 'Crash the Vesper clubhouse', hint: 'Six guns. The rifle earns its slot tonight.' },
        { kind: 'goto', x: vesper.x, y: vesper.y, label: 'Walk into the quiet clubhouse', hint: 'Mind the glass.' },
      ],
      outro: [Z('The Flats fly Solstice colours by morning. You did that.')],
    },
    {
      title: 'The Set-Up', giver: 'Madame Zora', acceptAt: club, pay: 3000, rep: 170,
      teaser: 'Dante runs tonight, in a black Vader. Finish the argument.',
      intro: [Z('Dante is running for the port with what is left of his pride, in a black Vader.'), R('Running is still driving.'), Z('Then out-drive him. Wreck the car. Let him walk home through his old empire.')],
      stages: [
        { kind: 'chase', x: 2205, y: 645, model: 'vader', color: '#15151c', label: 'Wreck Dante\u2019s Vader', hint: 'Ram him into the architecture, or pin him still.' },
        { kind: 'goto', x: club.x, y: club.y, label: 'Come home to Club Solstice', hint: 'Slowly. Let the Mile see you cruise it.' },
      ],
      outro: [Z('He walked. The whole Quarter watched him walk. It is over, Rio — almost.')],
    },
    {
      title: 'Neon Crown', giver: 'Madame Zora', acceptAt: club, pay: 6000, rep: 300,
      teaser: 'One race, every district, the whole PD watching. Take the crown.',
      intro: [Z('The Midnight Grand Prix, Rio. Every district, one lap, my name on the trophy.'), R('And Interdiction?'), Z('Invited. Three stars of them. Win anyway — win as a Solstice.')],
      stages: [
        { kind: 'race', checkpoints: [[4335, 645], [4335, 2925], [3900, 3220], [75, 2925], [75, 75], [2205, 1215], [1850, 1620]], label: 'Neon Crown Grand Prix', hint: 'Seven gates around the whole city. The crown is the last one.', heat: 310 },
      ],
      outro: [Z('PALMERA! Say his name right: C\u00c1RDENAS, king of the Mile!'), R('Long live the crew.'), Z('Long live the Neon Crown.')],
    },
  ];
}
