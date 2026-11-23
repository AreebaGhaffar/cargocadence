insert into public.truck_types (name, base_fee, rate_per_mile, max_weight_lbs) values
  ('Box Truck', 150.00, 2.50, 10000),
  ('Dry Van', 250.00, 2.90, 45000),
  ('Flatbed', 300.00, 3.20, 48000),
  ('Refrigerated', 350.00, 3.60, 42000);

insert into public.surcharges (name, kind, amount) values
  ('Fuel surcharge', 'percent', 8.00),
  ('Liftgate service', 'flat', 75.00),
  ('Weekend pickup', 'flat', 100.00);