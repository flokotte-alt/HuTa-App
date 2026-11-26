-- Huta: Beispieldaten (erfundene Kunden und Hunde). Alles ist spaeter in der App aenderbar.
-- Wochentage: 1 = Montag ... 7 = Sonntag.
-- NICHT im echten Projekt ausfuehren: Dort liegen echte Stationen und Hunde.

do $$ begin
  if exists (select 1 from public.customers) then
    raise exception 'seed.sql ist nur fuer eine leere Datenbank gedacht';
  end if;
end $$;

insert into public.stations (label, address, lat, lng) values
  ('Hölderlinstraße 9', 'Hölderlinstraße 9, Dresden', 51.0488177, 13.6885685),
  ('Annenstraße 2', 'Annenstraße 2, Dresden', 51.0501147, 13.7316723),
  ('Jacobistraße 5', 'Jacobistraße 5, Dresden', 51.0488083, 13.7963416),
  ('Wasastraße 4', 'Wasastraße 4, Dresden', 51.0309167, 13.7573741),
  ('Heinrich-Schütz-Straße 18', 'Heinrich-Schütz-Straße 18, Dresden', 51.0454189, 13.8101223),
  ('Tolkewitzer Straße 70', 'Tolkewitzer Straße 70, Dresden', 51.0349783, 13.8227082);

insert into public.customers (email, name, phone) values
  ('kunde1@beispiel.test', 'Familie Beispiel', '0351 1110001'),
  ('kunde2@beispiel.test', 'Anna Muster', '0351 1110002'),
  ('kunde3@beispiel.test', 'Ben Probe', '0351 1110003'),
  ('kunde4@beispiel.test', 'Clara Test', '0351 1110004'),
  ('kunde5@beispiel.test', 'David Demo', '0351 1110005'),
  ('kunde6@beispiel.test', 'Eva Entwurf', '0351 1110006'),
  ('kunde7@beispiel.test', 'Felix Vorlage', '0351 1110007'),
  ('kunde8@beispiel.test', 'Greta Platzhalter', '0351 1110008');

-- Hunde: (Kunde Nr., Name, Wochentage, Stationsname, Uebergabe, Wohnungs-Knopf erlaubt)
create temp table seed_dogs (cust int, dname text, wd smallint[], st text, handover text, apt boolean);
insert into seed_dogs values
  (1,'Bello','{1,2,3,4,5}','Hölderlinstraße 9','station',false),
  (1,'Luna','{1,3,5}','Hölderlinstraße 9','station',false),
  (2,'Max','{2,4}','Annenstraße 2','station',false),
  (3,'Emma','{1,2,3,4,5}','Annenstraße 2','apartment',true),
  (4,'Rocky','{1,2,3}','Jacobistraße 5','station',false),
  (4,'Mila','{3,4,5}','Jacobistraße 5','station',false),
  (5,'Balu','{1,2,3,4,5}','Wasastraße 4','station',false),
  (6,'Lotta','{1,4}','Wasastraße 4','station',true),
  (6,'Finn','{2,3,4}','Heinrich-Schütz-Straße 18','station',false),
  (7,'Nala','{1,2,3,4,5}','Heinrich-Schütz-Straße 18','station',false),
  (7,'Charly','{1,2,3,4,5}',null,'self',false),
  (8,'Frieda','{2,5}','Tolkewitzer Straße 70','station',false);

insert into public.dogs (customer_id, name, weekdays, apartment_allowed, address)
select c.id, s.dname, s.wd, s.apt, 'Beispielstraße ' || s.cust || ', Dresden'
from seed_dogs s join public.customers c on c.email = 'kunde' || s.cust || '@beispiel.test';

insert into public.dog_rules (dog_id, period, handover, station_id)
select dg.id, p.period, s.handover, st.id
from seed_dogs s
join public.dogs dg on dg.name = s.dname
cross join (values ('morning'), ('afternoon')) as p(period)
left join public.stations st on st.label = s.st;

-- Wochenplan fuer diese und die naechste Woche, veroeffentlicht
insert into public.week_entries (dog_id, day, status, published)
select dg.id, g::date, 'registered', true
from public.dogs dg
cross join generate_series(date_trunc('week', public.today_de())::date,
                           date_trunc('week', public.today_de())::date + 13, interval '1 day') g
where extract(isodow from g)::int = any (dg.weekdays);

insert into public.closures (date_from, date_to, note)
values ('2026-12-24', '2027-01-01', 'Weihnachtspause (Beispiel)');
