-- Example price table (NPR). Generated from src/lib/pricing.ts; edit in /admin.
insert into price_table (category, label_en, label_ne, unit, low, high, per_day, online) values
  ('tailoring', 'Tailoring & alterations', 'सिलाइ र मर्मत', 'item', 600, 2500, 1800, false),
  ('tutoring', 'Tutoring', 'ट्युसन', 'session', 500, 1500, 1500, true),
  ('phone-repair', 'Phone & laptop repair', 'फोन र ल्यापटप मर्मत', 'device', 800, 6000, 3000, false),
  ('web-design', 'Websites & design', 'वेबसाइट र डिजाइन', 'project', 8000, 45000, 4000, true),
  ('electrician', 'Electrician', 'बिजुली मिस्त्री', 'visit', 700, 4000, 3500, false),
  ('plumbing', 'Plumbing', 'प्लम्बिङ', 'visit', 700, 4500, 3500, false),
  ('cleaning', 'Home cleaning', 'घर सफाइ', 'visit', 1200, 5000, 2500, false),
  ('moving', 'Moving & delivery', 'सामान सार्ने', 'trip', 1500, 9000, 6000, false),
  ('photography', 'Photo & video', 'फोटो र भिडियो', 'event', 4000, 25000, 12000, false),
  ('translation', 'Writing & translation', 'लेखन र अनुवाद', 'page', 400, 1500, 3000, true),
  ('beauty', 'Beauty & mehendi', 'ब्युटी र मेहन्दी', 'visit', 1000, 8000, 6000, false),
  ('elder-care', 'Care & errands for family', 'परिवारको हेरचाह र काम', 'day', 1200, 3500, 2500, false),
  ('other', 'Other', 'अन्य', 'job', 1000, 6000, 3000, false)
on conflict (category) do update set label_en = excluded.label_en, label_ne = excluded.label_ne, unit = excluded.unit,
  low = excluded.low, high = excluded.high, per_day = excluded.per_day, online = excluded.online;
