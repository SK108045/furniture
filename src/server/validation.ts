import { HttpError } from './http';
import {loadCatalogue} from './catalogue';
export function clean(value: unknown, label: string, max: number, optional = false) {
  if (typeof value !== 'string' || value.trim().length > max || (!optional && !value.trim())) throw new HttpError(400, `Please enter a valid ${label}.`);
  return value.trim();
}
export function phoneNumber(value: unknown) {
  const phone = clean(value, 'M-Pesa number', 30).replace(/[\s()-]/g, '');
  if (!/^(?:\+?254|0)[17]\d{8}$/.test(phone)) throw new HttpError(400, 'Enter a Kenyan mobile number, for example 0712345678.');
  return phone.replace(/^(?:\+?254|0)/, '0');
}
export function customerDetails(input: any) {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'Please add your delivery details.');
  const delivery = input.delivery;
  if (!['pickup', 'delivery'].includes(delivery)) throw new HttpError(400, 'Choose pickup or delivery.');
  return {
    firstName: clean(input.firstName, 'first name', 60), lastName: clean(input.lastName, 'last name', 60),
    phone: phoneNumber(input.phone), contactPhone: phoneNumber(input.contactPhone || input.phone), delivery,
    address: delivery === 'pickup' ? '' : clean(input.address, 'delivery address', 400),
    note: clean(input.note || '', 'delivery instructions', 300, true),
  };
}
export async function orderInput(input: any) {
  const products=await loadCatalogue();
  if (!input || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > products.length) throw new HttpError(400, 'Add a piece to your bag first.');
  const seen = new Set<number>();
  const items = input.items.map((item: any) => {
    const product = products.find(p => p.id === item?.id);
    if (!product || product.quoteOnly || seen.has(product.id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20 || (product.testOnly && (item.quantity!==1 || input.items.length!==1))) throw new HttpError(400, 'Choose priced furniture, or check out the test item on its own with quantity one.');
    seen.add(product.id);
    return {id: product.id, name: product.name, image: product.image, price: product.price, quantity: item.quantity};
  }).sort((a: any,b: any) => a.id - b.id);
  const total = items.reduce((sum: number,item: any) => sum + item.price * item.quantity, 0);
  if (!Number.isSafeInteger(total) || total > 150000) throw new HttpError(400, 'For orders above KSh 150,000, please contact the shop to arrange payment.');
  return {items, total, customer: customerDetails(input.customer)};
}
