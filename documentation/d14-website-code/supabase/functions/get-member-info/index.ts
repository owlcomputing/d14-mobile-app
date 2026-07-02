import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";


const SupabaseUrl = Deno.env.get('SUPABASE_URL')!;
const SupabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SupabaseClient = createClient(SupabaseUrl, SupabaseServiceKey);

// Shared secret for integration partners (LiveLaps). Gateway JWT verification
// is disabled for this function (see config.toml), so this header check is the
// only thing gating access to member data.
const MemberInfoApiKey = Deno.env.get('MEMBER_INFO_API_KEY');


Deno.serve(async (req)=>{
  if (!MemberInfoApiKey || req.headers.get('x-api-key') !== MemberInfoApiKey) {
    return new Response(JSON.stringify({
      error: "Invalid or missing x-api-key header"
    }), {
      status: 401,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  const url = new URL(req.url);
  const amaNumber = url.searchParams.get("ama_number");
  const d14Number = url.searchParams.get("d14_number");

  if (!amaNumber && !d14Number) {
    return new Response(JSON.stringify({
      error: "At least one of ama_number or d14_number is required"
    }), {
      status: 400,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  try {
    let query = SupabaseClient.from("profiles").select("*");
    if (amaNumber) {
      query = query.eq("ama_number", amaNumber);
    } else if (d14Number) {
      query = query.eq("d14_number", d14Number);
    }
    const { data: profiles, error: profileError } = await query;
    if (profileError) throw profileError;

    const { data: memberships, error: membershipError } = await SupabaseClient.from("memberships").select("*").in("profile_id", profiles.map((profile)=>profile.id));
    if (membershipError) throw membershipError;
    
    return new Response(JSON.stringify({
      profiles,
      memberships
    }), {
      headers: {
        "Content-Type": "application/json"
      },
      status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
