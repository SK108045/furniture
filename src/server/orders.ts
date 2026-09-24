import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {database, query, rpc} from './database';
import {HttpError} from './http';
import {orderInput, customerDetails, phoneNumber} from './validation';
export type OrderStatus = 'draft'|'cancelled'|'requesting'|'pending'|'uncertain'|'failed'|'paid';
export type OrderRow = {id:string;user_id:string;idempotency_key:string;fingerprint:string;created_at:string;updated_at:string;status:OrderStatus;total:number;details:any;provider_id:string|null;receipt:string|null;payment_note:string|null;version:number};
export const publicOrder = (row:OrderRow) => ({...row.details,id:row.id,createdAt:row.created_at,updatedAt:row.updated_at,version:row.version,status:row.status,total:row.total,receipt:row.receipt,paymentNote:row.payment_note});
export async function getOrder(id:string,userId:string) {
  const rows=await database<OrderRow[]>(`nicoo_orders?${query({id:`eq.${id}`,user_id:`eq.${userId}`,limit:'1'})}`);
  if(!rows[0])throw new HttpError(404,'Order not found.');
  return rows[0];
}
export async function listOrders(userId:string) {
  const all:OrderRow[]=[];
  for(let offset=0;;offset+=500){
    const rows=await database<OrderRow[]>(`nicoo_orders?${query({user_id:`eq.${userId}`,order:'created_at.desc,id.desc',limit:'500',offset:String(offset)})}`);
    all.push(...rows);if(rows.length<500)return all;
  }
}
function newId(){return `NF-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${randomBytes(4).toString('hex').toUpperCase()}`;}
function record(details:any,label:string){return {...details,history:[...(details.history||[]),{at:new Date().toISOString(),label}].slice(-50)};}
function mutate(action:string,userId:string,id:string,version:unknown,data:any={}){
  if(version!==null&&!Number.isInteger(version))throw new HttpError(400,'A valid order version is required.');
  return rpc<{row:OrderRow;created:boolean;claimed:boolean}>('nicoo_mutate_order',{p_action:action,p_user_id:userId,p_id:id,p_version:version,p_data:data});
}
export function createOrder(userId:string,key:string,input:ReturnType<typeof orderInput>,email:string,draft=false){
  return mutate('create',userId,newId(),null,{key,fingerprint:createHash('sha256').update(JSON.stringify(input)).digest('hex'),status:draft?'draft':'requesting',total:input.total,details:record({...input,email,...(!draft?{paymentPhone:input.customer.phone}:{})},draft?'Draft saved from checkout':'Order placed')});
}
export async function editOrder(id:string,userId:string,input:any){
  const row=await getOrder(id,userId);let details=row.details,total=row.total;
  const customer=customerDetails(input.customer);
  if(row.status==='draft'){const priced=orderInput({items:input.items,customer});details={...details,...priced};total=priced.total;}
  else {if(input.items)throw new HttpError(409,'Items are fixed after a payment request.');details={...details,paymentPhone:details.paymentPhone||details.customer.phone,customer:{...customer,phone:details.customer.phone}};}
  return (await mutate('edit',userId,id,input.version,{total,details:record(details,row.status==='draft'?'Draft updated':'Delivery details updated')})).row;
}
export async function copyToDraft(id:string,userId:string,version:unknown){
  const source=await getOrder(id,userId),priced=orderInput(source.details);
  return (await mutate('copy',userId,id,version,{id:newId(),key:randomUUID(),total:priced.total,details:record({...priced,email:source.details.email,sourceOrderId:id},`Draft created from ${id}`)})).row;
}
export async function cancelDraft(id:string,userId:string,version:unknown){
  const row=await getOrder(id,userId);
  return (await mutate('cancel',userId,id,version,{details:record(row.details,'Draft cancelled')})).row;
}
export async function claimDraftPayment(id:string,userId:string,version:unknown,phone:unknown,email:string){
  const row=await getOrder(id,userId);
  if(['requesting','pending','uncertain','paid','failed'].includes(row.status))return {row,claimed:false};
  const priced=orderInput(row.details);
  if(priced.total!==row.total)throw new HttpError(409,'Prices have changed. Save your draft again to see the current total.');
  const paymentPhone=phoneNumber(phone);
  return mutate('pay',userId,id,version,{details:record({...row.details,email,paymentPhone,customer:{...row.details.customer,phone:paymentPhone}},'M-Pesa payment requested')});
}
export async function updatePayment(id:string,status:OrderStatus,providerId:string|null,note:string){
  await rpc('nicoo_payment_result',{p_id:id,p_status:status,p_provider_id:providerId,p_note:note});
}
