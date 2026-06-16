/**
 * emailService.js
 * Brevo transactional email via HTTP API (port 443 — no SMTP firewall issues).
 * Falls back to console logging when API key is not configured.
 * FR-A04, FR-A05, FR-PA24, FR-FM22
 */
const axios = require('axios');
const logger = require('../utils/logger');

const BREVO_API = 'https://api.brevo.com/v3/smtp/email';

async function sendMail({ to, subject, html, text }) {
  const apiKey = process.env.BREVO_API_KEY;
  const fromRaw = process.env.EMAIL_FROM || 'MoveSmart <noreply@movesmart.cm>';

  // Parse "Name <email>" or plain email
  const match = fromRaw.match(/^(.*?)\s*<(.+?)>$/);
  const fromEmail = match ? match[2].trim() : fromRaw.trim();
  const fromName  = match ? match[1].trim() : 'MoveSmart';

  if (!apiKey) {
    logger.info(`[EMAIL STUB] To: ${to} | Subject: ${subject}`);
    logger.debug(text || html);
    return { messageId: 'stub' };
  }

  const payload = {
    sender:   { name: fromName, email: fromEmail },
    to:       [{ email: to }],
    subject,
    htmlContent: html,
    ...(text ? { textContent: text } : {}),
  };

  try {
    const res = await axios.post(BREVO_API, payload, {
      headers: {
        'api-key':      apiKey,
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      timeout: 10000,
    });
    logger.info(`Email sent to ${to} — messageId: ${res.data.messageId}`);
    return res.data;
  } catch (err) {
    const detail = err.response?.data || err.message;
    throw new Error(`Brevo API error: ${JSON.stringify(detail)}`);
  }
}

// ── Account lockout alert (FR-A04) ─────────────────────────────────────────
exports.sendLockoutAlert = async (user, ipAddress) => {
  const unlockTime = new Date(Date.now() + 30 * 60 * 1000).toLocaleTimeString();
  await sendMail({
    to: user.email,
    subject: 'MoveSmart — Account Temporarily Locked',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
        <h2 style="color: #0F4C81; margin-bottom: 8px;">⚠️ Account Locked</h2>
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>Your MoveSmart account has been <strong>temporarily locked</strong> due to 5 consecutive failed login attempts.</p>
        <table style="background:#fff; border-radius:8px; padding:16px; width:100%; margin:16px 0;">
          <tr><td style="color:#666; padding:4px 0;">Account</td><td style="font-weight:600;">${user.email}</td></tr>
          <tr><td style="color:#666; padding:4px 0;">Locked at</td><td style="font-weight:600;">${new Date().toLocaleString()}</td></tr>
          <tr><td style="color:#666; padding:4px 0;">Unlock at</td><td style="font-weight:600;">${unlockTime} (30 minutes)</td></tr>
          <tr><td style="color:#666; padding:4px 0;">IP address</td><td style="font-weight:600;">${ipAddress || 'unknown'}</td></tr>
        </table>
        <p>If this was you, please wait 30 minutes and try again. If this was <strong>not you</strong>, please reset your password immediately.</p>
        <a href="${process.env.CLIENT_URL}/forgot-password" style="display:inline-block; background:#0F4C81; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Reset My Password</a>
        <p style="color:#999; font-size:12px; margin-top:24px;">This is an automated security alert from MoveSmart.</p>
      </div>
    `,
    text: `Your MoveSmart account (${user.email}) has been locked after 5 failed login attempts. It will unlock in 30 minutes. If this was not you, reset your password at ${process.env.CLIENT_URL}/forgot-password`,
  });
};

// ── Password reset email (FR-A05) ──────────────────────────────────────────
exports.sendPasswordReset = async (user, resetToken) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
  await sendMail({
    to: user.email,
    subject: 'MoveSmart — Reset Your Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
        <h2 style="color: #0F4C81;">Reset Your Password</h2>
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>We received a request to reset your MoveSmart password. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetUrl}" style="display:inline-block; background:#0F4C81; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; margin:16px 0;">Reset Password</a>
        <p style="word-break:break-all; color:#888; font-size:12px;">Or copy this link: ${resetUrl}</p>
        <p>If you did not request a password reset, you can safely ignore this email.</p>
        <p style="color:#999; font-size:12px; margin-top:24px;">This link expires at ${new Date(Date.now() + 3600000).toLocaleString()}.</p>
      </div>
    `,
    text: `Reset your MoveSmart password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
  });
};

// ── Booking confirmation email (FR-PA24) ───────────────────────────────────
exports.sendBookingConfirmation = async (booking, passenger, trip, route) => {
  const depTime = trip.scheduledStart
    ? new Date(trip.scheduledStart).toLocaleString('en-CM', { dateStyle: 'medium', timeStyle: 'short' })
    : 'TBD';
  await sendMail({
    to: passenger.email,
    subject: `MoveSmart Booking Confirmed — ${booking.bookingRef}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
        <h2 style="color: #0F4C81;">✅ Booking Confirmed!</h2>
        <p>Hi <strong>${passenger.name}</strong>, your trip is booked.</p>
        <table style="background:#fff; border-radius:8px; padding:16px; width:100%; margin:16px 0; border-collapse:collapse;">
          <tr style="background:#0F4C81; color:#fff;"><td colspan="2" style="padding:10px 16px; border-radius:8px 8px 0 0; font-weight:700;">Booking Reference: ${booking.bookingRef}</td></tr>
          <tr><td style="color:#666; padding:8px 16px; border-bottom:1px solid #f0f0f0;">Route</td><td style="font-weight:600; padding:8px 16px; border-bottom:1px solid #f0f0f0;">${route.origin} → ${route.destination}</td></tr>
          <tr><td style="color:#666; padding:8px 16px; border-bottom:1px solid #f0f0f0;">Seat</td><td style="font-weight:600; padding:8px 16px; border-bottom:1px solid #f0f0f0;">${booking.seatLabel}</td></tr>
          <tr><td style="color:#666; padding:8px 16px; border-bottom:1px solid #f0f0f0;">Departure</td><td style="font-weight:600; padding:8px 16px; border-bottom:1px solid #f0f0f0;">${depTime}</td></tr>
          <tr><td style="color:#666; padding:8px 16px;">Total Fare</td><td style="font-weight:700; color:#0F4C81; padding:8px 16px;">${(booking.fareBreakdown?.total || 0).toLocaleString()} FCFA</td></tr>
        </table>
        <a href="${process.env.CLIENT_URL}/passenger/bookings" style="display:inline-block; background:#0F4C81; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">View My Bookings</a>
        <p style="color:#999; font-size:12px; margin-top:24px;">To cancel, visit your bookings page at least 2 hours before departure.</p>
      </div>
    `,
    text: `Booking Confirmed!\nRef: ${booking.bookingRef}\nRoute: ${route.origin} → ${route.destination}\nSeat: ${booking.seatLabel}\nDeparture: ${depTime}\nFare: ${booking.fareBreakdown?.total || 0} FCFA`,
  });
};

// ── Departure reminder (30 min and 15 min) ─────────────────────────────────
exports.sendDepartureReminder = async (passenger, trip, route, booking, minutesLeft = 30) => {
  const depTime = trip.scheduledStart
    ? new Date(trip.scheduledStart).toLocaleString('en-CM', { dateStyle: 'medium', timeStyle: 'short' })
    : 'TBD';
  const urgencyColor = minutesLeft <= 15 ? '#c0392b' : '#e65c00';
  const emoji        = minutesLeft <= 15 ? '⚠️' : '🕐';
  await sendMail({
    to: passenger.email,
    subject: `MoveSmart — Departure in ${minutesLeft} minutes: ${route.origin} → ${route.destination}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
        <h2 style="color: #0F4C81;">${emoji} Your trip departs in ${minutesLeft} minutes!</h2>
        <p>Hi <strong>${passenger.name}</strong>, this is your ${minutesLeft}-minute departure reminder.</p>
        <table style="background:#fff; border-radius:8px; padding:16px; width:100%; margin:16px 0; border-collapse:collapse;">
          <tr style="background:#0F4C81; color:#fff;"><td colspan="2" style="padding:10px 16px; border-radius:8px 8px 0 0; font-weight:700;">Booking Ref: ${booking.bookingRef}</td></tr>
          <tr><td style="color:#666; padding:8px 16px; border-bottom:1px solid #f0f0f0;">Route</td><td style="font-weight:600; padding:8px 16px; border-bottom:1px solid #f0f0f0;">${route.origin} → ${route.destination}</td></tr>
          <tr><td style="color:#666; padding:8px 16px; border-bottom:1px solid #f0f0f0;">Seat</td><td style="font-weight:600; padding:8px 16px; border-bottom:1px solid #f0f0f0;">${booking.seatLabel}</td></tr>
          <tr><td style="color:#666; padding:8px 16px;">Departure</td><td style="font-weight:700; color:${urgencyColor}; padding:8px 16px;">${depTime}</td></tr>
        </table>
        <p style="color:#555;">${minutesLeft <= 15 ? 'Please head to the boarding point <strong>immediately</strong>.' : 'Please make sure you are heading to the boarding point.'} Have a safe journey! 🚌</p>
        <a href="${process.env.CLIENT_URL}/passenger/bookings" style="display:inline-block; background:#0F4C81; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">View Booking</a>
        <p style="color:#999; font-size:12px; margin-top:24px;">MoveSmart — Smart Travel, Every Journey.</p>
      </div>
    `,
    text: `Reminder (${minutesLeft} min): Your trip from ${route.origin} to ${route.destination} (Seat ${booking.seatLabel}) departs at ${depTime}. Have a safe journey!`,
  });
};

// ── Driver assignment notification (FR-FM22) ───────────────────────────────
exports.sendDriverAssignment = async (driver, trip, route) => {
  const depTime = trip.scheduledStart
    ? new Date(trip.scheduledStart).toLocaleString('en-CM', { dateStyle: 'medium', timeStyle: 'short' })
    : 'TBD';
  await sendMail({
    to: driver.email,
    subject: `MoveSmart — Trip Assignment: ${route.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
        <h2 style="color: #0F4C81;">🚌 New Trip Assignment</h2>
        <p>Hi <strong>${driver.name}</strong>, you have been assigned to a new trip.</p>
        <table style="background:#fff; border-radius:8px; padding:16px; width:100%; margin:16px 0;">
          <tr><td style="color:#666; padding:4px 0;">Route</td><td style="font-weight:600;">${route.origin} → ${route.destination}</td></tr>
          <tr><td style="color:#666; padding:4px 0;">Departure</td><td style="font-weight:600;">${depTime}</td></tr>
        </table>
        <a href="${process.env.CLIENT_URL}/driver/dashboard" style="display:inline-block; background:#0F4C81; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Open Driver Dashboard</a>
      </div>
    `,
    text: `New trip assigned: ${route.origin} → ${route.destination} at ${depTime}. Open your dashboard: ${process.env.CLIENT_URL}/driver/dashboard`,
  });
};
