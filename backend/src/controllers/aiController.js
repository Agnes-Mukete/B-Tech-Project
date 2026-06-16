const OpenAI = require('openai');
const Vehicle = require('../models/Vehicle');
const Incident = require('../models/Incident');
const Trip = require('../models/Trip');
const Booking = require('../models/Booking');
const { success } = require('../utils/response');
const logger = require('../utils/logger');

// ── OpenAI client (lazy init — only if API key is present) ────────────
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else {
  logger.warn('OPENAI_API_KEY not set — fleet assistant will use rule-based fallback');
}

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// ── Helpers ───────────────────────────────────────────────────────────
const pct = (part, total) => total ? Math.round((part / total) * 100) : 0;

// ── Data fetching (unchanged) ─────────────────────────────────────────
const getFleetContext = async (agencyFilter) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [vehicles, openIncidents, upcomingTrips, activeTrips, bookingsToday] = await Promise.all([
    Vehicle.find(agencyFilter).populate('currentDriver', 'name').lean(),
    Incident.find({ ...agencyFilter, status: 'open' }).populate('vehicleId', 'vehicleId plateNumber').lean(),
    Trip.find({ ...agencyFilter, status: 'scheduled', scheduledStart: { $gte: new Date() } }).limit(10).lean(),
    Trip.countDocuments({ ...agencyFilter, status: 'inProgress' }),
    Booking.countDocuments({ ...agencyFilter, createdAt: { $gte: today }, status: { $ne: 'cancelled' } }),
  ]);

  return { vehicles, openIncidents, upcomingTrips, activeTrips, bookingsToday };
};

// ── Summary builder (unchanged) ───────────────────────────────────────
const buildSummary = ({ vehicles, openIncidents, upcomingTrips, activeTrips, bookingsToday }) => {
  const total = vehicles.length;
  const active = vehicles.filter(v => v.status === 'active').length;
  const idle = vehicles.filter(v => v.status === 'idle').length;
  const maintenance = vehicles.filter(v => v.status === 'maintenance').length;
  const unassigned = vehicles.filter(v => !v.currentDriver).length;
  const lowFuel = vehicles.filter(v => Number(v.fuelLevel || 0) <= 25);

  const recommendations = [];
  if (openIncidents.length) recommendations.push(`Resolve ${openIncidents.length} open incident(s) first, especially high or critical alerts.`);
  if (maintenance) recommendations.push(`${maintenance} vehicle(s) are in maintenance; avoid assigning them to new trips.`);
  if (lowFuel.length) recommendations.push(`Refuel ${lowFuel.map(v => v.vehicleId || v.plateNumber).join(', ')} before long-distance dispatch.`);
  if (unassigned) recommendations.push(`${unassigned} vehicle(s) have no assigned driver; assign drivers before scheduling trips.`);
  if (idle > 0 && upcomingTrips.length > 0) recommendations.push('Use idle vehicles for the next scheduled trips before overloading active vehicles.');
  if (!recommendations.length) recommendations.push('Fleet status is stable. Continue monitoring active trips and scheduled maintenance.');

  return {
    total,
    active,
    idle,
    maintenance,
    unassigned,
    lowFuel: lowFuel.length,
    openIncidents: openIncidents.length,
    upcomingTrips: upcomingTrips.length,
    activeTrips,
    bookingsToday,
    utilizationPct: pct(active, total),
    recommendations,
  };
};

// ── System prompt builder ─────────────────────────────────────────────
const buildSystemPrompt = (summary, vehicles, openIncidents) => {
  const vehicleLines = vehicles.map(v =>
    `  • ${v.vehicleId} (${v.plateNumber}): ${v.type}, status=${v.status}, ` +
    `fuel=${v.fuelLevel ?? '?'}%, driver=${v.currentDriver?.name || 'UNASSIGNED'}`
  ).join('\n');

  const incidentLines = openIncidents.length
    ? openIncidents.map(i =>
        `  • Vehicle ${i.vehicleId?.vehicleId || 'unknown'} — ${i.type} [${i.priority}]: ${i.description}`
      ).join('\n')
    : '  None';

  return `You are MoveSmart Fleet Assistant, an AI advisor embedded in a transport management system \
for intercity bus agencies in Cameroon.

Your role is to help fleet managers make fast, data-driven decisions. You have access to \
real-time fleet data shown below. Always base your answers on this data. Be concise (2–4 sentences), \
specific (reference vehicle IDs, exact counts), and actionable.

If the user's question falls outside fleet operations, politely say so and redirect them.

═══════════════════════════════
LIVE FLEET DATA
═══════════════════════════════
Vehicles  : ${summary.total} total | ${summary.active} active | ${summary.idle} idle | ${summary.maintenance} in maintenance
Utilisation: ${summary.utilizationPct}%
Low fuel (≤25%) : ${summary.lowFuel} vehicle(s)
Unassigned      : ${summary.unassigned} vehicle(s) without a driver
Active trips now: ${summary.activeTrips}
Upcoming trips  : ${summary.upcomingTrips}
Bookings today  : ${summary.bookingsToday}
Open incidents  : ${summary.openIncidents}

VEHICLE DETAILS:
${vehicleLines || '  No vehicles found.'}

OPEN INCIDENTS:
${incidentLines}

TOP RECOMMENDATIONS:
${summary.recommendations.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}
═══════════════════════════════`;
};

// ── Rule-based fallback (used when OpenAI is unavailable) ─────────────
const ruleBasedAnswer = (message, summary) => {
  const q = String(message || '').toLowerCase();

  if (q.includes('maintenance') || q.includes('repair'))
    return summary.maintenance
      ? `There are ${summary.maintenance} vehicle(s) in maintenance. Do not schedule them until cleared, and prioritise any related open incidents.`
      : 'No vehicle is currently in maintenance. Keep monitoring fuel levels, incidents, and service intervals.';

  if (q.includes('driver') || q.includes('assign'))
    return summary.unassigned
      ? `${summary.unassigned} vehicle(s) have no assigned driver. Assign available drivers before creating trips.`
      : 'All vehicles currently have drivers assigned.';

  if (q.includes('fuel') || q.includes('refuel'))
    return summary.lowFuel
      ? `${summary.lowFuel} vehicle(s) are running low on fuel. Refuel before dispatching on long routes.`
      : 'No low-fuel vehicles detected.';

  if (q.includes('alert') || q.includes('incident'))
    return summary.openIncidents
      ? `There are ${summary.openIncidents} open incident(s). Resolve high and critical priority ones before dispatching affected vehicles.`
      : 'No open incidents. Fleet operations look clear.';

  if (q.includes('schedule') || q.includes('trip'))
    return `${summary.upcomingTrips} trip(s) scheduled, ${summary.activeTrips} currently active. Prefer idle, driver-assigned, fuel-ready vehicles for the next departures.`;

  return `Fleet snapshot: ${summary.active}/${summary.total} vehicles active (${summary.utilizationPct}%), ` +
    `${summary.idle} idle, ${summary.maintenance} in maintenance, ${summary.openIncidents} open incident(s). ` +
    `Recommended next step: ${summary.recommendations[0]}`;
};

// ── Handler ───────────────────────────────────────────────────────────
exports.fleetChat = async (req, res, next) => {
  try {
    const context = await getFleetContext(req.agencyFilter || {});
    const summary = buildSummary(context);
    const { vehicles, openIncidents } = context;
    const message = String(req.body?.message || '').trim();

    let reply = null;
    let source = 'openai';

    // ── Try OpenAI ────────────────────────────────────────────────────
    if (openai && message) {
      try {
        const completion = await openai.chat.completions.create({
          model: MODEL,
          messages: [
            { role: 'system', content: buildSystemPrompt(summary, vehicles, openIncidents) },
            { role: 'user',   content: message },
          ],
          max_tokens: 350,
          temperature: 0.3,
        });
        reply = completion.choices[0]?.message?.content?.trim() || null;
        logger.info(`Fleet AI (${MODEL}) responded to: "${message.slice(0, 60)}"`);
      } catch (aiErr) {
        logger.warn(`OpenAI error — falling back to rule-based: ${aiErr.message}`);
        source = 'fallback';
      }
    }

    // ── Fallback if OpenAI unavailable, errored, or no message ────────
    if (!reply) {
      reply = ruleBasedAnswer(message, summary);
      source = 'fallback';
    }

    return success(res, {
      reply,
      source,       // 'openai' | 'fallback' — useful for debugging / UI badges
      summary,
      suggestions: summary.recommendations,
    }, 'Fleet assistant response generated');
  } catch (err) {
    next(err);
  }
};
