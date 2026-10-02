import {products as originalProducts, type Product} from '../data/products';
export {money, productImage} from '../data/products';
// The server supplies the same live catalogue used to render this page. The
// array is request-specific and contains no server keys or admin metadata.
export const products:Product[] = (()=>{
  const data=document.getElementById('nicoo-catalogue')?.textContent;
  if(data)try {const parsed=JSON.parse(data);if(Array.isArray(parsed))return parsed;}catch{}
  return originalProducts;
})();
