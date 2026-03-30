
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { listing, applicant, role, applicant_discord } = await req.json()

    const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN')
    const DISCORD_CHANNEL_ID = Deno.env.get('DISCORD_CHANNEL_ID')

    const channelMessage = `🚀 **New Crew Application!**\n\n` +
      `**Ship:** ${listing.ship}\n` +
      `**Mission:** ${listing.mission}\n` +
      `**Posted by:** ${listing.owner}\n` +
      `**Applicant:** ${applicant}\n` +
      `**Role:** ${role}\n` +
      `**Applicant Discord:** @${applicant_discord}\n\n` +
      `Hey **${listing.owner}** — someone wants to crew up! Add **@${applicant_discord}** on Discord to connect.`

    // Post to channel
    await fetch(`https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: channelMessage }),
    })

    // Send DM to owner if they provided their Discord username
    let dmResult = null
    if (listing.owner_discord) {
      // First find the user by username to get their ID
      const userSearch = await fetch(`https://discord.com/api/v10/guilds/${Deno.env.get('DISCORD_GUILD_ID')}/members/search?query=${encodeURIComponent(listing.owner_discord)}&limit=1`, {
        headers: {
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        }
      })
      const members = await userSearch.json()

      if (members && members.length > 0) {
        const userId = members[0].user.id

        // Create DM channel
        const dmChannel = await fetch('https://discord.com/api/v10/users/@me/channels', {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ recipient_id: userId })
        })
        const dmChannelData = await dmChannel.json()

        if (dmChannelData.id) {
          // Send DM
          const dmMessage = `🚀 **Someone wants to join your crew!**\n\n` +
            `**Ship:** ${listing.ship}\n` +
            `**Mission:** ${listing.mission}\n` +
            `**Applicant:** ${applicant}\n` +
            `**Role they want:** ${role}\n` +
            `**Their Discord:** @${applicant_discord}\n\n` +
            `Add them on Discord to crew up!`

          const dmRes = await fetch(`https://discord.com/api/v10/channels/${dmChannelData.id}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: dmMessage })
          })
          dmResult = await dmRes.json()
        }
      }
    }

    return new Response(JSON.stringify({ success: true, dm: dmResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})