"use strict";
// No entitlement copies and no retroactive passive-income boosts. Resolve active
// membership at each committed mining/daily reward using the ARVEE authority.
function benefits(account,cosmetics=[],now=Date.now()){
 const member=account?.available===true?account.membership:null;
 const active=!!member&&(!member.expiresAt||Number(member.expiresAt)>now);
 const raw=Number(member?.idle?.miningPercent);
 const premiumPercent=active&&Number.isFinite(raw)?Math.min(10,Math.max(0,Math.trunc(raw))):0;
 const crossGamePercent=cosmetics.some(c=>(typeof c==='string'?c:c.id)==='realm_traveler')?2:0;
 const boost=account?.available===true?account.sharedBoost:null;
 const communityPercent=boost&&Number(boost.expiresAt)>now&&Number.isFinite(Number(boost.percent))?Math.min(25,Math.max(0,Math.trunc(Number(boost.percent)))):0;
 const multiplier=Math.min(1.4,(1+premiumPercent/100)*(1+crossGamePercent/100)*(1+communityPercent/100));
 return {premiumPercent,crossGamePercent,communityPercent,multiplier:multiplier.toFixed(6),totalPercent:Math.round((multiplier-1)*10000)/100,
  sources:[...(premiumPercent?[`${member.name}: +${premiumPercent}%`]:[]),...(crossGamePercent?['Realm Traveler: +2%']:[]),...(communityPercent?[`${boost.name||'Community boost'}: +${communityPercent}%`]:[])],communityExpiresAt:communityPercent?Number(boost.expiresAt):null};
}
module.exports={benefits};
