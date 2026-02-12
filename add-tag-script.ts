import { createClient } from '@supabase/supabase-js';
import type { Database } from './src/integrations/supabase/types';

const SUPABASE_URL = "https://chxphfcpehxshvijqtlf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoeHBoZmNwZWh4c2h2aWpxdGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTA5MzAsImV4cCI6MjA3ODg2NjkzMH0.NqtDrpd-lKHh11bxtjshs2o6eHl5sDdVImnsW8t1OhU";

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function findRouteAndAddTag() {
  // 1. Find route with title "test"
  const { data: routes, error: routeError } = await supabase
    .from('routes')
    .select('*')
    .eq('title', 'test');

  if (routeError) {
    console.error('Error finding route:', routeError);
    return;
  }

  if (!routes || routes.length === 0) {
    console.log('No route found with title "test"');
    return;
  }

  console.log(`Found ${routes.length} route(s) with title "test":`);
  routes.forEach((route, i) => {
    console.log(`\n${i + 1}. Route ID: ${route.id}`);
    console.log(`   User ID: ${route.user_id}`);
    console.log(`   Status: ${route.status}`);
    console.log(`   Description: ${route.description || 'N/A'}`);
  });

  // 2. Get pins for the first matching route
  const routeId = routes[0].id;
  const { data: pins, error: pinError } = await supabase
    .from('pins')
    .select('*')
    .eq('route_id', routeId)
    .order('pin_order');

  if (pinError) {
    console.error('Error finding pins:', pinError);
    return;
  }

  if (!pins || pins.length === 0) {
    console.log('\nNo pins found in this route');
    return;
  }

  console.log(`\n\nFound ${pins.length} pin(s) in this route:`);
  pins.forEach((pin, i) => {
    console.log(`\n${i + 1}. ${pin.place_name}`);
    console.log(`   Pin ID: ${pin.id}`);
    console.log(`   Current tags: ${pin.tags ? pin.tags.join(', ') : 'None'}`);
    console.log(`   Address: ${pin.address}`);
  });

  // 3. Add tag "nowy-tag" to the first pin as example
  // Uncomment the following lines to actually add the tag:

  /*
  const firstPin = pins[0];
  const newTags = [...(firstPin.tags || []), 'nowy-tag'];

  const { error: updateError } = await supabase
    .from('pins')
    .update({ tags: newTags })
    .eq('id', firstPin.id);

  if (updateError) {
    console.error('Error updating pin:', updateError);
    return;
  }

  console.log(`\n✓ Successfully added tag "nowy-tag" to pin: ${firstPin.place_name}`);
  */

  console.log('\n\nTo add a tag, uncomment the update code in the script.');
}

findRouteAndAddTag();
