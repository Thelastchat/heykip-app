// Thai for privacy, consent and saved entries — see src/i18n/GUIDE.md.
const th: Record<string, string> = {
  // Before Kip reads for you
  'Before Kip reads for you': 'ก่อน Kip จะอ่านให้นะ',
  'To read slips and chats, Kip sends them to **Anthropic’s Claude AI**, a company outside Thailand.': 'เพื่ออ่านสลิปและแชต Kip จะส่งไปให้ **Claude AI ของ Anthropic** ซึ่งเป็นบริษัทนอกประเทศไทย',
  'We save **only the numbers** — amount, who, when. Slip pictures stay in your Photos.': 'เราเก็บ**แค่ตัวเลข** — ยอดเงิน ให้ใคร เมื่อไหร่ ส่วนรูปสลิปยังอยู่ในแอปรูปภาพในเครื่อง',
  'Anthropic deletes it within 30 days and **never trains AI on it**. Nothing is sold, ever.': 'Anthropic ลบทิ้งภายใน 30 วัน และ**ไม่เอาไปฝึก AI** เราไม่ขายข้อมูลเด็ดขาด',
  'Turn this off or delete everything any time in **Profile → Privacy & data**.': 'ปิดหรือลบทุกอย่างได้ตลอดที่ **โปรไฟล์ → ความเป็นส่วนตัวและข้อมูล**',
  Allow: 'อนุญาต',
  'Not now — you can still type it in yourself': 'ไว้ก่อน — ยังพิมพ์จดเองได้นะ',
  'Privacy policy': 'นโยบายความเป็นส่วนตัว',
  'Kip’s reading is turned off — turn it on in Profile → Privacy & data.': 'ปิดการอ่านของ Kip ไว้อยู่ — เปิดได้ที่ โปรไฟล์ → ความเป็นส่วนตัวและข้อมูล',

  // Privacy & data
  'Privacy & data': 'ความเป็นส่วนตัวและข้อมูล',
  'Kip’s AI, what’s saved, delete': 'AI ของ Kip · ข้อมูลที่จดไว้ · ลบ',
  'Your money stays yours': 'เรื่องเงินเป็นเรื่องส่วนตัว',
  'Only your account can see it. Encrypted on the way. Never sold.': 'มีแค่บัญชีตัวเองที่เห็น ส่งแบบเข้ารหัส และไม่มีวันขาย',
  'Kip’s AI': 'AI ของ Kip',
  'Let Kip read for me': 'ให้ Kip อ่านให้',
  'Talk to Kip, slips and finding slips. Sent to Anthropic, deleted in 30 days.': 'คุยกับ Kip อ่านสลิป และหาสลิป ส่งไปที่ Anthropic และลบภายใน 30 วัน',
  'Kip’s reading is off — nothing is sent to the AI.': 'ปิดการอ่านของ Kip แล้ว — ไม่มีอะไรส่งไปที่ AI',
  'Your data': 'ข้อมูลของฉัน',
  'Everything Kip saved': 'ทุกอย่างที่ Kip จดไว้',
  'See every entry · swipe to delete one': 'ดูทุกรายการ · ปัดเพื่อลบทีละรายการ',
  'The full version, in plain words': 'ฉบับเต็ม เขียนแบบอ่านง่าย',
  Questions: 'มีคำถาม',
  'Delete all spending & slips': 'ลบรายจ่ายและสลิปทั้งหมด',
  'Keeps your account, goals and plan': 'บัญชี เป้าหมาย และแผนยังอยู่ครบ',
  'Everything, for good': 'ลบทุกอย่างถาวร',
  'Delete all spending & slips?': 'ลบรายจ่ายและสลิปทั้งหมดเลยไหม?',
  'Every entry you saved — typed, from slips or from Kip — is deleted for good. Your account, goals and plan stay. This can’t be undone.':
    'ทุกรายการที่จดไว้ — ทั้งที่พิมพ์เอง จากสลิป หรือจาก Kip — จะถูกลบถาวร ส่วนบัญชี เป้าหมาย และแผนยังอยู่ ย้อนกลับไม่ได้นะ',
  'Keep them': 'เก็บไว้ก่อน',
  'All spending and slips are deleted.': 'ลบรายจ่ายและสลิปทั้งหมดแล้ว',
  'Couldn’t delete: {msg}': 'ลบไม่สำเร็จ: {msg}',

  // Everything Kip saved
  'Nothing saved yet.': 'ยังไม่มีอะไรจดไว้เลย',
  'Show older': 'ดูรายการเก่ากว่านี้',
  'Swipe left on any entry to delete it. Today’s money updates straight away.': 'ปัดซ้ายที่รายการไหนก็ได้เพื่อลบ เงินของวันนี้อัปเดตทันที',
  slip: 'สลิป',

  // Privacy policy
  'HeyKip · updated {date}': 'HeyKip · อัปเดต {date}',
  'What we keep': 'สิ่งที่เราเก็บ',
  'Your email, and the name and photo you add.': 'อีเมล และชื่อกับรูปที่ใส่เอง',
  'Your plan: pay, payday, rent, bills, budgets and goals.': 'แผนการเงิน: เงินเดือน วันเงินเดือนออก ค่าห้อง บิล งบ และเป้าหมาย',
  'What you log: amount, category, note, time — and for slips, who you paid and the slip’s reference number.': 'สิ่งที่จด: ยอดเงิน หมวด โน้ต เวลา — และถ้ามาจากสลิป ก็มีชื่อคนรับเงินกับเลขที่รายการ',
  'When you agreed to let Kip read for you.': 'เวลาที่กดอนุญาตให้ Kip อ่านให้',
  'What we never keep': 'สิ่งที่เราไม่เก็บเลย',
  'Slip pictures — they stay in your Photos.': 'รูปสลิป — ยังอยู่ในแอปรูปภาพในเครื่อง',
  'Your other photos, contacts, location or bank logins.': 'รูปอื่นๆ รายชื่อติดต่อ ตำแหน่ง หรือรหัสเข้าแอปธนาคาร',
  'Anything to sell. We don’t sell or share your data for ads.': 'ไม่เก็บไว้ขาย เราไม่ขายหรือแชร์ข้อมูลเพื่อโฆษณา',
  Why: 'เก็บไปทำไม',
  'To run your money plan and show your money — that’s the app you signed up for.': 'เพื่อทำแผนการเงินและแสดงเงินในแต่ละวัน — ซึ่งก็คือสิ่งที่แอปนี้ทำ',
  'Kip’s AI reading (Talk to Kip, slips) only with your Allow, and you can turn it off any time.': 'การอ่านด้วย AI ของ Kip (คุยกับ Kip, สลิป) ทำเฉพาะเมื่อกดอนุญาต และปิดได้ตลอด',
  'Who helps us': 'ใครช่วยเราบ้าง',
  'Supabase stores your account and data (servers in Singapore).': 'Supabase เก็บบัญชีและข้อมูล (เซิร์ฟเวอร์อยู่สิงคโปร์)',
  'Anthropic’s Claude AI reads what you send Kip, only when you allow it (servers in the USA). It deletes it within 30 days and doesn’t use it to train AI.':
    'Claude AI ของ Anthropic อ่านสิ่งที่ส่งให้ Kip เฉพาะเมื่ออนุญาต (เซิร์ฟเวอร์อยู่สหรัฐฯ) และลบภายใน 30 วัน ไม่เอาไปฝึก AI',
  'So your data does leave Thailand — both are bound to protect it.': 'ข้อมูลจึงถูกส่งออกนอกประเทศไทย — ทั้งสองบริษัทมีหน้าที่ต้องปกป้องข้อมูลนี้',
  'How long': 'เก็บนานแค่ไหน',
  'Until you delete it. Delete one entry, all spending, or your whole account any time in Profile → Privacy & data.':
    'จนกว่าจะลบเอง ลบทีละรายการ ลบรายจ่ายทั้งหมด หรือลบบัญชีได้ตลอดที่ โปรไฟล์ → ความเป็นส่วนตัวและข้อมูล',
  'Your rights': 'สิทธิ์ตามกฎหมาย',
  'Under Thailand’s PDPA you can see, correct, take a copy of, or delete your data, and take back your consent.':
    'ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) ขอดู แก้ไข ขอสำเนา หรือลบข้อมูล และถอนความยินยอมได้',
  'Ask us at {email}. You can also complain to the Personal Data Protection Committee (PDPC).': 'ติดต่อเราได้ที่ {email} หรือร้องเรียนไปที่สำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.)',
  'Keeping it safe': 'ดูแลให้ปลอดภัย',
  'Encrypted connections, and every row is locked to your own account.': 'ส่งข้อมูลแบบเข้ารหัส และทุกรายการล็อกไว้ให้เฉพาะเจ้าของบัญชี',
};

export default th;
