const catalogue = [
 {id:1,name:'Ergo Executive Chair',category:'Seating',price:18499,image:'1.jpg',tag:'Everyday comfort',description:'A high-back office chair with a padded headrest, upholstered seat and polished base.'},
 {id:2,name:'Studio Desk',category:'Desks',price:16500,image:'2.jpg',tag:'A fresh perspective',description:'A clean white desktop with contrasting legs for a light, uncluttered workspace. Desk only; chair shown for styling.'},
 {id:3,name:'Compact Work Desk',category:'Desks',price:14000,image:'3.jpg',tag:'Small space, big ideas',description:'A compact desk with integrated storage, ready for a dedicated corner of your home.'},
 {id:4,name:'The Workday Set',category:'Workspace sets',price:32500,image:'4.jpg',tag:'Better together',description:'A coordinated workspace with a white desk, mobile drawer unit and office chair.'},
 {id:5,name:'Oakline Storage Desk',category:'Desks',price:16500,image:'5.jpg',tag:'Room for everything',description:'A warm wood-look desktop paired with drawers to keep your daily essentials close.'},
 {id:6,name:'Crossframe Desk',category:'Desks',price:15000,image:'6.jpg',tag:'A modern classic',description:'A warm wood-look surface with a crisp white cross-frame base. Desk only; chairs shown for styling.'},
 {id:7,name:'The Executive Chair',category:'Seating',price:25000,image:'7.jpg',tag:'The executive edit',description:'Generous cushioning, a tall supportive back and rich wood-tone accents. A statement seat for your working day.'},
 {id:8,name:'Trio Waiting Bench',category:'Seating',price:13500,image:'8.jpg',tag:'A warm welcome',description:'Three connected seats with a polished metal finish, designed for reception and waiting areas.'},
 {id:9,name:'Director’s Corner Desk',category:'Desks',price:36500,image:'9.jpg',tag:'Think bigger',description:'An expansive corner workspace with a rich wood-tone finish and room to spread out.'},
 {id:10,name:'Air Mesh Chair',category:'Seating',price:7500,image:'10.jpg',tag:'Lighten your workday',description:'A breathable mesh back, curved armrests and a wheeled base for an easy everyday seat.'},
];
// Photo prices are the selling prices. Reference prices sit above them;
// never apply another discount to the amounts supplied by the shop.
export const products = catalogue.map(p => {
  const originalPrice = Math.ceil(p.price / 0.9 / 500) * 500;
  return {...p, originalPrice, onSale: true, featuredOffer: [5,7,10].includes(p.id),
    savings: originalPrice - p.price, discountPercent: Math.floor((originalPrice - p.price) / originalPrice * 100)};
});
export const money = (amount:number) => `KSh ${amount.toLocaleString('en-KE')}`;
