import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath:"/usr/bin/google-chrome", headless:"new", args:["--no-sandbox"] });
const now = Date.now();

// Shared browser context => shared localStorage (two tabs same browser)
const D = await b.newPage();  // driver tab
const P = await b.newPage();  // passenger tab

// Seed an ONLINE driver near Muscat, in the DRIVER tab, mode=driver
await D.goto("http://localhost:3330/taxi", { waitUntil:"networkidle0" });
await D.evaluate((now) => {
  const drv = { id:"drv_1", fullName:"Dan Driver", mobile:"+96891", vehicleType:"taxi", vehicleNumber:"123", status:"ONLINE", location:{lat:23.588,lng:58.3829}, lastSeen:now, activeRideId:null, createdAt:now };
  localStorage.setItem("omantaxi:drivers", JSON.stringify({ drv_1: drv }));
  localStorage.setItem("omantaxi:driver-session", JSON.stringify(drv));
  sessionStorage.setItem("omantaxi:mode","driver");
}, now);
await D.reload({ waitUntil:"networkidle0" });
await new Promise(r=>setTimeout(r,600));
let dtext = await D.evaluate(()=>document.body.innerText);
console.log("DRIVER online dashboard (Waiting/Incoming):", /Incoming requests|Waiting for ride/.test(dtext));

// Now simulate the passenger creating a REQUESTED ride near the driver by writing
// to the SHARED rides store from the passenger tab (this is what createRideRequest does).
await P.goto("http://localhost:3330/taxi", { waitUntil:"networkidle0" });
await P.evaluate((now) => {
  const ride = { id:"ride_1", passengerId:"psg_1", passengerName:"Pat", passengerMobile:"+96892", pickup:{lat:23.59,lng:58.385,address:"Pickup"}, destination:{lat:23.6,lng:58.40,address:"Dest"}, distanceKm:3, durationMin:7, fare:4, currency:"OMR", status:"REQUESTED", driverId:null, driverName:null, vehicleType:null, vehicleNumber:null, createdAt:now, updatedAt:now };
  const prev = JSON.parse(localStorage.getItem("omantaxi:rides")||"{}");
  prev["ride_1"] = ride;
  localStorage.setItem("omantaxi:rides", JSON.stringify(prev));
  // notify other tabs (BroadcastChannel like the store does)
  try { new BroadcastChannel("omantaxi").postMessage({ key:"rides" }); } catch {}
}, now);

await new Promise(r=>setTimeout(r,1500));
dtext = await D.evaluate(()=>document.body.innerText);
console.log("DRIVER sees the incoming request (Pat / Accept ride):", /Pat|Accept ride|Pickup/.test(dtext));

await b.close();
