"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {Readable}=require("node:stream");
const {createServer}=require("../src/web");
const ecosystem=require("../src/ecosystem");
const key="test-private-idle-key-"+"x".repeat(32),id="123456789012345678";
function invoke(server,{method="POST",path="/play",headers={},body="{}"}={}) {
  const request=Readable.from([Buffer.from(body)]);
  Object.assign(request,{method,url:path,headers});
  return new Promise(resolve=>{
    const response={writeHead(status,headers){this.status=status;this.headers=headers;},end(text){resolve({status:this.status,headers:this.headers,data:JSON.parse(text)});}};
    server.emit("request",request,response);
  });
}
test("private Idle HTTP boundary rejects missing credentials, malformed input and public paths",async()=>{
  const server=createServer({key,store:{},browser:{}});
  assert.equal((await invoke(server)).status,401);
  assert.equal((await invoke(server,{headers:{"x-idle-service-key":"é".repeat(key.length)}})).status,401);
  const headers={"x-idle-service-key":key};
  assert.equal((await invoke(server,{method:"GET",path:"/",headers})).status,404);
  for(const body of ["null","[]","bad-json",JSON.stringify({user:{id:"not-discord",username:"x"}})])
    assert.equal((await invoke(server,{headers,body})).status,400);
  assert.equal((await invoke(server,{headers,body:"x".repeat(24001)})).status,413);
});
test("private browser transport supplies one fresh membership snapshot without an entitlement write",async()=>{
  let calls=0;
  const account={available:true,membership:{tier:"inferno",name:"Prime"},rpg:null};
  const server=createServer({key,store:{pool:{}},browser:{async execute(pool,user,action,requestId){
    calls++; assert.equal(user.id,id);assert.equal(action.command,"mine");assert.equal(requestId,"test-receipt");
    assert.equal(await ecosystem.account(id),account);
    return {view:null,notices:["done"]};
  }}});
  const result=await ecosystem.withAccount(id,account,()=>invoke(server,{headers:{"x-idle-service-key":key},body:JSON.stringify({user:{id,username:"Test user"},action:{kind:"command",command:"mine"},requestId:"test-receipt"})}));
  assert.equal(result.status,200);assert.equal(result.data.account.membership.tier,"inferno");assert.equal(calls,1);
  assert.equal(result.headers["cache-control"],"no-store");
});
