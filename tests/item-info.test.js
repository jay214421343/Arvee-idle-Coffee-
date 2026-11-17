"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const { idle }=require("../src/commands"),ui=require("../src/ui"),{items,recipes}=require("../src/catalog");
const owner="123456789012345678";
test("/idle info supports any catalog item via autocomplete, without ownership",()=>{
  const cmd=idle.toJSON().options.find(o=>o.name==="info");
  assert.ok(cmd);
  assert.equal(cmd.options.find(o=>o.name==="item").required,true);
  assert.equal(cmd.options.find(o=>o.name==="item").autocomplete,true);
  for(const [id,item] of Object.entries(items)){
    const json=ui.itemInfo(owner,id,0).toJSON(),text=JSON.stringify(json);
    assert.equal(json.type,17);
    assert.ok(json.components.length<=10);
    assert.match(text,new RegExp(item.name.replace(/[.*+?^$\{\}()|[\]\\]/g,"\\$&").slice(0,6),"i"));
    assert.match(text,/0 owned/);
    assert.match(text,/FIELD NOTES/);
    assert.match(text,/ITEM ID/);
    assert.doesNotMatch(text,/"label":"Use item"/);
    if(recipes[id])assert.match(text,/FORGE RECIPE/);
  }
  assert.match(JSON.stringify(ui.itemInfo(owner,"rebirth_cocktail",1).toJSON()),/1 owned/);
  assert.throws(()=>ui.itemInfo(owner,"missing"),/Unknown item/);
});
