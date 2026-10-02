/// <reference types="astro/client" />
declare namespace App {
  interface Locals { nicooCatalogue?: Promise<import('./data/products').Product[]>; }
}
