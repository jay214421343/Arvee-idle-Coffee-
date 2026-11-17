"use strict";
const store=require("./tutorial-store");
const ui=require("./ui");
// Runs before the usual slash dispatcher, but never affects /admin,
// autocomplete, buttons, other commands or the player's game economy.
async function routeTutorial(interaction,respond) {
  if(!interaction.isChatInputCommand?.()||interaction.commandName!=="idle")
    return respond(interaction);
  await interaction.deferReply();
  try {
    const group=interaction.options.getSubcommandGroup(false);
    const command=interaction.options.getSubcommand();
    if(group==="account"&&command==="tutorial"){
      const status=await store.restart(interaction.user.id);
      await interaction.editReply({content:null,embeds:[],...ui.payload(ui.tutorialStep(interaction.user.id,Number(status.step)))});
      return true;
    }
    if(await store.startIfNew(interaction.user.id)){
      await interaction.editReply({content:null,embeds:[],...ui.payload(ui.tutorialStep(interaction.user.id,0))});
      return true;
    }
  }catch(error) {
    console.error("[ARVEE Idle tutorial]",error);
    // Never swallow an onboarding database error and silently run a money or
    // item action while the player's tutorial state is unknown.
    await interaction.editReply({content:null,embeds:[],...ui.payload(ui.message(
      "Guide unavailable","Could not check your first-play status. Please retry.",interaction.user.id,{color:ui.ERROR}
    ))}).catch(console.error);
    return true;
  }
  return respond(interaction);
}
module.exports={routeTutorial};
