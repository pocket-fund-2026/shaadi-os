import { db, one, run } from './db.ts';
const V: [string,string,string,string,number,string][] = [
['Pixel Baraat Studios','photographer','Mumbai','Andheri',85000,'Candid wedding stories, Hindi & Marathi'],
['Frames by Aarav','photographer','Pune','Koregaon Park',65000,'South Indian & Maharashtrian weddings'],
['Glow by Simran','makeup','Mumbai','Bandra',25000,'HD & airbrush bridal makeup'],
['Rang Mehndi Art','mehndi','Pune','Kothrud',8000,'Bridal & guest mehndi'],
['Mandap Dreams Decor','decor','Mumbai','Powai',200000,'Floral mandaps and sangeet stages'],
['Royal Lawns','venue','Pune','Wagholi',300000,'Lawn for 800 guests, veg only'],
['Sea Breeze Banquet','venue','Mumbai','Juhu',450000,'AC banquet, 400 guests'],
['Spice Route Caterers','caterer','Pune','Baner',900,'Per plate, multi-cuisine'],
['DJ Rohan Live','dj','Mumbai','Malad',40000,'DJ, dhol and sound'],
['Pandit Sharma Ji','pandit','Pune','Camp',11000,'Vedic wedding rituals'],
['Lens & Lehenga','photographer','Nashik','College Rd',45000,'Tier-2 city specialist, travels'],
['Bridal Bloom Makeup','makeup','Nagpur','Dharampeth',18000,'Bridal makeup, Hindi/Marathi'],
];
export function seed(){
  if(one('SELECT 1 x FROM vendors')) return;
  V.forEach((v,i)=>{
    const u=run('INSERT INTO users(phone,name,role) VALUES(?,?,?)',`900000${String(i+1).padStart(4,'0')}`,v[0],'vendor');
    run('INSERT INTO vendors(user_id,name,category,city,locality,start_paise,description,languages,verified,travels) VALUES(?,?,?,?,?,?,?,?,?,?)',
      Number(u.lastInsertRowid),v[0],v[1],v[2],v[3],v[4]*100,v[5],'en,hi,mr',1,i%3===0?1:0);
  });
}
if (process.argv[1]?.endsWith('seed.ts')) { seed(); console.log('seeded'); }
