export interface TokenMessageParams {
  patientName?: string;
  tokenNumber: string;
  providerName: string;
  roomName: string;
  etaWindow: string;
  aheadCount: number;
  leaveByTime?: string;
  travelMinutes?: number;
}

export const TEMPLATES = {
  // Booking confirmation
  bookingConfirmed: (p: TokenMessageParams) =>
    `✅ *Aapki baari pakki!*
🎫 Token *${p.tokenNumber}* · ${p.providerName} · ${p.roomName}
🕐 Anumaanit samay: *~${p.etaWindow}*
👥 Aapse pehle *${p.aheadCount} log* hain.${p.leaveByTime ? `\n🚗 Ghar se *${p.leaveByTime}* niklein (${p.travelMinutes || 12} min raasta + 10 min buffer).` : ''}`,

  // 2 patients ahead reminder
  twoAheadReminder: (p: TokenMessageParams) =>
    `🔔 *${p.patientName ? `${p.patientName} ji, ` : ''}nikalne ka time hai!*
Aapki baari ~15 min me aane wali hai.
Aapse pehle sirf *${p.aheadCount} log* hain.
🎫 Token: *${p.tokenNumber}* (${p.providerName} · ${p.roomName})
${p.leaveByTime ? `🚗 Turant niklein (target arrival: ${p.leaveByTime})` : '🚗 Kripya clinic ke liye niklein.'}`,

  // Called to cabin
  calledNow: (p: { tokenNumber: string; providerName: string; roomName: string }) =>
    `📢 *Aapki baari aa gayi!*
Kripya *${p.roomName}* mein aayein.
🎫 Token: *${p.tokenNumber}* · ${p.providerName}`,

  // Delay notice
  delayed: (p: { delayMinutes: number; newEta: string; reason?: string }) =>
    `⚠️ *Timing update*
${p.reason || 'Doctor saab ko thoda extra samay lag raha hai'}.
Aapki nayi anumaanit timing: *~${p.newEta}* (~${p.delayMinutes} min delay).
Asuvidha ke liye kshama chahte hain 🙏`,

  // Review request
  reviewAsk: (clinicName: string) =>
    `🙏 *${clinicName}* — aaj aane ke liye dhanyavaad!
Aapka experience kaisa raha?
Kripya *1 se 5* number likhkar bhejein (5 = bahut badiya, 1 = behtar ho sakta tha).`,

  // Review feedback reply (offered to EVERY rating)
  reviewReply: (googleReviewUrl: string) =>
    `Dhanyavaad! 🙏 Do chhoti cheezein:
1️⃣ Agar experience accha raha, toh Google par 30 second me review dein:
👉 ${googleReviewUrl}
2️⃣ Agar koi kami rahi, toh humein yahin direct batayein — hum turant theek karenge.`,

  // Grounded escalation fallback
  groundedEscalation: () =>
    `Yeh jaankari mere paas nahi hai — clinic se poochh kar 2 minute me bata deti hoon 🙏`,

  // Emergency ping to desk
  emergencyPing: (p: { tokenNumber: string; patientName: string; phone: string; reason: string }) =>
    `🚨 *EMERGENCY TOKEN ASSIGNED*
Token: *${p.tokenNumber}*
Patient: ${p.patientName} (${p.phone})
Reason: ${p.reason}`
};

