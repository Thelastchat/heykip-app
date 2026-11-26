// Your own categories (Create your own), Start fresh, and Kip's daily limit.
const th: Record<string, string> = {
  // ---- Your own category ----
  '{n} slips to check': 'มีสลิปให้เช็ก {n} ใบ',
  'Kip remembered: {shop} goes to {name}': 'Kip จำไว้แล้ว: {shop} ไปที่ {name}',
  'Create your own': 'สร้างหมวดของคุณเอง',
  'Kip thinks it’s a want: fun money, like albums and concerts. Change it if not.': 'Kip ว่าเป็นของที่อยากได้ ใช้เงินเที่ยวเล่น เช่น อัลบั้มกับคอนเสิร์ต ถ้าไม่ใช่เปลี่ยนได้เลย',
  'Your own category': 'หมวดของคุณเอง',
  Icon: 'ไอคอน',
  'Is it a need or a want?': 'เป็นของจำเป็น หรือของที่อยากได้?',
  Need: 'จำเป็น',
  Want: 'อยากได้',
  'Take it from': 'เอามาจาก',
  'Create {name}': 'สร้าง {name}',
  '{name} is ready': '{name} พร้อมแล้ว',
  'I found {n} things this month that look like {name}. Move them there?': 'เดือนนี้ Kip เจอ {n} รายการที่น่าจะเป็น {name} ย้ายไปไว้ตรงนั้นเลยมั้ย?',
  '{name} this month': '{name} เดือนนี้',
  'Move them': 'ย้ายเลย',
  ' of {amount}': ' จาก {amount}',

  // ---- Start fresh (app/privacy.tsx) ----
  'HeyKip Plus · your free trial still ends {date}': 'HeyKip Plus · ทดลองใช้ฟรียังหมดวันที่ {date} เหมือนเดิม',
  'HeyKip Plus · stays on': 'HeyKip Plus · ยังใช้ได้ต่อ',
  'Your plan (Free)': 'แพ็กเกจของคุณ (ฟรี)',
  'Start fresh': 'เริ่มใหม่ทั้งหมด',
  'Clear everything and make a new plan · keeps your login and Plus': 'ล้างทุกอย่างแล้ววางแผนใหม่ · บัญชีกับ Plus ยังอยู่',
  'Everything, for good · cancel Plus in the App Store first': 'ลบทุกอย่างถาวร · ยกเลิก Plus ใน App Store ก่อนนะ',
  'Start fresh?': 'เริ่มใหม่ทั้งหมด?',
  'Everything you made in HeyKip is cleared, then you set up a new plan. This can’t be undone.': 'ทุกอย่างที่ทำไว้ใน HeyKip จะถูกล้าง แล้วค่อยวางแผนใหม่ ย้อนกลับไม่ได้นะ',
  Cleared: 'ที่จะถูกล้าง',
  'Spending, slips and money in': 'รายจ่าย สลิป และเงินเข้า',
  'Goals, photos and your promise': 'เป้าหมาย รูป และคำสัญญา',
  'Bills and your monthly plan': 'บิลกับแผนรายเดือน',
  'Safety net and what Kip learned': 'เงินสำรองกับสิ่งที่ Kip จำไว้',
  Kept: 'ที่ยังอยู่',
  'Your login ({email})': 'บัญชีที่ใช้เข้า ({email})',
  'Your privacy choices': 'การตั้งค่าความเป็นส่วนตัว',
  'Clearing…': 'กำลังล้าง…',
  'Hold to start fresh': 'กดค้างไว้เพื่อเริ่มใหม่',
  'Keep everything': 'เก็บไว้เหมือนเดิม',
  'Your goals, spending, photos and promise are deleted for good. Deleting doesn’t cancel Plus: cancel it first in Settings → your name → Subscriptions, or Apple keeps charging. Want to keep using HeyKip? Start fresh instead.':
    'เป้าหมาย รายจ่าย รูป และคำสัญญาจะถูกลบถาวร การลบบัญชีไม่ได้ยกเลิก Plus นะ ต้องยกเลิกก่อนที่ ตั้งค่า → ชื่อของคุณ → การสมัครรับ ไม่งั้น Apple จะยังตัดเงินอยู่ ถ้ายังอยากใช้ HeyKip ต่อ ลอง "เริ่มใหม่ทั้งหมด" แทนได้',

  // ---- Kip's daily limit (app/talk.tsx) ----
  'Kip · back at midnight': 'Kip · กลับมาตอนเที่ยงคืน',
  'Kip · {n} left today': 'Kip · วันนี้เหลือ {n} ข้อความ',
  'Kip is back at midnight': 'Kip กลับมาตอนเที่ยงคืนนะ',
  'That’s all 50 of my messages for today, so I’m resting. I’m back at midnight.': 'วันนี้ใช้ครบ 50 ข้อความแล้ว Kip ขอพักก่อนนะ เที่ยงคืนกลับมา',
  'Log it yourself': 'จดเองก็ได้',
  'Takes a few seconds. Today’s money still updates.': 'แป๊บเดียวเสร็จ เงินของวันนี้ก็อัปเดตเหมือนเดิม',
};
export default th;
