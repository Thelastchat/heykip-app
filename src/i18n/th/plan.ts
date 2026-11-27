// One plan, made real (approved 27 Nov): the bank's scheduled transfer, the payday check, the weekly sweep, living at home.
export default {
  // ---- Saving: bank card ----
  'Your bank moves {amount} on the {day}': 'ธนาคารโอน {amount} ให้ทุกวันที่ {day}',
  'Your bank moves {amount} every payday': 'ธนาคารโอน {amount} ให้ทุกวันเงินเดือนออก',
  'Your plan now saves {amount} — update it in your bank, then tap here': 'ตอนนี้แผนเก็บ {amount} แล้ว ไปแก้ยอดในแอปธนาคาร แล้วกดตรงนี้',
  '{bank} · Kip checks it on payday': '{bank} · Kip เช็กให้ทุกวันเงินเดือนออก',
  'Your bank': 'ธนาคารของคุณ',
  'Make your saving happen by itself': 'ให้เงินเก็บย้ายเองทุกเดือน',
  'Set your bank to move {amount} every payday, into a separate pocket': 'ตั้งให้ธนาคารโอน {amount} เข้าบัญชีแยกทุกวันเงินเดือนออก',
  'Set. On payday Kip checks it went through': 'ตั้งแล้ว วันเงินเดือนออก Kip จะเช็กว่าโอนเข้าแล้วนะ',
  // ---- Bank sheet ----
  'on the {day}, every month': 'ทุกวันที่ {day} ของเดือน',
  'every payday': 'ทุกวันเงินเดือนออก',
  'In MAKE, make a Cloud Pocket just for saving, like “Japan”.': 'ในแอป MAKE สร้าง Cloud Pocket ไว้เก็บเงินอย่างเดียว เช่น “ญี่ปุ่น”',
  'Use Schedule Transfer: {amount} into that pocket, {when}.': 'ใช้ Schedule Transfer โอน {amount} เข้า Pocket นั้น {when}',
  'Come back and tap Done. On payday Kip checks it went through.': 'กลับมากด “ตั้งแล้ว” วันเงินเดือนออก Kip จะเช็กให้ว่าโอนเข้าแล้ว',
  'Open a separate savings account or pocket, just for saving, so it isn’t mixed with spending money.': 'เปิดบัญชีออมหรือ Pocket แยกไว้เก็บอย่างเดียว ไม่ให้ปนกับเงินใช้',
  'Find the scheduled (repeating) transfer in your bank app and set {amount} into it, {when}.': 'หาเมนูโอนเงินล่วงหน้า (โอนซ้ำ) ในแอปธนาคาร แล้วตั้งโอน {amount} เข้าบัญชีนั้น {when}',
  'Make it happen by itself': 'ให้ย้ายเองทุกเดือน',
  'Set your bank to move your saving every payday. HeyKip never touches your bank — you set it once, in your bank app.':
    'ตั้งให้ธนาคารโอนเงินเก็บเองทุกวันเงินเดือนออก HeyKip ไม่แตะบัญชีธนาคารของคุณ คุณตั้งเองครั้งเดียวในแอปธนาคาร',
  'Which bank app?': 'ใช้แอปธนาคารไหน',
  'Done, it’s set': 'ตั้งแล้ว',
  'In K PLUS: Transfer → your savings account → “ตั้งโอนล่วงหน้า” (schedule) → “รายเดือน” (monthly). {amount}, {when}.':
    'ใน K PLUS: โอนเงิน → เลือกบัญชีเก็บเงินของคุณ → “ตั้งโอนล่วงหน้า” → “รายเดือน” โอน {amount} {when}',
  'In SCB EASY: Transfer → your savings account → “ตั้งรายการล่วงหน้า” (schedule) → “ทุกเดือน” (every month). {amount}, {when}.':
    'ใน SCB EASY: โอนเงิน → เลือกบัญชีเก็บเงินของคุณ → “ตั้งรายการล่วงหน้า” → “ทุกเดือน” โอน {amount} {when}',
  'In Krungthai NEXT: Transfer → your savings account → turn on “ตั้งรายการล่วงหน้า” (schedule) → “ทุกเดือน” (every month). {amount}, {when}.':
    'ใน Krungthai NEXT: โอนเงิน → เลือกบัญชีเก็บเงินของคุณ → เปิด “ตั้งรายการล่วงหน้า” → “ทุกเดือน” โอน {amount} {when}',
  'In Bangkok Bank: Transfer → your savings account → “ตั้งรายการล่วงหน้า” (schedule) → “รายเดือน” (monthly). {amount}, {when}.':
    'ในแอปธนาคารกรุงเทพ: โอนเงิน → เลือกบัญชีเก็บเงินของคุณ → “ตั้งรายการล่วงหน้า” → “รายเดือน” โอน {amount} {when}',
  'In krungsri app: Transfer → your savings account → “ตั้งเวลา” (schedule) → “ทุกเดือน” (every month). {amount}, {when}.':
    'ใน krungsri app: โอนเงิน → เลือกบัญชีเก็บเงินของคุณ → “ตั้งเวลา” → “ทุกเดือน” โอน {amount} {when}',
  'Bangkok Bank repeats it 12 times at most. Kip reminds you to set it again in a year.': 'ธนาคารกรุงเทพตั้งซ้ำได้สูงสุด 12 ครั้ง ครบปี Kip จะเตือนให้ตั้งใหม่',
  'Menu names are from the bank’s own steps and can change when its app updates.': 'ชื่อเมนูมาจากขั้นตอนของธนาคาร อาจเปลี่ยนได้เมื่อแอปอัปเดต',
  'Bangkok Bank stops after 12 transfers — set it again, then tap here': 'ธนาคารกรุงเทพโอนครบ 12 ครั้งแล้วจะหยุด ตั้งใหม่แล้วกดตรงนี้',
  // ---- Home: payday ----
  'Payday · your bank moves {amount} today': 'เงินเดือนออก · วันนี้ธนาคารโอน {amount} ให้',
  'Payday · move {amount} to savings': 'เงินเดือนออก · ย้าย {amount} ไปเก็บ',
  'It moved': 'เข้าแล้ว',
  'I moved it': 'ย้ายแล้ว',
  'Make it automatic': 'ตั้งให้ย้ายเอง',
  'Did it reach your savings account?': 'เงินเข้าบัญชีเก็บแล้วหรือยัง',
  'Did it reach your savings account? Bangkok Bank stops after 12 — set it again soon.': 'เงินเข้าบัญชีเก็บแล้วหรือยัง ธนาคารกรุงเทพโอนครบ 12 ครั้งแล้วจะหยุด อย่าลืมตั้งใหม่นะ',
  'Move it to a separate account now, before it gets spent.': 'ย้ายไปบัญชีแยกตอนนี้เลย ก่อนจะเผลอใช้',
  // ---- Home: weekly sweep ----
  '{amount} spare so far this month': 'เดือนนี้เหลือเกินแผนมาแล้ว {amount}',
  'Send to {goal}': 'ส่งเข้า {goal}',
  'Send to safety net': 'ส่งเข้าเงินสำรอง',
  'You’ve spent **{amount}** less than planned. Send it now, before it gets spent? Every day left still gets **{daily}**.':
    'คุณใช้น้อยกว่าแผน **{amount}** ส่งไปเก็บตอนนี้เลยไหม ก่อนจะเผลอใช้ วันที่เหลือยังใช้ได้วันละ **{daily}** เท่าเดิม',
  '{goal} arrives **{will}** instead of {was}.': '{goal} จะถึง **{will}** แทน {was}',
  'Kip: spare this week': 'Kip: เงินเหลือสัปดาห์นี้',
  '{amount} sent to {goal}': 'ส่ง {amount} เข้า {goal} แล้ว',
  // ---- Setup ----
  '{perDay} a day · lowest ฿100 living at home': 'วันละ {perDay} · อยู่บ้านต่ำสุดวันละ ฿100',
};
