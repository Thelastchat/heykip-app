// Thai for going over and History (ประวัติรายการ) — see src/i18n/GUIDE.md.
const th: Record<string, string> = {
  // Home
  'This month’s spending money is used up — {amount} over. It comes out of your saving, so rent and bills are safe. Must-haves only until payday.':
    'เงินใช้จ่ายเดือนนี้หมดแล้ว — เกินมา {amount} ส่วนนี้ดึงจากเงินออมไปก่อน ค่าห้องกับบิลยังปลอดภัย ช่วงนี้ใช้แค่ของจำเป็นจนถึงวันเงินเดือนออกนะ',
  'A big day — that’s okay. I spread the {amount} over the next {n} days, so {goal} stays on {date}.':
    'วันนี้ใช้เยอะหน่อย ไม่เป็นไร — Kip เกลี่ย {amount} ไปอีก {n} วันข้างหน้าแล้ว {goal} ยังได้ {date} เหมือนเดิม',
  'A big day — that’s okay. I spread the {amount} over the next {n} days, so {goal} stays on track.':
    'วันนี้ใช้เยอะหน่อย ไม่เป็นไร — Kip เกลี่ย {amount} ไปอีก {n} วันข้างหน้าแล้ว {goal} ยังทันตามแผน',
  '{amount} over today — see what it changes': 'วันนี้เกินมา {amount} — ดูว่าแผนเปลี่ยนยังไง',
  'Over today': 'เกินวันนี้',
  '{amount} over this month — see what it changes': 'เดือนนี้เกินมา {amount} — ดูว่าแผนเปลี่ยนยังไง',
  '{amount} left this month — see history': 'เหลือทั้งเดือน {amount} — ดูประวัติรายการ',
  'Over this month': 'เกินทั้งเดือน',

  // What going over changes
  '{amount} over this month': 'เดือนนี้เกินมา {amount}',
  '{amount} over today': 'วันนี้เกินมา {amount}',
  'Spending money for this month is used up · {n} days to payday': 'เงินใช้จ่ายเดือนนี้หมดแล้ว · อีก {n} วันเงินเดือนออก',
  'Spending money for this month is used up': 'เงินใช้จ่ายเดือนนี้หมดแล้ว',
  'You spent {spent} · today’s money was {daily}': 'วันนี้ใช้ไป {spent} · งบของวันนี้คือ {daily}',
  'This comes out of **this month’s {goal} saving**, so rent and bills are safe. Until payday, try to spend only on must-haves.':
    'ส่วนนี้ดึงจาก**เงินออม {goal} ของเดือนนี้** ค่าห้องกับบิลยังปลอดภัย ระหว่างนี้ลองใช้แค่ของจำเป็นจนเงินเดือนออกนะ',
  'This comes out of **your safety net**, so rent and bills are safe. Until payday, try to spend only on must-haves.':
    'ส่วนนี้ดึงจาก**เงินสำรอง** ค่าห้องกับบิลยังปลอดภัย ระหว่างนี้ลองใช้แค่ของจำเป็นจนเงินเดือนออกนะ',
  'No stress — I took it from the days ahead, **about {amount} less each day**. Your month and your goal don’t move.':
    'ไม่ต้องเครียด — Kip เกลี่ยไปที่วันข้างหน้าแล้ว **วันละน้อยลงราว {amount}** ทั้งเดือนกับเป้าหมายยังเหมือนเดิม',
  'No stress — payday is tomorrow, and **your month still has room** for it.': 'ไม่ต้องเครียด — พรุ่งนี้เงินเดือนออกแล้ว และ**เดือนนี้ยังพอรับไหว**',
  '{goal} saving this month': 'เงินออม {goal} เดือนนี้',
  '{amount} went to spending': '{amount} ย้ายไปเป็นค่าใช้จ่าย',
  '{goal} arrives': '{goal} ถึงเป้า',
  'Unless you save {amount} more later': 'ถ้าเก็บเพิ่ม {amount} ทีหลัง ก็จะได้ตามเดิม',
  'Safety net this month': 'เงินสำรองเดือนนี้',
  'Each day until payday': 'ใช้ได้ต่อวันจนเงินเดือนออก',
  'Next {n} days': 'อีก {n} วันข้างหน้า',
  'Already counted': 'หักให้แล้ว',
  'Still saving {amount} this month': 'เดือนนี้ยังออมได้ {amount} เท่าเดิม',
  'Got it': 'โอเค',
  'Change my plan instead': 'ปรับแผนเองดีกว่า',
  'See what I spent today': 'ดูว่าวันนี้ใช้อะไรไปบ้าง',

  // History
  History: 'ประวัติรายการ',
  'The month before': 'เดือนก่อน',
  'The month after': 'เดือนถัดไป',
  'Pay cycle · {from} – {to}': 'รอบเงินเดือน {from} – {to}',
  'spent of {budget} · {over} over': 'ใช้ไปจาก {budget} · เกินมา {over}',
  'spent of {budget} · {left} left': 'ใช้ไปจาก {budget} · เหลือ {left}',
  spent: 'ใช้ไป',
  'money in': 'เงินเข้า',
  'Rent & bills {amount} are planned on their own, so they’re not in this number': 'ค่าห้องและบิล {amount} วางแผนแยกไว้แล้ว เลยไม่นับรวมในยอดนี้',
  All: 'ทั้งหมด',
  'Money in': 'เงินเข้า',
  'Nothing yet this month. Add spending with + or a slip.': 'เดือนนี้ยังไม่มีรายการ จดได้ที่ปุ่ม + หรือส่งสลิปมาเลย',
  'Nothing saved this month.': 'เดือนนี้ไม่มีรายการ',
  'Tap an entry to change its category · swipe left to delete it.': 'แตะรายการเพื่อเปลี่ยนหมวด · ปัดซ้ายเพื่อลบ',
  'Change its category': 'เปลี่ยนหมวด',
  'Couldn’t change it: {msg}': 'เปลี่ยนไม่ได้: {msg}',
};
export default th;
