const SUPABASE_URL = "https://rsogerenyorczxbpyzmb.supabase.co";
const SUPABASE_KEY = "sb_publishable_gd-5K8F8H48YIYM1XKIkVQ_Yu5qwdvI";

window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CREATE_CHECKOUT_URL =
"https://rsogerenyorczxbpyzmb.supabase.co/functions/v1/create-checkout";

const WAITLIST_PRICE_ID =
"price_1T9sZp2UkFduvWwcyM2KRwjl";

document.addEventListener("DOMContentLoaded", () => {

const form = document.getElementById("waitlistForm");
const message = document.getElementById("message");

function setMsg(text){
message.textContent = text || "";
}

form.addEventListener("submit", async (e) => {

e.preventDefault();

const fullName =
document.getElementById("fullName").value.trim();

const email =
document.getElementById("email").value.trim();

const confirmEmail =
document.getElementById("confirmEmail").value.trim();

const phone =
document.getElementById("phone").value.trim();

if(!fullName || !email || !confirmEmail || !phone){

setMsg("Please complete all fields.");
return;

}

if(email.toLowerCase() !== confirmEmail.toLowerCase()){

setMsg("Email and Confirm Email do not match.");
return;

}

setMsg("Starting checkout...");

try{

const res = await fetch(CREATE_CHECKOUT_URL,{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

source:"waitlist",

training_type:"inperson",

full_name:fullName,

email:email,

phone:phone,

price_id:WAITLIST_PRICE_ID,

mode:"payment",

success_path:"/inperson-waitlist.html?paid=1",

cancel_path:"/inperson-waitlist.html"

})

});

const raw = await res.text();

let result = {};

try{

result = raw ? JSON.parse(raw) : {};

}catch{

result = { error: raw };

}

if(!res.ok){

setMsg(result.error || "Could not start payment.");
return;

}

if(!result.url){

setMsg("Could not start payment.");
return;

}

window.location.href = result.url;

}catch(err){

setMsg(err?.message || "Could not start payment.");

}

});

});