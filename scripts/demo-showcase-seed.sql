-- Safe, deterministic, additive fictional showcase data for the existing Demo Elmina test tenant.
-- Run only in the dedicated development/test Supabase SQL editor after base account seeding.
-- It never creates real accounts, overwrites existing sites, or clears data.
DO $demo$
DECLARE t uuid; s uuid; f uuid; l uuid; z uuid; b uuid; r1 uuid; r2 uuid; v uuid;
        i int; guest_state text; ride_state text; created timestamptz; rec record; person uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM private.runtime_settings WHERE environment IN ('development','test') AND simulations_enabled) THEN
    RAISE EXCEPTION 'Showcase seeding restricted to development/test simulation';
  END IF;
  SELECT x.id INTO STRICT t FROM public.tenants x WHERE x.demo AND x.name LIKE 'Demo Elmina %';
  SELECT x.id INTO STRICT s FROM public.sites x WHERE x.tenant_id=t AND x.name='Demo Elmina Community Hub';
  SELECT user_id INTO STRICT r1 FROM public.memberships WHERE site_id=s AND role='RESIDENT' ORDER BY user_id LIMIT 1;
  SELECT user_id INTO STRICT r2 FROM public.memberships WHERE site_id=s AND role='RESIDENT' ORDER BY user_id DESC LIMIT 1;
  FOR rec IN SELECT * FROM (VALUES
    ('Elmina Central'),('East Garden'),('Lakeside Walk'),('Elmina Square'),('School Hub'),('Health Centre')
  ) AS x(name) LOOP
    INSERT INTO public.stops(id,tenant_id,site_id,name)
    VALUES(md5('amin-v2:stop:'||s::text||rec.name)::uuid,t,s,rec.name) ON CONFLICT DO NOTHING;
  END LOOP;
  INSERT INTO public.vehicles(id,tenant_id,site_id,name,capacity,accessible,shift_active) VALUES
    (md5('amin-v2:vehicle:a:'||s::text)::uuid,t,s,'Fictional Shuttle 02 · Garden Loop',12,true,false),
    (md5('amin-v2:vehicle:b:'||s::text)::uuid,t,s,'Fictional Shuttle 03 · Town Link',16,false,false),
    (md5('amin-v2:vehicle:c:'||s::text)::uuid,t,s,'Fictional Shuttle 04 · Accessible',8,true,false)
    ON CONFLICT DO NOTHING;
  FOR rec IN SELECT * FROM (VALUES
    ('Community Hub ↔ Mall',ARRAY['Community Hub','Demo Mall']::text[],450,1320,15),
    ('Garden Community Loop',ARRAY['Elmina Central','East Garden','Lakeside Walk','Elmina Square']::text[],420,1200,20),
    ('Town Services Link',ARRAY['Elmina Square','School Hub','Health Centre','Demo Mall']::text[],480,1140,30)
  ) AS x(name,stops,start_minute,end_minute,headway) LOOP
    INSERT INTO public.transport_routes(id,tenant_id,site_id,name,stop_names,start_minute,end_minute,headway_minutes,published)
    VALUES(md5('amin-v2:route:'||s::text||rec.name)::uuid,t,s,rec.name,rec.stops,rec.start_minute,rec.end_minute,rec.headway,true)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Sites, levels, zones and device bindings make the Parking UI fully navigable.
  f:=md5('amin-v2:facility:mall:'||s::text)::uuid;
  INSERT INTO public.parking_facilities(id,tenant_id,site_id,name,details)
    VALUES(f,t,s,'Fictional Elmina Community Mall','Fictional mall parking · simulator data, not real public availability')
    ON CONFLICT DO NOTHING;
  l:=md5('amin-v2:level:mall-p1:'||s::text)::uuid;
  INSERT INTO public.parking_levels(id,tenant_id,site_id,facility_id,name)
    VALUES(l,t,s,f,'P1 · Retail Parking') ON CONFLICT DO NOTHING;
  INSERT INTO public.parking_levels(id,tenant_id,site_id,facility_id,name)
    VALUES(md5('amin-v2:level:mall-p2:'||s::text)::uuid,t,s,f,'P2 · Extended Stay')
    ON CONFLICT DO NOTHING;
  f:=md5('amin-v2:facility:parkride:'||s::text)::uuid;
  INSERT INTO public.parking_facilities(id,tenant_id,site_id,name,details)
    VALUES(f,t,s,'Fictional Park & Ride Hub','Fictional community transport interchange · demo counts')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.parking_levels(id,tenant_id,site_id,facility_id,name)
    VALUES(md5('amin-v2:level:parkride-g:'||s::text)::uuid,t,s,f,'Ground Level')
    ON CONFLICT DO NOTHING;

  FOR rec IN SELECT * FROM (VALUES
    ('Retail North · Zone B',140,93,'mall-p1'),
    ('Retail South · Zone C',96,52,'mall-p1'),
    ('Retail P2 · Zone D',180,109,'mall-p2'),
    ('Park & Ride · Zone A',64,29,'parkride-g')
  ) AS x(name,capacity,occupied,levelkey) LOOP
    z:=md5('amin-v2:zone:'||s::text||rec.name)::uuid;
    INSERT INTO public.parking_zones(id,tenant_id,site_id,name,capacity,occupied,observed_at,simulated,kind,source,level_id)
    VALUES(z,t,s,rec.name,rec.capacity,rec.occupied,now(),true,'counter','counter',
        md5('amin-v2:level:'||rec.levelkey||':'||s::text)::uuid)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.iot_devices(id,tenant_id,site_id,zone_id,active)
    VALUES(md5('amin-v2:counter-device:'||s::text||rec.name)::uuid,t,s,z,true)
    ON CONFLICT DO NOTHING;
  END LOOP;
  -- Attach the original base-seed counter to a facility without resetting it.
  UPDATE public.parking_zones SET level_id=l WHERE site_id=s AND name='Demo Mall - Level 1 - Zone A' AND level_id IS NULL;
  z:=md5('amin-v2:zone:smart-bays:'||s::text)::uuid;
  INSERT INTO public.parking_zones(id,tenant_id,site_id,name,capacity,level_id,kind)
    VALUES(z,t,s,'Premium Bays · Sensor Demo',10,l,'bay') ON CONFLICT DO NOTHING;
  FOR i IN 1..10 LOOP
    b:=md5('amin-v2:bay:'||s::text||i::text)::uuid;
    INSERT INTO public.parking_bays(id,tenant_id,site_id,zone_id,label,accessible,status,observed_at,simulated)
    VALUES(b,t,s,z,'P1-'||lpad(i::text,2,'0'),i IN (1,2),
      CASE WHEN i IN (1,4,7,9) THEN 'FREE' WHEN i=10 THEN 'OUT_OF_SERVICE'
       WHEN i=8 THEN 'UNKNOWN' ELSE 'OCCUPIED' END,
      CASE WHEN i=8 THEN NULL ELSE now() END,i<>8)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.iot_devices(id,tenant_id,site_id,zone_id,bay_id,active)
    VALUES(md5('amin-v2:bay-device:'||s::text||i::text)::uuid,t,s,z,b,true)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Historical fictional registrations. Synthetic hashes are NOT real invitation tokens.
  FOR i IN 1..15 LOOP
    v:=md5('amin-v2:invitation:'||s::text||i::text)::uuid;
    person:=CASE WHEN i%2=0 THEN r1 ELSE r2 END;
    created:=now()-make_interval(hours=>i*2);
    guest_state:=CASE WHEN i%5=0 THEN 'onsite' WHEN i%4=0 THEN 'pending_entry' ELSE 'departed' END;
    INSERT INTO public.invitations(id,tenant_id,site_id,owner_id,token_hash,expires_at,redeemed_at,created_at)
    VALUES(v,t,s,person,md5('fictional-nonredeemable-demo-token:'||s::text||i::text),
      created+interval '1 day',created+interval '4 minutes',created)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.visits(id,tenant_id,site_id,invitation_id,owner_id,guest_name,status,created_at,entered_at,exited_at)
    VALUES(md5('amin-v2:visit:'||s::text||i::text)::uuid,t,s,v,person,
      (ARRAY['Aina Farah','Daniel Tan','Priya Kumar','Haziq Amir','Mei Lin',
             'Arjun Raj','Sofia Lee','Adam Hakim','Nadia Yusuf','Jason Wong',
             'Maya Devi','Amir Danish','Chloe Lim','Sara Iman','Zara Nabil'])[i]||' · Demo',
      guest_state,created,
      CASE WHEN guest_state='pending_entry' THEN NULL ELSE created+interval '12 minutes' END,
      CASE WHEN guest_state='departed' THEN created+interval '65 minutes' ELSE NULL END)
    ON CONFLICT DO NOTHING;
  END LOOP;
  FOR i IN 1..21 LOOP
    v:=md5('amin-v2:ride:'||s::text||i::text)::uuid;
    ride_state:=CASE WHEN i IN (1,2,3,4) THEN 'requested'
      WHEN i%7=0 THEN 'cancelled' ELSE 'completed' END;
    created:=now()-make_interval(hours=>i);
    person:=CASE WHEN i%2=0 THEN r1 ELSE r2 END;
    INSERT INTO public.rides(id,tenant_id,site_id,resident_id,pickup,destination,
        accessible,status,created_at,updated_at,assigned_at,boarded_at,completed_at,cancelled_at)
    VALUES(v,t,s,person,
      (ARRAY['Community Hub','Demo Mall','East Garden','Elmina Central','Lakeside Walk','School Hub'])[1+(i%6)],
      (ARRAY['Elmina Square','Health Centre','Demo Mall','Lakeside Walk','Community Hub','Elmina Central'])[1+(i%6)],
      i%8=0,ride_state,created,
      CASE WHEN ride_state='requested' THEN created ELSE created+interval '25 minutes' END,
      CASE WHEN ride_state='completed' THEN created+interval '4 minutes' ELSE NULL END,
      CASE WHEN ride_state='completed' THEN created+interval '10 minutes' ELSE NULL END,
      CASE WHEN ride_state='completed' THEN created+interval '25 minutes' ELSE NULL END,
      CASE WHEN ride_state='cancelled' THEN created+interval '5 minutes' ELSE NULL END)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $demo$;
