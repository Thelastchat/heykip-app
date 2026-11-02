// Thai for money in, "Tell Kip…" and covering going over — see src/i18n/GUIDE.md.
const th: Record<string, string> = {
  // + Got paid hint
  '**{amt}** extra — next, give it a job: {goal}, safety net or spending': 'เกินมา **{amt}** — เดี๋ยวเลือกได้เลยว่าจะเอาไป {goal} เงินสำรอง หรือไว้ใช้',

  // Money-in sheet
  'Nice — extra money': 'เย้ ได้เงินพิเศษ!',
  'This month’s pay is in ✓': 'เงินเดือนเดือนนี้เข้าแล้ว ✓',
  'Part of this month’s pay': 'เงินเดือนเข้ามาบางส่วน',
  'Your plan runs on this — nothing to change': 'แผนใช้ยอดนี้อยู่แล้ว ไม่ต้องเปลี่ยนอะไร',
  '{amount} still to come — the saving moves when it’s all in': 'ยังขาดอีก {amount} — เข้าครบเมื่อไหร่ค่อยย้ายเงินออม',
  'Saving comes first, so it can’t get spent. **Payday auto-move** did it for you:': 'ออมก่อนใช้ จะได้ไม่เผลอใช้หมด **ย้ายเงินอัตโนมัติวันเงินเดือนออก** จัดให้แล้ว:',
  'Saving comes first, so it can’t get spent. Move it now?': 'ออมก่อนใช้ จะได้ไม่เผลอใช้หมด ย้ายเลยไหม?',
  'This month’s saving already moved ✓': 'เงินออมเดือนนี้ย้ายไปแล้ว ✓',
  'This month’s saving': 'เงินออมเดือนนี้',
  'Building your {amount} cushion': 'ค่อยๆ เก็บให้ถึง {amount}',
  'Move {amount} now': 'ย้าย {amount} เลย',
  'Moving…': 'กำลังย้าย…',
  'Couldn’t move the saving: {msg}': 'ย้ายเงินออมไม่ได้: {msg}',
  'More than your usual pay · not in your plan': 'มากกว่าเงินเดือนปกติ · ไม่ได้อยู่ในแผน',
  '{kind} · not in your plan': '{kind} · ไม่ได้อยู่ในแผน',
  'Give it a job': 'ให้เงินก้อนนี้ไปทำอะไรดี',
  'Put it in {goal}': 'ใส่ใน {goal}',
  '{from} → {to} of {target}': '{from} → {to} จาก {target}',
  '{from} → {to}': '{from} → {to}',
  'Keep it for spending': 'เก็บไว้ใช้',
  'Each day until payday {from} → {to}': 'ใช้ได้ต่อวันจนเงินเดือนออก {from} → {to}',
  'Put {amount} in the safety net': 'ใส่ {amount} ในเงินสำรอง',
  'Keep {amount} for spending': 'เก็บ {amount} ไว้ใช้',
  '{amount} added to this month ✓': 'เพิ่ม {amount} ในเดือนนี้แล้ว ✓',
  'Done ✓ — your extra money has a job': 'เรียบร้อย ✓ — เงินพิเศษมีที่ไปแล้ว',
  'Spending this month': 'เงินใช้จ่ายเดือนนี้',
  'More for each day until payday': 'ใช้ได้ต่อวันมากขึ้นจนเงินเดือนออก',
  '{category} · this month': '{category} · เดือนนี้',
  'Hmm, that didn’t add up to {amount}. Try saying it another way?': 'อืม รวมแล้วไม่ครบ {amount} ลองพูดอีกแบบได้ไหม?',
  'my goal': 'เป้าหมาย',
  'Or tell Kip… “half to {goal}”': 'หรือบอก Kip… “ครึ่งนึงเข้า {goal}”',

  // Tell Kip box
  'Listening…': 'กำลังฟัง…',
  'Send to Kip': 'ส่งให้ Kip',
  'Stop listening': 'หยุดฟัง',
  'Do it': 'จัดเลย',
  'Back to the choices': 'กลับไปที่ตัวเลือก',
  'Telling Kip what to do is a Plus feature.': 'สั่ง Kip ด้วยคำพูดเป็นฟีเจอร์ของ Plus นะ',
  'Kip is busy right now — try again in a moment, or pick one of the choices.': 'ตอนนี้ Kip ยุ่งอยู่ ลองใหม่อีกแป๊บ หรือเลือกจากตัวเลือกก็ได้',
  'Or tell Kip in your own words — **Plus**': 'หรือบอก Kip ด้วยคำพูดตัวเอง — **Plus**',
  'Kip is thinking…': 'Kip กำลังคิด…',

  // Going over
  'Or tell Kip… “take it from {goal}”': 'หรือบอก Kip… “เอาจาก {goal}”',
  'Or tell Kip… “take it from the safety net”': 'หรือบอก Kip… “เอาจากเงินสำรอง”',
  '{amount} goes to today': '{amount} มาใช้กับวันนี้',
  'About the same': 'ประมาณเดิม',
  'Okay — take it from {goal}': 'โอเค — เอาจาก {goal}',
  'Okay — take it from the safety net': 'โอเค — เอาจากเงินสำรอง',
  'Covered ✓ — your days stay the same': 'จัดการแล้ว ✓ — วันอื่นใช้ได้เท่าเดิม',
  'Your plan isn’t loaded yet — try again in a moment.': 'แผนยังโหลดไม่เสร็จ ลองใหม่อีกแป๊บนะ',
  'Covered a month that ran over': 'เอาไปช่วยเดือนที่ใช้เกิน',

  // Your month
  'Tell Kip… “move ฿500 to Food”': 'บอก Kip… “ย้าย ฿500 ไปค่ากิน”',
  'Change your month': 'ปรับแผนเดือนนี้',
  'Hmm, that doesn’t fit this month’s plan. Try saying it another way?': 'อืม แบบนี้ไม่เข้ากับแผนเดือนนี้ ลองพูดอีกแบบได้ไหม?',
  'New bill · every month': 'บิลใหม่ · ทุกเดือน',
  'Bill removed': 'ลบบิลแล้ว',
  'Kip’s guess shrinks as you add real ones': 'ยอดที่ Kip กะไว้จะลดลงเมื่อเพิ่มบิลจริง',
  '{goal} saving': 'เงินออม {goal}',
  'Each day': 'ใช้ได้ต่อวัน',
  'No change': 'ไม่เปลี่ยน',

  // Look (Light / Dark)
  Look: 'โหมด',
  Light: 'สว่าง',
  Dark: 'มืด',
  Phone: 'ตามเครื่อง',
  'Same as my phone': 'ตามโหมดของโทรศัพท์',

  // Home + Goals
  'incl. +{amount} extra': 'รวมเงินพิเศษ +{amount}',
  'saved · {amount} a month': 'เก็บแล้ว · เดือนละ {amount}',
};
export default th;
