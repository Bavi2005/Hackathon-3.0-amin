/** Deterministic fictional experiment. No routing, GPS, live availability or personal data. */
export type Demand = {id: string; minute: number; origin: number; destination: number; seats: number; accessible: boolean};
export type SimVehicle = {id: string; capacity: number; accessible: boolean; start: number};
export type Scenario = {seed: number; stops: string[]; travelMinutes: number[][]; fleet: SimVehicle[]; demand: Demand[]; maxWait: number; headway: number; horizon: number};
export type SimEvent = {type: 'assigned' | 'boarded' | 'completed' | 'unserved' | 'leg'; minute: number; request?: string; vehicle?: string; from?: number; to?: number; passengers?: number; duration?: number; alternatives?: number; reason?: string};
export type SimulationResult = {strategy: 'fixed' | 'adaptive'; events: SimEvent[]; metrics: {requests: number; served: number; unserved: number; averageWait: number | null; p95Wait: number | null; averageDetour: number | null; operatingMinutes: number; occupancy: number | null}};

export function validateScenario(s: Scenario): void {
  if (!Number.isSafeInteger(s.seed) || !Number.isInteger(s.horizon) || s.horizon < 1 || s.horizon > 480 || !Number.isInteger(s.maxWait) || s.maxWait < 1 || s.maxWait > 120 || !Number.isInteger(s.headway) || s.headway < 1 || s.headway > 180) throw Error('Invalid simulation bounds');
  const n = s.stops.length;
  if (n < 2 || n > 6 || new Set(s.stops).size !== n || s.stops.some(v => typeof v !== 'string' || !v || v.length > 80) || s.travelMinutes.length !== n) throw Error('Invalid simulation stops');
  for (let a = 0; a < n; a++) {
    if (!Array.isArray(s.travelMinutes[a]) || s.travelMinutes[a].length !== n) throw Error('Invalid travel matrix');
    for (let b = 0; b < n; b++) {const v = s.travelMinutes[a][b]; if (!Number.isInteger(v) || (a === b ? v !== 0 : v < 1 || v > 120)) throw Error('Invalid travel matrix');}
  }
  if (!s.fleet.length || s.fleet.length > 20 || new Set(s.fleet.map(v => v.id)).size !== s.fleet.length) throw Error('Invalid simulation fleet');
  for (const v of s.fleet) if (!v.id || !Number.isInteger(v.capacity) || v.capacity < 1 || v.capacity > 100 || typeof v.accessible !== 'boolean' || !Number.isInteger(v.start) || v.start < 0 || v.start >= n) throw Error('Invalid vehicle');
  if (s.demand.length > 1000 || new Set(s.demand.map(r => r.id)).size !== s.demand.length) throw Error('Invalid demand');
  for (const r of s.demand) if (!r.id || !Number.isInteger(r.minute) || r.minute < 0 || r.minute >= s.horizon || !Number.isInteger(r.seats) || r.seats < 1 || r.seats > 100 || typeof r.accessible !== 'boolean' || !Number.isInteger(r.origin) || !Number.isInteger(r.destination) || r.origin < 0 || r.destination < 0 || r.origin >= n || r.destination >= n || r.origin === r.destination) throw Error('Invalid request');
}
export function simulateDispatch(s: Scenario, strategy: 'fixed' | 'adaptive'): SimulationResult {
  validateScenario(s);
  const events: SimEvent[] = [], demand = [...s.demand].sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id));
  const assigned = new Set<string>(), completed = new Set<string>(), failed = new Set<string>();
  const boarded = new Map<string, number>();
  const vehicles = s.fleet.map((v, i) => ({...v, position: v.start, available: strategy === 'fixed' ? Math.floor(i * s.headway / s.fleet.length) : 0, passengers: [] as Demand[], hubDeparture: -s.headway}));
  let operatingMinutes = 0, passengerMinutes = 0, seatMinutes = 0;
  const end = s.horizon + s.maxWait + Math.max(...s.travelMinutes.flat()) * (s.stops.length + 1);
  const pending = (minute: number) => demand.filter(r => r.minute <= minute && minute - r.minute <= s.maxWait && !assigned.has(r.id) && !failed.has(r.id));
  function board(v: typeof vehicles[number], r: Demand, minute: number, alternatives: number) {
    assigned.add(r.id); boarded.set(r.id, minute); v.passengers.push(r);
    events.push({type: 'assigned', minute, request: r.id, vehicle: v.id, alternatives, reason: strategy === 'fixed' ? 'Scheduled route, FIFO and spare capacity' : 'Shortest feasible pickup using fictional matrix; same-destination batching'});
    events.push({type: 'boarded', minute, request: r.id, vehicle: v.id, passengers: r.seats});
  }
  function leg(v: typeof vehicles[number], from: number, to: number, minute: number, passengers: number) {
    const duration = s.travelMinutes[from][to]; operatingMinutes += duration; passengerMinutes += passengers * duration; seatMinutes += v.capacity * duration;
    events.push({type: 'leg', minute, vehicle: v.id, from, to, passengers, duration});
  }
  for (let minute = 0; minute <= end; minute++) {
    for (const v of vehicles) {
      if (v.available > minute) continue;
      for (const r of v.passengers.filter(r => r.destination === v.position)) {completed.add(r.id); events.push({type: 'completed', minute, vehicle: v.id, request: r.id});}
      v.passengers = v.passengers.filter(r => !completed.has(r.id));
      if (strategy !== 'fixed' || minute >= s.horizon + s.maxWait && !v.passengers.length) continue;
      if (v.position === 0 && minute < v.hubDeparture + s.headway) continue;
      let seats = v.capacity - v.passengers.reduce((n, r) => n + r.seats, 0);
      for (const r of pending(minute).filter(r => r.origin === v.position)) {
        if (r.seats > seats || r.accessible && !v.accessible) continue; board(v, r, minute, 0); seats -= r.seats;
      }
      const destination = (v.position + 1) % s.stops.length;
      if (v.position === 0) v.hubDeparture = minute;
      leg(v, v.position, destination, minute, v.capacity - seats);
      v.available = minute + s.travelMinutes[v.position][destination]; v.position = destination;
    }
    if (strategy === 'adaptive') {
      for (const r of pending(minute)) {
        if (assigned.has(r.id)) continue;
        const candidates = vehicles.filter(v => v.available <= minute && !v.passengers.length && v.capacity >= r.seats && (!r.accessible || v.accessible) && minute + s.travelMinutes[v.position][r.origin] - r.minute <= s.maxWait)
          .sort((a, b) => s.travelMinutes[a.position][r.origin] - s.travelMinutes[b.position][r.origin] || a.id.localeCompare(b.id));
        const v = candidates[0]; if (!v) continue;
        const pickup = minute + s.travelMinutes[v.position][r.origin];
        const from = v.position; let seats = v.capacity;
        for (const group of [r, ...pending(minute).filter(q => q.id !== r.id && q.origin === r.origin && q.destination === r.destination)]) {
          if (assigned.has(group.id) || group.seats > seats || group.accessible && !v.accessible || pickup - group.minute > s.maxWait) continue;
          board(v, group, pickup, candidates.length - 1); seats -= group.seats;
        }
        if (from !== r.origin) leg(v, from, r.origin, minute, 0);
        leg(v, r.origin, r.destination, pickup, v.capacity - seats);
        v.available = pickup + s.travelMinutes[r.origin][r.destination]; v.position = r.destination;
      }
    }
    for (const r of demand) if (!assigned.has(r.id) && !failed.has(r.id) && minute > r.minute + s.maxWait) {failed.add(r.id); events.push({type: 'unserved', minute, request: r.id, reason: 'No feasible service within configured maximum wait'});}
  }
  const waits = demand.filter(r => completed.has(r.id)).map(r => boarded.get(r.id)! - r.minute).sort((a, b) => a - b);
  const detours = events.filter(e => e.type === 'completed').map(e => {const r = demand.find(r => r.id === e.request)!; return e.minute - boarded.get(r.id)! - s.travelMinutes[r.origin][r.destination];});
  const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  events.sort((a, b) => a.minute - b.minute);
  return {strategy, events, metrics: {requests: demand.length, served: completed.size, unserved: demand.length - completed.size, averageWait: mean(waits), p95Wait: waits.length ? waits[Math.ceil(waits.length * .95) - 1] : null, averageDetour: mean(detours), operatingMinutes, occupancy: seatMinutes ? passengerMinutes / seatMinutes : null}};
}
export function fictionalScenario(seed = 20261020): Scenario {
  let state = seed >>> 0;
  const random = () => {state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296;};
  return {seed, stops: ['Fictional Community Hub', 'Fictional Mall'], travelMinutes: [[0, 8], [8, 0]], fleet: [{id: 'fictional-1', capacity: 4, accessible: true, start: 0}, {id: 'fictional-2', capacity: 4, accessible: false, start: 1}], maxWait: 20, headway: 24, horizon: 60,
    demand: Array.from({length: 30}, (_, index) => {const origin = random() < .65 ? 0 : 1; return {id: `fictional-request-${index + 1}`, minute: Math.floor(random() * 60), origin, destination: 1 - origin, seats: random() < .2 ? 2 : 1, accessible: random() < .15};})};
}
