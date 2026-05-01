alter table business_profiles
  add column if not exists color_badge   text default null,
  add column if not exists color_card_bg text default null,
  add column if not exists color_button  text default null;
