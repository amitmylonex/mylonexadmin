import {test} from 'node:test';
import assert from 'node:assert/strict';
import {list} from '../src/modules/suppliers/supplier.service.js';
const id='11111111-1111-4111-8111-111111111111';
test('manual route picker excludes RFQ matches across every page while retaining approved search scope',async()=>{
 let where:any;
 const storage:any={list:async(filter:any,page:number,size:number)=>{where=filter;assert.equal(page,1);assert.equal(size,25);return {suppliers:[]};}};
 await list({status:'APPROVED',search:'Amit',pageSize:25,unmatchedForRfq:id},storage);
 assert.equal(where.status,'APPROVED');assert.deepEqual(where.communicationRequestMatches,{none:{communicationRequestId:id}});assert.ok(where.AND[0].OR.some((r:any)=>r.companyName?.contains==='Amit'));
});
test('normal supplier directory queries remain unchanged; malformed RFQ exclusions are rejected',async()=>{
 const storage:any={list:async(where:any)=>{assert.equal(where.communicationRequestMatches,undefined);return {suppliers:[]};}};
 await list({status:'APPROVED'},storage);
 await assert.rejects(list({status:'APPROVED',unmatchedForRfq:'invalid'},storage));
});
