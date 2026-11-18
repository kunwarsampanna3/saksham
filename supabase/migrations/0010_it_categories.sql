-- IT categories (Saksham features IT students first; all trades stay).
insert into price_table (category, label_en, label_ne, unit, low, high, per_day, online) values
  ('coding', 'Programming & apps', 'प्रोग्रामिङ र एप', 'project', 10000, 60000, 4000, true),
  ('it-support', 'Computer & IT support', 'कम्प्युटर र IT सहयोग', 'visit', 600, 3500, 2500, false),
  ('digital-marketing', 'Social media & marketing', 'सोसल मिडिया र मार्केटिङ', 'project', 3000, 20000, 2000, true)
on conflict (category) do nothing;
